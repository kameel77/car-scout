import { FastifyInstance } from 'fastify';
import { refreshListingImages } from '../services/image-refresh.service.js';

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
            currency, // Added currency parameter
            page: pageParam,
            perPage: perPageParam
        } = request.query as any;

        // Helper to parse comma-separated lists into array or undefined
        const toArray = (val: unknown): string[] | undefined => {
            if (!val) return undefined;
            if (Array.isArray(val)) return val.map(String);
            return String(val).split(',');
        };

        const fuelTypes = toArray(fuelType);
        const transmissions = toArray(transmission);
        const bodyTypes = toArray(bodyType);
        const makes = toArray(make);
        const models = toArray(model);

        const isEur = currency === 'EUR';
        const priceField = isEur ? 'brokerPriceEur' : 'brokerPricePln';

        const page = Math.max(1, parseInt(pageParam) || 1);
        const parsedPerPage = parseInt(perPageParam);
        const perPage = [30, 60].includes(parsedPerPage) ? parsedPerPage : 30;

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

        const where = {
            ...searchFilter,
            make: makes ? { in: makes, mode: 'insensitive' as const } : undefined,
            model: models ? { in: models, mode: 'insensitive' as const } : undefined,

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

            fuelType: fuelTypes ? { in: fuelTypes, mode: 'insensitive' as const } : undefined,
            transmission: transmissions ? { in: transmissions, mode: 'insensitive' as const } : undefined,
            bodyType: bodyTypes ? { in: bodyTypes, mode: 'insensitive' as const } : undefined,
            isArchived: includeArchived === 'true' ? undefined : false,
        };

        const [listings, totalCount] = await Promise.all([
            fastify.prisma.listing.findMany({
                where,
                include: {
                    dealer: true
                },
                orderBy,
                skip: (page - 1) * perPage,
                take: perPage
            }),
            fastify.prisma.listing.count({ where })
        ]);

        return {
            listings,
            count: totalCount,
            page,
            perPage,
            totalPages: Math.max(1, Math.ceil(totalCount / perPage))
        };
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

    // Refresh images from source (admin only for manual refresh, public for auto-refresh)
    fastify.post('/api/listings/:id/refresh-images', async (request, reply) => {
        const { id } = request.params as { id: string };

        // Check if user is authenticated (for manual refresh)
        const authHeader = request.headers.authorization;
        const isAuthenticated = authHeader && authHeader.startsWith('Bearer ');

        if (!isAuthenticated) {
            // For auto-refresh, check if autoRefreshImages setting is enabled
            try {
                const settings = await fastify.prisma.appSettings.findFirst();
                if (!settings?.autoRefreshImages) {
                    return reply.code(403).send({
                        error: 'Auto-refresh not enabled'
                    });
                }
            } catch (error) {
                return reply.code(500).send({
                    error: 'Settings check failed'
                });
            }
        }

        try {
            const listing = await refreshListingImages(fastify.prisma, id);
            return { success: true, listing };
        } catch (error) {
            fastify.log.error(error);
            return reply.code(400).send({
                error: 'Refresh failed',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // DEBUG: Get raw counts from Prisma to diagnose visibility issues
    fastify.get('/api/debug-data', async (request, reply) => {
        try {
            const rawCount = await fastify.prisma.listing.count();
            const activeCount = await fastify.prisma.listing.count({ where: { isArchived: false } });
            const userCount = await fastify.prisma.user.count();

            // Raw SQL checks to bypass Prisma mapping and see exactly what's in the DB
            const dbIdentity = await fastify.prisma.$queryRaw`SELECT current_database(), current_user, inet_server_addr(), inet_server_port()`;
            const rawListingCount = await fastify.prisma.$queryRaw`SELECT count(*) FROM public.listings`;
            const rawUserCount = await fastify.prisma.$queryRaw`SELECT count(*) FROM public.users`;
            const tablesWithCounts = await fastify.prisma.$queryRaw`
                SELECT table_name, 
                (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I', table_name), false, true, '')))[1]::text::int as row_count
                FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            `;

            // Helper to handle BigInt serialization
            const serialize = (obj: any): any => {
                return JSON.parse(JSON.stringify(obj, (key, value) =>
                    typeof value === 'bigint' ? value.toString() : value
                ));
            };

            return {
                prismaReport: serialize({
                    totalListings: rawCount,
                    totalUsers: userCount,
                    diagnostics: {
                        dbIdentity,
                        rawListingCount,
                        rawUserCount,
                        tablesWithCounts
                    },
                    dbUrl: process.env.DATABASE_URL?.replace(/:([^:@]+)@/, ':****@')
                })
            };
        } catch (error) {
            return { error: error instanceof Error ? error.message : 'Prisma error' };
        }
    });
}
