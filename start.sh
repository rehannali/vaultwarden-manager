#!/bin/sh
set -e

echo "Configuring Bitwarden CLI server: $BW_SERVER_URL"
bw config server "$BW_SERVER_URL"

STATUS=$(bw status 2>/dev/null | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "unauthenticated")
echo "Current vault status: $STATUS"

if [ "$STATUS" = "unauthenticated" ]; then
  echo "Logging in via API key..."
  bw login --apikey
  echo "Logged in."
fi

echo "Starting server..."
exec node server.js
