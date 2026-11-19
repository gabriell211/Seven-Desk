#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

BACKUP_DIR=/var/backups/sevendesk-postgres
install -d -m 0700 "$BACKUP_DIR"
exec 9>"$BACKUP_DIR/.backup.lock"
if ! flock -n 9; then
  echo "SKIP: PostgreSQL backup already running"
  exit 0
fi

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
for database in sevendesk-db-1 seven-desk-portal-db-1; do
  state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$database")"
  if [ "$state" != "healthy" ] && [ "$state" != "running" ]; then
    echo "ERROR: ${database} is not healthy" >&2
    exit 1
  fi

  name="${database}_${stamp}.sql.gz"
  output="$BACKUP_DIR/$name"
  if [ -e "$output" ]; then
    echo "ERROR: backup output already exists" >&2
    exit 1
  fi

  temp="$(mktemp "$BACKUP_DIR/.${database}.XXXXXXXX.sql.gz")"
  cleanup() { rm -f -- "$temp"; }
  trap cleanup EXIT
  docker exec "$database" sh -ec '
    export PGPASSWORD="$(cat /run/secrets/pg_password)"
    exec pg_dumpall -h 127.0.0.1 -U "$POSTGRES_USER" --quote-all-identifiers
  ' | gzip -6 >"$temp"
  test "$(stat -c %s "$temp")" -gt 200
  gzip -t "$temp"
  chmod 0600 "$temp"
  mv -- "$temp" "$output"
  trap - EXIT
  (cd "$BACKUP_DIR" && sha256sum "$name" >"$name.sha256")
  chmod 0600 "$output" "$output.sha256"
  echo "BACKUP OK: $database ($(stat -c %s "$output") compressed bytes)"
done

# Retain 14 days locally; offsite encrypted backup is a separate requirement.
find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name 'sevendesk-db-1_*.sql.gz' -o -name 'seven-desk-portal-db-1_*.sql.gz' \
     -o -name 'sevendesk-db-1_*.sql.gz.sha256' -o -name 'seven-desk-portal-db-1_*.sql.gz.sha256' \) \
  -mtime +14 -delete
