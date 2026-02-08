#!/usr/bin/env bash
#
# Exchanges a Figma OAuth authorization code for an access token.
#
# Prerequisites:
#   1. Register an app at https://www.figma.com/developers/apps
#   2. Complete the OAuth authorization flow to obtain an authorization code
#   3. Set environment variables below or pass them as arguments
#
# Usage:
#   ./scripts/get-figma-token.sh
#
# Required environment variables:
#   FIGMA_CLIENT_ID      - Your Figma app client ID
#   FIGMA_CLIENT_SECRET  - Your Figma app client secret
#   FIGMA_REDIRECT_URI   - The redirect URI registered with your app
#   FIGMA_AUTH_CODE       - The authorization code from the OAuth callback
#
# Optional:
#   FIGMA_CODE_VERIFIER  - Code verifier if you used PKCE flow
#   FIGMA_GOV=1          - Use Figma for Government endpoint

set -euo pipefail

: "${FIGMA_CLIENT_ID:?Set FIGMA_CLIENT_ID}"
: "${FIGMA_CLIENT_SECRET:?Set FIGMA_CLIENT_SECRET}"
: "${FIGMA_REDIRECT_URI:?Set FIGMA_REDIRECT_URI}"
: "${FIGMA_AUTH_CODE:?Set FIGMA_AUTH_CODE}"

if [ "${FIGMA_GOV:-}" = "1" ]; then
  BASE_URL="https://api.figma-gov.com"
else
  BASE_URL="https://api.figma.com"
fi

CREDENTIALS=$(printf '%s:%s' "$FIGMA_CLIENT_ID" "$FIGMA_CLIENT_SECRET" | base64 -w0 2>/dev/null || printf '%s:%s' "$FIGMA_CLIENT_ID" "$FIGMA_CLIENT_SECRET" | base64)

BODY="redirect_uri=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$FIGMA_REDIRECT_URI', safe=''))")&code=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$FIGMA_AUTH_CODE', safe=''))")&grant_type=authorization_code"

if [ -n "${FIGMA_CODE_VERIFIER:-}" ]; then
  BODY="${BODY}&code_verifier=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$FIGMA_CODE_VERIFIER', safe=''))")"
fi

echo "Requesting access token from ${BASE_URL}/v1/oauth/token ..."

RESPONSE=$(curl -s -X POST "${BASE_URL}/v1/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Authorization: Basic ${CREDENTIALS}" \
  -d "$BODY")

if echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['access_token'])" 2>/dev/null; then
  echo ""
  echo "Full response:"
  echo "$RESPONSE" | python3 -m json.tool
  echo ""
  echo "Set your token:"
  ACCESS_TOKEN=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
  echo "  export FIGMA_ACCESS_TOKEN=${ACCESS_TOKEN}"
else
  echo "Error getting token:"
  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
  exit 1
fi
