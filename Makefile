.PHONY: help install dev dev-down dev-logs build test lint format \
	migrate db-generate start stop restart logs clean version

# Lets `make version 1.2.3` work as well as `make version VERSION=1.2.3` —
# treats the word after "version" as the version number rather than trying
# (and failing) to find a make target with that name.
ifeq (version,$(firstword $(MAKECMDGOALS)))
  VERSION := $(word 2,$(MAKECMDGOALS))
  $(eval $(VERSION):;@:)
endif

help:
	@echo "Tasmin — common commands"
	@echo ""
	@echo "  make install      Install all workspace dependencies"
	@echo "  make dev          Run the dev stack in Docker (hot reload) — server:3000 web:5173"
	@echo "  make dev-down     Stop and remove the dev stack"
	@echo "  make dev-logs     Tail dev stack logs"
	@echo "  make build        Production build of server + web"
	@echo "  make test         Run server unit tests"
	@echo "  make lint         Run ESLint across the repo"
	@echo "  make format       Run Prettier across the repo"
	@echo "  make migrate      Apply DB migrations (local Node, not Docker)"
	@echo "  make db-generate  Generate a new Drizzle migration from schema changes"
	@echo "  make start        Build and run the production Docker stack (detached)"
	@echo "  make stop         Stop the production Docker stack"
	@echo "  make restart      Restart the production Docker stack"
	@echo "  make logs         Tail production stack logs"
	@echo "  make clean        Remove node_modules, build output, and local SQLite data"
	@echo "  make version 1.2.3   Bump version.json, commit, tag, and push — triggers the release build"

install:
	npm install

dev:
	docker compose -f docker-compose.dev.yml up --build

dev-down:
	docker compose -f docker-compose.dev.yml down

dev-logs:
	docker compose -f docker-compose.dev.yml logs -f

build:
	npm run build

test:
	npm run test

lint:
	npm run lint

format:
	npm run format

migrate:
	npm run db:migrate --workspace server

db-generate:
	npm run db:generate --workspace server

start:
	docker compose up --build -d

stop:
	docker compose down

restart: stop start

logs:
	docker compose logs -f

clean:
	rm -rf node_modules server/node_modules web/node_modules server/dist web/dist server/data

# Bumps version.json, commits it to main, then tags and pushes — the tag
# push is what triggers .github/workflows/docker-release.yml to build and
# publish the image. Usage: make version 1.2.3 (or make version VERSION=1.2.3)
version:
	@test -n "$(VERSION)" || (echo "Usage: make version 1.2.3" && exit 1)
	@echo "$(VERSION)" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$$' \
		|| (echo "VERSION must look like a semver version, e.g. 1.2.3 or 1.2.3-beta.1" && exit 1)
	@[ "$$(git branch --show-current)" = "main" ] \
		|| (echo "Not on main (currently on $$(git branch --show-current)) — switch to main first" && exit 1)
	@git diff --quiet && git diff --cached --quiet \
		|| (echo "Working tree has uncommitted changes — commit or stash them first" && exit 1)
	node -e "const fs=require('fs');const f='version.json';const v=JSON.parse(fs.readFileSync(f,'utf8'));v.version='$(VERSION)';fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n');"
	git add version.json
	git commit -m "Release v$(VERSION)"
	git push origin main
	git tag v$(VERSION)
	git push origin v$(VERSION)
	@echo "Released v$(VERSION) — image build: https://github.com/verti4cal/tasmin/actions"
