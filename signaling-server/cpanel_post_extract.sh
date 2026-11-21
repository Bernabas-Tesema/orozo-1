#!/usr/bin/env bash
# Run inside the cPanel Node.js App root AFTER extracting orzo-signaling.zip
set -euo pipefail

cd "$(dirname "$0")"

test -f server.js
test -f package.json

echo "==> npm install (production)"
npm install --production

echo "==> Set in cPanel Node.js App environment:"
echo "    ALLOWED_ORIGINS=https://your-orzo-domain.com,https://www.your-orzo-domain.com"
echo "    MAX_PER_ROOM=8"
echo "    (PORT is injected by cPanel — do not hardcode)"
echo "==> Restart Node app, then verify:"
echo "    curl -s https://signal.your-orzo-domain.com/health"
