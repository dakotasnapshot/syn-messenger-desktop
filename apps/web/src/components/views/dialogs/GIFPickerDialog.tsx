/*
Copyright 2026 Hawthorn LLC

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useEffect, useState } from "react";

import { _t } from "../../../languageHandler";
import { fetchGiphyResults, type GiphyResult } from "../../../utils/GiphyClient";
import BaseDialog from "./BaseDialog";
import Spinner from "../elements/Spinner";

interface IProps {
    apiKey: string;
    onFinished: (result?: GiphyResult) => void;
}

export default function GIFPickerDialog({ apiKey, onFinished }: IProps): JSX.Element {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<GiphyResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        const timeout = window.setTimeout(
            () => {
                setLoading(true);
                setFailed(false);
                void fetchGiphyResults(apiKey, query, controller.signal)
                    .then(setResults)
                    .catch((error) => {
                        if (error instanceof DOMException && error.name === "AbortError") return;
                        setFailed(true);
                    })
                    .finally(() => setLoading(false));
            },
            query ? 250 : 0,
        );

        return () => {
            window.clearTimeout(timeout);
            controller.abort();
        };
    }, [apiKey, query]);

    return (
        <BaseDialog
            title={_t("composer|gif_picker_title")}
            onFinished={() => onFinished()}
            className="mx_GIFPickerDialog"
        >
            <input
                autoFocus
                className="mx_GIFPickerDialog_search"
                type="search"
                value={query}
                placeholder={_t("composer|gif_picker_search")}
                aria-label={_t("composer|gif_picker_search")}
                onChange={(event) => setQuery(event.target.value)}
            />
            {loading ? (
                <Spinner />
            ) : failed ? (
                <div className="mx_GIFPickerDialog_status">{_t("composer|gif_picker_error")}</div>
            ) : (
                <div className="mx_GIFPickerDialog_grid">
                    {results.map((result) => (
                        <button
                            className="mx_GIFPickerDialog_result"
                            type="button"
                            key={result.id}
                            title={result.title}
                            onClick={() => onFinished(result)}
                        >
                            <img src={result.previewURL} alt={result.title} loading="lazy" />
                        </button>
                    ))}
                </div>
            )}
            <div className="mx_GIFPickerDialog_attribution">Powered by GIPHY</div>
        </BaseDialog>
    );
}
