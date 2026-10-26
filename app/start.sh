#!/bin/sh
# T3 Code Themes for macOS/Linux: one-time npm install, then open the skin window. Keep T3 Code running.
cd "$(dirname "$0")/launcher" || exit 1
if [ ! -d node_modules/electron/dist ] || [ ! -f node_modules/ffmpeg-static/package.json ]; then
  echo "T3 Code Themes - first-time setup: downloading Electron and ffmpeg (about 200 MB, 1-3 minutes)..."
  command -v npm >/dev/null 2>&1 || { echo "Install Node.js LTS from https://nodejs.org, then run this again."; exit 1; }
  npm install --no-audit --no-fund --loglevel=error || exit 1
fi
unset ELECTRON_RUN_AS_NODE
exec npx electron . --pair "$@"
