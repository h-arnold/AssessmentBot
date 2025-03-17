# syntax=docker/dockerfile:1
# Keep this syntax directive! It's used to enable Docker BuildKit

################################
# BUILDER-BASE
# Used to build dependencies and create our virtual environment
################################

# 1. Use python:3.12.3-slim as the base image until https://github.com/pydantic/pydantic-core/issues/1292 gets resolved
# 2. Do not add --platform=$BUILDPLATFORM because the pydantic binaries must be resolved for the final architecture
# Use a Python image with uv pre-installed
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

# Set working directory
WORKDIR /app

# Enable bytecode compilation and set link mode to copy
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

# Install required packages
RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install --no-install-recommends -y \
       build-essential \
       git \
       npm \
       gcc \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Clone the Langflow repository at the 1.2.0 tag
RUN git clone --branch 1.2.0 https://github.com/langflow-ai/langflow.git

COPY ./src /app/src

# First dependency sync (without installing the project itself)
# This uses the uv.lock, pyproject.toml and README.md files from the cloned repo
WORKDIR /app
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-editable --extra postgresql

# Build the frontend assets
# The frontend code is built in a temporary folder to avoid cluttering the source tree
WORKDIR /app/src/frontend
RUN --mount=type=cache,target=/root/.npm \
    npm ci \
    && npm run build \
    && cp -r build /app/src/backend/langflow/frontend \
    && rm -rf /app/src/frontend

# Final dependency sync (this installs the project code into the virtual environment)
WORKDIR /app
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --extra postgresql

################################
# RUNTIME
# Setup utilities and copy the complete application (running as root)
################################
FROM python:3.12.3-slim AS runtime

RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y git \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy the entire /app folder from the builder stage into the runtime stage
COPY --from=builder /app /app

# Place executables in the environment at the front of the PATH
ENV PATH="/app/.venv/bin:$PATH"

# Metadata labels
LABEL org.opencontainers.image.title=langflow
LABEL org.opencontainers.image.authors="Langflow"
LABEL org.opencontainers.image.licenses=MIT
LABEL org.opencontainers.image.url="https://github.com/langflow-ai/langflow"
LABEL org.opencontainers.image.source="https://github.com/langflow-ai/langflow"

WORKDIR /app

# Set environment variables for Langflow
ENV LANGFLOW_HOST=0.0.0.0
ENV LANGFLOW_PORT=7860

CMD ["langflow", "run"]
