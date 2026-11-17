# Seven Desk signaling server

`rustdesk-server-license.patch` contains the Seven Desk source changes for the open-source RustDesk ID server. `build.sh` fetches the pinned upstream revision, applies this patch, tests it, and produces `seven-id` and `seven-relay` binaries. The upstream source is AGPL-3.0, as is this derived patch.

The new ID server checks `GET /api/license` before forwarding a connection request. It sends the existing `PunchHoleRequest.token` or `RequestRelay.token` as a Bearer token and permits only an HTTP 200 response with `allowed: true`. Empty, malformed, expired, or unavailable credentials fail closed. The receiving computer still registers and receives support without account login.

The Seven Desk build fails closed when `SEVEN_LICENSE_URL` is missing, invalid, or unavailable. Configure `SEVEN_LICENSE_URL=https://www.sevendesk.tech/api/license` in the dedicated ID server before attempting outgoing connections. Never place activation tokens in server logs or command-line arguments. The receiver still explicitly approves incoming support and does not need an account.

**Rollout safety:** the current VPS still runs legacy upstream signaling without this check. Build and run the modified binaries in isolation on non-production ports, verify both direct and relay sessions between two devices using a signed-in account, and check unsigned/revoked/expired/offline cases before cutover. Preserve the production server keys/data and provide rollback. Do not enable enforcement on the active ports before distributing updated installers, or existing clients may lose remote access.

The VPS currently runs branded `seven-id` and `seven-relay` binaries without their source tree. This build is a candidate and must be tested on separate ports before replacing the active services. Keep the existing server key and data directory during any future migration so installed clients can still authenticate.
