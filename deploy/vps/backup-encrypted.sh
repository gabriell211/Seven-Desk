#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

if [ -z "$BACKUP_DIR" ] || [ -z "$AGE_RECIPIENT" ]; then
  echo 'Set BACKUP_DIR and AGE_RECIPIENT' >&2
  exit 1
fi
command -v age >/dev/null || { echo 'age CLI not installed' >&2; exit 1; }
command -v docker >/dev/null || { echo 'Docker not installed' >&2; exit 1; }
cd "$(dirname "$0")"
mkdir -p -- "$BACKUP_DIR"
chmod 700 -- "$BACKUP_DIR"
tag="$(date -u +%Y%m%dT%H%M%SZ)"
temp="$BACKUP_DIR/sevendesk-$tag.dump.age.partial"
final="$BACKUP_DIR/sevendesk-$tag.dump.age"
trap 'rm -f -- "$temp"' EXIT

docker compose exec -T db sh -ec \
  'export PGPASSWORD="$(cat /run/secrets/pg_password)"; exec pg_dump --no-owner --no-acl -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | age -r "$AGE_RECIPIENT" -o "$temp"

test -s "$temp"
mv -- "$temp" "$final"
trap - EXIT
echo "Encrypted backup written: $final"
echo "Confirm backup is stored off the VPS and restore works."
