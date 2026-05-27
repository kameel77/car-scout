#!/bin/sh
set -e

if [ -n "$VITE_TURNSTILE_SITE_KEY" ]; then
  echo "Replacing Turnstile Site Key placeholder with runtime value..."
  find /usr/share/nginx/html -type f \( -name "*.js" -o -name "*.html" \) -exec sed -i "s/1x00000000000000000000AA/$VITE_TURNSTILE_SITE_KEY/g" {} +
else
  echo "VITE_TURNSTILE_SITE_KEY is not set, keeping default/fallback placeholder."
fi
