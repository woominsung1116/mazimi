#!/usr/bin/env bash
# PostgreSQL 백업 스크립트 — majimi
# 사용법: ./scripts/backup.sh
# cron 예시 (매일 새벽 3시):
#   0 3 * * * /opt/majimi/scripts/backup.sh >> /var/log/majimi-backup.log 2>&1

set -euo pipefail

# ── 설정 ────────────────────────────────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-/opt/majimi/backups}"
CONTAINER_NAME="${CONTAINER_NAME:-majimi-db-1}"
DB_USER="${DB_USER:-wello}"
DB_NAME="${DB_NAME:-wello}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"   # 로컬 보관 기간 (일)

# S3 업로드 사용 시 아래 값을 설정하고 USE_S3=true 로 변경
USE_S3="${USE_S3:-false}"
S3_BUCKET="${S3_BUCKET:-s3://your-bucket/majimi-db-backups}"
# AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION 은
# 환경변수 또는 ~/.aws/credentials 로 설정

# ── 초기화 ──────────────────────────────────────────────────────────────────
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="majimi_${DB_NAME}_${TIMESTAMP}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${FILENAME}"

mkdir -p "${BACKUP_DIR}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 백업 시작: ${FILENAME}"

# ── pg_dump 실행 ─────────────────────────────────────────────────────────────
docker exec "${CONTAINER_NAME}" \
    pg_dump -U "${DB_USER}" "${DB_NAME}" \
    | gzip > "${BACKUP_PATH}"

BACKUP_SIZE=$(du -sh "${BACKUP_PATH}" | cut -f1)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 로컬 백업 완료: ${BACKUP_PATH} (${BACKUP_SIZE})"

# ── S3 업로드 (선택) ─────────────────────────────────────────────────────────
if [ "${USE_S3}" = "true" ]; then
    if ! command -v aws &> /dev/null; then
        echo "[WARN] aws CLI를 찾을 수 없습니다. S3 업로드를 건너뜁니다." >&2
    else
        aws s3 cp "${BACKUP_PATH}" "${S3_BUCKET}/${FILENAME}" \
            --storage-class STANDARD_IA
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] S3 업로드 완료: ${S3_BUCKET}/${FILENAME}"
    fi
fi

# ── 오래된 로컬 백업 삭제 ────────────────────────────────────────────────────
DELETED=$(find "${BACKUP_DIR}" -name "majimi_${DB_NAME}_*.sql.gz" \
    -mtime +"${RETENTION_DAYS}" -print -delete | wc -l)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 오래된 백업 ${DELETED}개 삭제 (보관 기간: ${RETENTION_DAYS}일)"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 백업 완료"
