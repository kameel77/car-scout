import { FastifyInstance } from 'fastify';
import { authorizeRoles } from '../middleware/authorize.js';
import { z } from 'zod';

const FinancingProductSchema = z.object({
    category: z.string(), // 'CREDIT', 'LEASING', 'RENT'
    name: z.string().optional(),
    currency: z.string().default('PLN'),
    provider: z.string().default('OWN'),
    priority: z.number().int().default(0),
    minAmount: z.number().optional().nullable(),
    maxAmount: z.number().optional().nullable(),
    providerConfig: z.record(z.any()).optional().nullable(),
    referenceRate: z.number(),
    margin: z.number(),
    commission: z.number(),
    maxInitialPayment: z.number(),
    maxFinalPayment: z.number(),
    minInstallments: z.number().int(),
    maxInstallments: z.number().int(),
    isDefault: z.boolean().default(false),
});

const FinancingConnectionSchema = z.object({
    provider: z.string(),
    name: z.string(),
    apiBaseUrl: z.string().url(),
    apiKey: z.string(),
    apiSecret: z.string().optional().nullable(),
    isActive: z.boolean().default(true),
});

const FinancingCalculateSchema = z.object({
    productId: z.string(),
    price: z.number(),
    downPaymentAmount: z.number(),
    period: z.number().int(),
});

export async function financingRoutes(fastify: FastifyInstance) {
    // Public: Get active products for calculator
    fastify.get('/api/financing/calculator', async (request, reply) => {
        // We want all products so the calculator can switch tabs. 
        // Maybe we only want "valid" ones? For now return all.
        const products = await fastify.prisma.financingProduct.findMany({
            orderBy: [
                { category: 'asc' },
                { priority: 'desc' },
                { isDefault: 'desc' } // Default first
            ]
        });
        return { products };
    });

    // Public: Calculate installment for provider-based products
    fastify.post('/api/financing/calculate', async (request, reply) => {
        try {
            const data = FinancingCalculateSchema.parse(request.body);
            const product = await fastify.prisma.financingProduct.findUnique({
                where: { id: data.productId }
            });

            if (!product) {
                return reply.code(404).send({ error: 'Product not found' });
            }

            if (product.provider !== 'INBANK') {
                return reply.code(400).send({ error: 'Unsupported provider' });
            }

            const connection = await fastify.prisma.financingProviderConnection.findFirst({
                where: { provider: product.provider, isActive: true }
            });

            if (!connection) {
                return reply.code(409).send({ error: 'Connection not configured' });
            }

            const config = (product.providerConfig || {}) as Record<string, any>;
            if (!config.productCode || !config.paymentDay) {
                return reply.code(422).send({ error: 'Missing provider configuration' });
            }
            const payload = {
                productCode: config.productCode,
                amount: data.price - data.downPaymentAmount,
                period: data.period,
                paymentDay: config.paymentDay,
                downPaymentAmount: data.downPaymentAmount,
                currency: config.currency || product.currency,
                responseLevel: config.responseLevel || 'simple',
            };

            const response = await fetch(connection.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-KEY': connection.apiKey,
                    ...(connection.apiSecret ? { 'X-API-SECRET': connection.apiSecret } : {}),
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                return reply.code(502).send({ error: 'Provider request failed', details: errorText });
            }

            const result = await response.json().catch(() => ({}));
            const monthlyInstallment = Number(
                (result as any)?.monthlyPayment
                ?? (result as any)?.monthlyInstallment
                ?? (result as any)?.paymentAmount
                ?? (result as any)?.installmentAmount
            );

            if (!Number.isFinite(monthlyInstallment)) {
                return reply.code(502).send({ error: 'Invalid provider response', details: result });
            }

            return { monthlyInstallment, provider: product.provider };
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) });
        }
    });

    // Admin: List all products
    fastify.get('/api/financing/products', {
        preHandler: [fastify.authenticate, authorizeRoles(['admin', 'manager'])]
    }, async (request, reply) => {
        try {
            const products = await fastify.prisma.financingProduct.findMany({
                orderBy: [
                    { category: 'asc' },
                    { priority: 'desc' },
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

    // Admin: List all provider connections
    fastify.get('/api/financing/connections', {
        preHandler: [fastify.authenticate, authorizeRoles(['admin', 'manager'])]
    }, async (request, reply) => {
        try {
            const connections = await fastify.prisma.financingProviderConnection.findMany({
                orderBy: [{ provider: 'asc' }, { createdAt: 'desc' }]
            });
            return { connections };
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) });
        }
    });

    // Admin: Create provider connection
    fastify.post('/api/financing/connections', {
        preHandler: [fastify.authenticate, authorizeRoles(['admin'])]
    }, async (request, reply) => {
        try {
            const data = FinancingConnectionSchema.parse(request.body);
            const connection = await fastify.prisma.financingProviderConnection.create({ data });
            return connection;
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) });
        }
    });

    // Admin: Update provider connection
    fastify.patch('/api/financing/connections/:id', {
        preHandler: [fastify.authenticate, authorizeRoles(['admin'])]
    }, async (request, reply) => {
        try {
            const { id } = request.params as { id: string };
            const data = FinancingConnectionSchema.partial().parse(request.body);
            const connection = await fastify.prisma.financingProviderConnection.update({
                where: { id },
                data
            });
            return connection;
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) });
        }
    });

    // Admin: Delete provider connection
    fastify.delete('/api/financing/connections/:id', {
        preHandler: [fastify.authenticate, authorizeRoles(['admin'])]
    }, async (request, reply) => {
        try {
            const { id } = request.params as { id: string };
            await fastify.prisma.financingProviderConnection.delete({ where: { id } });
            return { success: true };
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) });
        }
    });
}
