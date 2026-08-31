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
    apt-get upgrade -y && \
    apt-get install -y --no-install-recommends \
      openssl curl \
      libnss3 libfontconfig1 libfreetype6 \
      fonts-liberation ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev

# Copy built artifacts and necessary files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/add-admin.cjs ./add-admin.cjs
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# IMPORTANT: Remove npm entirely from the production image to avoid CVEs
# caused by outdated bundled dependencies (like 'tar') inside npm.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# Expose port
EXPOSE 3000

# Start command (with migrations)
# Using direct path to prisma bin instead of npx because we removed npm.
CMD ["sh", "-c", "node ./node_modules/.bin/prisma db push --accept-data-loss; node dist/server.js"]
