# syntax=docker/dockerfile:1
# Keep this syntax directive! It's used to enable Docker BuildKit

################################
# BUILDER-BASE
# Used to build dependencies and create our virtual environment
################################

FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

WORKDIR /app

# Enable bytecode compilation and set the linking mode
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

# Install build dependencies including curl for downloading the release archive
RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install --no-install-recommends -y \
       build-essential \
       git \
       npm \
       gcc \
       curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Download the Langflow 1.2.0 release tarball into a temporary location and extract it.
RUN curl -L https://github.com/langflow-ai/langflow/archive/refs/tags/1.2.0.tar.gz -o /tmp/langflow.tar.gz \
    && mkdir -p /tmp/langflow \
    && tar -xzvf /tmp/langflow.tar.gz -C /tmp/langflow --strip 1

# Copy only the necessary files from the downloaded release into /app
RUN cp -r /tmp/langflow/src /app/src \
    && cp /tmp/langflow/pyproject.toml /app/pyproject.toml \
    && cp /tmp/langflow/uv.lock /app/uv.lock \
    && cp /tmp/langflow/README.md /app/README.md

# Run uv sync with the correct files now in place.
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-editable

# Build the frontend assets:
# Create the temporary directory and copy the frontend folder into it
RUN mkdir -p /tmp/src && cp -r /app/src/frontend /tmp/src/frontend
WORKDIR /tmp/src/frontend
RUN --mount=type=cache,target=/root/.npm \
    npm ci \
    && npm run build \
    && cp -r build /app/src/backend/langflow/frontend \
    && rm -rf /tmp/src/frontend

# Return to /app and finalise backend dependency installation
WORKDIR /app
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-editable

################################
# RUNTIME
# Copy the virtual environment only and run as root
################################

FROM python:3.12.3-slim AS runtime

RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y git \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy the virtual environment built in the builder stage
COPY --from=builder /app/.venv /app/.venv

# Ensure executables from the virtual environment are at the front of the PATH
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

# Run Langflow (running as root for compatibility with Cloud Run’s in-memory file system)
CMD ["langflow", "run"]
