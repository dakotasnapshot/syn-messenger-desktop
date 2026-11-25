# SYN web deployment

SYN Web at `/chat/` uses this repository's customized renderer, not an upstream prebuilt Element archive. Desktop release publication does not deploy the web app automatically.

1. Build with the intended `VERSION` in the environment before Webpack runs. Inspect the baked WebPlatform version and the emitted `version` file; they must agree. Overwriting only the marker after a build can cause repeated reload/update prompts. Bypass stale build caches when changing this input, or use a verified native release renderer whose embedded version already matches.
2. Verify the renderer's source provenance, generic SYN configuration and required deployment settings. Keep deployment credentials out of source and logs. Preserve upstream licensing and publish the matching source checkpoint.
3. Read the live browser configuration before deployment. Preserve browser device identity, server choices, existing settings and deployment configuration rather than blindly copying desktop configuration.
4. Preserve the SYN web/PWA manifest, scope, icons, branded head tags and pre-bundle mobile full-web bootstrap. They are browser-specific customizations, not desktop packaging assets.
5. Stage privately with rollback copies outside the public tree. Publish complete assets before index/version metadata, retain old hashed bundles for open tabs, and ensure public files/directories have appropriate readable/traversable modes. Do not clear browser storage or encryption databases as an update step.
6. Verify public HTTP responses, matching baked/served versions, desktop and actual mobile-user-agent loading, sign-in entry, PWA identity and absence of reload loops or JavaScript errors. State separately whether authenticated features were tested with synthetic accounts; do not use personal account data as a test fixture.
7. Record verified hosting, access, rollback and operational evidence in the private infrastructure documentation. A working build or transport upload alone is not a delivered web app.

## Safari and repeatable release checks

Use a real WebKit engine for Safari coverage, including an iPhone user-agent viewport, sign-in/custom-homeserver entry, manifest scope/icons, document-navigation counts (hash navigation is not a reload), and actual message selection/composer bounds. Synthetic authenticated tests that need network interception must account for service workers; prefer a real local synthetic Matrix HTTP fixture so service-worker fetches are exercised. Never interpret DNS failure for an intercepted `.invalid` fixture as an application failure. Native schedule acceptance must start at an explicit synthetic wall-clock time rather than assuming the release happens during quiet hours.

Release installers use explicit workflow dispatch versions. Never rebuild a historical fixed version on every source push; code changes need a new immutable release version. Preserve matching source provenance even when a later documentation/CI-only commit updates the runbook.

Browser-only mobile shell styles live at `apps/web/syn/web/syndicate-mobile-shell.css`. Deploy as a content-hashed stylesheet linked after renderer theme links, retain prior hashed shell assets, and record renderer source plus shell source separately. At phone widths the homeserver dialog must fit its own content, not merely avoid document-level horizontal overflow; assert dialog bounds and scrollWidth/clientWidth and inspect screenshots. Desktop app.asar/webapp.asar must never receive browser deployment configuration as an incidental shell update.
