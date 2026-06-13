# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build arguments for frontend env vars
ARG VITE_API_URL
ARG VITE_BRAND=carsalon
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_BRAND=$VITE_BRAND

# Build application
RUN npm run build

# Production stage
FROM nginx:alpine

# Runtime backend proxy target — overridden by docker-compose at runtime
ENV BACKEND_URL=http://carscout-api:3000
ENV VITE_TURNSTILE_SITE_KEY=""

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy Nginx config template
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Copy rate limiting config (http-level directives, not templated)
COPY nginx-rate-limit.conf /etc/nginx/conf.d/rate-limit.conf

EXPOSE 80

# IMPORTANT: envsubst must only substitute OUR variables (BACKEND_URL, VITE_TURNSTILE_SITE_KEY).
# If we let it substitute all $vars, it will destroy Nginx's own $host, $uri, $request_uri etc.
# We explicitly list the variables to substitute using the '${VAR}' syntax as a filter.
CMD ["/bin/sh", "-c", "envsubst '${BACKEND_URL} ${VITE_TURNSTILE_SITE_KEY}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
