#!/bin/sh
set -e

# Fail-safe: In production (INDEXING_ENABLED=true), a valid non-test TURNSTILE_SITE_KEY is required
if [ "$INDEXING_ENABLED" = "true" ]; then
  if [ -z "$TURNSTILE_SITE_KEY" ] || [ "$TURNSTILE_SITE_KEY" = "1x00000000000000000000AA" ]; then
    echo "FATAL: In production (INDEXING_ENABLED=true), a valid non-test TURNSTILE_SITE_KEY is required." >&2
    exit 1
  fi
fi

# Generate runtime-config.json if variables are provided or default fallback
BRAND_NAME="${PORTAL_BRAND_NAME:-Benefivo}"
BRAND_LOGO_URL="${PORTAL_BRAND_LOGO_URL:-/static/logo-dark.svg}"
PORTAL_URL="${PORTAL_URL:-https://benefivo.pl}"
API_URL="${PORTAL_API_URL:-/api}"
TURNSTILE_KEY="${TURNSTILE_SITE_KEY:-1x00000000000000000000AA}"
ANALYTICS="${ANALYTICS_ENABLED:-false}"

B2B_PHONE="${PORTAL_B2B_PHONE:-+48 22 112 09 50}"
B2B_EMAIL="${PORTAL_B2B_EMAIL:-b2b@benefivo.pl}"

# Normalize ORIGIN without trailing slash
ORIGIN="${PORTAL_URL%/}"

# Serialize all JSON characters, including backslashes and newlines.
jq -n --arg brandName "$BRAND_NAME" --arg brandLogoUrl "$BRAND_LOGO_URL" \
  --arg portalUrl "$ORIGIN" --arg apiUrl "$API_URL" \
  --arg turnstileSiteKey "$TURNSTILE_KEY" \
  --arg b2bPhone "$B2B_PHONE" --arg b2bEmail "$B2B_EMAIL" \
  --argjson analyticsEnabled "$([ "$ANALYTICS" = "true" ] && echo true || echo false)" \
  '{brandName: $brandName, brandLogoUrl: $brandLogoUrl, portalUrl: $portalUrl, apiUrl: $apiUrl, turnstileSiteKey: $turnstileSiteKey, analyticsEnabled: $analyticsEnabled, b2bPhone: $b2bPhone, b2bEmail: $b2bEmail}' \
  > /usr/share/nginx/html/runtime-config.json

# Substitute __PORTAL_ORIGIN__ placeholder across all static HTML and sitemap.xml files
for f in /usr/share/nginx/html/*.html /usr/share/nginx/html/sitemap.xml; do
  if [ -f "$f" ]; then
    sed -i "s|__PORTAL_ORIGIN__|$ORIGIN|g" "$f"
  fi
done

# Dynamic robots.txt generation based on INDEXING_ENABLED
if [ "$INDEXING_ENABLED" = "true" ]; then
  cat << EOF > /usr/share/nginx/html/robots.txt
User-agent: *
Allow: /
Allow: /dla-firm
Allow: /regulamin
Allow: /prywatnosc
Disallow: /dashboard
Disallow: /konto
Disallow: /katalog
Disallow: /najem
Disallow: /zapytania
Disallow: /logowanie
Disallow: /rejestracja
Disallow: /reset-hasla
Disallow: /zapomnialem-hasla
Disallow: /brand.html
Disallow: /api/

Sitemap: $ORIGIN/sitemap.xml
EOF
else
  cat << 'EOF' > /usr/share/nginx/html/robots.txt
User-agent: *
Disallow: /
EOF
fi

# Substitute Nginx environment variables (BACKEND_URL)
envsubst '${BACKEND_URL}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

# Execute passed command (default: nginx -g 'daemon off;')
exec "$@"
