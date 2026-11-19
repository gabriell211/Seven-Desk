# Seven Desk: VPS-only customer downloads

GitHub Actions builds and validates package artifacts. Customer download links point exclusively to https://downloads.sevendesk.tech, never GitHub Actions or Releases.

The version-tag workflow is triggered by tags such as `v1.5.4`. Its preflight strictly checks the version in native and Flutter packages, preventing wrongly named builds. Passing CI does **not** promote a version to stable or constitute physical QA.

The VPS mirror service uses `scripts/sync_public_release.py`. It requires a completed successful build for the precise source commit, a finalized release record, and a root-owned `/etc/sevendesk/release-approval-v1.5.4.json` (0600). This approval must contain the same tag, source commit and run ID, a reviewer, two distinct physical-machine identifiers, true results for connection, disconnect, file transfer and Windows UAC elevation, non-debug Android distribution signing data, and one SHA-256-verified evidence file per machine under `/srv/sevendesk/qa-evidence/v1.5.4/`.

Do not create or approve evidence without actually testing two authorized computers. Synthetic test fixtures are strictly unit tests; never publish them as QA evidence. Production `manifest.json` is created only after all gates have passed. The VPS download root is the public distribution endpoint.
