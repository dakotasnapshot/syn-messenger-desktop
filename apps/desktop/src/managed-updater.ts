/* Copyright 2026 Hawthorn LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { app } from "electron";
import fs from "node:fs/promises";
import { constants, createWriteStream } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { authenticateRelease, newerVersion, shellQuote, windowsArgument, MANAGED_UPDATE_ORIGIN, type PackageKind, type ManagedRelease } from "./managed-update-manifest.js";

const run = promisify(execFile);
// Updater staging contains real ASAR blobs. Electron's patched filesystem treats
// those as directories, so replacement/cleanup must use its raw filesystem.
const rawFs: typeof fs = process.versions.electron
    ? createRequire(import.meta.url)("original-fs").promises as typeof fs : fs;
let kind: PackageKind | undefined;
let pending: { release: ManagedRelease; file: string } | undefined;
let busy = false;
let installing = false;

function status(value: string | boolean): void {
    global.mainWindow?.webContents.send("check_updates", value);
}
function announce(): void {
    if (!pending) return;
    const r = pending.release;
    global.mainWindow?.webContents.send("update-downloaded", {
        releaseName: r.version, releaseNotes: r.releaseNotes,
        releaseDate: new Date(r.releaseDate), updateURL: r.url,
    });
}

export async function startManagedUpdates(): Promise<boolean> {
    if (!app.isPackaged || (process.platform !== "win32" && process.platform !== "linux")) return false;
    if (process.platform === "win32") {
        // Only the MSI path reaches here; Squirrel keeps its established updater.
        kind = "msi";
    } else {
        // Do not install a Debian package over a portable installation. Query the
        // actual package owner of the executable rather than guessing from /opt.
        try {
            const { stdout } = await run("/usr/bin/dpkg-query", ["-S", process.execPath]);
            if (stdout.startsWith("syn-messenger:")) kind = "deb";
        } catch { /* A tar installation or a non-Debian distribution. */ }
        kind ??= "tar.gz";
    }
    setTimeout(() => void checkManagedUpdates(), 30_000).unref();
    setInterval(() => void checkManagedUpdates(), 60 * 60 * 1000).unref();
    return true;
}

export function managedUpdatesActive(): boolean { return kind !== undefined; }

export async function checkManagedUpdates(): Promise<void> {
    if (!kind || busy || installing) return;
    if (pending) { announce(); return; }
    busy = true;
    let partial: string | undefined;
    try {
        const url = `${MANAGED_UPDATE_ORIGIN}/desktop/update/managed/${process.platform}/${process.arch}/${kind}.json`;
        const res = await fetch(url, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(30_000) });
        if (!res.ok) throw new Error(`Update service returned HTTP ${res.status}`);
        // Bound the manifest before parsing rather than trusting Content-Length.
        const reader = res.body!.getReader();
        const chunks: Uint8Array[] = []; let bytes = 0;
        while (true) {
            const { done, value } = await reader.read(); if (done) break;
            bytes += value.length;
            if (bytes > 64 * 1024) { await reader.cancel(); throw new Error("Update manifest too large"); }
            chunks.push(value);
        }
        const release = authenticateRelease(Buffer.concat(chunks).toString(), process.platform, process.arch, kind);
        if (!newerVersion(release.version, app.getVersion())) { status(false); return; }
        status(true);
        const dir = path.join(app.getPath("userData"), "syndicate-updates");
        await fs.mkdir(dir, { recursive: true, mode: 0o700 });
        // Reserve the complete installer plus scratch. Never fill a user's disk.
        const disk = await fs.statfs(dir);
        if (disk.bavail * disk.bsize < release.size * 3 + 512 * 1024 * 1024) throw new Error("Not enough free space to update");
        const file = path.join(dir, `syndicate-${release.version}.${kind}`);
        partial = `${file}.partial`;
        await fs.rm(partial, { force: true });
        const response = await fetch(release.url, { redirect: "error", signal: AbortSignal.timeout(30 * 60_000) });
        if (!response.ok || !response.body) throw new Error(`Installer download returned HTTP ${response.status}`);
        const hash = createHash("sha256"); let length = 0;
        const meter = new Transform({ transform(chunk: Buffer, _encoding, cb) {
            length += chunk.length;
            if (length > release.size) { cb(new Error("Installer size exceeds signed manifest")); return; }
            hash.update(chunk); cb(null, chunk);
        } });
        await pipeline(Readable.fromWeb(response.body as never), meter, createWriteStream(partial, { flags: "wx", mode: 0o600 }));
        if (length !== release.size || hash.digest("hex") !== release.sha256) throw new Error("Installer verification failed");
        await fs.rename(partial, file); partial = undefined;
        pending = { release, file }; announce();
        for (const name of await fs.readdir(dir)) {
            if (/^syndicate-\d+\.\d+\.\d+\.(msi|deb|tar\.gz)$/.test(name) && path.join(dir, name) !== file) {
                await fs.rm(path.join(dir, name), { force: true });
            }
        }
    } catch (error) {
        console.error("Managed update failed", error);
        status(error instanceof Error ? error.message : "Update failed");
    } finally {
        if (partial) await fs.rm(partial, { force: true }).catch(() => undefined);
        busy = false;
    }
}

