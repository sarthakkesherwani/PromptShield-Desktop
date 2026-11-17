#!/bin/bash
set -e
cd -- "$(dirname -- "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo 'Install Node.js 22 or newer from https://nodejs.org, then try again.'
  read -r -p 'Press Enter to close.'
  exit 1
fi
if [ "$(node -p 'Number(process.versions.node.split(".")[0])')" -lt 22 ]; then
  echo 'Node.js 22 or newer is required.'
  read -r -p 'Press Enter to close.'
  exit 1
fi
# Keep the dependency cache local to avoid permissions in an older global cache.
if [ ! -d node_modules ]; then
  npm ci --cache .npm-cache || { echo 'Setup failed. Check the error above and your connection.'; read -r -p 'Press Enter to close.'; exit 1; }
fi
npm start || { echo 'Launch failed. Check the error above.'; read -r -p 'Press Enter to close.'; exit 1; }
