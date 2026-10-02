#!/bin/sh
# Migrates the public schema and every business schema, makes sure the platform exists, then starts the server.
set -e
if [ "${MIGRATE_ON_START:-1}" = "1" ]; then
    python manage.py migrate_schemas --noinput
    python manage.py ensure_platform
fi
exec "$@"
