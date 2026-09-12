#!/bin/sh
set -eu
npx tsx apps/api/src/boot-env.ts
npx tsx apps/api/src/wait-for-db.ts
npm run migrate
npx tsx apps/api/src/plants/sync-cli.ts --seed-only
exec npx tsx apps/api/src/main.ts
