import { FastifyInstance } from 'fastify';
import path from 'path';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import crypto from 'crypto';
import { requirePermission } from '../middleware/permissions.js';
import { optimizeAndSaveImage } from '../services/image-optimizer.js';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const TILES_DIR = path.join(UPLOADS_DIR, 'feature-tiles');
const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_TILE_IMAGE_SIZE = 5 * 1024 * 1024;

// ── URL parser + vehicle count ──────────────────────────────────────────────

type CountKind = 'sale-only' | 'rental-only' | 'both';

interface ParsedTarget {
    kind: CountKind;
    saleWhere: any;
    rentalWhere: any;
}

function buildSaleWhere(condition: 'NEW' | 'USED' | undefined, qs: URLSearchParams): any {
    const where: any = { isArchived: false };
    if (condition) where.condition = condition;

    const csv = (key: string) => qs.get(key)?.split(',').map((s) => s.trim()).filter(Boolean);
    const makes = csv('make');
    const models = csv('model');
    const bodyTypes = csv('bodyType');
    const fuelTypes = csv('fuelType');
    const transmissions = csv('transmission');
    const drives = csv('drive');

    if (makes?.length) where.make = { in: makes, mode: 'insensitive' as const };
    if (models?.length) where.model = { in: models, mode: 'insensitive' as const };
    if (bodyTypes?.length) where.bodyType = { in: bodyTypes, mode: 'insensitive' as const };
    if (fuelTypes?.length) where.fuelType = { in: fuelTypes, mode: 'insensitive' as const };
    if (transmissions?.length) where.transmission = { in: transmissions, mode: 'insensitive' as const };
    if (drives?.length) where.drive = { in: drives, mode: 'insensitive' as const };

    const yearMin = qs.get('yearMin');
    const yearMax = qs.get('yearMax');
    if (yearMin || yearMax) {
        where.productionYear = {};
        if (yearMin) where.productionYear.gte = parseInt(yearMin, 10);
        if (yearMax) where.productionYear.lte = parseInt(yearMax, 10);
    }

    const priceMin = qs.get('priceMin');
    const priceMax = qs.get('priceMax');
    if (priceMin || priceMax) {
        where.pricePln = {};
        if (priceMin) where.pricePln.gte = parseInt(priceMin, 10);
        if (priceMax) where.pricePln.lte = parseInt(priceMax, 10);
    }

    return where;
}

function buildRentalWhere(condition: 'NEW' | 'USED' | undefined, qs: URLSearchParams): any {
    const where: any = {
        isActive: true,
        isPublished: true,
        rentalAssignments: {
            some: { isActive: true, matrixEntries: { some: {} } }
        }
    };
    if (condition) where.condition = condition;

    const csv = (key: string) => qs.get(key)?.split(',').map((s) => s.trim()).filter(Boolean);
    const makes = csv('make');
    const models = csv('model');
    const bodyTypes = csv('bodyType');
    const fuelTypes = csv('fuelType');
    const transmissions = csv('transmission');
    const drives = csv('drive');

    if (makes?.length) where.make = { in: makes, mode: 'insensitive' as const };
    if (models?.length) where.model = { in: models, mode: 'insensitive' as const };
    if (bodyTypes?.length) where.bodyType = { in: bodyTypes, mode: 'insensitive' as const };
    if (fuelTypes?.length) where.fuelType = { in: fuelTypes, mode: 'insensitive' as const };
    if (transmissions?.length) where.transmission = { in: transmissions, mode: 'insensitive' as const };
    if (drives?.length) where.drive = { in: drives, mode: 'insensitive' as const };

    const yearMin = qs.get('yearMin');
    const yearMax = qs.get('yearMax');
    if (yearMin || yearMax) {
        where.productionYear = {};
        if (yearMin) where.productionYear.gte = parseInt(yearMin, 10);
        if (yearMax) where.productionYear.lte = parseInt(yearMax, 10);
    }

    return where;
}

