/*
Copyright 2026 Hawthorn LLC

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export interface GiphyResult {
    id: string;
    title: string;
    previewURL: string;
    originalURL: string;
}

interface GiphyImage {
    url: string;
}

interface GiphyAPIResult {
    id: string;
    title: string;
    images: {
        fixed_width: GiphyImage;
        original: GiphyImage;
    };
}

export async function fetchGiphyResults(apiKey: string, query: string, signal?: AbortSignal): Promise<GiphyResult[]> {
    const endpoint = query.trim() ? "search" : "trending";
    const parameters = new URLSearchParams({ api_key: apiKey, limit: "30", rating: "pg-13" });
    if (query.trim()) parameters.set("q", query.trim());

    const response = await fetch(`https://api.giphy.com/v1/gifs/${endpoint}?${parameters}`, { signal });
    if (!response.ok) throw new Error(`GIPHY request failed with status ${response.status}`);

    const payload = (await response.json()) as { data: GiphyAPIResult[] };
    return payload.data.map((result) => ({
        id: result.id,
        title: result.title,
        previewURL: result.images.fixed_width.url,
        originalURL: result.images.original.url,
    }));
}

export async function downloadGiphyResult(result: GiphyResult): Promise<File> {
    const response = await fetch(result.originalURL);
    if (!response.ok) throw new Error(`GIF download failed with status ${response.status}`);

    return new File([await response.blob()], `syndicate-gif-${result.id}.gif`, { type: "image/gif" });
}
