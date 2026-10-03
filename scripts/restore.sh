#!/bin/bash
# Restores a backup made by scripts/backup.sh into this stack: REPLACES the whole database and the uploaded files.
#   scripts/restore.sh backups/20261003-050000
# Bot tokens stay readable only with the SECRET_KEY of the stack that made the backup.
set -euo pipefail
cd "$(dirname "$0")/.."

DIR=${1:?usage: scripts/restore.sh <backup dir>}
[ -s "$DIR/db.dump" ] || { echo "no $DIR/db.dump"; exit 1; }

if [ "${RESTORE_YES:-}" != "yes" ]; then
  read -r -p "Every business's data in this stack will be replaced by $DIR. Type yes: " answer
  [ "$answer" = "yes" ] || { echo "cancelled"; exit 1; }
fi

docker compose up -d db
until docker compose exec -T db sh -c 'pg_isready -U "$POSTGRES_USER" -d postgres' > /dev/null 2>&1; do sleep 1; done
docker compose stop bot backend

docker compose exec -T db sh -c 'psql -q -U "$POSTGRES_USER" -d postgres \
  -c "DROP DATABASE IF EXISTS \"$POSTGRES_DB\" WITH (FORCE)" -c "CREATE DATABASE \"$POSTGRES_DB\" OWNER \"$POSTGRES_USER\""'
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --role="$POSTGRES_USER" 2>&1 \
  | grep -v "already exists" || true' < "$DIR/db.dump"

if [ -s "$DIR/media.tar.gz" ]; then
  docker compose run --rm --no-deps -T --entrypoint sh backend -c 'rm -rf /app/media/* && tar -xzf - -C /app/media' \
    < "$DIR/media.tar.gz"
fi

docker compose up -d backend bot   # the backend applies new migrations on start
echo "restored from $DIR"
