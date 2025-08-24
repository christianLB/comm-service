.PHONY: help install dev build start stop restart logs clean test docker-up docker-down docker-rebuild token token-prod token-nas

# Colors for output
CYAN := \033[0;36m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

help: ## Show this help message
	@echo '${CYAN}Comm-Service Commands:${NC}'
	@echo ''
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  ${GREEN}%-20s${NC} %s\n", $$1, $$2}'

install: ## Install dependencies
	@echo '${YELLOW}Installing dependencies...${NC}'
	npm install
	@echo '${GREEN}✓ Dependencies installed${NC}'

dev: ## Start development server with hot reload
	@echo '${YELLOW}Starting development server...${NC}'
	npm run start:dev

build: ## Build for production
	@echo '${YELLOW}Building for production...${NC}'
	npm run build
	@echo '${GREEN}✓ Build complete${NC}'

start: ## Start production server
	@echo '${YELLOW}Starting production server...${NC}'
	npm run start:prod

test: ## Run tests
	@echo '${YELLOW}Running tests...${NC}'
	npm run test

test-cov: ## Run tests with coverage
	@echo '${YELLOW}Running tests with coverage...${NC}'
	npm run test:cov

test-e2e: ## Run E2E tests
	@echo '${YELLOW}Running E2E tests...${NC}'
	npm run test:e2e

lint: ## Run linter
	@echo '${YELLOW}Running linter...${NC}'
	npm run lint

format: ## Format code with Prettier
	@echo '${YELLOW}Formatting code...${NC}'
	npm run format

# Docker commands
docker-up: ## Start all services with Docker Compose
	@echo '${YELLOW}Starting Docker services...${NC}'
	docker-compose up -d
	@echo '${GREEN}✓ Services started${NC}'
	@echo 'View logs: make logs'

docker-down: ## Stop all Docker services
	@echo '${YELLOW}Stopping Docker services...${NC}'
	docker-compose down
	@echo '${GREEN}✓ Services stopped${NC}'

docker-rebuild: ## Rebuild and restart Docker services
	@echo '${YELLOW}Rebuilding Docker services...${NC}'
	docker-compose down
	docker-compose build --no-cache
	docker-compose up -d
	@echo '${GREEN}✓ Services rebuilt and started${NC}'

logs: ## View Docker logs
	docker-compose logs -f comm-api

logs-all: ## View all Docker services logs
	docker-compose logs -f

redis-cli: ## Connect to Redis CLI
	@echo '${CYAN}Connecting to Redis...${NC}'
	docker exec -it comm-redis redis-cli

# Database commands
redis-backup: ## Backup Redis data
	@echo '${YELLOW}Backing up Redis data...${NC}'
	@mkdir -p backups
	docker exec comm-redis redis-cli BGSAVE
	@sleep 2
	docker cp comm-redis:/data/dump.rdb backups/redis-backup-$$(date +%Y%m%d-%H%M%S).rdb
	@echo '${GREEN}✓ Redis backup complete${NC}'

# Utility commands
clean: ## Clean build artifacts and dependencies
	@echo '${YELLOW}Cleaning project...${NC}'
	rm -rf dist/ node_modules/ coverage/ logs/*.log
	@echo '${GREEN}✓ Project cleaned${NC}'

env-setup: ## Copy environment template
	@echo '${YELLOW}Setting up environment...${NC}'
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo '${GREEN}✓ Created .env file from template${NC}'; \
		echo '${YELLOW}Please edit .env with your configuration${NC}'; \
	else \
		echo '${YELLOW}.env file already exists${NC}'; \
	fi

check-health: ## Check service health
	@echo '${CYAN}Checking service health...${NC}'
	@curl -s http://localhost:8080/health | jq '.' || echo '${RED}Service not responding${NC}'

generate-token: ## Generate a test JWT token
	@echo '${CYAN}Generating test token...${NC}'
	@node -e "const jwt = require('jsonwebtoken'); const token = jwt.sign({service: 'test', permissions: ['all']}, 'your-super-secret-jwt-key', {expiresIn: '1h', issuer: 'comm-service'}); console.log(token);"

token: ## Generate service token for local development
	@echo '${CYAN}Generating service token for local development...${NC}'
	@node scripts/generate-token.js $(SERVICE) $(EXPIRY)

token-prod: ## Generate service token from production NAS container
	@echo '${CYAN}Generating service token from production (NAS)...${NC}'
	@echo '${YELLOW}Connecting to NAS and generating token...${NC}'
	@ssh k2600x@192.168.1.11 "cd /volume1/docker/comm-service && sudo /usr/local/bin/docker exec comm-service node scripts/generate-token.js $(SERVICE) $(EXPIRY)" || \
		(echo '${YELLOW}Alternative: Running token generation locally with prod secret...${NC}' && \
		 JWT_SECRET=$$(ssh k2600x@192.168.1.11 "sudo /usr/local/bin/docker exec comm-service printenv JWT_SECRET") node scripts/generate-token.js $(SERVICE) $(EXPIRY))

token-nas: ## Quick command to get GoCardless token from NAS production
	@echo '${CYAN}Generating GoCardless token from production...${NC}'
	@ssh k2600x@192.168.1.11 "cd /volume1/docker/comm-service && sudo /usr/local/bin/docker exec comm-service node scripts/generate-token.js gocardless-service" || \
		echo '${RED}Failed to connect to NAS. Is comm-service running?${NC}'

token-help: ## Show token generation help
	@node scripts/generate-token.js --help

# Development shortcuts
up: docker-up ## Alias for docker-up
down: docker-down ## Alias for docker-down
restart: docker-down docker-up ## Restart all services

# Initial setup
init: env-setup install ## Initial project setup
	@echo '${GREEN}✓ Project initialized${NC}'
	@echo '${YELLOW}Next steps:${NC}'
	@echo '  1. Edit .env file with your configuration'
	@echo '  2. Run "make docker-up" to start services'
	@echo '  3. View API docs at http://localhost:8080/api-docs'