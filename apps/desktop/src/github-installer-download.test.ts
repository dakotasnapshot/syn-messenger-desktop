/* Copyright 2026 Hawthorn LLC
 * SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchTrustedInstaller } from "./managed-update-manifest.js";
const release = {
    url: "https://github.com/dakotasnapshot/syndicate-releases/releases/download/desktop-v0.1.11/Syndicate-0.1.11-Linux-x86_64.deb",
    version: "0.1.11",
    kind: "deb" as const,
};
const cdn = "https://release-assets.githubusercontent.com/github-production-release-asset/123/456?sig=synthetic";
afterEach(() => vi.unstubAllGlobals());
describe("authenticated installer transport", () => {
    it("follows GitHub's release CDN without sending cookies or bypassing signed byte checks", async () => {
        const fetcher = vi
            .fn()
            .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: cdn } }))
            .mockResolvedValueOnce(new Response("synthetic installer"));
        vi.stubGlobal("fetch", fetcher);
        const response = await fetchTrustedInstaller(release, AbortSignal.timeout(1000));
        expect(await response.text()).toBe("synthetic installer");
        expect(fetcher.mock.calls.map((c) => c[0])).toEqual([release.url, cdn]);
        expect(fetcher.mock.calls[1][1]).toMatchObject({ redirect: "manual", credentials: "omit" });
    });
    it.each([
        "http://release-assets.githubusercontent.com/github-production-release-asset/a",
        "https://evil.example/file.deb",
        "https://github.com/attacker/repo/releases/download/a/file.deb",
        "https://release-assets.githubusercontent.com/not-a-release/a",
        "https://user@release-assets.githubusercontent.com/github-production-release-asset/a",
    ])("rejects untrusted redirect %s before contacting it", async (location) => {
        const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location } }));
        vi.stubGlobal("fetch", fetcher);
        await expect(fetchTrustedInstaller(release, AbortSignal.timeout(1000))).rejects.toThrow();
        expect(fetcher).toHaveBeenCalledTimes(1);
    });
    it("bounds redirect loops", async () => {
        const fetcher = vi
            .fn()
            .mockImplementation(() => new Response(null, { status: 302, headers: { location: cdn } }));
        vi.stubGlobal("fetch", fetcher);
        await expect(fetchTrustedInstaller(release, AbortSignal.timeout(1000))).rejects.toThrow();
        expect(fetcher).toHaveBeenCalledTimes(4);
    });
    it("still refuses redirects from legacy same-origin installer URLs", async () => {
        const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: cdn } }));
        vi.stubGlobal("fetch", fetcher);
        await expect(
            fetchTrustedInstaller(
                { ...release, url: "https://synmessenger.com/downloads/test.deb" },
                AbortSignal.timeout(1000),
            ),
        ).rejects.toThrow();
        expect(fetcher).toHaveBeenCalledTimes(1);
    });
});
