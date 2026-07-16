import { FastifyInstance } from 'fastify';

const CACHE_KEY = 'business:offers';
const CACHE_TTL_S = 600;
const OFFERS_LIMIT = 6;

export async function businessRoutes(fastify: FastifyInstance) {
    // Oferty specjalne dla firm (/dla-firm) — isBusinessFeatured, fallback na isFeatured
    // (jak onepager), rata netto liczona z pola referenceLeasingInstallment (cron finansowania).
    fastify.get('/api/business/offers', async (req, reply) => {
        const cached = await fastify.redis.get(CACHE_KEY);
        if (cached) return JSON.parse(cached);

        const businessFeatured = await fastify.prisma.listing.findMany({
            where: { isBusinessFeatured: true, isArchived: false, pricePln: { gt: 0 } },
            take: OFFERS_LIMIT,
            orderBy: { createdAt: 'desc' },
            include: { dealer: true },
        });

        const offers = businessFeatured.length > 0
            ? businessFeatured
            : await fastify.prisma.listing.findMany({
                  where: { isFeatured: true, isArchived: false, pricePln: { gt: 0 } },
                  take: OFFERS_LIMIT,
                  orderBy: { createdAt: 'desc' },
                  include: { dealer: true },
              });

        const result = { offers };
        await fastify.redis.set(CACHE_KEY, JSON.stringify(result), 'EX', CACHE_TTL_S);
        return result;
    });
}
