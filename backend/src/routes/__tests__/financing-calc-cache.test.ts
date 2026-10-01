import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';

describe('POST /api/financing/calculate — Redis result cache', () => {
    let app: FastifyInstance;
    let connectionId: string;
    let productId: string;
    let originalFetch: typeof fetch;
    let fetchMock: ReturnType<typeof vi.fn>;

    const okProviderResponse = () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ payment_amount_monthly: 1234.56 }),
    });
    const failProviderResponse = () => ({
        ok: false,
        status: 500,
        text: async () => 'boom',
    });

    const calculate = (period = 36) =>
        app.inject({
            method: 'POST',
            url: '/api/financing/calculate',
            payload: { productId, price: 100000, downPaymentAmount: 10000, period, manufacturingYear: 2020 },
        });

    beforeAll(async () => {
        originalFetch = global.fetch;
        app = await buildApp();
        await app.ready();

        const connection = await app.prisma.financingProviderConnection.create({
            data: {
                name: 'TEST_INBANK_CACHE',
                provider: 'INBANK',
                apiBaseUrl: 'http://localhost:9999',
                apiKey: 'test-key',
                shopUuid: 'test-shop',
                isActive: true,
            },
        });
        connectionId = connection.id;

        const product = await app.prisma.financingProduct.create({
            data: {
                category: 'CREDIT',
                name: 'Test Inbank Cache',
                provider: 'INBANK',
                providerConfig: { productCode: 'TEST', paymentDay: 15 },
                referenceRate: 5,
                margin: 2,
                commission: 1,
                maxInitialPayment: 50,
                maxFinalPayment: 20,
                minInstallments: 12,
                maxInstallments: 60,
            },
        });
        productId = product.id;
    });

    afterAll(async () => {
        await app.prisma.financingProduct.delete({ where: { id: productId } });
        await app.prisma.financingProviderConnection.delete({ where: { id: connectionId } });
        await app.close();
        global.fetch = originalFetch;
    });

    beforeEach(() => {
        fetchMock = vi.fn().mockResolvedValue(okProviderResponse());
        global.fetch = fetchMock as any;
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('serves an identical second request from cache (one partner call, equal 200 bodies)', async () => {
        const first = await calculate(36);
        const second = await calculate(36);

        expect(first.statusCode).toBe(200);
        expect(second.statusCode).toBe(200);
        expect(first.json().monthlyInstallment).toBe(1234.56);
        expect(second.json()).toEqual(first.json());
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('calls the partner again for a different period', async () => {
        await calculate(24);
        await calculate(48);

        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('calls the partner again after the product is updated (updatedAt is part of the key)', async () => {
        await calculate(30);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        await app.prisma.financingProduct.update({ where: { id: productId }, data: { margin: 3 } });

        await calculate(30);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not cache provider errors (502 is retried against the partner)', async () => {
        fetchMock.mockResolvedValue(failProviderResponse());

        const first = await calculate(18);
        const second = await calculate(18);

        expect(first.statusCode).toBe(502);
        expect(second.statusCode).toBe(502);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
