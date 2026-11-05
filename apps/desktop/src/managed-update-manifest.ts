/* Copyright 2026 Hawthorn LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { verify } from "node:crypto";

// Offline release signing key; never ship its private half. HTTPS alone is not
// sufficient authentication for installers executed with administrator privileges.
export const RELEASE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAIwa9gRuM3q2Bf99LQTRsHYKf2swSJvFltFhc73GxHFI=
-----END PUBLIC KEY-----`;
export const MANAGED_UPDATE_ORIGIN = "https://synmessenger.com";
export const GITHUB_RELEASE_REPOSITORY = "dakotasnapshot/syndicate-releases";
export const MANAGED_UPDATE_FEED_BASE = `https://raw.githubusercontent.com/${GITHUB_RELEASE_REPOSITORY}/main/channels/stable`;
export type PackageKind = "msi" | "deb" | "tar.gz";
export interface ManagedRelease {
    version: string;
    platform: "win32" | "linux";
    arch: string;
    kind: PackageKind;
    url: string;
    size: number;
    sha256: string;
    releaseNotes: string;
    releaseDate: string;
}

export function newerVersion(candidate: string, current: string): boolean {
    const valid = /^\d+\.\d+\.\d+$/;
    if (!valid.test(candidate) || !valid.test(current)) return false;
    const a = candidate.split(".").map(Number);
    const b = current.split(".").map(Number);
    if (![...a, ...b].every(Number.isSafeInteger)) return false;
    for (let i = 0; i < 3; i++) {
        if (a[i] !== b[i]) return a[i] > b[i];
    }
    return false;
}

export function authenticateRelease(
    envelope: string,
    platform: string,
    arch: string,
    kind: PackageKind,
    publicKey = RELEASE_PUBLIC_KEY,
): ManagedRelease {
    if (envelope.length > 64 * 1024) throw new Error("Update manifest too large");
    const { payload, signature } = JSON.parse(envelope);
    if (
        typeof payload !== "string" ||
        typeof signature !== "string" ||
        !verify(null, Buffer.from(payload, "base64"), publicKey, Buffer.from(signature, "base64"))
    ) {
        throw new Error("Update signature invalid");
    }
    const r: ManagedRelease = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
    if (
        r.platform !== platform ||
        r.arch !== arch ||
        r.kind !== kind ||
        !/^\d+\.\d+\.\d+$/.test(r.version) ||
        !/^[a-f0-9]{64}$/.test(r.sha256) ||
        !Number.isSafeInteger(r.size) ||
        r.size < 1 ||
        r.size > 1024 * 1024 * 1024 ||
        typeof r.releaseNotes !== "string" ||
        !Number.isFinite(Date.parse(r.releaseDate))
    ) {
        throw new Error("Update manifest does not match this installation");
    }
    if (!trustedInstallerURL(r)) throw new Error("Untrusted installer URL");
    return r;
}

/** Accept exact signed release URLs, never arbitrary repositories or mutable latest URLs. */
export function trustedInstallerURL(r: Pick<ManagedRelease, "url" | "version" | "kind">): boolean {
    const url = new URL(r.url);
    if (url.username || url.password || url.search || url.hash || !url.pathname.endsWith(`.${r.kind}`)) return false;
    if (url.origin === MANAGED_UPDATE_ORIGIN) return url.pathname.startsWith("/downloads/");
    if (url.origin !== "https://github.com") return false;
    const prefix = `/${GITHUB_RELEASE_REPOSITORY}/releases/download/desktop-v${r.version}/`;
    if (!url.pathname.startsWith(prefix)) return false;
    const filename = url.pathname.slice(prefix.length);
    return /^[A-Za-z0-9._-]+$/.test(filename) && filename.includes(`-${r.version}-`);
}

/** GitHub redirects only to its release CDN. Reverify signed size/hash after streaming. */
export async function fetchTrustedInstaller(
    release: Pick<ManagedRelease, "url" | "version" | "kind">,
    signal: AbortSignal,
): Promise<Response> {
    if (!trustedInstallerURL(release)) throw new Error("Untrusted installer URL");
    const github = new URL(release.url).origin === "https://github.com";
    let url = release.url;
    for (let hop = 0; hop < 4; hop++) {
        const response = await fetch(url, { redirect: "manual", credentials: "omit", signal });
        if (![301, 302, 303, 307, 308].includes(response.status)) return response;
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!github || !location || hop === 3) throw new Error("Installer redirect rejected");
        const next = new URL(location, url);
        if (
            next.origin !== "https://release-assets.githubusercontent.com" ||
            next.username ||
            next.password ||
            next.hash ||
            !next.pathname.startsWith("/github-production-release-asset/")
        ) {
            throw new Error("Untrusted installer redirect");
        }
        url = next.href;
    }
    throw new Error("Too many installer redirects");
}

export function shellQuote(value: string): string {
    return "'" + value.replace(/'/g, "'\\''") + "'";
}

export function windowsArgument(value: string): string {
    return '"' + value.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, "$1$1") + '"';
}
