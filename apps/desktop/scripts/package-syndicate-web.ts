#!/usr/bin/env node
/*
Copyright 2026 Hawthorn LLC
SPDX-License-Identifier: AGPL-3.0-only
*/

import { execFileSync } from "node:child_process";
import { readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as asar from "@electron/asar";

const desktop = fileURLToPath(new URL("../", import.meta.url));
const webapp = path.resolve(desktop, "../web/webapp");
const version = process.env.VERSION;
const key = process.env.GIPHY_API_KEY?.trim();
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) throw new Error("VERSION must be a release version");
if (!key || key === "__GIPHY_API_KEY__") throw new Error("GIPHY_API_KEY is required for Syndicate releases");

await access(path.join(webapp, "index.html"));
const config = JSON.parse(await readFile(path.join(desktop, "syn/release/config.json"), "utf8"));
config.giphy_api_key = key;
if (config.update_base_url !== "https://synmessenger.com/desktop/update/") {
    throw new Error("Release must use Syndicate's update service");
}
await writeFile(path.join(webapp, "config.json"), JSON.stringify(config, null, 4));
await writeFile(path.join(webapp, "version"), version);
await writeFile(
    path.join(webapp, "syndicate-release.json"),
    JSON.stringify({
        version,
        source: execFileSync("git", ["rev-parse", "HEAD"], { cwd: desktop, encoding: "utf8" }).trim(),
    }),
);
const archive = path.join(desktop, "webapp.asar");
await asar.createPackage(webapp, archive);
const embedded = JSON.parse(asar.extractFile(archive, "config.json").toString());
if (embedded.giphy_api_key !== key || asar.extractFile(archive, "version").toString() !== version) {
    throw new Error("Packaged release configuration did not match");
}
console.log(`Packaged Syndicate ${version} renderer with deployment configuration`);
