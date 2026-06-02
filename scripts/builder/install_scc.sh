#!/bin/bash

# Script to install scc (Sloc, Cloc and Code) for the loc-counter skill
# Based on the recommended installation method from the skill documentation

set -e

echo "Installing scc (Sloc, Cloc and Code)..."

# Create local bin directory if it doesn't exist
mkdir -p ~/.local/bin

# Determine architecture
ARCH=$(uname -m)
case "$ARCH" in
    x86_64) ARCH="x86_64" ;;
    aarch64) ARCH="arm64" ;;
    *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

# Download the latest release for the detected architecture
echo "Downloading scc for $ARCH architecture..."
curl -L -o /tmp/scc.tar.gz "https://github.com/boyter/scc/releases/latest/download/scc_Linux_${ARCH}.tar.gz"

# Extract and install to ~/.local/bin
echo "Installing to ~/.local/bin..."
tar -xzf /tmp/scc.tar.gz -C ~/.local/bin/

# Clean up
echo "Cleaning up..."
rm /tmp/scc.tar.gz

# Add to PATH if not already present
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    echo "Adding ~/.local/bin to PATH..."
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
fi

# Verify installation
echo "Verifying installation..."
~/.local/bin/scc --version

echo "scc installed successfully!"
