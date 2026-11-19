# Seven Desk: VPS-only customer downloads

GitHub Actions builds and validates package artifacts. Customer download links point exclusively to https://downloads.sevendesk.tech, never GitHub Actions or Releases.

The version-tag workflow is triggered by tags such as `v1.5.4`. Its preflight strictly checks the version in native and Flutter packages, preventing wrongly named builds. Passing CI does **not** promote a version to stable or constitute physical QA.

The VPS mirror service uses `scripts/sync_public_release.py`. It requires a completed successful build for the precise source commit, a finalized release record, and a root-owned `/etc/sevendesk/release-approval-v1.5.4.json` (0600). This approval must contain the same tag, source commit and run ID, a reviewer, two distinct physical-machine identifiers, true results for connection, disconnect, file transfer and Windows UAC elevation, non-debug Android distribution signing data, and one SHA-256-verified evidence file per machine under `/srv/sevendesk/qa-evidence/v1.5.4/`.

Do not create or approve evidence without actually testing two authorized computers. Synthetic test fixtures are strictly unit tests; never publish them as QA evidence. Production `manifest.json` is created only after all gates have passed. The VPS download root is the public distribution endpoint.

## PostgreSQL backup (live VPS)

The existing VPS currently runs `sevendesk-db-1` and `seven-desk-portal-db-1`. The deployment has a read-only database dump process with the files in `deploy/vps/local-backups/`:

1. Install the script as root to `/usr/local/sbin/sevendesk-postgres-backup.sh` (mode `0700`).
2. Create `/var/backups/sevendesk-postgres` (mode `0700`).
3. Install the unit and timer in `/etc/systemd/system/` (mode `0644`), review all paths and use `systemd-analyze verify`.
4. Run `systemctl daemon-reload`, `systemctl start sevendesk-postgres-backup.service`, inspect the journal and verify `sha256sum -c *.sha256` and `gzip -t`.
5. Test a restore into **isolated temporary PostgreSQL**, never into the production containers, then enable the timer.

The backup includes role/password hashes and commercial data: keep local output root-only and never put dumps into GitHub, the public website root, or logs. Retention is 14 days. In the 19 Nov 2026 validation, both dumps were successfully restored in isolated, network-disabled temporary PostgreSQL containers; production databases remained healthy. These are operational checks, not proof of future restoration.

**Disaster recovery is still incomplete without an encrypted offsite copy, secure key management, and periodic recovery drills.** The repository's existing `deploy/vps/backup-encrypted.sh` supports an age-encrypted backup flow but requires the separately configured recipient and offsite storage; do not invent or hardcode these credentials.

