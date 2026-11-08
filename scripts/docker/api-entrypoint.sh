#!/bin/sh
set -eu
cd /app
node dist/boot-env.js
node dist/wait-for-db.js
# Applies pending migrations (tracked, each runs once), seeds demo users when
# enabled, and loads the fixture catalog only on first boot.
node dist/sync-cli.js --seed-only
exec node dist/main.js
