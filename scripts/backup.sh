#!/bin/bash
# DeliveryHub backup: the database (the platform and every business) and the uploaded files.
#   scripts/backup.sh                → backups/<stamp>/{db.dump,media.tar.gz}
#   BACKUP_DIR=/srv/backups BACKUP_KEEP=14 scripts/backup.sh   (cron: daily; keeps the newest BACKUP_KEEP)
# The dump is checked right away (pg_restore --list): a backup that cannot be read is an error, not a file.
set -euo pipefail
cd "$(dirname "$0")/.."

ROOT=${BACKUP_DIR:-backups}
KEEP=${BACKUP_KEEP:-14}
DIR="$ROOT/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DIR"
chmod 700 "$ROOT"

docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner --no-privileges' \
  > "$DIR/db.dump"
docker compose exec -T db pg_restore --list < "$DIR/db.dump" > /dev/null

docker compose run --rm --no-deps -T --entrypoint tar backend -czf - -C /app/media . > "$DIR/media.tar.gz"
tar -tzf "$DIR/media.tar.gz" > /dev/null

chmod 600 "$DIR"/*
echo "backup: $DIR ($(du -sh "$DIR" | cut -f1))"

# Keep the newest $KEEP backups (portable: GNU and BSD tools).
ls -1d "$ROOT"/*/ 2>/dev/null | sort -r | tail -n +"$((KEEP + 1))" | while read -r old; do rm -rf "$old"; done
