# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_SYSTEM_PYTHON=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN curl -LsSf https://astral.sh/uv/install.sh | sh \
    && ln -s /root/.local/bin/uv /usr/local/bin/uv

WORKDIR /app

# Install JS tooling (wrangler) and Python worker runtime deps.
COPY package.json package-lock.json pyproject.toml uv.lock ./
RUN npm ci
RUN uv sync --frozen

# Copy the worker application source.
COPY . .

EXPOSE 8787

# Run Cloudflare Python Worker in dev mode, accessible from host.
CMD ["uv", "run", "pywrangler", "dev", "--ip", "0.0.0.0", "--port", "8787"]
