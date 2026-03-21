.PHONY: dev dev-up dev-down dev-logs prod prod-up prod-down prod-logs db-shell redis-shell scrape clean

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
