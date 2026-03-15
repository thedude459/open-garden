#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$ROOT_DIR/backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

mkdir -p "$BACKUP_DIR"

if [[ ! -f "$ROOT_DIR/.env" ]]; then
  echo "Missing .env in $ROOT_DIR"
  exit 1
fi

set -a
source "$ROOT_DIR/.env"
set +a

FILE="$BACKUP_DIR/opengarden_${TIMESTAMP}.sql"

docker compose -f "$ROOT_DIR/docker-compose.yml" exec -T db \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" > "$FILE"

echo "Backup created: $FILE"
