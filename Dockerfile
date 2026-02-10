# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
# Build argument for the app directory (default to carsalon)
ARG APP_NAME=carsalon
COPY apps/${APP_NAME} .

# Build arguments for frontend env vars
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

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

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
