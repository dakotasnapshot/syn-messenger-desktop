/*
Copyright 2026 Hawthorn LLC
SPDX-License-Identifier: AGPL-3.0-only
*/

import { defineConfig } from "@playwright/test";
import config from "./playwright.config.ts";

export default defineConfig({
    ...config,
    webServer: {
        command: "python3 -m http.server 8080 --bind 127.0.0.1 --directory webapp",
        url: "http://localhost:8080/config.json",
        timeout: 30000,
    },
    reporter: [["list"], ["html", { outputFolder: "playwright/html-report", open: "never" }]],
});
