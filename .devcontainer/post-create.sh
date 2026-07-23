#!/bin/bash
set -e

echo "=== Running root-level setup ==="

sudo apt-get update && sudo apt-get install -y wget ca-certificates gnupg2

sudo mkdir -p /etc/apt/keyrings
wget -qO- https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt-get update && sudo apt-get install -y gh

echo "=== Running user-level setup ==="

/workspaces/AssessmentBot/scripts/builder/install_scc.sh

npm install
npm install -g typescript
npm install -g @google/clasp
npm install -g opencode-ai
npm --prefix src/frontend ci
npm --prefix src/frontend exec -- playwright install --with-deps chromium

echo "=== postCreateCommand complete ==="
