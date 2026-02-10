
import { FastifyInstance } from 'fastify';
import { authorizeRoles } from '../middleware/authorize.js';

export async function seoRoutes(fastify: FastifyInstance) {
    // Get SEO Config
    fastify.get('/api/seo', async () => {
        const config = await fastify.prisma.seoConfig.findUnique({
            where: { id: 'default' }
        });
        // Return empty object if not found, or default structure
        return config || { id: 'default' };
    });

    // Update SEO Config
    fastify.put('/api/seo', {
        preHandler: [fastify.authenticate, authorizeRoles(['admin', 'manager'])]
    }, async (request, reply) => {
        const data = request.body as any;

        // Basic validation could be added here if needed

        const config = await fastify.prisma.seoConfig.upsert({
            where: { id: 'default' },
            update: {
                gtmId: data.gtmId,
                homeTitle: data.homeTitle,
                homeTitleEn: data.homeTitleEn,
                homeTitleDe: data.homeTitleDe,
                homeDescription: data.homeDescription,
                homeDescriptionEn: data.homeDescriptionEn,
                homeDescriptionDe: data.homeDescriptionDe,
                homeOgImage: data.homeOgImage,
                listingTitle: data.listingTitle,
                listingTitleEn: data.listingTitleEn,
                listingTitleDe: data.listingTitleDe,
                listingDescription: data.listingDescription,
                listingDescriptionEn: data.listingDescriptionEn,
                listingDescriptionDe: data.listingDescriptionDe
            },
            create: {
                id: 'default',
                gtmId: data.gtmId,
                homeTitle: data.homeTitle,
                homeTitleEn: data.homeTitleEn,
                homeTitleDe: data.homeTitleDe,
                homeDescription: data.homeDescription,
                homeDescriptionEn: data.homeDescriptionEn,
                homeDescriptionDe: data.homeDescriptionDe,
                homeOgImage: data.homeOgImage,
                listingTitle: data.listingTitle,
                listingTitleEn: data.listingTitleEn,
                listingTitleDe: data.listingTitleDe,
                listingDescription: data.listingDescription,
                listingDescriptionEn: data.listingDescriptionEn,
                listingDescriptionDe: data.listingDescriptionDe
            }
        });

        return config;
    });
}
