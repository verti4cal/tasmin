.PHONY: help install dev dev-down dev-logs build test lint format \
	migrate db-generate start stop restart logs clean

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
