/*
Copyright 2026 Hawthorn LLC

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { afterEach, describe, expect, it, vi } from "vitest";

import { downloadGiphyResult, fetchGiphyResults, type GiphyResult } from "./GiphyClient";

const result: GiphyResult = {
    id: "cat",
    title: "Cat",
    previewURL: "https://media.giphy.com/preview.gif",
    originalURL: "https://media.giphy.com/original.gif",
};

describe("GiphyClient", () => {
    afterEach(() => vi.restoreAllMocks());

    it("loads trending GIFs when search is empty", async () => {
        const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(
                JSON.stringify({
                    data: [
                        {
                            id: result.id,
                            title: result.title,
                            images: {
                                fixed_width: { url: result.previewURL },
                                original: { url: result.originalURL },
                            },
                        },
                    ],
                }),
            ),
        );

        await expect(fetchGiphyResults("key", "")).resolves.toEqual([result]);
        expect(fetchMock.mock.calls[0][0].toString()).toContain("/trending?");
    });

    it("searches GIPHY with the supplied query", async () => {
        const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: [] })));

        await fetchGiphyResults("key", "party time");
        const url = fetchMock.mock.calls[0][0].toString();
        expect(url).toContain("/search?");
        expect(url).toContain("q=party+time");
    });

    it("downloads the original GIF as an uploadable file", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(new Blob(["gif"], { type: "image/gif" })));

        const file = await downloadGiphyResult(result);
        expect(file.name).toBe("syndicate-gif-cat.gif");
        expect(file.type).toBe("image/gif");
    });
});
