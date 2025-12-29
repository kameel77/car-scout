import { FastifyInstance } from 'fastify';

export async function listingRoutes(fastify: FastifyInstance) {
    // Get filter options (makes and models)
    fastify.get('/api/listings/options', async (request, reply) => {
        // fetch distinct makes
        const makesRaw = await fastify.prisma.listing.findMany({
            select: { make: true },
            distinct: ['make'],
            orderBy: { make: 'asc' }
        });

        // fetch distinct models with their makes
        const modelsRaw = await fastify.prisma.listing.findMany({
            select: { make: true, model: true },
            distinct: ['make', 'model'],
            orderBy: { model: 'asc' }
        });

        const makes = makesRaw.map(m => m.make).filter(Boolean);
        const models = modelsRaw.map(m => ({ make: m.make, model: m.model })).filter(m => m.make && m.model);

        return { makes, models };
    });

    // Get all listings (with filters)
    fastify.get('/api/listings', async (request, reply) => {
        const {
            q, // Search query
            make, model,
            priceMin, priceMax,
            yearMin, yearMax,
            mileageMin, mileageMax,
            powerMin, powerMax,
            capacityMin, capacityMax,
            fuelType, transmission, bodyType,
            sortBy,
            includeArchived,
            currency // Added currency parameter
        } = request.query as any;

        // Helper to parse comma-separated lists into array or undefined
        const toArray = (val: any) => val ? (Array.isArray(val) ? val : val.split(',')) : undefined;

        const fuelTypes = toArray(fuelType);
        const transmissions = toArray(transmission);
        const bodyTypes = toArray(bodyType);
        const makes = toArray(make);
        const models = toArray(model);

        const isEur = currency === 'EUR';
        const priceField = isEur ? 'brokerPriceEur' : 'brokerPricePln';

        const orderBy: any = {};
        switch (sortBy) {
            case 'price_asc': orderBy[priceField] = 'asc'; break;
            case 'price_desc': orderBy[priceField] = 'desc'; break;
            case 'year_asc': orderBy.productionYear = 'asc'; break;
            case 'year_desc': orderBy.productionYear = 'desc'; break;
            case 'mileage_asc': orderBy.mileageKm = 'asc'; break;
            case 'mileage_desc': orderBy.mileageKm = 'desc'; break;
            case 'newest': default: orderBy.createdAt = 'desc'; break;
        }

        // Search logic
        const searchTerms = q ? (q as string).trim().split(/\s+/).filter(Boolean) : [];
        const searchFilter = searchTerms.length > 0 ? {
            AND: searchTerms.map(term => {
                const isNumber = !isNaN(parseInt(term));
                const termFilter: any[] = [
                    { make: { contains: term, mode: 'insensitive' } },
                    { model: { contains: term, mode: 'insensitive' } },
                    { version: { contains: term, mode: 'insensitive' } },
                    { fuelType: { contains: term, mode: 'insensitive' } },
                    { transmission: { contains: term, mode: 'insensitive' } },
                    { bodyType: { contains: term, mode: 'insensitive' } },
                    { additionalInfoContent: { contains: term, mode: 'insensitive' } },
                    // Check equipment arrays for exact matches (limit of Prisma)
                    { equipmentAudioMultimedia: { has: term } },
                    { equipmentSafety: { has: term } },
                    { equipmentComfortExtras: { has: term } },
                    { equipmentOther: { has: term } }
                ];

                if (isNumber) {
                    termFilter.push({ productionYear: { equals: parseInt(term) } });
                }

                return { OR: termFilter };
            })
        } : {};

        const listings = await fastify.prisma.listing.findMany({
            where: {
                ...searchFilter,
                make: makes ? { in: makes, mode: 'insensitive' } : undefined,
                model: models ? { in: models, mode: 'insensitive' } : undefined,

                [priceField]: {
                    gte: priceMin ? parseInt(priceMin) : undefined,
                    lte: priceMax ? parseInt(priceMax) : undefined
                },
                productionYear: {
                    gte: yearMin ? parseInt(yearMin) : undefined,
                    lte: yearMax ? parseInt(yearMax) : undefined
                },
                mileageKm: {
                    gte: mileageMin ? parseInt(mileageMin) : undefined,
                    lte: mileageMax ? parseInt(mileageMax) : undefined
                },
                enginePowerHp: {
                    gte: powerMin ? parseInt(powerMin) : undefined,
                    lte: powerMax ? parseInt(powerMax) : undefined
                },
                engineCapacityCm3: {
                    gte: capacityMin ? parseInt(capacityMin) : undefined,
                    lte: capacityMax ? parseInt(capacityMax) : undefined
                },

                fuelType: fuelTypes ? { in: fuelTypes, mode: 'insensitive' } : undefined,
                transmission: transmissions ? { in: transmissions, mode: 'insensitive' } : undefined,
                bodyType: bodyTypes ? { in: bodyTypes, mode: 'insensitive' } : undefined,
            },
            include: {
                dealer: true
            },
            orderBy,
            take: 100
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
