# 0.1.11 GitHub bridge — prepared, NOT published

The bridge is intended for installed 0.1.10 MSI/Linux clients. Their existing signed origin feeds must offer immutable, direct same-origin 0.1.11 installers. Do not redirect them or give these clients GitHub installer URLs. Preserve the pinned offline signing key, runtime identity, profile and keyring.

The bridge already includes the strict GitHub delivery implementation from source3065f75. Once installed, it discovers signed stable metadata on raw.githubusercontent.com/dakotasnapshot/syndicate-releases and accepts immutable versioned package URLs in that exact repository, with bounded credential-free GitHub release-CDN redirects and unchanged exact-size/SHA256 authentication.

The 0.1.11 build workflows are prepared. The dedicated syn-bridge-gates.yml workflow must pass before publication: extract the exact public0.1.10 updater modules, authenticate the candidate in a disposable test copy using an ephemeral key, install the real0.1.11 package, verify packaged renderer/profile retention and MSI relaunch. The exact0.1.11 modules additionally exercise signed future-version discovery and GitHub/CDN download with synthetic responses; this does not claim a real0.1.12 installation or a live GitHub acceptance. Headless Debian uses sudo instead of the interactive Polkit agent, as in the previous release gate.

Publication remains conditional on successful native gates, packaged-source/private-string inspection, real public whole-file GitHub verification, fresh mounted-fileserver recovery readback, and only then atomic signed channel/origin-feed advancement. Website current buttons/history/checksums must match the new immutable assets. Keep the legacy origin bridge available for clients that return late; do not redirect it after the first upgrades.

Mac and Windows EXE/Squirrel retain their native mechanisms. Do not claim their discovery URLs changed by this managed-updater-only bridge. Pre0.1.10 MSI/Linux binaries lack this updater and still require the previously documented one-time manual bootstrap. No production account stores are used or reset by acceptance.

Local47targeted tests and desktop TypeScript check passed. At preparation time GitHub source pushes, Git blob creation and workflow dispatch returned HTTP500; source ref remained3065f75. No bridge packages or production feed changes were published.
