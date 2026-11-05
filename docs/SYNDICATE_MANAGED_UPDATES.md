# MSI and Linux managed updates

Beginning with 0.1.10, MSI installations, Linux Debian packages and writable portable tar installations check for updates 30 seconds after launch and hourly. Downloads are staged inside the existing profile directory, authenticated with pinned Ed25519 release metadata and verified for exact size/SHA-256. The existing update notification and restart/install action are reused. Nothing is elevated or installed merely by launching or quitting.

MSI uses the Windows Installer upgrade path and normal Windows authorization. Debian uses Polkit (`pkexec`) and `dpkg --install`, without broad system package repair. Portable Linux replaces its identified application directory via an adjacent-directory rename and retains one managed previous-version directory; it never changes the profile, Matrix stores or keyring identity. The portable directory's parent must be writable, and custom profile storage must be outside the application directory; unsafe in-tree profiles are refused rather than moved/reset. System-managed tar installations must be moved to a user-writable location or converted to an appropriate package; the updater reports permissions errors rather than silently elevating a portable directory replacement. A desktop Polkit authentication agent is needed for Debian updates.

macOS and Windows EXE/Squirrel keep their existing update paths. Releases before 0.1.10 do not contain the new updater and require **one bootstrap installation**. There is no mechanism to remotely patch that into an already-installed old MSI/Linux binary. No updater claims installation merely because a payload was published.

## Static signed feeds

`/desktop/update/managed/{win32|linux}/x64/{msi|deb|tar.gz}.json` contains an envelope with a base64 payload and detached Ed25519 signature. The payload has `version`, `platform`, `arch`, `kind`, immutable HTTPS `url`, `size`, `sha256`, `releaseNotes` and ISO `releaseDate`. Installer URLs are restricted to the SYN download origin/path; redirects, wrong platforms/packages, oversized payloads, invalid signatures, downgrade/equal versions and checksum mismatches are rejected. Installation re-verifies the staged bytes.

The public key is pinned in `managed-update-manifest.ts`; keep its private counterpart outside source/build artifacts and preserve it for future releases. Changing the trust key requires an already-trusted client update. Sign manifests only after package/native acceptance succeeds. Publish immutable installers first, verify complete server hashes, then replace signed manifests atomically. Retain historical packages and feeds for rollback/evidence. Never overwrite a published version's installer with different bytes.

## Validation

Run manifest/updater tests, profile/config regressions and desktop TypeScript checks. Native release workflows additionally install the previous public MSI/DEB/tar package and exercise the real candidate updater module with the just-built candidate. The disposable harness replaces only a **test copy** of the public key with an ephemeral test key; production modules remain pinned. Headless Debian tests substitute `sudo` for Polkit while exercising the same `dpkg` argv; do not describe that as interactive Polkit UI validation. Verify the installed renderer hash and synthetic profile marker. No personal account stores are used.

## Runtime integration and acceptance

- Return the managed feed from the existing `getUpdateFeedUrl` IPC method, because the renderer uses it to enable About → Check for Updates. Keep native Squirrel/macOS feed discovery as the fallback.
- Use Electron's `original-fs` promises for real portable archive staging, access, renames and cleanup. Its normal filesystem presents ASAR files as virtual directories; use the patched filesystem only to read embedded package identity.
- Start Windows PowerShell through the independent `cmd start` launcher, not directly with `DETACHED_PROCESS`. The helper retains normal user privileges, requests Windows Installer authorization, acknowledges admission through a private file, waits for installation and the old process, then relaunches the app. Keep installer errors in the private update cache.
- Run Electron acceptance from an asynchronously invoked main function rather than awaiting `app.whenReady()` at ESM entry scope. Locate arguments relative to the script path so Electron switches do not shift package arguments. Use normal app shutdown for successful smoke checks.
- Test against the exact updater modules extracted from the candidate `app.asar`. Treat optional source-only preflight as development feedback, not packaged acceptance. Test a second portable update to verify rollback rotation, and tolerate only transient missing paths while polling an atomic swap; require the final installed hashes.
- Verify both installed payload hashes and preserved synthetic profile markers. On Windows, also verify that the updated executable relaunches. Do not reset real account stores or equate headless `sudo` testing with interactive Polkit/UAC acceptance.

## Release tooling

Use `scripts/sign-managed-release.mjs` with an outside-repository private key to produce the authenticated envelopes after native gates pass. Keep recovery copies restricted and verify their full readback. Publish payloads before feed metadata; verify public envelopes with the pinned key, fresh cache headers, exact lengths and byte ranges. Feed rollback does not downgrade installed clients or revoke already-downloaded updates; use a forward fix when needed.

## GitHub delivery transition (next client, not shipped in 0.1.10)

Release payloads are mirrored under `https://github.com/dakotasnapshot/syndicate-releases/releases/download/desktop-vVERSION/FILENAME`. New source accepts signed installer URLs only for that exact repository, version tag and package filename, and follows bounded HTTPS redirects only to GitHub's release-asset CDN. Signed size/SHA-256 limits and pre-install verification remain mandatory. Arbitrary repositories, mutable `latest` URLs, credential/query overrides on the signed URL, HTTP and off-CDN redirects are rejected.

The next client reads signed envelopes from `https://raw.githubusercontent.com/dakotasnapshot/syndicate-releases/main/channels/stable/{win32|linux}/x64/{msi|deb|tar.gz}.json`. The existing offline release key remains pinned; GitHub access alone cannot forge an authenticated update. Release signing tooling imports the same maintained URL validator as the client (Node >=22.18), not a stale compiled copy.

**Do not rewrite 0.1.10's existing `/desktop/update/managed/` feeds to GitHub URLs.** Installed 0.1.10 clients require direct same-origin installers and reject redirects. Those origin endpoints must offer a bridge client with a direct local installer, even after website downloads switch to GitHub. Once that bridge is installed, subsequent downloads can come entirely from GitHub. No existing account/profile/keyring identity changes are required. This source support is not evidence of a shipped bridge; native packaging/upgrade acceptance and publication remain separate gates. Never silently replace immutable 0.1.10 installers or claim that its installed updater already understands GitHub.

Publish immutable assets and verify their GitHub digest plus public whole-file delivery and off-host recovery copies before committing signed channel metadata. Preserve prior versions and existing website/update paths through the transition. Release manifests distinguish byte-verified historical migration from genuine build provenance/attestations.
