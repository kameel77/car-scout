import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import jwt from '@fastify/jwt';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const fastify = Fastify({
    logger: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
    }
});

// Register plugins
await fastify.register(cors, {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
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

// Health check
fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
});

// Root endpoint
fastify.get('/', async () => {
    return {
        name: 'Car Scout API',
        version: '1.0.0',
        status: 'running'
    };
});

// TODO: Register routes here
// import { authRoutes } from './routes/auth.js';
// import { importRoutes } from './routes/import.js';
// import { listingRoutes } from './routes/listings.js';
// import { analyticsRoutes } from './routes/analytics.js';
// 
// await fastify.register(authRoutes);
// await fastify.register(importRoutes);
// await fastify.register(listingRoutes);
// await fastify.register(analyticsRoutes);

// Start server
const start = async () => {
    try {
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
        user?: {
            userId: string;
            email: string;
            role: string;
        };
    }
}
