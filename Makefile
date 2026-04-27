# ==========================================
# Root Makefile for njmtech-knowledge-base
# ==========================================

.PHONY: setup setup-media setup-upload setup-cron setup-yt build test clean

# Default target: setup everything
setup: setup-media setup-upload setup-cron setup-yt
	@echo "✅ All projects setup successfully."

# --- Project Specific Setups ---

setup-media:
	@echo "📦 Setting up Media (Next.js)..."
	pnpm install

setup-upload:
	@echo "🐍 Setting up Upload Blob (Python/uv)..."
	cd apps/upload-blob && uv sync

setup-cron:
	@echo "🐍 Setting up Blob Cron (Python/Poetry)..."
	cd apps/blob-cron && poetry install

setup-yt:
	@echo "🐹 Setting up YT Transcribe (Go)..."
	cd apps/yt-transcribe && go mod download

# --- Task Graph (via Nx) ---

build:
	@echo "🏗️ Building all projects..."
	pnpm nx run-many --target=build --all

test:
	@echo "🧪 Running all tests..."
	pnpm nx run-many --target=test --all

lint:
	@echo "✨ Linting all projects..."
	pnpm nx run-many --target=lint --all

# --- Utilities ---

clean:
	@echo "🧹 Cleaning up artifacts..."
	find . -name "node_modules" -type d -prune -exec rm -rf '{}' +
	find . -name "__pycache__" -type d -prune -exec rm -rf '{}' +
	find . -name ".venv" -type d -prune -exec rm -rf '{}' +
	rm -rf dist/ build/ .nx/
	rm -f apps/yt-transcribe/yt-transcribe
