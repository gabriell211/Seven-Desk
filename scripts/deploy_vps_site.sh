#!/usr/bin/env bash
set -euo pipefail

ref=${1:-codex/license-activation}
if [[ ! "$ref" =~ ^[A-Za-z0-9._/-]+$ ]]; then
  echo 'Invalid Git reference' >&2
  exit 1
fi

base=/srv/sevendesk/site
mkdir -p "$base/releases" /srv/sevendesk/avatars /etc/sevendesk
if ! id sevendesk >/dev/null 2>&1; then
  useradd --system --home /srv/sevendesk --shell /usr/sbin/nologin sevendesk
fi
chown sevendesk:sevendesk /srv/sevendesk/avatars
chmod 750 /srv/sevendesk/avatars

checkout=$(mktemp -d "$base/releases/.candidate-XXXXXXXX")
trap 'rm -rf "$checkout"' EXIT
git clone --quiet --depth 1 --filter=blob:none --sparse --branch "$ref" \
  https://github.com/gabriell211/Seven-Desk.git "$checkout"
git -C "$checkout" sparse-checkout set website
sha=$(git -C "$checkout" rev-parse HEAD)
cd "$checkout/website"
npm ci
npm test
npm run build

release="$base/releases/$sha"
if [[ -e "$release" ]]; then
  rm -rf "$checkout"
else
  mv "$checkout" "$release"
fi
trap - EXIT

if [[ ! -f /etc/sevendesk/site.env ]]; then
  cat > /etc/sevendesk/site.env <<'ENV'
SEVEN_ACCOUNT_STATUS_ENABLED=0
SEVEN_REGISTRATION_ENABLED=0
SEVEN_PASSWORD_RECOVERY_ENABLED=0
SEVEN_BILLING_ENABLED=0
SEVEN_WEBHOOK_ENABLED=0
SEVEN_LICENSE_API_ENABLED=0
SEVEN_SALES_LAUNCH_APPROVED=0
ENV
  chmod 600 /etc/sevendesk/site.env
fi

cat > /etc/systemd/system/sevendesk-site.service <<'UNIT'
[Unit]
Description=Seven Desk website and account API
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=sevendesk
Group=sevendesk
WorkingDirectory=/srv/sevendesk/site/current/website
ExecStart=/usr/bin/node server.js
Environment=PORT=3100
Environment=SEVEN_AVATAR_DIR=/srv/sevendesk/avatars
EnvironmentFile=/etc/sevendesk/site.env
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/srv/sevendesk/avatars
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT

previous=$(readlink "$base/current" || true)
ln -sfn "$release" "$base/current.new"
mv -Tf "$base/current.new" "$base/current"
systemctl daemon-reload
systemctl enable --now sevendesk-site
systemctl restart sevendesk-site
if ! curl --fail --silent --show-error http://127.0.0.1:3100/api/account-availability >/dev/null; then
  if [[ -n "$previous" ]]; then
    ln -sfn "$previous" "$base/current.new"
    mv -Tf "$base/current.new" "$base/current"
    systemctl restart sevendesk-site
  fi
  echo 'Site failed health check; previous release restored' >&2
  exit 1
fi

caddyfile=/etc/caddy/Caddyfile
if ! grep -q 'www.sevendesk.tech' "$caddyfile"; then
  cp "$caddyfile" "${caddyfile}.before-sevendesk-site"
  printf '\nhttp://www.sevendesk.tech {\n    reverse_proxy 127.0.0.1:3100\n}\n' >> "$caddyfile"
  if ! caddy validate --config "$caddyfile"; then
    cp "${caddyfile}.before-sevendesk-site" "$caddyfile"
    exit 1
  fi
  systemctl reload caddy
fi

echo "SITE_STAGED=$sha"
curl --fail --silent --show-error --resolve www.sevendesk.tech:80:127.0.0.1 \
  http://www.sevendesk.tech/api/account-availability
echo
