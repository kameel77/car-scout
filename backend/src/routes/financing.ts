import { FastifyInstance } from 'fastify';
import { authorizeRoles } from '../middleware/authorize.js';
import { z } from 'zod';

const FinancingProductSchema = z.object({
    category: z.string(), // 'CREDIT', 'LEASING', 'RENT'
    name: z.string().optional(),
    currency: z.string().default('PLN'),
    referenceRate: z.number(),
    margin: z.number(),
    commission: z.number(),
    maxInitialPayment: z.number(),
    maxFinalPayment: z.number(),
    minInstallments: z.number().int(),
    maxInstallments: z.number().int(),
    isDefault: z.boolean().default(false),
});

export async function financingRoutes(fastify: FastifyInstance) {
    // Public: Get active products for calculator
    fastify.get('/api/financing/calculator', async (request, reply) => {
        // We want all products so the calculator can switch tabs. 
        // Maybe we only want "valid" ones? For now return all.
        const products = await fastify.prisma.financingProduct.findMany({
            orderBy: [
                { category: 'asc' },
                { isDefault: 'desc' } // Default first
            ]
        });
        return { products };
    });

    // Admin: List all products
    fastify.get('/api/financing/products', {
        preHandler: [fastify.authenticate, authorizeRoles(['admin', 'manager'])]
    }, async (request, reply) => {
        try {
            const products = await fastify.prisma.financingProduct.findMany({
                orderBy: [
                    { category: 'asc' },
                    { createdAt: 'desc' }
                ]
            });
            return { products };
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) });
        }
    });

    // Admin: Create product
    fastify.post('/api/financing/products', {
        preHandler: [fastify.authenticate, authorizeRoles(['admin'])]
    }, async (request, reply) => {
        try {
            const data = FinancingProductSchema.parse(request.body);

            // If this is set as default, unset others in same category
            if (data.isDefault) {
                await fastify.prisma.financingProduct.updateMany({
                    where: { category: data.category },
                    data: { isDefault: false }
                });
            }

            const product = await fastify.prisma.financingProduct.create({
                data
            });

            return product;
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) });
        }
    });

    // Admin: Update product
    fastify.patch('/api/financing/products/:id', {
        preHandler: [fastify.authenticate, authorizeRoles(['admin'])]
    }, async (request, reply) => {
        try {
            const { id } = request.params as { id: string };
            const data = FinancingProductSchema.partial().parse(request.body);

            // If this is set as default, unset others in same category
            if (data.isDefault) {
                // Need to know category first if not provided in update
                let category = data.category;
                if (!category) {
                    const existing = await fastify.prisma.financingProduct.findUnique({ where: { id } });
                    if (!existing) return reply.code(404).send({ error: 'Not found' });
                    category = existing.category;
                }

                await fastify.prisma.financingProduct.updateMany({
                    where: { category, id: { not: id } },
                    data: { isDefault: false }
                });
            }

            const product = await fastify.prisma.financingProduct.update({
                where: { id },
                data
            });

            return product;
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) });
        }
    });

    // Admin: Delete product
    fastify.delete('/api/financing/products/:id', {
        preHandler: [fastify.authenticate, authorizeRoles(['admin'])]
    }, async (request, reply) => {
        try {
            const { id } = request.params as { id: string };

            await fastify.prisma.financingProduct.delete({
                where: { id }
            });

            return { success: true };
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) });
        }
    });
}
