import { FastifyInstance } from 'fastify';
import { sanitizeListing } from '../constants/dealer.js';

const CACHE_KEY = 'business:offers';
const CACHE_TTL_S = 600;
const OFFERS_LIMIT = 6;

export async function businessRoutes(fastify: FastifyInstance) {
    // Oferty specjalne dla firm (/dla-firm) — isBusinessFeatured, fallback na isFeatured
    // (jak onepager), rata netto liczona z pola referenceLeasingInstallment (cron finansowania).
    fastify.get('/api/business/offers', async (req, reply) => {
        const cached = await fastify.redis.get(CACHE_KEY);
        if (cached) return JSON.parse(cached);

        const [businessFeatured, businessRentals] = await Promise.all([
            fastify.prisma.listing.findMany({
                where: { isBusinessFeatured: true, isArchived: false, pricePln: { gt: 0 } },
                take: OFFERS_LIMIT,
                orderBy: { createdAt: 'desc' },
                include: { dealer: true },
            }),
            // Miks form finansowania: pojazdy najmu oznaczone jako oferta dla firm
            fastify.prisma.rentalVehicle.findMany({
                where: { isBusinessFeatured: true, isActive: true, isPublished: true },
                take: OFFERS_LIMIT,
                orderBy: { createdAt: 'desc' },
                include: { rentalAssignments: { include: { matrixEntries: true } } },
            }),
        ]);

        // Rata netto najmu: minimalna z macierzy (konwencja jak w widgets.ts)
        const rentalOffers = businessRentals.map((r) => {
            let minNetRate: number | null = null;
            for (const asgmnt of r.rentalAssignments) {
                for (const entry of asgmnt.matrixEntries) {
                    if (minNetRate === null || entry.monthlyRateNet < minNetRate) {
                        minNetRate = entry.monthlyRateNet;
                    }
                }
            }
            const { rentalAssignments, ...vehicle } = r as any;
            return { ...vehicle, offerKind: 'rental', rentalNetRate: minNetRate };
        });

        let merged = [
            ...businessFeatured.map((l) => ({ ...l, offerKind: 'sale' })),
            ...rentalOffers,
        ]
            .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, OFFERS_LIMIT);

        if (merged.length === 0) {
            const fallback = await fastify.prisma.listing.findMany({
                where: { isFeatured: true, isArchived: false, pricePln: { gt: 0 } },
                take: OFFERS_LIMIT,
                orderBy: { createdAt: 'desc' },
                include: { dealer: true },
            });
            merged = fallback.map((l) => ({ ...l, offerKind: 'sale' }));
        }

        const sanitizedOffers = merged.map((item) => sanitizeListing(item, false));
        const result = { offers: sanitizedOffers };
        await fastify.redis.set(CACHE_KEY, JSON.stringify(result), 'EX', CACHE_TTL_S);
        return result;
    });
}
