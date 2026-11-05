/* Copyright 2026 Hawthorn LLC
 * SPDX-License-Identifier: AGPL-3.0-only */
import { describe, it, expect } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import { authenticateRelease, newerVersion, shellQuote } from "./managed-update-manifest.js";
const keys = generateKeyPairSync("ed25519");
const publicKey = keys.publicKey.export({ type: "spki", format: "pem" }).toString();
const release = {
    version: "0.1.10",
    platform: "linux",
    arch: "x64",
    kind: "deb",
    url: "https://synmessenger.com/downloads/Syndicate-0.1.10-Linux-x86_64.deb",
    size: 100,
    sha256: "a".repeat(64),
    releaseNotes: "Update",
    releaseDate: "2026-11-05T12:00:00Z",
};
function envelope(r: unknown): string {
    const payload = Buffer.from(JSON.stringify(r));
    return JSON.stringify({
        payload: payload.toString("base64"),
        signature: sign(null, payload, keys.privateKey).toString("base64"),
    });
}
describe("authenticated managed releases", () => {
    it("accepts only the matching package and signing key", () => {
        expect(authenticateRelease(envelope(release), "linux", "x64", "deb", publicKey)).toEqual(release);
        expect(() => authenticateRelease(envelope(release), "win32", "x64", "msi", publicKey)).toThrow();
        expect(() => authenticateRelease(envelope(release), "linux", "arm64", "deb", publicKey)).toThrow();
        expect(() => authenticateRelease(envelope(release), "linux", "x64", "deb")).toThrow();
    });
    it("rejects tampering, excessive sizes and off-origin downloads", () => {
        const e = JSON.parse(envelope(release));
        e.payload = Buffer.from(JSON.stringify({ ...release, size: 5 })).toString("base64");
        expect(() => authenticateRelease(JSON.stringify(e), "linux", "x64", "deb", publicKey)).toThrow();
        for (const patch of [
            { size: -1 },
            { size: 2 ** 32 },
            { sha256: "bad" },
            { url: "http://synmessenger.com/downloads/a.deb" },
            { url: "https://evil.example/downloads/a.deb" },
            { url: "https://synmessenger.com/downloads/a.msi" },
        ]) {
            expect(() =>
                authenticateRelease(envelope({ ...release, ...patch }), "linux", "x64", "deb", publicKey),
            ).toThrow();
        }
    });
    it("does not downgrade or mistake 0.1.10 for older than 0.1.9", () => {
        expect(newerVersion("0.1.10", "0.1.9")).toBe(true);
        expect(newerVersion("0.1.9", "0.1.10")).toBe(false);
        expect(newerVersion("0.1.10", "0.1.10")).toBe(false);
        expect(newerVersion("0.1.11-beta", "0.1.10")).toBe(false);
    });
    it("quotes portable paths and profile arguments literally", () => {
        expect(shellQuote("user's $(nope) file")).toBe("'user'\\''s $(nope) file'");
    });
});

describe("GitHub-hosted signed installers", () => {
    const github = {
        ...release,
        url: "https://github.com/dakotasnapshot/syndicate-releases/releases/download/desktop-v0.1.10/Syndicate-0.1.10-Linux-x86_64.deb",
    };
    it("accepts the exact signed repository, version and package", () => {
        expect(authenticateRelease(envelope(github), "linux", "x64", "deb", publicKey)).toEqual(github);
    });
    it("rejects alternate repositories, mutable latest, credentials, query overrides and mismatched tags", () => {
        for (const url of [
            github.url.replace("dakotasnapshot", "attacker"),
            github.url.replace("desktop-v0.1.10", "desktop-v0.1.9"),
            github.url.replace("download/desktop-v0.1.10", "latest/download"),
            github.url.replace("https://github.com", "https://user@github.com"),
            github.url + "?download=other",
            github.url + "#other",
            github.url.replace("Syndicate-0.1.10", "Syndicate-0.1.9"),
        ]) {
            expect(() => authenticateRelease(envelope({ ...github, url }), "linux", "x64", "deb", publicKey)).toThrow();
        }
    });
});
