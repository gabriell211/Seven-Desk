#!/usr/bin/env bash
set -euo pipefail

if ! getent ahostsv4 www.sevendesk.tech | awk '{print $1}' | grep -qx '187.53.111.184'; then
  echo 'www.sevendesk.tech does not resolve to the Seven Desk VPS yet' >&2
  exit 1
fi

caddyfile=/etc/caddy/Caddyfile
backup=$(mktemp /etc/caddy/Caddyfile.before-site-XXXXXXXX)
cp "$caddyfile" "$backup"
python3 - "$caddyfile" <<'PY'
from pathlib import Path
import sys

file = Path(sys.argv[1])
before = file.read_text()
old = 'http://www.sevendesk.tech {'
if before.count(old) != 1:
    raise SystemExit('Expected one staged website block')
file.write_text(before.replace(old, 'www.sevendesk.tech {', 1))
PY

if ! caddy validate --config "$caddyfile" || ! systemctl reload caddy; then
  cp "$backup" "$caddyfile"
  systemctl reload caddy
  exit 1
fi

if ! curl --fail --silent --show-error --max-time 30 \
    https://www.sevendesk.tech/api/account-availability >/dev/null; then
  cp "$backup" "$caddyfile"
  systemctl reload caddy
  echo 'HTTPS check failed; restored previous Caddy configuration' >&2
  exit 1
fi

echo 'SITE_HTTPS_OK'
