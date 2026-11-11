# Scheduled room mute — one shared control

The scheduler calls the same `setRoomNotifsState` function as ordinary room notification controls. There is exactly one standard Matrix room mute (`override` rule ID = room ID). There is no scheduler-owned secondary mute rule and no extra local delivery filter for Matrix-backed schedules. Every ordinary mute indicator reads the same standard state.

Existing schedule storage (`app.syn.notification_schedule`), weekdays, time windows and timezone remain. Explicit Save opts older local-only schedules into Matrix-backed muting. The rejected separate-rule candidate was never released; its tests/notarization do not constitute acceptance of this revised implementation.

## Manual control

Every call from a normal notification control uses the default `manual` source. For a Matrix-backed policy, it saves the existing visible schedule override (`mute` or `normal`) before changing the ordinary room rule. The override lasts until the user selects **Follow schedule** and saves. The scheduler supplies `schedule` as its source; it does not turn its own writes into manual overrides.

Both sources use one per-client/per-room serialized operation queue. A scheduled write is revalidated after acquiring that queue so an intervening manual override cannot be silently undone by a stale scheduled operation. A failed operation does not poison later queued requests. SDK sync/readback exposes the same persisted rule everywhere.

The scheduler reads fresh server push rules on reconciliation, calls the common operation only when the actual mute differs from the desired state, then reads back and verifies the actual room mute. Unknown policies and failed hydration do not authorize changes. Disabling a policy stops driving the current mute rather than silently unmuting it.

Manual controls in older/other clients do not write Syndicate’s schedule override metadata. Their standard room-rule changes synchronize normally, but a running scheduler following an active policy may apply that policy again. Cross-client manual-override handling must be covered before claiming equivalent override support in those clients.

## Clock and lifecycle

The native Electron main-process minute clock and resume event drive reconciliation even when the renderer is minimized. Focus, online, sync and a renderer fallback also reconcile. These paths do not change background throttling, page visibility, read receipts or system sleep. Logout stops the captured controller, IPC subscription and timers.

Transitions require a running, online supporting client. When all supporting clients are closed, the last standard Matrix mute remains until a client resumes. There is no custom server module or server-side scheduler.

## Validation / release

Revised tests cover one standard visible mute, exact 13:00/05:00 transitions, manual mute/unmute overriding scheduled state, visible Follow schedule resumption, delayed-write/manual-click ordering, server failures, legacy opt-in and disabling. Run renderer type checks, schedule/Notifier tests and existing room-notification regressions. The revised packaged UI must show the same state at every control and prove a manual unmute works during quiet hours without any hidden filter.

Do not publish the rejected independent-rule candidate or reuse its native acceptance receipts. Rebuild complete universal packages after ASAR changes: all embedded `ElectronAsarIntegrity` plist maps must be regenerated, not just the outer signature. Native launch is required before notarization. Preserve runtime/profile/keyring identity and private user stores. Final app/DMG signing, notarization, upgrade acceptance, immutable assets, public hashes, recovery readbacks and feed/site/wiki gates remain mandatory.
