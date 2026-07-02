import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';

describe('Financing routes logging and errors', () => {
    let app: FastifyInstance;
    let platformToken: string;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();

        platformToken = app.jwt.sign({
            userId: 'platform-test',
            email: 'p@test.com',
            role: 'admin',
            activeContext: { scopeType: 'PLATFORM', scopeId: 'PLATFORM' },
        });
    });

    afterAll(async () => {
        await app.close();
        vi.restoreAllMocks();
    });

    it('does not return raw provider body in 502 error', async () => {
        // Mock fetch to return a non-ok response with raw body
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 502,
            text: async () => JSON.stringify({ message: 'RAW_SECRET_ERROR' }),
            json: async () => ({ message: 'RAW_SECRET_ERROR' })
        }) as any;

        // Create mock product and connection
        const connection = await app.prisma.financingProviderConnection.create({
            data: {
                name: 'TEST_INBANK',
                provider: 'INBANK',
                apiBaseUrl: 'http://localhost:9999', // Will definitely fail
                apiKey: 'test-key',
                shopUuid: 'test-shop',
                isActive: true
            }
        });

        const product = await app.prisma.financingProduct.create({
            data: {
                category: 'CREDIT',
                name: 'Test Inbank',
                provider: 'INBANK',
                providerConfig: { productCode: 'TEST', paymentDay: 15 },
                referenceRate: 5,
                margin: 2,
                commission: 1,
                maxInitialPayment: 50,
                maxFinalPayment: 20,
                minInstallments: 12,
                maxInstallments: 60
            }
        });

        const res = await app.inject({
            method: 'POST',
            url: '/api/financing/calculate',
            payload: {
                productId: product.id,
                price: 100000,
                downPaymentAmount: 10000,
                period: 36,
                manufacturingYear: 2020
            }
        });

        // Cleanup
        await app.prisma.financingProduct.delete({ where: { id: product.id } });
        await app.prisma.financingProviderConnection.delete({ where: { id: connection.id } });

        expect(res.statusCode).toBe(502);
        const body = res.json();
        expect(body).toHaveProperty('error');
        expect(body).not.toHaveProperty('details'); // No raw details
    });
});