/** User's existing Restart to Update action. Never auto-elevate on launch/quit. */
export async function installManagedUpdate(): Promise<void> {
    if (!pending || installing) return;
    installing = true;
    try {
        // Re-read verification after staging: do not execute a replaced/truncated file.
        const { file, release } = pending;
        const hash = createHash("sha256");
        const handle = await fs.open(file, "r");
        try { for await (const chunk of handle.createReadStream({ autoClose: false })) hash.update(chunk); }
        finally { await handle.close(); }
        if ((await fs.stat(file)).size !== release.size || hash.digest("hex") !== release.sha256) {
            pending = undefined; throw new Error("Staged installer verification failed; check for updates again");
        }
        if (kind === "msi") {
            // Start-Process handles the standard Windows elevation dialog. Passing
            // an encoded script avoids cmd.exe interpretation of profile paths.
            const quote = (s: string): string => "'" + s.replace(/'/g, "''") + "'";
            const args = `/i "${file}" /passive /norestart`;
            const executable = quote(process.execPath);
            const launchArgs = process.argv.slice(1).map(windowsArgument).join(" ");
            const launch = `Start-Process -FilePath ${executable}${launchArgs ? ` -ArgumentList ${quote(launchArgs)}` : ""}`;
            const log = quote(path.join(path.dirname(file), "install.log"));
            const ready = path.join(path.dirname(file), `msi-started-${process.pid}.txt`);
            await fs.rm(ready, { force: true });
            // Detached Windows consoles do not reliably deliver pipe output.
            // A private acknowledgement file records successful UAC admission.
            const script = `$ErrorActionPreference='Stop'; $p=Start-Process -FilePath "$env:WINDIR\\System32\\msiexec.exe" -ArgumentList ${quote(args)} -Verb RunAs -PassThru; [System.IO.File]::WriteAllText(${quote(ready)},'SYNDICATE_INSTALL_STARTED'); $p.WaitForExit(); Set-Content -LiteralPath ${log} -Value ("MSI exit: " + $p.ExitCode); Wait-Process -Id ${process.pid} -Timeout 120 -ErrorAction SilentlyContinue; ${launch}`;
            const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], { detached: true, windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
            let closed = false;
            let failure: Error | undefined;
            let detail = "";
            child.once("error", error => { failure = error; closed = true; });
            child.once("close", code => { closed = true; failure ??= new Error(`Windows installer authorization failed (${code})`); });
            child.stderr!.on("data", chunk => { detail = (detail + String(chunk)).slice(-2048); });
            while (true) {
                if (await fs.readFile(ready, "utf8").then(s => s.trim() === "SYNDICATE_INSTALL_STARTED").catch(() => false)) break;
                if (closed) throw new Error(`${failure?.message ?? "Windows installer could not start"}${detail.trim() ? ": " + detail.trim() : ""}`);
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            await fs.rm(ready, { force: true });
            child.unref(); global.appQuitting = true; app.quit();
        } else if (kind === "deb") {
            // Direct argv, no shell and no broad apt-get repair/unauthenticated flags.
            // Polkit prompts on interactive desktops; cancellation leaves app running.
            await run("/usr/bin/pkexec", ["/usr/bin/dpkg", "--install", file], { timeout: 30 * 60_000 });
            app.relaunch(); global.appQuitting = true; app.quit();
        } else {
            await installPortable(file, release);
        }
    } catch (error) {
        console.error("Managed installer failed", error);
        status(error instanceof Error ? error.message : "Could not install update");
    } finally { installing = false; }
}

async function installPortable(file: string, release: ManagedRelease): Promise<void> {
    const executable = await rawFs.realpath(process.execPath);
    const target = path.dirname(executable);
    const profile = await rawFs.realpath(app.getPath("userData"));
    if (profile === target || profile.startsWith(target + path.sep)) {
        throw new Error("Portable updates require the profile directory to be outside the application directory");
    }
    // Never replace a managed /opt installation or an arbitrary user directory.
    // Electron presents an ASAR archive as a virtual directory, not an ordinary
    // file. Validate the embedded application identity through its patched FS.
    const metadata = await fs.readFile(path.join(target, "resources", "app.asar", "package.json"), "utf8")
        .then(text => JSON.parse(text) as { electron_appId?: string }).catch(() => undefined);
    if (metadata?.electron_appId !== "app.syn.messenger.desktop") {
        throw new Error("Cannot identify portable Syndicate installation");
    }
    await rawFs.access(path.dirname(target), constants.W_OK);
    const disk = await rawFs.statfs(path.dirname(target));
    if (disk.bavail * disk.bsize < release.size * 4 + 512 * 1024 * 1024) throw new Error("Not enough space to unpack update");
    const staging = await rawFs.mkdtemp(path.join(path.dirname(target), ".syndicate-update-"));
    await rawFs.chmod(staging, 0o700);
    try {
        const { stdout } = await run("/usr/bin/tar", ["-tzf", file], { maxBuffer: 16 * 1024 * 1024 });
        const prefix = `syn-messenger-${release.version}/`;
        const members = stdout.trim().split("\n");
        if (members.some(n => !n.startsWith(prefix) || n.split("/").includes(".."))) throw new Error("Invalid portable archive paths");
        await run("/usr/bin/tar", ["-xzf", file, "-C", staging, "--no-same-owner"], { timeout: 5 * 60_000 });
        const next = path.join(staging, `syn-messenger-${release.version}`);
        await rawFs.access(path.join(next, path.basename(executable)), constants.X_OK);
        await rawFs.access(path.join(next, "resources", "app.asar"));
        // Helper lives outside the replaced app, waits for this process to exit,
        // swaps adjacent directories, and rolls back if the second rename fails.
        // Keep one previous app directory, never touch userData/crypto stores.
        const backup = `${target}.previous`;
        try {
            const marker = JSON.parse(await rawFs.readFile(path.join(backup, ".syndicate-update-backup.json"), "utf8"));
            if (marker.target !== target) throw new Error("Unrecognized previous update backup; move it before updating");
            await rawFs.access(path.join(backup, "resources", "app.asar"));
            await rawFs.rename(backup, path.join(staging, "obsolete"));
        } catch (e) {
            if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
            // An existing unmarked directory must never be overwritten/deleted.
            if (await rawFs.stat(backup).then(() => true).catch(() => false)) throw new Error("Unrecognized previous update backup");
        }
        const script = path.join(staging, "install.sh");
        const args = process.argv.slice(1).map(shellQuote).join(" ");
        const marker = shellQuote(JSON.stringify({ target, version: app.getVersion() }));
        await rawFs.writeFile(script, `#!/bin/sh\nset -eu\ni=0\nwhile kill -0 ${process.pid} 2>/dev/null; do i=$((i+1)); [ "$i" -lt 120 ] || exit 1; sleep 1; done\nmv -- ${shellQuote(target)} ${shellQuote(backup)}\nif ! mv -- ${shellQuote(next)} ${shellQuote(target)}; then mv -- ${shellQuote(backup)} ${shellQuote(target)}; exit 1; fi\nprintf '%s\\n' ${marker} > ${shellQuote(path.join(backup, ".syndicate-update-backup.json"))}\nrm -rf -- ${shellQuote(path.join(staging, "obsolete"))}\n${shellQuote(executable)} ${args} >/dev/null 2>&1 &\n`, { mode: 0o700 });
        const child = spawn("/bin/sh", [script], { detached: true, stdio: "ignore" });
        await new Promise<void>((resolve, reject) => { child.once("spawn", resolve); child.once("error", reject); });
        child.unref(); global.appQuitting = true; app.quit();
    } catch (error) {
        await rawFs.rm(staging, { recursive: true, force: true }).catch(cleanupError => console.warn("Could not clean update staging", cleanupError));
        throw error;
    }
}
