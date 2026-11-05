/* Native disposable-runner acceptance only. No production accounts or stores. */
import { app } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { generateKeyPairSync, createHash, sign } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

async function main() {
app.disableHardwareAcceleration();
await app.whenReady();
console.log("Native acceptance: Electron ready");
if (process.argv.includes("--self-check")) { setTimeout(() => app.quit(), 250); return; }
const scriptIndex = process.argv.findIndex(arg => path.resolve(arg) === fileURLToPath(import.meta.url));
const [kind, installer, previousExecutable, testRoot] = process.argv.slice(scriptIndex + 1);
if (scriptIndex < 0 || !["msi", "deb", "tar.gz"].includes(kind) || !testRoot) throw new Error("Usage: kind installer previous-executable test-root");
if (process.argv.includes("--self-check-args")) { console.log("Native acceptance: argument routing verified"); setTimeout(() => app.quit(), 250); return; }

await fs.mkdir(testRoot, { recursive: true });
const userData = path.join(testRoot, "profile"); await fs.mkdir(userData, { recursive: true });
await fs.writeFile(path.join(userData, "synthetic-profile-marker"), "preserve-me");
app.setPath("userData", userData);
process.argv.push("--profile-dir", userData);
Object.defineProperty(app, "isPackaged", { value: true });
app.getVersion = () => process.env.MANAGED_TEST_CURRENT_VERSION || "0.1.9";
Object.defineProperty(process, "execPath", { value: previousExecutable });
app.relaunch = () => { /* Native installer verified externally, don't loop the harness. */ };

// Test copy only: an ephemeral signing key authenticates the just-built candidate.
// Production modules retain the pinned release key and fixed HTTPS origin.
const sourceDir = process.env.MANAGED_TEST_MODULE_DIR || fileURLToPath(new URL("../lib/", import.meta.url));
const moduleDir = path.join(testRoot, "modules"); await fs.mkdir(moduleDir, { recursive: true });
await fs.writeFile(path.join(testRoot, "package.json"), '{"type":"module"}');
const keys = generateKeyPairSync("ed25519");
const publicKey = keys.publicKey.export({ type: "spki", format: "pem" }).toString().trim();
let manifestCode = await fs.readFile(path.join(sourceDir, "managed-update-manifest.js"), "utf8");
manifestCode = manifestCode.replace(/-----BEGIN PUBLIC KEY-----[\s\S]*?-----END PUBLIC KEY-----/, publicKey);
await fs.writeFile(path.join(moduleDir, "managed-update-manifest.js"), manifestCode);
let updaterCode = await fs.readFile(path.join(sourceDir, "managed-updater.js"), "utf8");
// Headless CI has no Polkit agent; exercise the same dpkg argv through sudo.
// Interactive Polkit/UAC UI acceptance remains a separately reported limitation.
if (kind === "deb") updaterCode = updaterCode.replaceAll('"/usr/bin/pkexec"', '"/usr/bin/sudo"');
await fs.writeFile(path.join(moduleDir, "managed-updater.js"), updaterCode);
if (kind === "msi" && process.env.MANAGED_WINDOWS_DIAGNOSTICS === "1") {
    updaterCode = updaterCode.replace('const child = spawn("powershell.exe",', 'console.log("Synthetic MSI helper script:", script); const child = spawn("powershell.exe",');
    await fs.writeFile(path.join(moduleDir, "managed-updater.js"), updaterCode);
    const { spawn } = await import("node:child_process");
    for (const detached of [false, true]) {
        const flag = path.join(testRoot, `powershell-probe-${detached}.txt`);
        const command = `[System.IO.File]::WriteAllText('${flag.replace(/'/g, "''")}','ok'); Write-Output 'probe-ok'`;
        const result = await new Promise((resolve, reject) => {
            const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(command, "utf16le").toString("base64")], { detached, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
            let stdout="", stderr="";
            child.stdout.on("data", b => stdout += String(b)); child.stderr.on("data", b => stderr += String(b));
            child.once("error", reject); child.once("close", code => resolve({code,stdout,stderr}));
        });
        console.log("Synthetic PowerShell probe", JSON.stringify({ detached, ...result, file: await fs.readFile(flag,"utf8").catch(()=>null) }));
    }
}

// ESM resolves Electron from the parent desktop node_modules, not a temp directory.
await fs.symlink(fileURLToPath(new URL("../node_modules/", import.meta.url)), path.join(testRoot, "node_modules"), process.platform === "win32" ? "junction" : "dir");
const bytes = await fs.readFile(installer);
const release = { version: process.env.MANAGED_TEST_CANDIDATE_VERSION || "0.1.10", platform: process.platform, arch: process.arch, kind,
    url: `https://synmessenger.com/downloads/acceptance.${kind}`, size: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"), releaseNotes: "Synthetic native upgrade acceptance", releaseDate: new Date().toISOString() };
const payload = Buffer.from(JSON.stringify(release));
const envelope = JSON.stringify({ payload: payload.toString("base64"), signature: sign(null, payload, keys.privateKey).toString("base64") });
const githubDelivery = process.env.MANAGED_TEST_GITHUB_DELIVERY === "1";
if (githubDelivery) {
    release.url = `https://github.com/dakotasnapshot/syndicate-releases/releases/download/desktop-v${release.version}/Syndicate-${release.version}-Acceptance.${kind}`;
}
const signedPayload = Buffer.from(JSON.stringify(release));
const signedEnvelope = JSON.stringify({ payload: signedPayload.toString("base64"), signature: sign(null, signedPayload, keys.privateKey).toString("base64") });
const requests = [];
global.fetch = async (url, options) => {
    requests.push(String(url));
    if (String(url).endsWith(".json")) {
        if (githubDelivery && !String(url).startsWith("https://raw.githubusercontent.com/dakotasnapshot/syndicate-releases/main/channels/stable/")) throw new Error("Wrong discovery origin");
        return new Response(signedEnvelope);
    }
    if (githubDelivery) {
        if (options?.redirect !== "manual" || options?.credentials !== "omit") throw new Error("Unsafe redirect policy");
        if (String(url) === release.url) return new Response(null, {status:302, headers:{location:"https://release-assets.githubusercontent.com/github-production-release-asset/acceptance/payload?token=synthetic"}});
        if (!String(url).startsWith("https://release-assets.githubusercontent.com/github-production-release-asset/acceptance/")) throw new Error("Wrong asset origin");
    } else if (String(url) !== release.url) throw new Error("Wrong legacy installer URL");
    return new Response(bytes);
};
let downloaded = false;
const updater = await import(pathToFileURL(path.join(moduleDir, "managed-updater.js")).href);
global.mainWindow = { webContents: { send(event, value) {
    if (event === "check_updates" && typeof value === "string") throw new Error(value);
    if (event === "update-downloaded") downloaded = true;
} } };
const quit = app.quit.bind(app);
app.quit = () => {
    fs.readFile(path.join(userData, "synthetic-profile-marker"), "utf8").then(async value => {
        if (value !== "preserve-me") throw new Error("Profile marker changed");
        await fs.writeFile(path.join(testRoot, "updater-result.json"), JSON.stringify({ kind, downloaded, version: release.version, verifiedInstallerSHA256: release.sha256, profilePreserved: true, installerRequested: true }, null, 2));
        quit();
    }).catch(error => { console.error(error); app.exit(1); });
};
await updater.startManagedUpdates();
if (!updater.managedUpdateFeedUrl()?.endsWith(`/${kind}.json`)) throw new Error("In-app update capability not exposed");
await updater.checkManagedUpdates();
console.log("Native acceptance: candidate authenticated and downloaded");
if (!downloaded) throw new Error("No downloaded update was announced");
if (process.env.MANAGED_TEST_DOWNLOAD_ONLY === "1") {
    if (!githubDelivery || requests.length !== 3) throw new Error("GitHub discovery/CDN path not exercised");
    await fs.writeFile(path.join(testRoot, "updater-result.json"), JSON.stringify({kind, downloaded, requests, version:release.version, verifiedInstallerSHA256:release.sha256, downloadOnly:true}, null, 2));
    quit(); return;
}
console.log("Native acceptance: invoking installer");
await updater.installManagedUpdate();
console.log("Native acceptance: installer invocation returned");
setTimeout(() => { console.error("Installer did not finish"); app.exit(1); }, 30000).unref();

}
void main().catch(error => { console.error(error); app.exit(1); });
