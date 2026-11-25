# Syndicate suite 0.1.14 — published November 25, 2026

Shared web/macOS/Windows/Linux renderer catch-up to iOS build51.

| iOS capability | Web / desktop handling |
|---|---|
| Adaptive avatar rail | Drag the sidebar separator down to88px; at180px or narrower room rows become avatar-only. Resize wider to restore names/previews. Existing room accessibility labels, unread badges, hover titles and context menus remain. |
| Sidebar corners / theme surfaces | Rounded theme-token sidebar canvas, no hardcoded light background. Selected rail rows use purple/blue highlight. Reduced-motion preference disables transitions. |
| Partial message text selection | Browser-native selection retained; no new copy-only replacement. |
| GIF picker | Existing branded GIPHY picker and production configuration retained. |
| Room mute / schedules | Latest0.1.13 standard Matrix shared-room mute controller and visible manual overrides now included for Windows/Linux and web. A supporting running client is required to drive schedule transitions; browser suspension is not guaranteed scheduling. |
| Composer pane / keyboard | Existing flex layout retains the composer inside the conversation pane. Verify narrow and expanded layouts. |
| iPhone background protection / Watch | Platform-specific; not copied into browser or Electron. |

No account, profile, keyring or encryption database migration/reset. Existing macOS and Squirrel updaters retained; Linux/MSI signed managed discovery retained with the same trust key. Legacy0.1.10 direct-origin bridge endpoints must remain unchanged. Windows remains unsigned preview.

Release gates: focused source/browser checks, production renderer provenance, synthetic full-app layout/selection/notifications, signed notarized universal macOS package and previous0.1.13 upgrade, native Windows/Linux0.1.11 upgrade, exact public payload/recovery hashes, signed channels/feed-last cutover, live web/PWA configuration preservation and desktop/mobile browser verification. Verified delivery details are in [the release receipt](SYNDICATE_SUITE_0.1.14_RECEIPT.json).

## Verified delivery

Web, signed/notarized universal macOS, Windows EXE/MSI (unsigned preview), and Linux DEB/portable packages are published as0.1.14. Native .13->.14 Mac and .11->.14 Windows/Linux upgrade fixtures preserved synthetic profiles and exact renderer hashes; public-byte CI, Mac GitHub/CDN native download/signature acceptance, signed MSI/Linux channels and native origin feeds passed. The original0.1.10 direct-origin bridge remains unchanged. iOS51, Watch, Android and Loader were not rebuilt.

The browser renderer source is2d1db16; the browser-only hashed mobile shell has separate source metadata at `/chat/syndicate-web-shell.json`. WebKit desktop and iPhone-user-agent sign-in/custom-homeserver, inner dialog bounds, PWA identity and no-reload checks passed. Physical iPhone and personal-account migration are not claimed. Older Mac native updaters may omit custom CLI profile flags on automatic relaunch; reopen with the original flags to retain the intended custom profile. Feed rollback does not downgrade installed apps or revoke staged updates; use a new forward version for corrections.
