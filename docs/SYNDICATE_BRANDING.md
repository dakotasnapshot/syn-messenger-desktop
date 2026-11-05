# Syndicate product branding

The shared desktop/web source uses **Syndicate** as the installed product and fallback UI name, and **Syndicate Call** for call labels. Product logos use `apps/web/res/img/syndicate-logo.svg`; the mobile guide includes the same SVG. `vector-icons/` retains compatible URLs but contains Syndicate artwork. The source manifest, HTML entry, configuration-error screens, mobile guide, download links, social-preview fallback and translation display values must not advertise upstream Element apps.

Run `python3 scripts/check-syndicate-branding.py` before packaging. It checks all translation catalogs, entry pages, manifest display values and source product-logo inventory. Webpack explicitly copies fallback SVG assets so startup/error screens do not depend on a desktop release config or a network logo request.

## Intentional upstream references

Copyright notices, license identifiers, upstream attribution, third-party dependency/package names, Matrix event/widget namespaces, stored-data keys and legacy configuration variant keys are not product branding. Preserve these where required for licensing, interoperability and account/crypto-store continuity. DOM `Element`/`HTMLElement`, JSX element types and ordinary UI-element terminology are programming interfaces, not references to the upstream app. `isElementBranded` remains an upstream-brand detector; Syndicate must not enable Element-specific promotions by renaming that comparison.

Legacy mobile-guide variant configuration selects Syndicate metadata rather than upstream app-store listings. Android links lead to the Syndicate downloads page; do not present a Play Store badge when no verified public Play listing is configured. The alternative sign-in action opens Syndicate Web, not an unsupported branded deep-link endpoint.

This source cleanup is not a published installer or web deployment. A new release must pass the platform-specific packaging/publication runbooks. Do not overwrite a previously published immutable installer with rebuilt contents.
