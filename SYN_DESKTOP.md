# SYN Messenger Desktop

SYN Messenger Desktop tracks Element Web/Desktop and ships under the upstream AGPLv3 option.

## Baseline

- Upstream: `element-hq/element-web`
- Initial tag: `v1.12.27`
- Desktop bundle ID: `app.syn.messenger.desktop`
- Product name: `SYN Messenger`

## iOS parity map

Desktop configuration carries SYN branding, iconography, generic Matrix.org onboarding, arbitrary homeserver login, SYN permalinks, support/legal links, default dark styling, and Retro 1/Retro 2 themes. Element Desktop already provides room-avatar editing, presence UI, encrypted-room search, desktop notifications, and room-level appearance controls.

Watch transport, iOS notification-service rendering, Apple communication notifications, and SwiftUI wallpaper storage are platform-specific and are not copied into Electron.

## Build

From `apps/desktop`:

```sh
pnpm install --frozen-lockfile --filter element-desktop
pnpm run fetch --noverify --cfgdir syn/release v1.12.27
cp syn/release/build.json variant.json
VARIANT_PATH=syn/release/build.json pnpm run build
```
