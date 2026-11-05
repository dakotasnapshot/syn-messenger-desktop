/* SPDX-License-Identifier: AGPL-3.0-only */
import fs from "node:fs/promises";
import { createHash, createPublicKey, sign, verify } from "node:crypto";
const [kind, artifact, version, url, keyPath, output] = process.argv.slice(2);
if (!["msi", "deb", "tar.gz"].includes(kind) || !/^\d+\.\d+\.\d+$/.test(version) || !output) {
    throw new Error("Usage: kind artifact version immutable-https-url private-key-path output.json");
}
const { trustedInstallerURL } = await import("../src/managed-update-manifest.ts");
if (!trustedInstallerURL({ url, version, kind })) throw new Error("Untrusted installer URL");
const bytes = await fs.readFile(artifact);
const payload = Buffer.from(
    JSON.stringify({
        version,
        platform: kind === "msi" ? "win32" : "linux",
        arch: "x64",
        kind,
        url,
        size: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        releaseNotes: "Syndicate: authenticated in-app updates for MSI and Linux; GIFs, previews and unread badges.",
        releaseDate: new Date().toISOString(),
    }),
);
const key = await fs.readFile(keyPath);
const signature = sign(null, payload, key);
if (!verify(null, payload, createPublicKey(key), signature)) throw new Error("Signature self-check failed");
await fs.writeFile(
    output,
    JSON.stringify({ payload: payload.toString("base64"), signature: signature.toString("base64") }, null, 2) + "\n",
);
console.log(`Signed ${kind} ${version} (${bytes.length} bytes)`);
