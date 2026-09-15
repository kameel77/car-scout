# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM nginx:alpine
RUN apk add --no-cache jq

# Runtime backend proxy target & brand configuration
ENV BACKEND_URL=http://carscout-api:3000
ENV PORTAL_BRAND_NAME="Program Samochodowy by Motolia"
ENV PORTAL_BRAND_LOGO_URL="/logo.svg"
ENV PORTAL_URL=""
ENV PORTAL_API_URL="/api"

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy Nginx config template
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Copy rate limiting config (http-level directives)
COPY nginx-rate-limit.conf /etc/nginx/conf.d/rate-limit.conf

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/health || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
