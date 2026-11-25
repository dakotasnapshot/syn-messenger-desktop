# Syndicate suite 0.1.14 — development

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

Release gates: focused source/browser checks, production renderer provenance, synthetic full-app layout/selection/notifications, signed notarized universal macOS package and previous0.1.13 upgrade, native Windows/Linux0.1.11 upgrade, exact public payload/recovery hashes, signed channels/feed-last cutover, live web/PWA configuration preservation and desktop/mobile browser verification. This document is not a release receipt.
