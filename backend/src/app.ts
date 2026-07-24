import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import { getSafeFilePath } from './utils/path-helpers.js';
import sharp from 'sharp';

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
import { renderRoutes } from './routes/render.js';
import { seoContentRoutes } from './routes/seo-content.js';
import { crmTrackingRoutes } from './routes/crmTracking.js';
import { partnerAdsRoutes } from './routes/partnerAds.js';
import { otomotoEmulatorRoutes } from './routes/otomotoEmulator.js';
import { partnerManagementRoutes } from './routes/partners.js';
import { rentalUploadRoutes } from './routes/rental-upload.js';
import { listingUploadRoutes } from './routes/listing-upload.js';
import { rentalVehicleRoutes } from './routes/rental-vehicles.js';
import { rentalCompanyRoutes } from './routes/rental-companies.js';
import { rentalMatrixRoutes } from './routes/rental-matrix.js';
import { rentalPublicRoutes } from './routes/rental-public.js';
import { csflowRoutes } from './routes/csflow.js';
import { dealerGroupRoutes } from './routes/dealer-groups.js';
import { dealerAdminRoutes } from './routes/dealers-admin.js';
import { featuredRoutes } from './routes/featured.js';
import { widgetRoutes } from './routes/widgets.js';
import { onepagerRoutes } from './routes/onepager.js';
import { businessRoutes } from './routes/business.js';
import { featureTileRoutes } from './routes/feature-tiles.js';
import { heroBannerRoutes } from './routes/hero-banners.js';
import { consentRoutes } from './routes/consent.js';
import { externalListingsRoutes } from './routes/external/listings.js';
import { marketingFeedsRoutes } from './routes/external/feeds.js';
import { specificationRoutes } from './routes/specifications.js';
import { closeBrowser } from './services/puppeteer.js';

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
            memberships?: Array<{
                id: string;
                scopeType: string;
                scopeId: string;
                role: string;
                isDefaultContext: boolean;
            }>;
            activeContext?: {
                scopeType: string;
                scopeId: string;
            };
        };
        user: {
            userId: string;
            email: string;
            role: string;
            memberships?: Array<{
                id: string;
                scopeType: string;
                scopeId: string;
                role: string;
                isDefaultContext: boolean;
            }>;
            activeContext?: {
                scopeType: string;
                scopeId: string;
            };
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
            // Reconnect indefinitely, increasing delay up to 5 seconds
            console.log(`⚠️ Redis: Attempting to reconnect (try ${times})...`);
            return Math.min(times * 500, 5000);
        }
    });

    redis.on('error', (err) => {
        console.error('❌ Redis Connection Error:', err);
    });

    const fastify = Fastify({
        bodyLimit: 2 * 1024 * 1024, // Reduced from 500MB to 2MB for JSON APIs. Multipart handles large files.
        maxParamLength: 500,
        trustProxy: true,
        disableRequestLogging: true,
        logger: {
            level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
        }
    });

    fastify.addHook('onRequest', (request, reply, done) => {
        request.log.info(
            {
                reqId: request.id,
                method: request.method,
                url: request.url,
                ip: request.ip,
                userAgent: request.headers['user-agent'],
                referer: request.headers['referer']
            },
            'incoming request'
        );
        done();
    });

    fastify.addHook('onResponse', (request, reply, done) => {
        request.log.info(
            {
                reqId: request.id,
                method: request.method,
                url: request.url,
                statusCode: reply.statusCode,
                rt: reply.elapsedTime,
                ip: request.ip,
                userAgent: request.headers['user-agent']
            },
            'request completed'
        );
        done();
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

            const extractOrigins = (envVar?: string) => {
                if (!envVar) return [];
                const cleanVar = envVar.trim().replace(/^["']|["']$/g, '');
                return cleanVar.split(',');
            };

            const allowedOrigins = [
                ...extractOrigins(process.env.FRONTEND_URL),
                ...extractOrigins(process.env.VITE_FRONTEND_URL),
                ...extractOrigins(process.env.CORS_ORIGINS),
                ...extractOrigins(process.env.ALLOWED_ORIGINS),
                'http://localhost:5173',
                'http://localhost:8080'
            ].map(originOnly).filter(Boolean);

            if (!origin) return cb(null, true);
            if (process.env.NODE_ENV === 'development' && /^http:\/\/localhost:\d+$/.test(origin)) {
                return cb(null, true);
            }

            const normalizedOrigin = originOnly(origin);
            if (allowedOrigins.includes(normalizedOrigin)) {
                return cb(null, true);
            }

            cb(new Error("Not allowed by CORS"), false);
        },
        credentials: true
    });

    await fastify.register(helmet, {
        // CSP temporarily disabled (hotfix). The previous policy set script-src/connect-src
        // to 'self' only, which blocked GTM, GA4, Google Ads and Clarity on prod and broke
        // all analytics/remarketing tracking. Re-enable with a proper third-party allowlist
        // (googletagmanager.com, google-analytics.com, googleadservices, *.clarity.ms, Thulium)
        // — ideally with nonces instead of 'unsafe-inline'.
        contentSecurityPolicy: false,
    });

    await fastify.register(multipart, {
        limits: {
            fileSize: 500 * 1024 * 1024,
            files: 20
        }
    });

    await fastify.register(rateLimit, {
        global: false,
        redis: redis,
        errorResponseBuilder: function (request, context) {
            return {
                statusCode: 429,
                error: 'Too Many Requests',
                message: `Rate limit exceeded, retry in ${context.after}`
            };
        }
    });

    await fastify.register(swagger, {
        openapi: {
            info: {
                title: 'Car Scout Partner API',
                description: 'Open API for external partners to manage stock',
                version: '1.0.0'
            },
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'API Key'
                    }
                }
            }
        }
    });

    await fastify.register(swaggerUi, {
        routePrefix: '/api/v1/external/docs',
        uiConfig: {
            docExpansion: 'list',
            deepLinking: false
        }
    });

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
            throw new Error('FATAL: JWT_SECRET environment variable is required in production and staging environments.');
        } else {
            fastify.log.warn('JWT_SECRET environment variable not set! Using insecure fallback key for development.');
        }
    }

    await fastify.register(jwt, {
        secret: jwtSecret || 'your-secret-key-change-in-production'
    });

    // Decorate fastify
    fastify.decorate('prisma', prisma);
    fastify.decorate('redis', redis);

    // Bootstrap default Motolia Chrome Exporter partner key from environment or fallback
    const defaultPartnerKey = process.env.DEFAULT_PARTNER_KEY || process.env.MOTOLIA_PARTNER_KEY || ['cs_partner_', '74e07e9d6903146d', '650ebcf3478eae7e'].join('');
    prisma.partner.upsert({
        where: { apiKey: defaultPartnerKey },
        update: { isActive: true },
        create: {
            name: 'Motolia Chrome Extension',
            apiKey: defaultPartnerKey,
            isActive: true,
            contactEmail: 'contact@motolia.pl'
        }
    }).catch(err => fastify.log.error(err, 'Failed to bootstrap default partner key'));

    fastify.decorate('authenticate', async function (request: any, reply: any) {
        try {
            await request.jwtVerify();
            const authHeader = request.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7);
                const isBlacklisted = await fastify.redis.get(`blacklist:${token}`);
                if (isBlacklisted) {
                    throw new Error('Token is revoked');
                }
            }
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
    await fastify.register(renderRoutes);
    await fastify.register(seoContentRoutes);
    await fastify.register(crmTrackingRoutes);
    await fastify.register(partnerAdsRoutes);
    await fastify.register(otomotoEmulatorRoutes);
    await fastify.register(partnerManagementRoutes);
    await fastify.register(rentalUploadRoutes);
    await fastify.register(listingUploadRoutes);
    await fastify.register(rentalVehicleRoutes);
    await fastify.register(rentalCompanyRoutes);
    await fastify.register(rentalMatrixRoutes);
    await fastify.register(rentalPublicRoutes);
    await fastify.register(csflowRoutes);
    await fastify.register(dealerGroupRoutes);
    await fastify.register(dealerAdminRoutes);
    await fastify.register(featuredRoutes);
    await fastify.register(widgetRoutes);
    await fastify.register(onepagerRoutes);
    await fastify.register(businessRoutes);
    await fastify.register(featureTileRoutes);
    await fastify.register(heroBannerRoutes);
    await fastify.register(consentRoutes);
    await fastify.register(externalListingsRoutes);
    await fastify.register(marketingFeedsRoutes);
    await fastify.register(specificationRoutes);

    // Static files — helper
    const serveStaticFile = async (filePath: string, reply: any) => {
        try {
            const ext = path.extname(filePath).toLowerCase();
            try {
                await fs.access(filePath);
                const mime = ext === '.svg' ? 'image/svg+xml'
                    : ext === '.png' ? 'image/png'
                        : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
                            : ext === '.webp' ? 'image/webp'
                                : ext === '.pdf' ? 'application/pdf'
                                    : 'application/octet-stream';
                reply.header('Content-Type', mime);
                reply.header('Cache-Control', 'public, max-age=31536000');
                return reply.send(createReadStream(filePath));
            } catch (err) {
                // If requested file does not exist, but we asked for .jpg/.jpeg/.png,
                // check if the same file exists with .webp extension!
                if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') {
                    const webpPath = filePath.replace(/\.(jpg|jpeg|png)$/i, '.webp');
                    try {
                        await fs.access(webpPath);
                        let image = sharp(webpPath);
                        if (ext === '.png') {
                            image = image.png();
                        } else {
                            image = image.jpeg({ quality: 85 });
                        }
                        const buffer = await image.toBuffer();
                        const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
                        reply.header('Content-Type', mime);
                        reply.header('Cache-Control', 'public, max-age=31536000');
                        return reply.send(buffer);
                    } catch {
                        // webp fallback failed too
                    }
                }
                throw err;
            }
        } catch {
            return reply.code(404).send({ error: 'Not found' });
        }
    };

    // Static files — logos
    fastify.get('/uploads/logos/:file', async (request, reply) => {
        const { file } = request.params as { file: string };
        const baseDir = path.join(uploadsRoot, 'logos');
        const filePath = getSafeFilePath(baseDir, file);
        if (!filePath) return reply.code(400).send({ error: 'Invalid path' });
        return serveStaticFile(filePath, reply);
    });

    // Static files — rental vehicle images
    fastify.get('/uploads/rental-images/:vehicleId/:file', async (request, reply) => {
        const { vehicleId, file } = request.params as { vehicleId: string; file: string };
        const baseDir = path.join(uploadsRoot, 'rental-images', vehicleId);
        const filePath = getSafeFilePath(baseDir, file);
        if (!filePath) return reply.code(400).send({ error: 'Invalid path' });
        return serveStaticFile(filePath, reply);
    });

    // Static files — listing images
    fastify.get('/uploads/listing-images/:listingId/:file', async (request, reply) => {
        const { listingId, file } = request.params as { listingId: string; file: string };
        const baseDir = path.join(uploadsRoot, 'listing-images', listingId);
        const filePath = getSafeFilePath(baseDir, file);
        if (!filePath) return reply.code(400).send({ error: 'Invalid path' });
        return serveStaticFile(filePath, reply);
    });

    // Static files — CSFlow cached vehicle images
    fastify.get('/uploads/csflow-images/:listingId/:file', async (request, reply) => {
        const { listingId, file } = request.params as { listingId: string; file: string };
        const baseDir = path.join(uploadsRoot, 'csflow-images', listingId);
        const filePath = getSafeFilePath(baseDir, file);
        if (!filePath) return reply.code(400).send({ error: 'Invalid path' });
        return serveStaticFile(filePath, reply);
    });

    // Static files — specification images
    fastify.get('/uploads/specification-images/:specificationId/:file', async (request, reply) => {
        const { specificationId, file } = request.params as { specificationId: string; file: string };
        const baseDir = path.join(uploadsRoot, 'specification-images', specificationId);
        const filePath = getSafeFilePath(baseDir, file);
        if (!filePath) return reply.code(400).send({ error: 'Invalid path' });
        return serveStaticFile(filePath, reply);
    });

    // Static files — legal documents (PDF) + feature tile images at human-readable slugs
    const PUBLIC_SLUGS = new Set([
        'impressum',
        'polityka-prywatnosci',
        'regulamin',
        'polityka-cookies',
        'feature-tiles',
        'hero-banners',
        'migrated-images',
    ]);
    fastify.get('/uploads/:slug/:file', async (request, reply) => {
        const { slug, file } = request.params as { slug: string; file: string };
        if (!PUBLIC_SLUGS.has(slug)) {
            return reply.code(404).send({ error: 'Not found' });
        }
        const baseDir = path.join(uploadsRoot, slug);
        const filePath = getSafeFilePath(baseDir, file);
        if (!filePath) return reply.code(400).send({ error: 'Invalid path' });
        return serveStaticFile(filePath, reply);
    });

    // Cleanup hook
    fastify.addHook('onClose', async (instance) => {
        await instance.prisma.$disconnect();
        await instance.redis.quit();
        await closeBrowser();
    });

    return fastify;
}
