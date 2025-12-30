import { FastifyInstance } from 'fastify';
import { authorizeRoles } from '../middleware/authorize.js';

export async function translationRoutes(fastify: FastifyInstance) {
    // List translations with optional filtering
    fastify.get('/api/translations', async (request) => {
        const { category, search } = request.query as { category?: string; search?: string };

        const where: any = {};

        if (category) {
            where.category = category;
        }

        if (search) {
            where.OR = [
                { sourceValue: { contains: search, mode: 'insensitive' } },
                { pl: { contains: search, mode: 'insensitive' } },
                { en: { contains: search, mode: 'insensitive' } },
                { de: { contains: search, mode: 'insensitive' } },
            ];
        }

        const translations = await fastify.prisma.translation.findMany({
            where,
            orderBy: { updatedAt: 'desc' }
        });

        return { translations };
    });

    // Create or update translation (admin)
    fastify.post('/api/translations', {
        preHandler: [fastify.authenticate, authorizeRoles(['admin', 'manager'])]
    }, async (request, reply) => {
        const { id, category, sourceValue, pl, en, de } = request.body as any;

        if (!category || !sourceValue) {
            return reply.code(400).send({ error: 'category and sourceValue are required' });
        }

        const data = {
            category,
            sourceValue,
            pl: pl ?? null,
            en: en ?? null,
            de: de ?? null
        };

        let translation;
        if (id) {
            try {
                translation = await fastify.prisma.translation.update({
                    where: { id },
                    data
                });
            } catch (error) {
                return reply.code(404).send({ error: 'Translation not found' });
            }
        } else {
            translation = await fastify.prisma.translation.upsert({
                where: { sourceValue },
                update: data,
                create: data
            });
        }

        return { translation };
    });

    // Delete translation (admin)
    fastify.delete('/api/translations/:id', {
        preHandler: [fastify.authenticate, authorizeRoles(['admin', 'manager'])]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };

        try {
            await fastify.prisma.translation.delete({ where: { id } });
            return { success: true };
        } catch (error) {
            return reply.code(404).send({ error: 'Translation not found' });
        }
    });
}
