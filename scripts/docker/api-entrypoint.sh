#!/bin/sh
set -eu
cd /app
node dist/boot-env.js
node dist/wait-for-db.js
# Applies pending migrations (tracked, each runs once), seeds demo users when
# enabled, and imports the plant catalog (a no-op when it has not changed).
node dist/sync-cli.js
exec node dist/main.js
