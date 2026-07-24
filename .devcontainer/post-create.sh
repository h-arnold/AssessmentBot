#!/bin/bash
set -e

echo "=== Running root-level setup ==="

sudo apt-get update && sudo apt-get install -y wget ca-certificates gnupg2

sudo mkdir -p /etc/apt/keyrings
# --max-redirect=0 disables redirects so the keyring can only come from the pinned GitHub CLI URL.
wget -qO- --max-redirect=0 https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt-get update && sudo apt-get install -y gh

echo "=== Running user-level setup ==="

/workspaces/AssessmentBot/scripts/builder/install_scc.sh

# --ignore-scripts blocks third-party lifecycle scripts during install.
# Platform binaries (opencode, esbuild) ship via optionalDependencies, so no
# install scripts are required; husky's prepare hook is run explicitly below.
npm install --ignore-scripts
npm run prepare
npm install -g --ignore-scripts typescript
npm install -g --ignore-scripts @google/clasp
npm install -g --ignore-scripts opencode-ai
# opencode-ai's bin stub is replaced with the real platform binary by its
# postinstall; run that single vetted script explicitly.
node "$(npm root -g)/opencode-ai/postinstall.mjs"
npm --prefix src/frontend ci --ignore-scripts
npm --prefix src/frontend exec -- playwright install --with-deps chromium

echo "=== postCreateCommand complete ==="
