#!/bin/bash
# scripts/restore-db.sh — restore a dump produced by scripts/backup-db.sh into this project's
# self-hosted Postgres. DESTRUCTIVE: pg_restore --clean drops every object the dump touches before
# recreating it, overwriting current data. Always confirms by name before running unless --yes is
# passed (for scripted disaster-recovery drills).
#
# Usage:
#   ./scripts/restore-db.sh /path/to/backup.dump
#   ./scripts/restore-db.sh /path/to/backup.dump --yes
#   ./scripts/restore-db.sh /path/to/backup.dump --base-dir=/path

set -euo pipefail

DEFAULT_REPO="toasternet/ai-integration-hub"
GITNAME="$DEFAULT_REPO"
BASE_DIR_ARG=""
DUMP_FILE=""
AUTO_YES=false
for arg in "$@"; do
  case "$arg" in
    --base-dir=*) BASE_DIR_ARG="${arg#--base-dir=}" ;;
    --repo=*)     GITNAME="${arg#--repo=}" ;;
    --yes)        AUTO_YES=true ;;
    *)            [ -z "$DUMP_FILE" ] && DUMP_FILE="$arg" ;;
  esac
done

if [ -z "$DUMP_FILE" ] || [ ! -f "$DUMP_FILE" ]; then
  echo "❌ Usage: $0 /path/to/backup.dump [--yes] [--base-dir=...]" >&2
  exit 1
fi

if [ -n "$BASE_DIR_ARG" ]; then
  BASE_DIR="$BASE_DIR_ARG"
elif [[ "$(uname)" == "Darwin" ]]; then
  BASE_DIR="${HOME}/.yogaipilot-deploy"
else
  BASE_DIR="/home"
fi

DIRNAME="$(echo "$GITNAME" | tr '/' '-')"
_CONTAINER_PREFIX="supabase-${DIRNAME}"
DB_CONTAINER="${_CONTAINER_PREFIX}-db"

if ! docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  echo "❌ DB container '${DB_CONTAINER}' is not running." >&2
  exit 1
fi

echo "⚠️  This will DROP and recreate every object the dump touches in '${DB_CONTAINER}',"
echo "   overwriting current data with the contents of:"
echo "     ${DUMP_FILE}"
if [ "$AUTO_YES" != true ]; then
  read -r -p "Type the container name (${DB_CONTAINER}) to confirm: " CONFIRM
  if [ "$CONFIRM" != "$DB_CONTAINER" ]; then
    echo "❌ Confirmation did not match — aborted, nothing was touched."
    exit 1
  fi
fi

echo "📥 Restoring into ${DB_CONTAINER}..."
docker exec -i "$DB_CONTAINER" pg_restore -U postgres -d postgres --clean --if-exists --no-owner < "$DUMP_FILE"
echo "✅ Restore complete."
