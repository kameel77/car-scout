import { FastifyInstance } from 'fastify';
import { z } from 'zod';

export async function partnerAdsRoutes(fastify: FastifyInstance) {
    // Schema for Ad validation
    const adSchema = z.object({
        placement: z.enum(['SEARCH_GRID', 'SEARCH_TOP', 'DETAIL_SIDEBAR']),
        title: z.string().optional(),
        titleEn: z.string().optional(),
        titleDe: z.string().optional(),
        description: z.string().optional(),
        descriptionEn: z.string().optional(),
        descriptionDe: z.string().optional(),
        subtitle: z.string().optional(),
        subtitleEn: z.string().optional(),
        subtitleDe: z.string().optional(),
        ctaText: z.string().optional(),
        ctaTextEn: z.string().optional(),
        ctaTextDe: z.string().optional(),
        url: z.string().url(),
        imageUrl: z.string().optional(),
        mobileImageUrl: z.string().optional(),
        hideUiElements: z.boolean().optional(),
        brandName: z.string().optional(),
        features: z.array(z.string()).optional(),
        priority: z.number().int().optional(),
        isActive: z.boolean().optional(),
        overlayOpacity: z.number().min(0).max(1).optional()
    });

    // Public: List active ads by placement
    fastify.get('/api/partner-ads', async (request, reply) => {
        const { placement } = request.query as { placement?: string };

        const ads = await fastify.prisma.partnerAd.findMany({
            where: {
                isActive: true,
                ...(placement ? { placement } : {})
            },
            orderBy: {
                priority: 'desc'
            }
        });

        return { ads };
    });

    // Admin: List all ads (including inactive)
    fastify.get('/api/admin/partner-ads', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const ads = await fastify.prisma.partnerAd.findMany({
            orderBy: [
                { placement: 'asc' },
                { priority: 'desc' }
            ]
        });
        return { ads };
    });

    // Admin: Create new ad
    fastify.post('/api/admin/partner-ads', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const data = adSchema.parse(request.body);

        const ad = await fastify.prisma.partnerAd.create({
            data: {
                ...data,
                features: data.features || []
            }
        });

        return { ad };
    });

    // Admin: Update ad
    fastify.patch('/api/admin/partner-ads/:id', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const data = adSchema.partial().parse(request.body);

        const ad = await fastify.prisma.partnerAd.update({
            where: { id },
            data
        });

        return { ad };
    });

    // Admin: Delete ad
    fastify.delete('/api/admin/partner-ads/:id', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };

        await fastify.prisma.partnerAd.delete({
            where: { id }
        });

        return { success: true };
    });
}
