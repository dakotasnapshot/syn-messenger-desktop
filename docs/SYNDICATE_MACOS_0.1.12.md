# Syndicate macOS 0.1.12 — published November 10, 2026

macOS-only release built from `e1d3e9a25df7517ea3195bc3df5c644451ce8a13`. Windows, Linux, iOS, Android and Loader are unchanged.

## Scheduled room notifications

Room settings → Notifications → Scheduled notifications lets users select weekdays, a time window and a time zone, or keep the room muted/use normal notifications until they resume the schedule. Outside the selected window, Syndicate suppresses its own banners and sounds; normal Matrix notification preferences still apply inside it. Other Matrix apps are unaffected.

The schedule is standard per-room Matrix account data (`app.syn.notification_schedule`), not a custom homeserver API or server module. It works with stock Matrix servers. Settings synchronize between supporting Syndicate clients; this release does not add schedule enforcement to unchanged mobile or older clients. Concurrent saves use normal Matrix last-write-wins semantics. Unsaved drafts are preserved when remote edits arrive, with an explicit reload/conflict notice.

## Verified release gates

- Full renderer and Electron type checks, production renderer build and 98 focused regressions passed at the source checkpoint.
- Isolated frozen dependency installation and 34 desktop profile/configuration regressions passed.
- Universal app contains x86_64 and arm64, expected source provenance and production configuration. Stable bundle ID `app.syn.messenger.desktop` and runtime/profile/keyring name `SYN Messenger` are unchanged.
- Deep strict code-signature verification passed with a newly issued Developer ID Application identity. The candidate satisfies the previous public 0.1.8 app's designated requirement.
- Native 0.1.8 updater downloaded, signature-validated and installed the exact final candidate ZIP; installed app/renderer hashes match. Automatic relaunch was observed. Custom command-line profile flags were not retained by the old updater: original profile data survived and reopened correctly when restarted with the original flags. Users of custom/named CLI profiles should reapply their launch arguments after this old-client update.
- Packaged Apple Silicon app launches and returns version 0.1.12 over native IPC. Native event-indexing support is available.
- Packaged schedule UI saved standard Matrix account data against intercepted synthetic responses. Packaged notifier evaluation suppressed popup/audio paths while muted and restored both for normal override. This fixture forces notification eligibility and spies on delivery calls; it is not real-account encryption, live multi-device sync or OS banner/sound acceptance.
- Apple accepted the app notarization; its ticket is stapled and Gatekeeper accepts it as Notarized Developer ID. The app mounted from the candidate DMG also passes Gatekeeper and deep strict signature verification, with matching payload hashes.
- Intel binary contents are verified, but Intel execution is unverified: Rosetta is unavailable on the build host.

## Published delivery

[GitHub release](https://github.com/dakotasnapshot/syndicate-releases/releases/tag/desktop-v0.1.12) and [download page](https://synmessenger.com/downloads/).

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| [Syndicate-0.1.12-macOS-universal.dmg](https://github.com/dakotasnapshot/syndicate-releases/releases/download/desktop-v0.1.12/Syndicate-0.1.12-macOS-universal.dmg) | 483628880 | `8ae9c68f8ba288536d3c685eed3c3f3546a9ce84ee1bdf8ac42140ab1a8e1427` |
| [Syndicate-0.1.12-macOS-universal.zip](https://github.com/dakotasnapshot/syndicate-releases/releases/download/desktop-v0.1.12/Syndicate-0.1.12-macOS-universal.zip) | 415568130 | `c269523fcbf49552dc4a8b7941a2ff57b02835d8f1527184f3d6b9412116e00f` |

Both app and DMG were Apple notarized, stapled and validated. GitHub asset digests, [public whole-file verification](https://github.com/dakotasnapshot/syndicate-releases/actions/runs/42913961009) and fresh mounted off-host recovery readbacks match. Byte ranges passed for both payloads. The previous public 0.1.8 native Squirrel client also downloaded and signature-accepted the real GitHub/CDN URL, with a matching staged renderer hash.

The native Mac feed at `/desktop/update/macos/releases.json` advertises 0.1.12 using the immutable GitHub ZIP. Discovery is revalidated with `Cache-Control: no-cache, max-age=0, must-revalidate`; versioned payload bytes remain immutable. Public desktop/mobile download-page rendering passed. Other platforms, their bridge feeds and historical installers are retained. This establishes publication and tested upgrade behavior, not installation on every user's Mac.

## Rebuild and recovery

Select an unused release version and immutable source ref, preserve unrelated working-tree changes, and build in an isolated checkout when packaging resources have local edits/deletions. Install the pinned dependencies with frozen-lockfile checks. Use `pnpm exec electron-builder` so the pnpm workspace collector is selected; a direct Node invocation without package-manager environment can choose npm instead. Supply VERSION, the SYN release variant and deployment configuration outside source. Preserve the runtime/profile identity above.

For Developer ID signing, verify the returned certificate matches the prepared private key, use an explicitly selected signing keychain and a real timestamped hardened-runtime signing probe, then notarize the exact distributed artifacts. A public certificate by itself is not a usable private-key identity. Keep encrypted identity recovery copies and credentials outside public source/artifacts. Follow the project release workflow; do not overwrite published installer bytes or advance discovery until native acceptance, public delivery and recovery readback have passed. Update payloads before metadata, preserve the old channels, and use a forward version for corrections affecting installed clients.

See [notification contract](SYNDICATE_NOTIFICATION_SCHEDULES.md), [desktop overview](../SYN_DESKTOP.md) and [managed-update requirements](SYNDICATE_MANAGED_UPDATES.md). Existing Windows/Linux bridge channels and historical installers must remain intact.
