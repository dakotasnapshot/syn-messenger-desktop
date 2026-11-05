# Syndicate desktop 0.1.9 — Windows/Linux parity

Windows and Linux 0.1.9 bring the desktop features from macOS 0.1.8 to the other desktop packages. macOS, mobile clients and Loader are unchanged.

## Features

- GIPHY trending/search, attribution and GIF attachment preview through the existing Matrix upload/encryption pipeline.
- Local image URL previews and encrypted-room link previews enabled by default.
- Notification-based unread badges and Syndicate branding.
- Existing profile selection preserved. Linux also recognizes the hyphenated runtime name and retains the prior keyring identity when selecting a 0.1.5 profile. Named profiles remain isolated; existing original profiles take precedence.

## Published artifacts

| Installer | Bytes | SHA-256 |
|---|---:|---|
| [Syndicate-0.1.9-Linux-x86_64.deb](https://synmessenger.com/downloads/Syndicate-0.1.9-Linux-x86_64.deb) | 137542192 | `4cfce0f050797b4905403026ac96ca56d4f111553458753434f5ff4f63dfeac6` |
| [Syndicate-0.1.9-Linux-x86_64.tar.gz](https://synmessenger.com/downloads/Syndicate-0.1.9-Linux-x86_64.tar.gz) | 169690118 | `f5f49a98c4e7c943378ab4257029415c227c6f53a0949f67c14a51fb6868249a` |
| [Syndicate-0.1.9-Windows-x64.msi](https://synmessenger.com/downloads/Syndicate-0.1.9-Windows-x64.msi) | 148656128 | `4942056767a0e31f35b82255aaa3bc964c7d9f6459cdf418c790c973f1f09844` |
| [Syndicate-Setup-0.1.9-Windows-x64.exe](https://synmessenger.com/downloads/Syndicate-Setup-0.1.9-Windows-x64.exe) | 189509632 | `56f472914b524570be3756e74491a92ad90081e3c0241ff6fe0b76fa03bd2a49` |

Historical installers and website download counters remain intact. The checksum manifest is available at [SHA256SUMS.txt](https://synmessenger.com/downloads/SHA256SUMS.txt).

## Exact public source

- Windows: [1433809454953ed41fcdb9f068a9b6d81bb22e65](https://github.com/dakotasnapshot/syn-messenger-desktop/commit/1433809454953ed41fcdb9f068a9b6d81bb22e65).
- Linux: [e862df65277328c5b79e026841b65a0f2efebdd5](https://github.com/dakotasnapshot/syn-messenger-desktop/commit/e862df65277328c5b79e026841b65a0f2efebdd5). The earlier Linux candidate was not published because final package inspection exposed the hyphenated-profile-name mismatch.

Each packaged renderer contains `syndicate-release.json` with its exact source commit and version. Element attribution and AGPL licensing remain unchanged.

## Reusable build and acceptance procedure

1. Select an unused release version and reviewed source ref. Preserve unrelated checkout changes. Use the platform release workflows for reproducible native packages.
2. Build the customized web client from this repository; never fetch upstream prebuilt Element as the renderer. The explicit Nx application names are required for clean project-graph resolution.
3. Supply `GIPHY_API_KEY` through deployment configuration outside git. `apps/desktop/scripts/package-syndicate-web.ts` requires `VERSION` and the deployment key, writes renderer provenance, and verifies packed configuration. Missing or placeholder configuration must fail the release.
4. Run feature regressions after building shared dependencies. The disposable Synapse acceptance test exercises GIF trending/search/attribution, preview, encrypted send and encrypted media metadata without real account fixtures.
5. Inspect native artifacts, not only project display names: verify version, architecture, profile identity, embedded renderer source/configuration and feature code. For Linux, compare the DEB and tar app/renderer archives and check the package control metadata.
6. Exercise a previous-install Windows Squirrel upgrade. The current acceptance workflow targets 0.1.5 → 0.1.9; update its previous/candidate version and artifact-name constants before reusing it for another release.
7. Stage payloads privately and verify whole-file SHA-256 before publication. Keep installer filenames immutable and retain historical releases. Publish payloads before replacing page/checksum/update manifests; publish Squirrel `RELEASES` last.
8. Verify public page readback, source links, file sizes, checksums, HTTP ranges, update-feed contents/cache headers and desktop/mobile rendering. Preserve per-version counters and homepage totals. Keep deployment-specific access, rollback and operations details outside the public repository.

Useful local commands after dependency installation:

```sh
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm --filter element-web build
pnpm exec nx run playwright-common:build:playwright
pnpm exec vitest run apps/web/src/utils/GiphyClient.test.ts apps/web/src/components/views/rooms/MessageComposerUrlPreview.test.tsx apps/desktop/src/args.test.ts apps/desktop/src/config.test.ts
# VERSION and GIPHY_API_KEY come from release configuration, never committed values.
node apps/desktop/scripts/package-syndicate-web.ts
# In apps/web, with Docker and the matching Chromium installed:
pnpm exec playwright test --config playwright.parity.config.ts --project=Chrome playwright/e2e/file-upload/gif-picker.spec.ts
```

## Update delivery and limits

Windows Squirrel EXE installs use [RELEASES](https://synmessenger.com/desktop/update/win32/x64/RELEASES) and the adjacent `syn-messenger-0.1.9-full.nupkg`. The feed requires a fresh lookup (`Cache-Control: no-cache, max-age=0, must-revalidate`) and the referenced payload supports byte ranges. Its SHA-1 and byte size must match the Squirrel manifest exactly. Preserve the package ID and NuGet filename; descriptive website installer names are separate.

MSI and Linux DEB/tar.gz installations require manual installation. Do not claim automatic updates for those package types. Publishing an update feed is not evidence that every client has installed it. Windows code signing remains pending; unsigned-preview labeling is retained.

## Verified release gates

- [Windows native build](https://github.com/dakotasnapshot/syn-messenger-desktop/actions/runs/42017041651): passed.
- [Corrected Linux native build](https://github.com/dakotasnapshot/syn-messenger-desktop/actions/runs/42019953709): passed, including 37 GIF/profile/config regressions.
- [Shared renderer encrypted-GIF acceptance](https://github.com/dakotasnapshot/syn-messenger-desktop/actions/runs/42018676902): passed, including 38 initial feature/profile/config regressions. The subsequent Linux profile change added three regressions; the renderer was unchanged.
- [Windows previous-install upgrade](https://github.com/dakotasnapshot/syn-messenger-desktop/actions/runs/42018466430): passed; installed renderer matched the candidate hash.
- All four published server files match whole-file SHA-256 receipts. Both Windows installers also passed full HTTPS-body checksum readback. Linux public verification checks HTTP success, lengths and matching first/last byte ranges; it does not claim a second full HTTPS-body hash.

Native Linux GNOME/KWallet decryption using an existing real account and native Windows encrypted-GIF interaction were not exercised with personal accounts. Profile selection/keyring-name regressions, platform package checks and the shared-renderer encrypted Matrix acceptance are the release evidence; no real user stores were modified or reset.
