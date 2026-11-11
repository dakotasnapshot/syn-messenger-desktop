# Matrix-backed room notification schedules

The room schedule uses standard Matrix `dont_notify` override rules, the same server-side mechanism as room mute. It requires no server module, cron, custom endpoint or administrator credentials. The rule applies to this Matrix account across clients, not only the desktop app.

## Ownership and manual settings

The scheduler owns only `app.syn.schedule.mute.v1.` plus the URI-encoded room ID. Its condition matches exactly that room. At quiet hours it adds/enables that rule and verifies the server's response with a fresh push-rules read. At the notifying window, disable, or normal override, it removes only that owned rule and verifies removal. It never rewrites the existing room-specific preferences, standard manual mute rule, or other clients' rules. A manual mute therefore survives schedule resume; the previous normal notification mode is preserved rather than guessed/restored destructively.

The explicit schedule override remains available: follow schedule, keep muted, or use normal preferences. Normal preferences do not force alerts through an independent manual mute or OS Focus.

## Lifecycle

A per-client controller starts/stops with the notifier. A wall-clock-aligned minute timer handles boundaries without requiring messages or foreground interaction. Sync, focus, visibility changes and reconnection recheck the policy; after sleep it applies the current state instead of replaying missed boundaries. A fresh server baseline at startup/wake avoids trusting stale cached push rules. Unknown/unhydrated policies never authorize removing an existing mute. Mutations are serialized; an edit arriving during a network operation triggers another reconciliation. Acknowledged operations are deduplicated while awaiting sync. Failed writes/readbacks surface as unconfirmed in the editor and retry on the next reconciliation.

This is an app-owned scheduler, not an always-running service: when all supporting clients are closed, the last server mute remains until one reopens and reconciles. Closing the app does not reliably run a future unmute. Days, overnight windows, DST and time zones retain the existing delivery-time evaluator. Local suppression remains defense in depth, not the server-side enforcement mechanism.

## Compatibility and explicit migration

Version1 schedule account data gains optional `enforcement: "matrix" | "local"`. Missing enforcement retains the older local-only behavior; no previously saved schedule silently changes other clients' notifications merely by installing a new build. New schedules default to Matrix mode. The editor discloses account-wide effects and the closed-app limitation; explicitly saving upgrades a legacy schedule to Matrix mode. Older supporting clients ignore the extra field and retain their existing local filtering. The custom server module and old cron remain retired.

## Verification

Focused regression coverage includes exact 05:00/13:00 boundaries, no-message transitions, wake catch-up, failed writes/readbacks, manual-mute/preference preservation, explicit migration, account isolation, unknown policy hydration and edits during in-flight writes. A server API probe uses only an agent-owned account and a nonexistent synthetic room ID, verifies the standard rule and preservation of an independent manual rule, then restores the original rule set. It sends no messages and alters no real-room settings. Native packaged acceptance, signed/notarized artifacts and delivery receipts are required before announcing release.
