#!/bin/sh
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Node.js kurulu değil (https://nodejs.org)"; exit 1; }
npm install && npm run dist && echo "Hazır! Kurulum dosyası dist/ klasöründe."
