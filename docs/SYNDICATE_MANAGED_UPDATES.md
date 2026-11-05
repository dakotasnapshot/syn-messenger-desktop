# MSI and Linux managed updates

Beginning with 0.1.10, MSI installations, Linux Debian packages and writable portable tar installations check for updates 30 seconds after launch and hourly. Downloads are staged inside the existing profile directory, authenticated with pinned Ed25519 release metadata and verified for exact size/SHA-256. The existing update notification and restart/install action are reused. Nothing is elevated or installed merely by launching or quitting.

MSI uses the Windows Installer upgrade path and normal Windows authorization. Debian uses Polkit (`pkexec`) and `dpkg --install`, without broad system package repair. Portable Linux replaces its identified application directory via an adjacent-directory rename and retains one managed previous-version directory; it never changes the profile, Matrix stores or keyring identity. The portable directory's parent must be writable, and custom profile storage must be outside the application directory; unsafe in-tree profiles are refused rather than moved/reset. System-managed tar installations must be moved to a user-writable location or converted to an appropriate package; the updater reports permissions errors rather than silently elevating a portable directory replacement. A desktop Polkit authentication agent is needed for Debian updates.

macOS and Windows EXE/Squirrel keep their existing update paths. Releases before 0.1.10 do not contain the new updater and require **one bootstrap installation**. There is no mechanism to remotely patch that into an already-installed old MSI/Linux binary. No updater claims installation merely because a payload was published.

## Static signed feeds

`/desktop/update/managed/{win32|linux}/x64/{msi|deb|tar.gz}.json` contains an envelope with a base64 payload and detached Ed25519 signature. The payload has `version`, `platform`, `arch`, `kind`, immutable HTTPS `url`, `size`, `sha256`, `releaseNotes` and ISO `releaseDate`. Installer URLs are restricted to the SYN download origin/path; redirects, wrong platforms/packages, oversized payloads, invalid signatures, downgrade/equal versions and checksum mismatches are rejected. Installation re-verifies the staged bytes.

The public key is pinned in `managed-update-manifest.ts`; keep its private counterpart outside source/build artifacts and preserve it for future releases. Changing the trust key requires an already-trusted client update. Sign manifests only after package/native acceptance succeeds. Publish immutable installers first, verify complete server hashes, then replace signed manifests atomically. Retain historical packages and feeds for rollback/evidence. Never overwrite a published version's installer with different bytes.

## Validation

Run manifest/updater tests, profile/config regressions and desktop TypeScript checks. Native release workflows additionally install the previous public MSI/DEB/tar package and exercise the real candidate updater module with the just-built candidate. The disposable harness replaces only a **test copy** of the public key with an ephemeral test key; production modules remain pinned. Headless Debian tests substitute `sudo` for Polkit while exercising the same `dpkg` argv; do not describe that as interactive Polkit UI validation. Verify the installed renderer hash and synthetic profile marker. No personal account stores are used.
