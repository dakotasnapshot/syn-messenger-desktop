# Scheduled room notifications (macOS implementation)

Room settings → Notifications → Scheduled notifications. Select days, start/end times and an IANA timezone, enable the schedule and Save. Overnight windows belong to their starting day. Start is inclusive and end exclusive; DST follows the chosen timezone even while travelling.

The Schedule override picker offers Follow schedule, Keep muted in Syndicate until I resume, and Use normal notifications until I resume. Overrides are explicit saved settings, do not expire automatically, and sync with the schedule. Returning to Follow schedule resumes it. Normal notifications means the ordinary Matrix preferences still apply; it does not force alerts through a manual Matrix mute, operating-system Focus or disabled notifications.

## Compatibility and scope

Uses only standard Matrix room account data (`app.syn.notification_schedule`) on the user's authenticated account. No Synapse module, server administrator access, cron, service, stored scheduler token or Matrix push-rule mutation. Compatible API on stock Matrix homeservers and matrix.org. Other clients ignore the custom setting. Only Syndicate builds implementing this contract enforce it; installing an older Syndicate/iOS/Android build does not add support remotely.

Banners, notification sounds and room-event notification handling evaluate the saved schedule at delivery time, including after wake. No timer is needed to wake the app at a boundary. Closing macOS Syndicate means it emits no local notifications; this implementation does not schedule iOS background pushes or change room messages, read receipts, unread counts, account-wide notification settings or other members' preferences.

## Sync and edits

The SDK's per-account room-data cache supplies the canonical synced setting. Successful saves apply locally immediately while waiting for the sync echo. Remote sync supersedes pending local data; an old save response cannot overwrite a newer sync/edit. Incoming settings are never uploaded automatically, avoiding writeback loops. Unsaved drafts are preserved when another device changes the setting; the conflict notice offers Reload synced schedule, or an explicit Save replaces the server value. Concurrent writes to the same room use Matrix's ordinary last-write-wins semantics; distinct rooms are independent. Offline saves report failure and do not silently apply an unsaved change. Existing synced settings can still be evaluated offline. Unknown/malformed versions are ignored rather than modifying server state.

Version1 JSON: enabled (boolean), days (ISO Monday1–Sunday7), start_minute/end_minute (0–1439, distinct), timezone (IANA), optional override (schedule/mute/normal). The namespace is private account data, not shared room state. Old private custom-endpoint prototype data is not silently migrated/enabled.

## Validation and release state

86 focused Jest tests cover schedule boundaries, overnight/week wrap, repeated/skipped DST hours, explicit overrides, invalid input, account isolation, remote sync, stale-save-response races, failed writes, settings UI and actual Notifier entry points/regressions. Production renderer webpack build passes (existing asset warnings); Electron main-process TypeScript passes. Full renderer type check has three existing upstream Matrix SDK42.3.0 QR-login crypto type errors from WASM SecretsBundle.to_json(): unknown. No crypto dependency/runtime changes were made for this feature.

No public release or automatic-update publication is established by these source/build checks. Native packaging, mounted signature checks and runtime acceptance are separate gates. Preserve runtime/profile/keyring identity and existing user stores. iOS follows separately and requires validating Apple's filtering entitlement and real background-notification behavior.
