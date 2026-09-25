import { FastifyInstance } from 'fastify';
import { requirePermission } from '../middleware/permissions.js';
import { resolveScope } from '../utils/scope-resolver.js';
import { sanitizeListing } from '../constants/dealer.js';

export async function featuredRoutes(fastify: FastifyInstance) {
    fastify.get('/api/featured', async (request, reply) => {
        try {
            // Redis caching (10 minutes)
            const cached = await fastify.redis.get('featured:vehicles');
            if (cached) {
                return JSON.parse(cached);
            }

            // We distinguish New vs Used using mileage (<= 100km is NEW).
            const [featuredNewCars, featuredUsedCars, featuredRentals] = await Promise.all([
                fastify.prisma.listing.findMany({
                    where: { isFeatured: true, isArchived: false, mileageKm: { lte: 100 }, pricePln: { gt: 0 } },
                    take: 12,
                    orderBy: { createdAt: 'desc' },
                    include: { dealer: true }
                }),
                fastify.prisma.listing.findMany({
                    where: { isFeatured: true, isArchived: false, mileageKm: { gt: 100 }, pricePln: { gt: 0 } },
                    take: 12,
                    orderBy: { createdAt: 'desc' },
                    include: { dealer: true }
                }),
                fastify.prisma.rentalVehicle.findMany({
                    where: { isFeatured: true, isActive: true, isPublished: true },
                    take: 12,
                    orderBy: { createdAt: 'desc' }
                })
            ]);

            const result = {
                newCars: featuredNewCars.map((l) => sanitizeListing(l, false)),
                usedCars: featuredUsedCars.map((l) => sanitizeListing(l, false)),
                rentals: featuredRentals.map((r) => sanitizeListing(r, false))
            };

            await fastify.redis.set('featured:vehicles', JSON.stringify(result), 'EX', 600); // 10 minutes TTL

            return result;
        } catch (error) {
            fastify.log.error(error, 'Failed to fetch featured vehicles');
            return reply.code(500).send({
                error: 'Failed to fetch featured vehicles',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // Toggle featured status for a listing
    fastify.post('/api/listings/:id/featured', {
        preHandler: [fastify.authenticate, requirePermission('stock:write')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        // isBusinessFeatured: wyróżnienie w ofercie dla firm (/dla-firm) — oba pola opcjonalne
        const { isFeatured, isBusinessFeatured } = request.body as { isFeatured?: boolean; isBusinessFeatured?: boolean };
        const scope = await resolveScope(fastify, request);

        // Security check - just like archive
        if (!scope.isPlatform) {
            const existing = await fastify.prisma.listing.findUnique({ where: { id }, select: { dealerId: true } });
            const allowedDealerIds = scope.dealerFilter.dealerId;
            const dealerId = existing?.dealerId;
            if (!dealerId) return reply.code(403).send({ error: 'Listing has no dealer' });
            if (typeof allowedDealerIds === 'string' && dealerId !== allowedDealerIds) return reply.code(403).send({ error: 'Forbidden' });
            if (typeof allowedDealerIds === 'object' && 'in' in allowedDealerIds && !allowedDealerIds.in.includes(dealerId)) return reply.code(403).send({ error: 'Forbidden' });
        }

        const listing = await fastify.prisma.listing.update({
            where: { id },
            data: {
                ...(isFeatured !== undefined ? { isFeatured } : {}),
                ...(isBusinessFeatured !== undefined ? { isBusinessFeatured } : {}),
            }
        });

        // Invalidate cache
        await fastify.redis.del('featured:vehicles');
        await fastify.redis.del('onepager:pdf:default');
        await fastify.redis.del('business:offers');

        return { success: true, isFeatured: listing.isFeatured, isBusinessFeatured: listing.isBusinessFeatured };
    });

    // Toggle featured status for a rental vehicle
    fastify.post('/api/rental-vehicles/:id/featured', {
        preHandler: [fastify.authenticate, requirePermission('rental:write')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { isFeatured, isBusinessFeatured } = request.body as { isFeatured?: boolean; isBusinessFeatured?: boolean };

        const rv = await fastify.prisma.rentalVehicle.update({
            where: { id },
            data: {
                ...(isFeatured !== undefined ? { isFeatured } : {}),
                ...(isBusinessFeatured !== undefined ? { isBusinessFeatured } : {}),
            }
        });

        // Invalidate cache
        await fastify.redis.del('featured:vehicles');
        await fastify.redis.del('onepager:pdf:default');
        await fastify.redis.del('business:offers');

        return { success: true, isFeatured: rv.isFeatured, isBusinessFeatured: rv.isBusinessFeatured };
    });

    // Toggle published (frontend visibility) status for a rental vehicle
    fastify.post('/api/rental-vehicles/:id/published', {
        preHandler: [fastify.authenticate, requirePermission('rental:write')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { isPublished } = request.body as { isPublished: boolean };

        const rv = await fastify.prisma.rentalVehicle.update({
            where: { id },
            data: { isPublished }
        });

        // Invalidate cache (featured list may have referenced this vehicle)
        await fastify.redis.del('featured:vehicles');

        return { success: true, isPublished: rv.isPublished };
    });
}
