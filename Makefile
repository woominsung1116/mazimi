.PHONY: dev dev-up dev-down dev-logs prod prod-up prod-down prod-logs db-shell redis-shell scrape clean \
        deploy backup logs restart status

# Development
dev: dev-up
dev-up:
	docker compose -f compose.dev.yml up --build
dev-down:
	docker compose -f compose.dev.yml down
dev-logs:
	docker compose -f compose.dev.yml logs -f

# Production
prod: prod-up
prod-up:
	docker compose -f compose.yml up --build -d
prod-down:
	docker compose -f compose.yml down
prod-logs:
	docker compose -f compose.yml logs -f

# Scraper
scrape:
	docker compose -f compose.dev.yml run --rm scraper

# Utilities
db-shell:
	docker compose -f compose.dev.yml exec db psql -U wello -d wello
redis-shell:
	docker compose -f compose.dev.yml exec redis redis-cli

# Cleanup
clean:
	docker compose -f compose.dev.yml down -v
	docker compose -f compose.yml down -v

# ── Deployment ────────────────────────────────────────────────────────────────

## deploy — full production deployment (build, migrate, start, health-check)
deploy:
	@bash scripts/deploy.sh

## backup — dump PostgreSQL to backups/wello_<timestamp>.sql.gz
backup:
	@bash scripts/backup.sh

## logs — tail all production service logs (Ctrl+C to stop)
logs:
	docker compose -f compose.yml logs -f

## restart — rolling restart of all production services
restart:
	docker compose -f compose.yml restart

## status — show container health and uptime
status:
	docker compose -f compose.yml ps
