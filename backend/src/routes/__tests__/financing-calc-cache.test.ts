import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';
import { getApiCacheKey, getApiRedisClient } from '../../services/api-cache';
import { buildFinancingQuoteKey } from '../../services/financing-quote-cache';

describe('POST /api/financing/calculate — result cache (Redis + financing_quotes)', () => {
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
        await app.prisma.financingQuote.deleteMany({ where: { productId } });
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

    describe('persistent store (financing_quotes)', () => {
        // Klucz dokładnie takiego zapytania, jakie wysyła helper calculate().
        const keyFor = async (period: number) => {
            const product = await app.prisma.financingProduct.findUniqueOrThrow({ where: { id: productId } });
            // Route bierze pierwsze aktywne połączenie danego dostawcy (lokalna baza może mieć inne niż testowe).
            const connection = await app.prisma.financingProviderConnection.findFirstOrThrow({ where: { provider: 'INBANK', isActive: true } });
            return buildFinancingQuoteKey(product, connection, {
                price: 100000, downPaymentAmount: 10000, period, manufacturingYear: 2020,
            });
        };
        const evictRedis = async (cacheKey: string) => {
            const redis = getApiRedisClient();
            expect(redis).not.toBeNull();
            await redis!.del(getApiCacheKey(cacheKey));
        };

        it('stores the partner result in financing_quotes', async () => {
            const res = await calculate(20);
            expect(res.statusCode).toBe(200);

            const row = await app.prisma.financingQuote.findUnique({ where: { cacheKey: await keyFor(20) } });
            expect(row).not.toBeNull();
            expect(row!.productId).toBe(productId);
            expect(row!.response).toEqual(res.json());
        });

        it('serves from the database after Redis eviction without calling the partner, and re-warms Redis', async () => {
            const first = await calculate(22);
            expect(first.statusCode).toBe(200);
            expect(fetchMock).toHaveBeenCalledTimes(1);

            const cacheKey = await keyFor(22);
            await evictRedis(cacheKey);
            expect(await getApiRedisClient()!.exists(getApiCacheKey(cacheKey))).toBe(0);

            const second = await calculate(22);
            expect(second.statusCode).toBe(200);
            expect(second.json()).toEqual(first.json());
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(await getApiRedisClient()!.exists(getApiCacheKey(cacheKey))).toBe(1);
        });

        it('calls the partner again when the stored quote is older than 36 h', async () => {
            await calculate(26);
            expect(fetchMock).toHaveBeenCalledTimes(1);

            const cacheKey = await keyFor(26);
            await evictRedis(cacheKey);
            await app.prisma.financingQuote.update({
                where: { cacheKey },
                data: { computedAt: new Date(Date.now() - 37 * 3600 * 1000) },
            });

            const res = await calculate(26);
            expect(res.statusCode).toBe(200);
            expect(fetchMock).toHaveBeenCalledTimes(2);

            const refreshed = await app.prisma.financingQuote.findUnique({ where: { cacheKey } });
            expect(Date.now() - refreshed!.computedAt.getTime()).toBeLessThan(60 * 1000);
        });
    });

    describe('coalescing concurrent identical requests', () => {
        it('calls the partner once for two parallel identical requests', async () => {
            let release!: () => void;
            const gate = new Promise<void>(resolve => { release = resolve; });
            fetchMock.mockImplementation(async () => {
                await gate;
                return okProviderResponse();
            });

            const both = Promise.all([calculate(42), calculate(42)]);
            // Daj obu żądaniom dojść do wywołania partnera, zanim go „odblokujemy”.
            await new Promise(resolve => setTimeout(resolve, 50));
            release();
            const [a, b] = await both;

            expect(a.statusCode).toBe(200);
            expect(b.statusCode).toBe(200);
            expect(b.json()).toEqual(a.json());
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it('hands the same error code to every waiter when the partner fails', async () => {
            let release!: () => void;
            const gate = new Promise<void>(resolve => { release = resolve; });
            fetchMock.mockImplementation(async () => {
                await gate;
                return failProviderResponse();
            });

            const both = Promise.all([calculate(44), calculate(44)]);
            await new Promise(resolve => setTimeout(resolve, 50));
            release();
            const [a, b] = await both;

            expect(a.statusCode).toBe(502);
            expect(b.statusCode).toBe(502);
            expect(fetchMock).toHaveBeenCalledTimes(1);

            // Po błędzie wpis in-flight znika — kolejne zapytanie znów woła partnera.
            fetchMock.mockImplementation(async () => okProviderResponse());
            const retry = await calculate(44);
            expect(retry.statusCode).toBe(200);
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });
    });
});
