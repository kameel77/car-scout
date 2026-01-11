
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
                homeDescription: data.homeDescription,
                homeOgImage: data.homeOgImage,
                listingTitle: data.listingTitle,
                listingDescription: data.listingDescription
            },
            create: {
                id: 'default',
                gtmId: data.gtmId,
                homeTitle: data.homeTitle,
                homeDescription: data.homeDescription,
                homeOgImage: data.homeOgImage,
                listingTitle: data.listingTitle,
                listingDescription: data.listingDescription
            }
        });

        return config;
    });
}
