# syntax=docker/dockerfile:1
# Keep this syntax directive! It's used to enable Docker BuildKit

################################
# BUILDER-BASE
# Build dependencies and create our virtual environment
################################

FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

WORKDIR /app

# Enable bytecode compilation and set linking mode
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

# Install build dependencies (single layer)
RUN apt-get update && apt-get upgrade -y && \
    apt-get install --no-install-recommends -y \
       build-essential \
       git \
       npm \
       gcc \
       curl && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Download, extract and copy necessary files from the Langflow 1.5.0 release,
# and run the initial uv sync (single layer)
RUN curl -L https://github.com/langflow-ai/langflow/archive/refs/tags/1.5.0.tar.gz -o /tmp/langflow.tar.gz && \
    mkdir -p /tmp/langflow && \
    tar -xzvf /tmp/langflow.tar.gz -C /tmp/langflow --strip 1 && \
    cp -r /tmp/langflow/src /app/src && \
    cp /tmp/langflow/pyproject.toml /app/pyproject.toml && \
    cp /tmp/langflow/uv.lock /app/uv.lock && \
    cp /tmp/langflow/README.md /app/README.md && \
    uv sync --frozen --no-install-project --no-editable --extra postgresql

# Build the frontend assets in one RUN command
RUN mkdir -p /tmp/src && cp -r /app/src/frontend /tmp/src/frontend && \
    cd /tmp/src/frontend && \
    npm ci && npm run build && \
    cp -r build /app/src/backend/langflow/frontend && \
    rm -rf /tmp/src/frontend

# Finalise backend dependency installation (single layer)
RUN uv sync --frozen --no-editable --extra postgresql

################################
# RUNTIME
# Copy the virtual environment only and run as root
################################

FROM python:3.12.3-slim AS runtime

RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y git libpq5 curl gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*
    
# Copy the virtual environment built in the builder stage
COPY --from=builder /app/.venv /app/.venv

# Place executables in the environment at the front of the PATH
ENV PATH="/app/.venv/bin:$PATH"

# Metadata labels
LABEL org.opencontainers.image.title=langflow
LABEL org.opencontainers.image.authors=['Langflow']
LABEL org.opencontainers.image.licenses=MIT
LABEL org.opencontainers.image.url=https://github.com/langflow-ai/langflow
LABEL org.opencontainers.image.source=https://github.com/langflow-ai/langflow

WORKDIR /app

# Environment variables for Langflow
ENV LANGFLOW_HOST=0.0.0.0
ENV LANGFLOW_PORT=7860

# Run Langflow (running as root for compatibility with Cloud Run's in-memory file system)
CMD ["langflow", "run"]
