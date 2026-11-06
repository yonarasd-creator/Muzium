#!/bin/sh
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Node.js kurulu değil (https://nodejs.org)"; exit 1; }
[ -d node_modules ] || npm install --omit=dev
node server/index.js
