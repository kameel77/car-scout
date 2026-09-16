import Fastify, { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { employeeAuthRoutes } from '../employee-auth.routes.js';
import { employeeCatalogRoutes } from '../../catalog/employee-catalog.routes.js';
import { employeeInquiriesRoutes } from '../../inquiries/employee-inquiries.routes.js';
import { trustPlatformJwt } from '../../../../middleware/platform-jwt.js';

export const RUNNER_TEST_MARKER = 'EMPLOYEE_INTEGRATION_RUNNER_ACTIVE_SAFE_V1';

export const TEST_HOST = 'portal.test';
export const TEST_ORIGIN = `https://${TEST_HOST}`;

export function assertSafeIntegrationEnvironment(): void {
  const marker = process.env.EMPLOYEE_INTEGRATION_RUNNER_MARKER;
  if (marker !== RUNNER_TEST_MARKER) {
    throw new Error(
      'REFUSING TO RUN INTEGRATION TESTS: Missing or invalid runner isolation marker. ' +
      'Run tests via `node scripts/test-employee-integration.mjs` to ensure ephemeral disposable Docker containers.'
    );
  }

  const dbUrl = process.env.DATABASE_URL || '';
  const redisUrl = process.env.REDIS_URL || '';

  // Validate endpoints are strictly localhost/127.0.0.1
  const isLocalDb = dbUrl.includes('127.0.0.1') || dbUrl.includes('localhost');
  const isLocalRedis = redisUrl.includes('127.0.0.1') || redisUrl.includes('localhost');
  const isDedicatedTestDb = dbUrl.includes('carscout_employee_test');

  if (!isLocalDb || !isDedicatedTestDb) {
    throw new Error(
      `REFUSING TO CONNECT TO DATABASE: DATABASE_URL must point to dedicated test database 'carscout_employee_test' on localhost/127.0.0.1. Current: ${dbUrl}`
    );
  }

  if (!isLocalRedis) {
    throw new Error(
      `REFUSING TO CONNECT TO REDIS: REDIS_URL must point to localhost/127.0.0.1. Current: ${redisUrl}`
    );
  }
}

export interface LightweightAppOptions {
  enablePlatformJwtTrust?: boolean;
}

export async function createLightweightTestApp(options: LightweightAppOptions = {}): Promise<{
  app: FastifyInstance;
  prisma: PrismaClient;
  redis: Redis;
}> {
  assertSafeIntegrationEnvironment();

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: ['error'],
  });

  const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    connectTimeout: 5000,
    maxRetriesPerRequest: 1,
    lazyConnect: false,
  });

  const app = Fastify({
    logger: false,
  });

  // Register rate limit
  await app.register(rateLimit, {
    global: false,
    redis,
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded, retry in ${context.after}`,
    }),
  });

  // Register JWT plugin with platform isolation
  const jwtSecret = process.env.JWT_SECRET || 'test-jwt-secret-employee-isolated';
  const jwtOptions: any = {
    secret: jwtSecret,
    trusted: options.enablePlatformJwtTrust !== false ? trustPlatformJwt : undefined,
  };

  await app.register(jwt, jwtOptions);

  // Decorate fastify
  app.decorate('prisma', prisma);
  app.decorate('redis', redis);

  // Register employee auth and catalog modules
  await app.register(employeeAuthRoutes);
  await app.register(employeeCatalogRoutes);
  await app.register(employeeInquiriesRoutes);

  await app.ready();

  return { app, prisma, redis };
}
