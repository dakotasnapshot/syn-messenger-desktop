# SYN Messenger Desktop

SYN Messenger Desktop tracks Element Web/Desktop and ships under the upstream AGPLv3 option.

## Baseline

- Upstream: `element-hq/element-web`
- Initial tag: `v1.12.27`
- Desktop bundle ID: `app.syn.messenger.desktop`
- Product name: `SYN Messenger`

## iOS parity map

Desktop configuration carries SYN branding, iconography, generic Matrix.org onboarding, arbitrary homeserver login, SYN permalinks, support/legal links, default dark styling, and Retro 1/Retro 2 themes. Element Desktop already provides room-avatar editing, presence UI, desktop notifications, and room-level appearance controls.

Encrypted rooms work in 0.1.0. Local full-text search inside encrypted message history does not: the release omits the optional native `matrix-seshat` module.

Watch transport, iOS notification-service rendering, Apple communication notifications, and SwiftUI wallpaper storage are platform-specific and are not copied into Electron.

## Roadmap

### Automatic updates

- macOS clients poll `https://synmessenger.com/desktop/update/macos/releases.json` after launch and hourly.
- Signed updates download in the background and expose the existing **Restart to Update** action.
- Publish the notarized universal ZIP and release metadata atomically; retain the DMG for first-time installation.
- A desktop release is not complete when only the download-page DMG is published. Before announcing a release, verify the live feed's `currentRelease`, the updater ZIP URL, its full SHA-256, byte-range support, and an upgrade check from the previous installed version.
- Upload the ZIP to a temporary filename first, verify it on the server, rename it into place, and replace `releases.json` last. This prevents field clients from seeing a partial or missing payload.
- Never point SYN builds at Element's upstream update feed.

### Native encrypted-room search

- Add supported Rust toolchain and build `matrix-seshat` for both `arm64` and `x86_64`.
- Package universal native module without weakening hardened-runtime settings.
- Sign and notarize native library with rest of app bundle.
- Test indexing, search after restart, database migration, and recovery on Apple Silicon and Intel.
- Ship only after mounted-DMG Gatekeeper verification passes.

## Build

From `apps/desktop`:

```sh
pnpm install --frozen-lockfile --filter element-desktop
pnpm run fetch --noverify --cfgdir syn/release v1.12.27
cp syn/release/build.json variant.json
VARIANT_PATH=syn/release/build.json pnpm run build
```
