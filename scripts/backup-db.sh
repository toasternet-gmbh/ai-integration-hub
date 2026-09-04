#!/bin/bash
# scripts/backup-db.sh — logical backup of this project's self-hosted Postgres, via pg_dump run
# inside the db container (no local pg_dump/psql version-matching, no password ever leaves the
# container). Mirrors deploy.sh's own project-naming logic (DIRNAME/_CONTAINER_PREFIX) so it finds
# the right container without duplicating that logic in a shared/edited copy of deploy.sh — this
# script is intentionally standalone so it never risks the other projects deploy.sh also deploys.
#
# Usage:
#   ./scripts/backup-db.sh                              # backup, default retention
#   ./scripts/backup-db.sh --base-dir=/path              # match deploy.sh's --base-dir override
#   ./scripts/backup-db.sh --out-dir=/path/to/backups    # override backup destination
#   BACKUP_KEEP_DAYS=30 BACKUP_KEEP_MIN=10 ./scripts/backup-db.sh   # override retention
#
# Backups land OUTSIDE the git repo by default (under the deploy base-dir) — a dump contains every
# customer's decrypted-in-transit row data and must never be committed.
#
# Scheduling (not wired up automatically — pick one for wherever the stack actually runs):
#   cron (Linux VPS):    0 3 * * * /path/to/ai-integration-hub/scripts/backup-db.sh >> /var/log/hub-backup.log 2>&1
#   launchd (macOS dev):  a LaunchAgent plist calling this script daily; ask before installing one,
#                         since it's a persistent system change outside this repo.
# Off-host copy: this script only writes to local disk. For real disaster recovery (surviving the
# host itself failing), periodically sync $OUT_DIR to object storage (e.g. `rclone`/`aws s3 sync`)
# — not implemented here, since it needs a destination/credentials this repo doesn't have.

set -euo pipefail

DEFAULT_REPO="toasternet/ai-integration-hub"
GITNAME="$DEFAULT_REPO"
BASE_DIR_ARG=""
OUT_DIR_ARG=""
for arg in "$@"; do
  case "$arg" in
    --base-dir=*) BASE_DIR_ARG="${arg#--base-dir=}" ;;
    --out-dir=*)  OUT_DIR_ARG="${arg#--out-dir=}" ;;
    --repo=*)     GITNAME="${arg#--repo=}" ;;
  esac
done

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

OUT_DIR="${OUT_DIR_ARG:-${BASE_DIR}/backups/${DIRNAME}}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
KEEP_MIN="${BACKUP_KEEP_MIN:-7}"   # never prune below this many backups regardless of age —
                                    # protects against a silent failure streak (or a paused cron)
                                    # pruning the only good copies left.

if ! docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  echo "❌ DB container '${DB_CONTAINER}' is not running. Is the stack up? (deploy.sh --supabase-only)" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="${OUT_DIR}/${DIRNAME}-${STAMP}.dump"
TMP="${DEST}.part"

echo "📦 Backing up ${DB_CONTAINER} → ${DEST}"
# Custom format (-Fc): compressed, and restorable with pg_restore --clean --if-exists for a clean
# point-in-time recovery without hand-editing a plain-SQL dump. Written to a .part file first so a
# backup killed mid-run never leaves a truncated file with the final .dump name.
docker exec "$DB_CONTAINER" pg_dump -U postgres -Fc -d postgres > "$TMP"
mv "$TMP" "$DEST"
SIZE="$(du -h "$DEST" | cut -f1)"
echo "✅ Backup complete: ${DEST} (${SIZE})"

# Retention: delete dumps older than KEEP_DAYS, but always keep at least KEEP_MIN most recent.
ls -1t "${OUT_DIR}/${DIRNAME}-"*.dump 2>/dev/null | tail -n "+$((KEEP_MIN + 1))" | while IFS= read -r f; do
  MTIME="$(stat -f%m "$f" 2>/dev/null || stat -c%Y "$f")"
  AGE_DAYS=$(( ($(date +%s) - MTIME) / 86400 ))
  if [ "$AGE_DAYS" -gt "$KEEP_DAYS" ]; then
    echo "🗑️  Pruning old backup: $(basename "$f") (${AGE_DAYS}d old)"
    rm -f "$f"
  fi
done

echo "📊 $(ls -1 "${OUT_DIR}/${DIRNAME}-"*.dump 2>/dev/null | wc -l | tr -d ' ') backup(s) retained in ${OUT_DIR}"
