#!/bin/sh
set -e

# Generate runtime-config.json if variables are provided or default fallback
BRAND_NAME="${PORTAL_BRAND_NAME:-Program Samochodowy by Motolia}"
BRAND_LOGO_URL="${PORTAL_BRAND_LOGO_URL:-/logo.svg}"
PORTAL_URL="${PORTAL_URL:-}"
API_URL="${PORTAL_API_URL:-/api}"

# Serialize all JSON characters, including backslashes and newlines.
jq -n --arg brandName "$BRAND_NAME" --arg brandLogoUrl "$BRAND_LOGO_URL" \
  --arg portalUrl "$PORTAL_URL" --arg apiUrl "$API_URL" \
  '{brandName: $brandName, brandLogoUrl: $brandLogoUrl, portalUrl: $portalUrl, apiUrl: $apiUrl}' \
  > /usr/share/nginx/html/runtime-config.json

# Substitute Nginx environment variables (BACKEND_URL)
envsubst '${BACKEND_URL}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

# Execute passed command (default: nginx -g 'daemon off;')
exec "$@"
