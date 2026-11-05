/* Copyright 2026 SYN Messenger Contributors
 * SPDX-License-Identifier: AGPL-3.0-only */
import { it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
const mocks = vi.hoisted(() => ({ send: vi.fn(), quit: vi.fn(), relaunch: vi.fn(), run: vi.fn(), spawn: vi.fn(), data: "", release: {} as Record<string, unknown> }));
vi.mock("electron", () => ({ app: { isPackaged: true, getVersion: () => "0.1.9", getPath: () => mocks.data, quit: mocks.quit, relaunch: mocks.relaunch } }));
vi.mock("node:child_process", async importOriginal => {
    const actual = await importOriginal<typeof import("node:child_process")>();
    const execFile = (...args: unknown[]): unknown => mocks.run(...args);
    Object.defineProperty(execFile, Symbol.for("nodejs.util.promisify.custom"), { value: (...args: unknown[]) => new Promise((resolve, reject) => {
        mocks.run(...args, (error: Error | null, stdout: string, stderr: string) => error ? reject(error) : resolve({ stdout, stderr }));
    }) });
    return { ...actual, execFile, spawn: (...args: unknown[]) => mocks.spawn(...args) };
});
vi.mock("./managed-update-manifest.js", async importOriginal => {
    const actual = await importOriginal<typeof import("./managed-update-manifest.js")>();
    return { ...actual, authenticateRelease: () => mocks.release };
});
const realProcess = process;
let updater: typeof import("./managed-updater.js");
const payload = Buffer.from("synthetic installer - not executable");
beforeEach(async () => {
    vi.resetModules(); vi.clearAllMocks();
    mocks.spawn.mockImplementation(() => {
        const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough(), unref: vi.fn() });
        queueMicrotask(() => { void fs.writeFile(path.join(mocks.data, "syndicate-updates", `msi-started-${realProcess.pid}.txt`), "SYNDICATE_INSTALL_STARTED"); });
        return child;
    });
    mocks.data = await fs.mkdtemp(path.join(os.tmpdir(), "syn-updater-test-"));
    mocks.release = { version: "0.1.10", platform: "linux", arch: "x64", kind: "deb", url: "https://synmessenger.com/downloads/test.deb", size: payload.length, sha256: createHash("sha256").update(payload).digest("hex"), releaseNotes: "test", releaseDate: "2026-11-05T12:00:00Z" };
    mocks.run.mockImplementation((cmd, args, optionsOrCallback, maybeCallback) => {
        const cb = maybeCallback ?? optionsOrCallback;
        cb(null, "syn-messenger: /opt/SYN-Messenger/syn-messenger\n", "");
    });
    vi.stubGlobal("process", { ...realProcess, platform: "linux", arch: "x64", execPath: "/opt/SYN-Messenger/syn-messenger" });
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(url.endsWith(".json") ? "{}" : payload))));
    global.mainWindow = { webContents: { send: mocks.send } } as never;
    updater = await import("./managed-updater.js");
    await updater.startManagedUpdates();
});
afterEach(async () => { vi.unstubAllGlobals(); await fs.rm(mocks.data, { recursive: true, force: true }); });
it("downloads in the background and installs the exact Debian file via explicit argv", async () => {
    await updater.checkManagedUpdates();
    expect(mocks.send).toHaveBeenCalledWith("update-downloaded", expect.objectContaining({ releaseName: "0.1.10" }));
    await updater.installManagedUpdate();
    const call = mocks.run.mock.calls.find(c => c[0] === "/usr/bin/pkexec");
    expect(call?.[1]).toEqual(["/usr/bin/dpkg", "--install", path.join(mocks.data, "syndicate-updates/syndicate-0.1.10.deb")]);
    expect(mocks.relaunch).toHaveBeenCalledOnce(); expect(mocks.quit).toHaveBeenCalledOnce();
});
it("never announces or executes a corrupt or overlong installer", async () => {
    mocks.release.sha256 = "f".repeat(64);
    await updater.checkManagedUpdates();
    expect(mocks.send).not.toHaveBeenCalledWith("update-downloaded", expect.anything());
    await updater.installManagedUpdate(); expect(mocks.quit).not.toHaveBeenCalled();
    expect(await fs.readdir(path.join(mocks.data, "syndicate-updates"))).toEqual([]);
});
it("leaves the app running after authorization cancellation", async () => {
    await updater.checkManagedUpdates();
    mocks.run.mockImplementation((cmd, args, options, cb) => cb(new Error("Authorization cancelled"), "", ""));
    await updater.installManagedUpdate();
    expect(mocks.quit).not.toHaveBeenCalled(); expect(mocks.relaunch).not.toHaveBeenCalled();
    expect(mocks.send).toHaveBeenCalledWith("check_updates", "Authorization cancelled");
});
it("re-verifies staged bytes at install time", async () => {
    await updater.checkManagedUpdates();
    await fs.writeFile(path.join(mocks.data, "syndicate-updates/syndicate-0.1.10.deb"), "changed");
    await updater.installManagedUpdate();
    expect(mocks.run.mock.calls.some(c => c[0] === "/usr/bin/pkexec")).toBe(false);
    expect(mocks.quit).not.toHaveBeenCalled();
});
it("does not download an older or equal release", async () => {
    mocks.release.version = "0.1.9";
    await updater.checkManagedUpdates(); expect(fetch).toHaveBeenCalledTimes(1);
    expect(mocks.send).toHaveBeenCalledWith("check_updates", false);
});
it("uses Windows Installer elevation for MSI without switching profiles or using Squirrel", async () => {
    vi.resetModules();
    vi.stubGlobal("process", { ...realProcess, platform: "win32", arch: "x64", execPath: "C:\\Program Files\\Syndicate\\Syndicate.exe" });
    updater = await import("./managed-updater.js");
    mocks.release.kind = "msi"; mocks.release.platform = "win32"; mocks.release.url = "https://synmessenger.com/downloads/test.msi";
    await updater.startManagedUpdates(); await updater.checkManagedUpdates(); await updater.installManagedUpdate();
    const call = mocks.spawn.mock.calls.find(c => c[0] === "powershell.exe");
    expect(call).toBeDefined();
    const script = Buffer.from(call![1][3], "base64").toString("utf16le");
    expect(script).toContain("msiexec.exe"); expect(script).toContain("-Verb RunAs");
    expect(script).toContain("/passive /norestart"); expect(mocks.quit).toHaveBeenCalledOnce();
});
it("refuses a portable swap when its custom profile is inside the application", async () => {
    const root = mocks.data;
    const folder = path.join(root, "portable");
    await fs.mkdir(path.join(folder, "resources"), { recursive: true });
    await fs.writeFile(path.join(folder, "syn-messenger"), "synthetic executable");
    mocks.data = path.join(folder, "profile"); await fs.mkdir(mocks.data);
    await fs.writeFile(path.join(mocks.data, "account-marker"), "preserve");
    vi.resetModules();
    vi.stubGlobal("process", { ...realProcess, platform: "linux", arch: "x64", execPath: path.join(folder, "syn-messenger") });
    mocks.run.mockImplementation((cmd, args, cb) => cb(new Error("Not a dpkg package"), "", ""));
    updater = await import("./managed-updater.js"); await updater.startManagedUpdates();
    mocks.release.kind = "tar.gz"; mocks.release.url = "https://synmessenger.com/downloads/test.tar.gz";
    await updater.checkManagedUpdates(); await updater.installManagedUpdate();
    expect(mocks.quit).not.toHaveBeenCalled();
    expect(await fs.readFile(path.join(mocks.data, "account-marker"), "utf8")).toBe("preserve");
    expect(mocks.send).toHaveBeenCalledWith("check_updates", expect.stringContaining("profile directory to be outside"));
    await fs.rm(folder, { recursive: true, force: true });
    mocks.data = root;
});
