import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import jwt from '@fastify/jwt';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { createReadStream } from 'fs';

dotenv.config();

const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Configure Redis with timeouts and limited retries for production robustness
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    connectTimeout: 5000,
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => {
        // Only retry a few times during startup
        if (times > 3) {
            console.log('❌ Redis: Max retries reached, giving up.');
            return null;
        }
        const delay = Math.min(times * 200, 1000);
        return delay;
    }
});

// Helper for timing out long operations
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
    const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    );
    return Promise.race([promise, timeout]);
}

// Test connections on startup
async function testConnections() {
    try {
        console.log('Testing associations (Prisma)...');
        // Use timeout for DB check to prevent hanging
        await withTimeout(prisma.$queryRaw`SELECT 1`, 5000, 'Database connection timeout (5s)');
        console.log('✅ Database connected');

        console.log('Testing Redis connection...');
        await withTimeout(redis.ping(), 5000, 'Redis connection timeout (5s)');
        console.log('✅ Redis connected');
    } catch (error) {
        console.error('⚠️ Connection test failed:', error instanceof Error ? error.message : error);
        // Don't exit in production, let the health check report it
        if (process.env.NODE_ENV === 'development') {
            process.exit(1);
        }
    }
}

const fastify = Fastify({
    logger: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
    }
});

// Register plugins
await fastify.register(cors, {
    origin: (origin, cb) => {
        // allow multiple origins via comma-separated env
        const originOnly = (value: string) => {
            const cleanValue = value.trim().replace(/^["']|["']$/g, '');
            try {
                const url = new URL(cleanValue);
                return `${url.protocol}//${url.host}`;
            } catch {
                // if it's already just origin or invalid, fall back to trimmed value without trailing slash
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

        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return cb(null, true);

        // Allow localhost on any port for development
        if (process.env.NODE_ENV === 'development' && /^http:\/\/localhost:\d+$/.test(origin)) {
            return cb(null, true);
        }

        // Strict check for allowed origins
        const normalizedOrigin = originOnly(origin);
        // Allow sslip.io helper domains (used for IP-based previews)
        if (/^https?:\/\/[a-zA-Z0-9.-]+\.sslip\.io$/.test(normalizedOrigin)) {
            return cb(null, true);
        }
        if (allowedOrigins.includes(normalizedOrigin)) {
            return cb(null, true);
        }

        // Generate error for disallowed origins
        cb(new Error("Not allowed by CORS"), false);
    },
    credentials: true
});

await fastify.register(multipart, {
    limits: {
        fileSize: 100 * 1024 * 1024, // 100 MB
        files: 1
    }
});

await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production'
});

// Decorate fastify with prisma and redis
fastify.decorate('prisma', prisma);
fastify.decorate('redis', redis);

// JWT authentication decorator
fastify.decorate('authenticate', async function (request: any, reply: any) {
    try {
        await request.jwtVerify();
    } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
    }
});

// Health check with timeouts
fastify.get('/health', async () => {
    try {
        // Test database connection with timeout
        await withTimeout(fastify.prisma.$queryRaw`SELECT 1`, 3000, 'DB timeout');
        const dbStatus = 'connected';

        // Test Redis connection with timeout
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
        return {
            status: 'error',
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error',
            database: 'unknown',
            redis: 'unknown'
        };
    }
});

// Root endpoint
fastify.get('/', async () => {
    return {
        name: 'Car Scout API',
        version: '1.0.0',
        status: 'running'
    };
});

// Handle POST to root (for health checks or misconfigured requests)
fastify.post('/', async () => {
    return {
        name: 'Car Scout API',
        version: '1.0.0',
        status: 'running',
        method: 'POST'
    };
});

// Register routes
import { authRoutes } from './routes/auth.js';
import { importRoutes } from './routes/import.js';
import { listingRoutes } from './routes/listings.js';
import { analyticsRoutes } from './routes/analytics.js';
import { settingsRoutes } from './routes/settings.js';
import { translationRoutes } from './routes/translations.js';
import { userRoutes } from './routes/users.js';
import { faqRoutes } from './routes/faq.js';
import { leadRoutes } from './routes/leads.js';
import { seoRoutes } from './routes/seo.js';

await fastify.register(authRoutes);
await fastify.register(importRoutes);
await fastify.register(listingRoutes);
await fastify.register(analyticsRoutes);
await fastify.register(settingsRoutes);
await fastify.register(translationRoutes);
await fastify.register(userRoutes);
await fastify.register(faqRoutes);
await fastify.register(leadRoutes);
await fastify.register(seoRoutes);

// Serve uploaded assets (logos)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.resolve(__dirname, '../uploads');

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

// Start server
const start = async () => {
    try {
        // Test connections before starting server
        await testConnections();

        const port = parseInt(process.env.PORT || '3000');
        await fastify.listen({ port, host: '0.0.0.0' });
        console.log(`🚀 Server listening on port ${port}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

// Graceful shutdown
process.on('SIGINT', async () => {
    await fastify.close();
    await prisma.$disconnect();
    await redis.quit();
    process.exit(0);
});

start();

// Type augmentation for fastify
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
