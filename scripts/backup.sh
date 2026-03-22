#!/bin/bash
# =============================================================================
# Majimi — PostgreSQL Backup Script
# Usage: ./scripts/backup.sh [backup_dir]
#
# Crontab example (daily at 03:00):
#   0 3 * * * /path/to/majimi/scripts/backup.sh >> /var/log/majimi-backup.log 2>&1
#
# Optional S3 upload: set USE_S3=true and configure S3_BUCKET + AWS credentials.
# Backups older than RETENTION_DAYS are automatically pruned.
# =============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.production"
COMPOSE="docker compose -f $REPO_ROOT/compose.yml"

# Configurable via environment variables
BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
USE_S3="${USE_S3:-false}"
S3_BUCKET="${S3_BUCKET:-s3://your-bucket/majimi-db-backups}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/wello_${TIMESTAMP}.sql.gz"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${CYAN}[backup $(date '+%H:%M:%S')]${NC} $*"; }
ok()   { echo -e "${GREEN}[ok]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
die()  { echo -e "${RED}[error]${NC} $*" >&2; exit 1; }

# Load production env
if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
else
    die ".env.production not found at $ENV_FILE"
fi

# Validate DB container is running
$COMPOSE exec -T db pg_isready -U wello -q 2>/dev/null \
    || die "PostgreSQL container is not running. Start with: make prod-up"

mkdir -p "$BACKUP_DIR"

log "Starting backup -> $BACKUP_FILE"

# Dump and compress in a single pipeline — no uncompressed temp file on disk
$COMPOSE exec -T db pg_dump \
    -U wello \
    -d wello \
    --no-password \
    --format=plain \
    --no-owner \
    --no-acl \
    | gzip -9 > "$BACKUP_FILE"

BACKUP_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
ok "Backup written: $BACKUP_FILE ($BACKUP_SIZE)"

# -----------------------------------------------------------------------------
# Optional: upload to S3
# -----------------------------------------------------------------------------
if [[ "$USE_S3" == "true" ]]; then
    log "Uploading to S3: $S3_BUCKET"
    if ! command -v aws >/dev/null 2>&1; then
        warn "aws CLI not found — skipping S3 upload"
    else
        aws s3 cp "$BACKUP_FILE" "$S3_BUCKET/$(basename "$BACKUP_FILE")" \
            --storage-class STANDARD_IA
        ok "Uploaded to $S3_BUCKET"
    fi
fi

# -----------------------------------------------------------------------------
# Prune old backups
# -----------------------------------------------------------------------------
log "Pruning backups older than ${RETENTION_DAYS} days..."
PRUNED=0
while IFS= read -r old_file; do
    rm -f "$old_file"
    log "  Removed: $(basename "$old_file")"
    PRUNED=$((PRUNED + 1))
done < <(find "$BACKUP_DIR" -name "wello_*.sql.gz" -mtime "+${RETENTION_DAYS}" 2>/dev/null || true)

if [[ $PRUNED -eq 0 ]]; then
    ok "No old backups to prune"
else
    ok "Pruned $PRUNED old backup(s)"
fi

# -----------------------------------------------------------------------------
# List current backups
# -----------------------------------------------------------------------------
log "Current backups in $BACKUP_DIR:"
ls -lh "$BACKUP_DIR"/wello_*.sql.gz 2>/dev/null \
    | awk '{print "  " $NF " (" $5 ")"}' \
    || log "  (none)"

echo ""
echo "To restore from this backup:"
echo "  gunzip -c $BACKUP_FILE \\"
echo "    | docker compose -f compose.yml exec -T db psql -U wello -d wello"
echo ""
