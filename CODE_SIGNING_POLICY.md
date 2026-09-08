# SYN Messenger Code Signing Policy

Free Windows code signing is requested from SignPath.io, with the certificate
provided by SignPath Foundation.

## Source and licensing

SYN Messenger Desktop is an actively maintained, public fork of Element
Web/Desktop. The source, build definitions, and release history are published
at <https://github.com/dakotasnapshot/syn-messenger-desktop>. Element's upstream
copyright notices and open-source licenses are preserved. SYN-specific changes
are released under the GNU Affero General Public License, version 3 or later.

Only artifacts built from this public repository may be submitted for signing.
Release branches must remain based on an upstream Element branch or release
that Element normally signs. Proprietary source or build components may not be
introduced into the signed package.

## Team roles

- Committer and reviewer: [Dakota Cole](https://github.com/dakotasnapshot)
- Release approver: [Dakota Cole](https://github.com/dakotasnapshot)

Changes from contributors without commit access require review before merge.
Release signing requests require approval from the release approver. GitHub and
SignPath accounts used for releases must have multi-factor authentication.

## Build and release controls

- Windows release artifacts are built by GitHub Actions from a tagged commit.
- SignPath trusted-build-system origin verification restricts release signing
  to this repository and approved release refs.
- Product name and version metadata must match the tagged SYN Messenger
  release.
- Signed files are verified with Windows Authenticode before publication.
- Published checksums are generated from the final signed artifacts.

## Privacy

SYN Messenger's privacy policy is available at
<https://synmessenger.com/privacy.html>. The client communicates with network
services when requested or configured by the user, including the user's Matrix
homeserver, identity and integration services, update service, and linked web
content. No private homeserver, account, message, credential, or customer data
is embedded in release artifacts or build fixtures.

## Incident response

Suspected signing-key abuse, malicious releases, or policy violations must be
reported to <support@synmessenger.com>. Maintainers will pause releases,
preserve build evidence, notify SignPath, investigate the affected commits and
artifacts, and request certificate revocation when warranted.
