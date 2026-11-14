# Seven Desk signaling server

`rustdesk-server-license.patch` contains the Seven Desk source changes for the open-source RustDesk ID server. `build.sh` fetches the pinned upstream revision, applies this patch, tests it, and produces `seven-id` and `seven-relay` binaries. The upstream source is AGPL-3.0, as is this derived patch.

The new ID server checks `GET /api/license` before forwarding a connection request. It sends the existing `PunchHoleRequest.token` or `RequestRelay.token` as a Bearer token and permits only an HTTP 200 response with `allowed: true`. Empty, malformed, expired, or unavailable credentials fail closed. The receiving computer still registers and receives support without account login.

The feature is disabled when `SEVEN_LICENSE_URL` is unset; the existing RustDesk behavior remains. Set it to an HTTPS URL ending exactly in `/api/license` only after desktop and mobile clients can obtain and refresh an account token, the API and billing checks are deployed, and two computers have passed direct and relay connection tests. An invalid configured URL denies connection attempts. Never place the account token in server logs or command-line arguments.

The VPS currently runs branded `seven-id` and `seven-relay` binaries without their source tree. This build is a candidate and must be tested on separate ports before replacing the active services. Keep the existing server key and data directory during any future migration so installed clients can still authenticate.
