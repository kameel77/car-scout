import { FastifyInstance } from 'fastify';

export async function listingRoutes(fastify: FastifyInstance) {
    // Get all listings (with filters)
    fastify.get('/api/listings', async (request, reply) => {
        const {
            make, model, priceMin, priceMax,
            yearMin, yearMax, includeArchived
        } = request.query as any;

        const listings = await fastify.prisma.listing.findMany({
            where: {
                isArchived: includeArchived === 'true' ? undefined : false,
                make: make ? { contains: make, mode: 'insensitive' } : undefined,
                model: model ? { contains: model, mode: 'insensitive' } : undefined,
                pricePln: {
                    gte: priceMin ? parseInt(priceMin) : undefined,
                    lte: priceMax ? parseInt(priceMax) : undefined
                },
                productionYear: {
                    gte: yearMin ? parseInt(yearMin) : undefined,
                    lte: yearMax ? parseInt(yearMax) : undefined
                }
            },
            include: {
                dealer: true
            },
            orderBy: { updatedAt: 'desc' },
            take: 100 // Limit for performance
        });

        return { listings, count: listings.length };
    });

    // Get single listing with price history
    fastify.get('/api/listings/:id', async (request, reply) => {
        const { id } = request.params as { id: string };

        const listing = await fastify.prisma.listing.findUnique({
            where: { id },
            include: {
                dealer: true,
                priceHistory: {
                    orderBy: { changedAt: 'desc' },
                    take: 30
                }
            }
        });

        if (!listing) {
            return reply.code(404).send({ error: 'Listing not found' });
        }

        return { listing };
    });

    // Archive listing (admin only)
    fastify.post('/api/listings/:id/archive', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { reason } = request.body as { reason?: string };

        const listing = await fastify.prisma.listing.update({
            where: { id },
            data: {
                isArchived: true,
                archivedAt: new Date(),
                archivedReason: reason || 'Manual archive'
            }
        });

        return { listing };
    });

    // Restore from archive (admin only)
    fastify.post('/api/listings/:id/restore', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };

        const listing = await fastify.prisma.listing.update({
            where: { id },
            data: {
                isArchived: false,
                archivedAt: null,
                archivedReason: null
            }
        });

        return { listing };
    });
}