function parseTargetUrl(rawUrl: string): ParsedTarget | null {
    // Accept absolute (http(s)) or relative URLs; only the path+query matter.
    let pathname = '';
    let search = '';
    try {
        if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
            const u = new URL(rawUrl);
            pathname = u.pathname;
            search = u.search;
        } else {
            const idx = rawUrl.indexOf('?');
            pathname = idx >= 0 ? rawUrl.slice(0, idx) : rawUrl;
            search = idx >= 0 ? rawUrl.slice(idx) : '';
        }
    } catch {
        return null;
    }
    const qs = new URLSearchParams(search);

    const norm = pathname.replace(/\/+$/, '').toLowerCase() || '/';

    // /nowe — sale condition=NEW (rentals are strictly on /wynajem-dlugoterminowy)
    if (norm === '/nowe') {
        return {
            kind: 'sale-only',
            saleWhere: buildSaleWhere('NEW', qs),
            rentalWhere: null,
        };
    }
    // /uzywane — sale condition=USED
    if (norm === '/uzywane') {
        return {
            kind: 'sale-only',
            saleWhere: buildSaleWhere('USED', qs),
            rentalWhere: null,
        };
    }
    // /samochody — sale optional status filter
    if (norm === '/samochody') {
        const statusRaw = qs.get('status');
        const cond = statusRaw === 'new' || statusRaw === 'NEW' ? 'NEW'
            : statusRaw === 'used' || statusRaw === 'USED' ? 'USED'
                : undefined;
        return {
            kind: 'sale-only',
            saleWhere: buildSaleWhere(cond, qs),
            rentalWhere: null,
        };
    }
    // /wynajem and /wynajem-dlugoterminowy — rental only
    if (norm === '/wynajem' || norm === '/wynajem-dlugoterminowy') {
        return {
            kind: 'rental-only',
            saleWhere: null,
            rentalWhere: buildRentalWhere(undefined, qs),
        };
    }
    return null;
}

async function countVehiclesForTarget(fastify: FastifyInstance, targetUrl: string): Promise<number | null> {
    const parsed = parseTargetUrl(targetUrl);
    if (!parsed) return null;

    if (parsed.kind === 'sale-only') {
        return fastify.prisma.listing.count({ where: parsed.saleWhere });
    }
    if (parsed.kind === 'rental-only') {
        return fastify.prisma.rentalVehicle.count({ where: parsed.rentalWhere });
    }
    const [sale, rental] = await Promise.all([
        fastify.prisma.listing.count({ where: parsed.saleWhere }),
        fastify.prisma.rentalVehicle.count({ where: parsed.rentalWhere }),
    ]);
    return sale + rental;
}

// ── Routes ───────────────────────────────────────────────────────────────────

