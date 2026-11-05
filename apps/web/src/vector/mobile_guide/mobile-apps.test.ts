/*
Copyright 2026 Dakota Cole
SPDX-License-Identifier: AGPL-3.0-only
*/
// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";
import { MobileAppVariant, mobileApps, updateMobilePage } from "./mobile-apps.ts";

describe("Syndicate mobile guide", () => {
    beforeEach(() => {
        document.head.innerHTML = '<meta name="apple-itunes-app" content="">';
        document.body.innerHTML = `
            <p id="header_title"></p><h1 id="step1_heading"></h1>
            <a id="app_store_link"></a><a id="play_store_link"></a>
            <p id="f_droid_section"><a id="f_droid_link"></a></p>
            <div id="step2_container"><p id="step2_description"></p><a id="deep_link_button"></a></div>`;
    });

    it.each(Object.values(MobileAppVariant))("offers Syndicate for legacy variant %s", (variant) => {
        const metadata = mobileApps[variant];
        updateMobilePage(metadata, "https://synmessenger.com/chat/#/login", "matrix.example");
        expect(metadata.name).toBe("Syndicate");
        expect(document.querySelector('meta[name="apple-itunes-app"]')?.getAttribute("content")).toBe(
            "app-id=id6809166852",
        );
        expect(document.getElementById("step1_heading")?.textContent).toBe("Download Syndicate");
        expect(document.getElementById("app_store_link")?.getAttribute("href")).toBe(
            "https://apps.apple.com/app/id6809166852",
        );
        expect(document.getElementById("play_store_link")?.getAttribute("href")).toBe(
            "https://synmessenger.com/downloads/#android",
        );
        expect(document.getElementById("f_droid_section")?.style.display).toBe("none");
        expect(document.getElementById("deep_link_button")?.getAttribute("href")).toBe(
            "https://synmessenger.com/chat/#/login",
        );
    });
});
