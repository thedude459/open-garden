#!/bin/sh
set -eu
npx tsx apps/api/src/boot-env.ts
npx tsx apps/api/src/wait-for-db.ts
# Applies pending migrations (tracked, each runs once), seeds demo users when
# enabled, and loads the fixture catalog only on first boot.
npx tsx apps/api/src/plants/sync-cli.ts --seed-only
exec npx tsx apps/api/src/main.ts
