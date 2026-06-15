#!/bin/sh
set -e

echo "Configuring Bitwarden CLI server: $BW_SERVER_URL"

CURRENT_SERVER=$(bw config server 2>/dev/null | tr -d '[:space:]' || echo "")

if [ "$CURRENT_SERVER" != "$BW_SERVER_URL" ]; then
  echo "Server changed (was: '$CURRENT_SERVER'), logging out before reconfiguring..."
  bw logout 2>/dev/null || true
  bw config server "$BW_SERVER_URL"
  echo "Server configured."
else
  echo "Server already configured: $CURRENT_SERVER"
fi

STATUS=$(bw status 2>/dev/null | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "unauthenticated")
echo "Current vault status: $STATUS"

if [ "$STATUS" = "unauthenticated" ]; then
  echo "Logging in via API key..."
  bw login --apikey
  echo "Logged in."
fi

echo "Starting server..."
exec node server.js
