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
    if (typeof payload !== "string" || typeof signature !== "string" ||
        !verify(null, Buffer.from(payload, "base64"), publicKey, Buffer.from(signature, "base64"))) {
        throw new Error("Update signature invalid");
    }
    const r: ManagedRelease = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
    if (r.platform !== platform || r.arch !== arch || r.kind !== kind ||
        !/^\d+\.\d+\.\d+$/.test(r.version) || !/^[a-f0-9]{64}$/.test(r.sha256) ||
        !Number.isSafeInteger(r.size) || r.size < 1 || r.size > 1024 * 1024 * 1024 ||
        typeof r.releaseNotes !== "string" || !Number.isFinite(Date.parse(r.releaseDate))) {
        throw new Error("Update manifest does not match this installation");
    }
    const url = new URL(r.url);
    if (url.origin !== MANAGED_UPDATE_ORIGIN || url.username || url.password || url.search || url.hash ||
        !url.pathname.startsWith("/downloads/") || !url.pathname.endsWith(`.${kind}`)) {
        throw new Error("Untrusted installer URL");
    }
    return r;
}

export function shellQuote(value: string): string {
    return "'" + value.replace(/'/g, "'\\''") + "'";
}

export function windowsArgument(value: string): string {
    return '"' + value.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, "$1$1") + '"';
}
