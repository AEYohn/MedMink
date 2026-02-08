.PHONY: help dev up down logs test lint format clean setup

help:
	@echo "Research Synthesizer - Available Commands"
	@echo ""
	@echo "  make setup     - Initial project setup"
	@echo "  make dev       - Start all services for development"
	@echo "  make up        - Start all services in background"
	@echo "  make down      - Stop all services"
	@echo "  make logs      - View logs from all services"
	@echo "  make test      - Run all tests"
	@echo "  make lint      - Run linters"
	@echo "  make format    - Format code"
	@echo "  make clean     - Remove all data and containers"
	@echo ""

setup:
	@echo "Setting up project..."
	@if [ ! -f .env ]; then cp .env.example .env; echo "Created .env file - please update with your API keys"; fi
	@python -m venv .venv
	@. .venv/bin/activate && pip install -r requirements.txt
	@cd dashboard && npm install
	@echo "Setup complete!"

dev:
	docker compose up --build

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f

logs-api:
	docker compose logs -f api

logs-orchestrator:
	docker compose logs -f orchestrator

test:
	pytest tests/ -v --cov=src --cov-report=html

test-unit:
	pytest tests/unit/ -v

test-integration:
	pytest tests/integration/ -v

lint:
	ruff check src/
	mypy src/

format:
	black src/ tests/
	ruff check --fix src/

clean:
	docker compose down -v
	rm -rf docker/data/
	rm -rf .pytest_cache/
	rm -rf htmlcov/
	rm -rf .venv/
	find . -type d -name __pycache__ -exec rm -rf {} +

# Database commands
db-migrate:
	alembic upgrade head

db-revision:
	alembic revision --autogenerate -m "$(MSG)"

db-reset:
	docker compose down -v
	docker compose up -d postgres neo4j redis
	sleep 5
	docker compose up -d api orchestrator

# Neo4j commands
neo4j-shell:
	docker compose exec neo4j cypher-shell -u neo4j -p neo4j_password

# Demo commands
demo-seed:
	python -m src.cli.seed_demo_data

demo-timelapse:
	python -m src.cli.simulate_timelapse

# Monitoring
stats:
	@echo "=== Container Status ==="
	@docker compose ps
	@echo ""
	@echo "=== API Health ==="
	@curl -s http://localhost:8000/health | python -m json.tool || echo "API not running"
