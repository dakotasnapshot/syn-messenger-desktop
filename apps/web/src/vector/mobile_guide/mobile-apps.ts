/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/*
 * Syndicate mobile guide metadata.
 */

export enum MobileAppVariant {
    Classic = "element-classic",
    X = "element",
    Pro = "element-pro",
}

export interface MobileAppMetadata {
    name: string;
    appleAppId: string;
    appStoreUrl: string;
    playStoreUrl: string;
    fDroidUrl?: string;
    deepLinkPath: string;
    usesLegacyDeepLink: boolean;
    isProApp: boolean;
}

// Historical config variant keys remain accepted, but all routes offer Syndicate.
const syndicateApp: MobileAppMetadata = {
    name: "Syndicate",
    appleAppId: "id6809166852",
    appStoreUrl: "https://apps.apple.com/app/id6809166852",
    playStoreUrl: "https://synmessenger.com/downloads/#android",
    deepLinkPath: "",
    usesLegacyDeepLink: true,
    isProApp: false,
};

export const mobileApps: Record<MobileAppVariant, MobileAppMetadata> = {
    [MobileAppVariant.Classic]: syndicateApp,
    [MobileAppVariant.X]: syndicateApp,
    [MobileAppVariant.Pro]: syndicateApp,
};

export function updateMobilePage(metadata: MobileAppMetadata, deepLinkUrl: string, server: string | undefined): void {
    const appleMeta = document.querySelector('meta[name="apple-itunes-app"]')!;
    appleMeta.setAttribute("content", `app-id=${metadata.appleAppId}`);

    if (server) {
        (document.getElementById("header_title") as HTMLHeadingElement).innerText =
            `Join ${server} on ${metadata.name}`;
    }
    (document.getElementById("app_store_link") as HTMLAnchorElement).href = metadata.appStoreUrl;
    (document.getElementById("play_store_link") as HTMLAnchorElement).href = metadata.playStoreUrl;

    if (metadata.fDroidUrl) {
        (document.getElementById("f_droid_link") as HTMLAnchorElement).href = metadata.fDroidUrl;
    } else {
        document.getElementById("f_droid_section")!.style.display = "none";
    }

    const step1Heading = document.getElementById("step1_heading")!;
    step1Heading.textContent = `Download ${metadata.name}`;

    // Step 2 is only shown on the mobile guide.
    if (document.getElementById("step2_container")) {
        document.getElementById("step2_container")!.style.display = "block";
        if (metadata.isProApp) {
            document.getElementById("step2_description")!.innerHTML = "Use your work email to join";
        }
        (document.getElementById("deep_link_button") as HTMLAnchorElement).href = deepLinkUrl;
    }
}
