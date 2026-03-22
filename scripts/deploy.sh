#!/bin/bash
# =============================================================================
# Majimi — One-Command Production Deployment
# Usage: ./scripts/deploy.sh
# Prerequisites: Docker, Docker Compose v2, domain DNS A record pointing to VPS
# =============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.production"
ENV_EXAMPLE="$REPO_ROOT/.env.production.example"
COMPOSE="docker compose -f $REPO_ROOT/compose.yml"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${CYAN}[deploy]${NC} $*"; }
ok()   { echo -e "${GREEN}[ok]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
die()  { echo -e "${RED}[error]${NC} $*" >&2; exit 1; }

# -----------------------------------------------------------------------------
# 1. Check prerequisites
# -----------------------------------------------------------------------------
log "Checking prerequisites..."

command -v docker >/dev/null 2>&1 || die "Docker is not installed. See https://docs.docker.com/engine/install/"
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 plugin not found. Run: apt install docker-compose-plugin"
command -v openssl >/dev/null 2>&1 || die "openssl is required for secret generation."

DOCKER_VERSION=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "unknown")
ok "Docker $DOCKER_VERSION detected"

# -----------------------------------------------------------------------------
# 2. Copy .env.production.example → .env.production (if not exists)
# -----------------------------------------------------------------------------
if [[ ! -f "$ENV_FILE" ]]; then
    log "Creating .env.production from example..."
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    warn ".env.production created. Please review and fill in real values before continuing."
    warn "  Edit: $ENV_FILE"
    echo ""
    read -rp "Press Enter after you have configured .env.production (Ctrl+C to abort): "
fi

ok ".env.production found"

# Source env file for validation
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# -----------------------------------------------------------------------------
# 3. Generate secrets if placeholders remain
# -----------------------------------------------------------------------------
log "Checking secrets..."

_replace_secret() {
    local key="$1"
    local length="${2:-48}"
    local current
    current=$(grep "^${key}=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' || true)
    if [[ -z "$current" || "$current" == *"CHANGE_ME"* ]]; then
        local secret
        secret=$(openssl rand -base64 "$length" | tr -d '\n')
        # Use | as delimiter to avoid issues with / in base64
        sed -i.bak "s|^${key}=.*|${key}=${secret}|" "$ENV_FILE"
        ok "Generated ${key}"
    else
        ok "${key} already set"
    fi
}

_replace_secret "JWT_SECRET" 48
_replace_secret "NEXTAUTH_SECRET" 32
_replace_secret "DB_PASSWORD" 32
_replace_secret "REDIS_PASSWORD" 32

# Remove sed backup files
rm -f "$ENV_FILE.bak"

# Re-source after secret generation
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# Validate required non-empty variables
REQUIRED_VARS=(DOMAIN DATABASE_URL DB_PASSWORD REDIS_PASSWORD NEXTAUTH_SECRET JWT_SECRET)
for var in "${REQUIRED_VARS[@]}"; do
    val="${!var:-}"
    if [[ -z "$val" || "$val" == *"CHANGE_ME"* ]]; then
        die "Required variable ${var} is not set or still has placeholder value. Edit $ENV_FILE"
    fi
done

ok "All required secrets validated"

# -----------------------------------------------------------------------------
# 4. Pull/build Docker images
# -----------------------------------------------------------------------------
log "Building Docker images (this may take a few minutes on first run)..."
$COMPOSE build --parallel

ok "Images built"

# -----------------------------------------------------------------------------
# 5. Start database and run migrations
# -----------------------------------------------------------------------------
log "Starting database..."
$COMPOSE up -d db redis

log "Waiting for database to be healthy..."
WAIT=0
MAX_WAIT=60
until $COMPOSE exec -T db pg_isready -U wello -q; do
    WAIT=$((WAIT + 2))
    if [[ $WAIT -ge $MAX_WAIT ]]; then
        die "Database did not become healthy within ${MAX_WAIT}s. Check logs: $COMPOSE logs db"
    fi
    sleep 2
done
ok "Database is ready"

log "Running SQLx migrations..."
# Run migrations via the api container using sqlx-cli if available,
# otherwise start the api which runs migrations on startup via sqlx::migrate!
if $COMPOSE run --rm --no-deps api sqlx migrate run --database-url "${DATABASE_URL}" 2>/dev/null; then
    ok "Migrations applied via sqlx-cli"
else
    warn "sqlx-cli not found in image — migrations will run on api startup"
fi

# -----------------------------------------------------------------------------
# 6. Start all services
# -----------------------------------------------------------------------------
log "Starting all services..."
$COMPOSE up -d

ok "All services started"

# -----------------------------------------------------------------------------
# 7. Health check
# -----------------------------------------------------------------------------
log "Running health checks (up to 90s)..."

_wait_healthy() {
    local service="$1"
    local url="$2"
    local max="${3:-90}"
    local waited=0
    until curl -sf "$url" >/dev/null 2>&1; do
        waited=$((waited + 3))
        if [[ $waited -ge $max ]]; then
            warn "Health check timed out for ${service}. Run: $COMPOSE logs ${service}"
            return 1
        fi
        sleep 3
    done
    ok "${service} is healthy"
}

_wait_healthy "api"  "http://localhost:8080/health" 90 || true

# Caddy exposes 80/443; check HTTP redirect
if curl -sf --max-time 5 "http://${DOMAIN}/" -o /dev/null -w "%{http_code}" 2>/dev/null | grep -qE "^(200|301|302)$"; then
    ok "Caddy is routing traffic"
else
    warn "Could not reach http://${DOMAIN}/ — DNS may not have propagated yet"
fi

# -----------------------------------------------------------------------------
# 8. Print success message
# -----------------------------------------------------------------------------
echo ""
echo -e "${BOLD}${GREEN}============================================================${NC}"
echo -e "${BOLD}${GREEN}  Majimi deployed successfully!${NC}"
echo -e "${BOLD}${GREEN}============================================================${NC}"
echo ""
echo -e "  Web app  : ${CYAN}https://${DOMAIN}${NC}"
echo -e "  API      : ${CYAN}https://${DOMAIN}/api${NC}"
echo -e "  Health   : ${CYAN}https://${DOMAIN}/api/health${NC}"
echo ""
echo -e "  Useful commands:"
echo -e "    make logs     — tail all service logs"
echo -e "    make status   — check container health"
echo -e "    make backup   — backup the database"
echo -e "    make restart  — rolling restart"
echo ""
echo -e "  SSL certificate is provisioned automatically by Caddy."
echo -e "  First HTTPS request may take 10-30s while Let's Encrypt issues the cert."
echo ""
