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

# Runtime backend proxy target (override via env)
ENV BACKEND_URL=http://backend:3000

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy Nginx config template for envsubst
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Copy rate limiting config (http-level directives, not templated)
COPY nginx-rate-limit.conf /etc/nginx/conf.d/rate-limit.conf

# Copy dynamic turnstile site key replacement script
COPY replace-turnstile-key.sh /docker-entrypoint.d/30-replace-turnstile-key.sh
RUN chmod +x /docker-entrypoint.d/30-replace-turnstile-key.sh

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
