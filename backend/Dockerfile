# Build stage
FROM node:20-slim AS builder

# Ensure openssl is available for Prisma engines
RUN apt-get update && \
    apt-get install -y --no-install-recommends openssl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies including devDependencies for build
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Prisma needs a connection string even to generate the client.
# Provide a sensible default that can be overridden at build time.
ARG DATABASE_URL="postgresql://user:password@localhost:5432/db"
ENV DATABASE_URL=$DATABASE_URL

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript code
RUN npm run build || npx tsc

# Production stage
FROM node:20-slim AS runner

# Ensure openssl is available for Prisma runtime
RUN apt-get update && \
    apt-get install -y --no-install-recommends openssl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built artifacts and necessary files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Expose port
EXPOSE 3000

# Start command (with migrations)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
