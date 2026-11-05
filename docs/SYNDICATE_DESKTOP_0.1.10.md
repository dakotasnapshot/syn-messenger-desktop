# Syndicate desktop and web 0.1.10

MSI and Linux installations now check/download updates inside the app and use the existing install/restart action. MSI uses Windows Installer authorization; Debian uses desktop Polkit; portable Linux requires a writable application parent and an external profile directory. macOS and Squirrel retain their established update mechanisms.

Older MSI/Linux binaries require one bootstrap installation because they have no updater. Windows remains an unsigned preview; authenticated update metadata is distinct from OS code signing.

## Exact source and acceptance

All published Windows/Linux payloads and the web renderer were built from [7fb2e23121ba0a8dd6c28b3d99c303688683cba9](https://github.com/dakotasnapshot/syn-messenger-desktop/commit/7fb2e23121ba0a8dd6c28b3d99c303688683cba9).

- [Linux build and native upgrade](https://github.com/dakotasnapshot/syn-messenger-desktop/actions/runs/42042830131): passed.
- [Windows build and native MSI upgrade](https://github.com/dakotasnapshot/syn-messenger-desktop/actions/runs/42042834807): passed.
- [Exact packaged acceptance](https://github.com/dakotasnapshot/syn-messenger-desktop/actions/runs/42044737264): passed Debian installation, two consecutive portable updates/rollback rotation, MSI installation and executable relaunch with the preserved synthetic profile, and Squirrel 0.1.9 → 0.1.10 upgrade.
- 93 targeted local regressions and desktop TypeScript checks passed. Both platform packages contain the customized GIF renderer, deployment configuration, stable profile/runtime identity, pinned update key and About/Check for Updates IPC capability.

The native harness uses synthetic profile data and test signing metadata. Headless Debian substitutes sudo for Polkit; interactive authentication UI and existing personal-account/keyring decryption were not tested or reset. Shared-renderer encrypted-GIF acceptance from 0.1.9 remains applicable because feature source was unchanged.

## Public installers

| Installer | SHA-256 |
|---|---|
| [Syndicate-0.1.10-Linux-x86_64.deb](https://synmessenger.com/downloads/Syndicate-0.1.10-Linux-x86_64.deb) | `6c3efbe86ee1da11267205f1f381f22c981c574876dd8bcc1b5240587874d688` |
| [Syndicate-0.1.10-Linux-x86_64.tar.gz](https://synmessenger.com/downloads/Syndicate-0.1.10-Linux-x86_64.tar.gz) | `772d0bcbde0bd8f27ebe15724d7e247c69d3ef9b887c1b90e51802864f8edeac` |
| [Syndicate-0.1.10-Windows-x64.msi](https://synmessenger.com/downloads/Syndicate-0.1.10-Windows-x64.msi) | `89060ce94a03742992f8a3295f7311a3646da462cd36de73c25910fb77fa297d` |
| [Syndicate-Setup-0.1.10-Windows-x64.exe](https://synmessenger.com/downloads/Syndicate-Setup-0.1.10-Windows-x64.exe) | `a415e1bcdeb513fa25fb5c3c7e99a19d45fe3c9aca08abf2716a59a77f17ecad` |

Historical installers and checksum entries remain available. Whole-file server SHA-256 matched every immutable staged payload. Public feed envelopes/signatures/cache headers, installer lengths and matching first/last byte ranges were verified; this is not a second full HTTPS-body hash of every installer.

## Delivery

- [MSI feed](https://synmessenger.com/desktop/update/managed/win32/x64/msi.json)
- [Debian feed](https://synmessenger.com/desktop/update/managed/linux/x64/deb.json)
- [Portable feed](https://synmessenger.com/desktop/update/managed/linux/x64/tar.gz.json)
- [Squirrel feed](https://synmessenger.com/desktop/update/win32/x64/RELEASES)

Publish complete immutable payloads before replacing manifests. Preserve the offline signing key and restricted verified recovery copies. See [managed-update architecture](SYNDICATE_MANAGED_UPDATES.md) and [web deployment](SYN_WEB_RELEASE.md).

SYN Web at `/chat/` uses the matching 0.1.10 renderer, with baked and served versions aligned, browser configuration and PWA/mobile shell preserved. Public desktop/mobile-user-agent loading, sign-in entry, version consistency and absence of JavaScript errors were verified. Old bundles and private rollback copies remain. The downloads page retains seven current counters and forty historical installer rows.
