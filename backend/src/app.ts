import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import jwt from '@fastify/jwt';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { createReadStream } from 'fs';

// Routes
import { authRoutes } from './routes/auth.js';
import { importRoutes } from './routes/import.js';
import { listingRoutes } from './routes/listings.js';
import { analyticsRoutes } from './routes/analytics.js';
import { settingsRoutes } from './routes/settings.js';
import { translationRoutes } from './routes/translations.js';
import { userRoutes } from './routes/users.js';
import { faqRoutes } from './routes/faq.js';
import { leadRoutes } from './routes/leads.js';
import { financingRoutes } from './routes/financing.js';
import { seoRoutes } from './routes/seo.js';
import { crmTrackingRoutes } from './routes/crmTracking.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.resolve(__dirname, '../uploads');

// Type augmentation
declare module 'fastify' {
    interface FastifyInstance {
        prisma: PrismaClient;
        redis: Redis;
        authenticate: any;
    }
    interface FastifyRequest {
        // user is already defined by @fastify/jwt
    }
}

declare module '@fastify/jwt' {
    interface FastifyJWT {
        payload: {
            userId: string;
            email: string;
            role: string;
        };
        user: {
            userId: string;
            email: string;
            role: string;
        };
    }
}

export async function buildApp(): Promise<FastifyInstance> {
    const prisma = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });

    // Configure Redis with timeouts and limited retries
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        connectTimeout: 5000,
        maxRetriesPerRequest: 1,
        lazyConnect: true, // Don't connect immediately
        retryStrategy: (times) => {
            if (times > 3) {
                console.log('❌ Redis: Max retries reached, giving up.');
                return null;
            }
            return Math.min(times * 200, 1000);
        }
    });

    redis.on('error', (err) => {
        console.error('❌ Redis Connection Error:', err);
    });

    const fastify = Fastify({
        logger: {
            level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
        }
    });

    // Register plugins
    await fastify.register(cors, {
        origin: (origin, cb) => {
            const originOnly = (value: string) => {
                const cleanValue = value.trim().replace(/^["']|["']$/g, '');
                try {
                    const url = new URL(cleanValue);
                    return `${url.protocol}//${url.host}`;
                } catch {
                    return cleanValue.replace(/\/+$/, '');
                }
            };

            const allowedOrigins = [
                ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : []),
                ...(process.env.VITE_FRONTEND_URL ? process.env.VITE_FRONTEND_URL.split(',') : []),
                ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : []),
                ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []),
                'http://localhost:5173',
                'http://localhost:8080'
            ].map(originOnly).filter(Boolean);

            if (!origin) return cb(null, true);
            if (process.env.NODE_ENV === 'development' && /^http:\/\/localhost:\d+$/.test(origin)) {
                return cb(null, true);
            }

            const normalizedOrigin = originOnly(origin);
            if (/^https?:\/\/[a-zA-Z0-9.-]+\.sslip\.io$/.test(normalizedOrigin)) {
                return cb(null, true);
            }
            if (allowedOrigins.includes(normalizedOrigin)) {
                return cb(null, true);
            }

            cb(new Error("Not allowed by CORS"), false);
        },
        credentials: true
    });

    await fastify.register(multipart, {
        limits: {
            fileSize: 100 * 1024 * 1024,
            files: 1
        }
    });

    await fastify.register(jwt, {
        secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production'
    });

    // Decorate fastify
    fastify.decorate('prisma', prisma);
    fastify.decorate('redis', redis);

    fastify.decorate('authenticate', async function (request: any, reply: any) {
        try {
            await request.jwtVerify();
        } catch (err) {
            reply.code(401).send({ error: 'Unauthorized' });
        }
    });

    // Health check
    fastify.get('/health', async (request, reply) => {
        try {
            // Helper for timing out long operations
            const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> => {
                const timeout = new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
                );
                return Promise.race([promise, timeout]);
            }

            await withTimeout(fastify.prisma.$queryRaw`SELECT 1`, 3000, 'DB timeout');
            const dbStatus = 'connected';

            await withTimeout(fastify.redis.ping(), 3000, 'Redis timeout');
            const redisStatus = 'connected';

            return {
                status: 'ok',
                timestamp: new Date().toISOString(),
                database: dbStatus,
                redis: redisStatus
            };
        } catch (error) {
            fastify.log.error(error, 'Health check failed');
            return reply.code(500).send({
                status: 'error',
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // Routes
    fastify.get('/', async () => ({
        name: 'Car Scout API',
        version: '1.0.0',
        status: 'running'
    }));

    fastify.post('/', async () => ({
        name: 'Car Scout API',
        version: '1.0.0',
        status: 'running',
        method: 'POST'
    }));

    await fastify.register(authRoutes);
    await fastify.register(importRoutes);
    await fastify.register(listingRoutes);
    await fastify.register(analyticsRoutes);
    await fastify.register(settingsRoutes);
    await fastify.register(translationRoutes);
    await fastify.register(userRoutes);
    await fastify.register(faqRoutes);
    await fastify.register(leadRoutes);
    await fastify.register(financingRoutes);
    await fastify.register(seoRoutes);
    await fastify.register(crmTrackingRoutes);

    // Static files
    fastify.get('/uploads/:folder/:file', async (request, reply) => {
        const { folder, file } = request.params as { folder: string; file: string };

        if (folder !== 'logos') {
            return reply.code(404).send({ error: 'Not found' });
        }

        const filePath = path.join(uploadsRoot, folder, file);
        try {
            await fs.access(filePath);
            const ext = path.extname(filePath).toLowerCase();
            const mime = ext === '.svg' ? 'image/svg+xml'
                : ext === '.png' ? 'image/png'
                    : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
                        : ext === '.webp' ? 'image/webp'
                            : 'application/octet-stream';
            reply.header('Content-Type', mime);
            return reply.send(createReadStream(filePath));
        } catch {
            return reply.code(404).send({ error: 'Not found' });
        }
    });

    // Cleanup hook
    fastify.addHook('onClose', async (instance) => {
        await instance.prisma.$disconnect();
        await instance.redis.quit();
    });

    return fastify;
}
