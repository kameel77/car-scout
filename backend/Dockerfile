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

# DATABASE_URL should be provided as an environment variable at runtime.
# It is used by Prisma for migrations and the server for connections.

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript code
RUN npm run build || npx tsc

# Production stage
FROM node:20-slim AS runner

# Ensure openssl and curl are available for Prisma runtime and healthchecks
RUN apt-get update && \
    apt-get install -y --no-install-recommends openssl curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built artifacts and necessary files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/add-admin.cjs ./add-admin.cjs
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Expose port
EXPOSE 3000

# Start command (with migrations)
# Using ; instead of && to ensure server starts even if migrations have conflicts,
# allowing terminal access for manual resolution (e.g. npx prisma migrate resolve).
CMD ["sh", "-c", "npx prisma migrate deploy; node dist/server.js"]
