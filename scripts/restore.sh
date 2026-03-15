#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <backup-file.sql>"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_FILE="$1"

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file not found: $BACKUP_FILE"
  exit 1
fi

set -a
source "$ROOT_DIR/.env"
set +a

cat "$BACKUP_FILE" | docker compose -f "$ROOT_DIR/docker-compose.yml" exec -T db \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

echo "Restore complete from: $BACKUP_FILE"