export async function featureTileRoutes(fastify: FastifyInstance) {
    // Public: list active tiles with computed vehicle counts
    fastify.get('/api/feature-tiles/public', async (_request, _reply) => {
        const tiles = await fastify.prisma.featureTile.findMany({
            where: { isActive: true },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        });
        const withCounts = await Promise.all(
            tiles.map(async (t) => ({
                id: t.id,
                title: t.title,
                imageUrl: t.imageUrl,
                targetUrl: t.targetUrl,
                vehicleCount: await countVehiclesForTarget(fastify, t.targetUrl),
            }))
        );
        return { tiles: withCounts };
    });

    // Admin: list all tiles
    fastify.get('/api/feature-tiles', {
        preHandler: [fastify.authenticate, requirePermission('content:read')]
    }, async () => {
        const tiles = await fastify.prisma.featureTile.findMany({
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        });
        return { tiles };
    });

    // Admin: create tile
    fastify.post('/api/feature-tiles', {
        preHandler: [fastify.authenticate, requirePermission('content:write')]
    }, async (request, reply) => {
        const { title, imageUrl, targetUrl, isActive } = request.body as {
            title?: string; imageUrl?: string | null; targetUrl?: string; isActive?: boolean;
        };
        if (!title || !targetUrl) {
            return reply.code(400).send({ error: 'title and targetUrl are required' });
        }
        const max = await fastify.prisma.featureTile.aggregate({ _max: { sortOrder: true } });
        const tile = await fastify.prisma.featureTile.create({
            data: {
                title,
                imageUrl: imageUrl ?? null,
                targetUrl,
                sortOrder: (max._max.sortOrder ?? 0) + 1,
                isActive: isActive ?? true,
            }
        });
        return { tile };
    });

    // Admin: update tile
    fastify.put('/api/feature-tiles/:id', {
        preHandler: [fastify.authenticate, requirePermission('content:write')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { title, imageUrl, targetUrl, isActive } = request.body as {
            title?: string; imageUrl?: string | null; targetUrl?: string; isActive?: boolean;
        };
        try {
            const tile = await fastify.prisma.featureTile.update({
                where: { id },
                data: {
                    ...(title !== undefined ? { title } : {}),
                    ...(imageUrl !== undefined ? { imageUrl } : {}),
                    ...(targetUrl !== undefined ? { targetUrl } : {}),
                    ...(isActive !== undefined ? { isActive } : {}),
                }
            });
            return { tile };
        } catch {
            return reply.code(404).send({ error: 'Tile not found' });
        }
    });

    // Admin: delete tile (also delete image file if hosted)
    fastify.delete('/api/feature-tiles/:id', {
        preHandler: [fastify.authenticate, requirePermission('content:write')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const tile = await fastify.prisma.featureTile.findUnique({ where: { id } });
        if (!tile) return reply.code(404).send({ error: 'Tile not found' });
        if (tile.imageUrl?.startsWith('/uploads/feature-tiles/')) {
            const oldPath = path.join(process.cwd(), tile.imageUrl.replace(/^\//, ''));
            const mediumPath = oldPath.replace('.webp', '-md.webp');
            const thumbPath = oldPath.replace('.webp', '-thumb.webp');
            try {
                await fs.unlink(oldPath);
                await fs.unlink(mediumPath).catch(() => {});
                await fs.unlink(thumbPath).catch(() => {});
            } catch { /* ignore */ }
        }
        await fastify.prisma.featureTile.delete({ where: { id } });
        return { success: true };
    });

    // Admin: reorder — body: { order: [tileId, tileId, ...] }
    fastify.post('/api/feature-tiles/reorder', {
        preHandler: [fastify.authenticate, requirePermission('content:write')]
    }, async (request, reply) => {
        const { order } = request.body as { order?: string[] };
        if (!Array.isArray(order)) {
            return reply.code(400).send({ error: 'order array required' });
        }
        await fastify.prisma.$transaction(
            order.map((id, idx) =>
                fastify.prisma.featureTile.update({
                    where: { id },
                    data: { sortOrder: idx + 1 }
                })
            )
        );
        return { success: true };
    });

    // Admin: upload image for a tile (multipart)
    fastify.post('/api/feature-tiles/:id/image', {
        preHandler: [fastify.authenticate, requirePermission('content:write')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const tile = await fastify.prisma.featureTile.findUnique({ where: { id } });
        if (!tile) return reply.code(404).send({ error: 'Tile not found' });

        const file = await request.file();
        if (!file) return reply.code(400).send({ error: 'File is required' });
        if (!ALLOWED_IMAGE_MIME.includes(file.mimetype)) {
            return reply.code(400).send({ error: `Unsupported MIME: ${file.mimetype}` });
        }

        await fs.mkdir(TILES_DIR, { recursive: true });
        
        const buffer = await file.toBuffer();
        if (buffer.length > MAX_TILE_IMAGE_SIZE) {
            return reply.code(413).send({ error: 'File too large (max 5MB)' });
        }

        const baseFilename = `${id}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
        const { largeFilename } = await optimizeAndSaveImage(buffer, {
            targetDir: TILES_DIR,
            baseFilename,
            // Kafelek renderuje się najwyżej ~280 px CSS (5 kolumn w .container na desktopie),
            // więc domyślne 1920/1200/600 z pipeline'u fotografii aut są tu bezużyteczne.
            largeWidth: 900,
            mediumWidth: 600,
            thumbWidth: 400,
            quality: 72,
        });
        const url = `/uploads/feature-tiles/${largeFilename}`;

        // Delete previous image file
        if (tile.imageUrl?.startsWith('/uploads/feature-tiles/')) {
            const oldPath = path.join(process.cwd(), tile.imageUrl.replace(/^\//, ''));
            const mediumPath = oldPath.replace('.webp', '-md.webp');
            const thumbPath = oldPath.replace('.webp', '-thumb.webp');
            try {
                await fs.unlink(oldPath);
                await fs.unlink(mediumPath).catch(() => {});
                await fs.unlink(thumbPath).catch(() => {});
            } catch { /* ignore */ }
        }

        const updated = await fastify.prisma.featureTile.update({
            where: { id },
            data: { imageUrl: url }
        });
        return { tile: updated, url };
    });
}
