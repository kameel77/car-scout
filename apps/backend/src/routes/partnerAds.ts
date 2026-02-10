import { FastifyInstance } from 'fastify';
import { z } from 'zod';

export async function partnerAdsRoutes(fastify: FastifyInstance) {
    // Schema for Ad validation
    const adSchema = z.object({
        placement: z.enum(['SEARCH_GRID', 'SEARCH_TOP', 'DETAIL_SIDEBAR']),
        title: z.string().nullable().optional(),
        titleEn: z.string().nullable().optional(),
        titleDe: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        descriptionEn: z.string().nullable().optional(),
        descriptionDe: z.string().nullable().optional(),
        subtitle: z.string().nullable().optional(),
        subtitleEn: z.string().nullable().optional(),
        subtitleDe: z.string().nullable().optional(),
        ctaText: z.string().nullable().optional(),
        ctaTextEn: z.string().nullable().optional(),
        ctaTextDe: z.string().nullable().optional(),
        url: z.string().url(),
        imageUrl: z.string().nullable().optional(),
        mobileImageUrl: z.string().nullable().optional(),
        hideUiElements: z.boolean().optional(),
        brandName: z.string().nullable().optional(),
        features: z.array(z.string()).optional(),
        priority: z.preprocess((val) => (typeof val === 'string' ? parseInt(val, 10) : val), z.number().int()).optional(),
        isActive: z.boolean().optional(),
        overlayOpacity: z.preprocess((val) => (typeof val === 'string' ? parseFloat(val) : val), z.number().min(0).max(1)).optional()
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
        try {
            const data = adSchema.parse(request.body);

            const ad = await fastify.prisma.partnerAd.create({
                data: {
                    ...data,
                    features: data.features || []
                }
            });

            return { ad };
        } catch (error: any) {
            fastify.log.error(error);
            if (error instanceof z.ZodError) {
                return reply.status(400).send({ error: 'Validation Error', details: error.errors });
            }
            return reply.status(500).send({ error: error.message || 'Internal Server Error' });
        }
    });

    // Admin: Update ad
    fastify.patch('/api/admin/partner-ads/:id', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        try {
            const { id } = request.params as { id: string };
            const data = adSchema.partial().parse(request.body);

            // Clean up nulls to undefined or pass them if allowed
            const updateData: any = { ...data };
            if (data.features) {
                updateData.features = { set: data.features };
            }

            const ad = await fastify.prisma.partnerAd.update({
                where: { id },
                data: updateData
            });

            return { ad };
        } catch (error: any) {
            fastify.log.error(error);
            if (error instanceof z.ZodError) {
                return reply.status(400).send({ error: 'Validation Error', details: error.errors });
            }
            return reply.status(500).send({ error: error.message || 'Internal Server Error' });
        }
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
