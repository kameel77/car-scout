import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { buildApp } from '../../app';
import { computeReferenceInstallments, recomputeAll } from '../../services/financing-calc.service';

describe('reference installments — shared partner quote store', () => {
    let app: FastifyInstance;
    let connectionId: string;
    let productId: string;
    let listingId: string;
    let ctxPrisma: PrismaClient;
    let originalFetch: typeof fetch;
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeAll(async () => {
        originalFetch = global.fetch;
        app = await buildApp();
        await app.ready();

        const connection = await app.prisma.financingProviderConnection.create({
            data: {
                name: 'TEST_INBANK_REFQUOTES',
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
                name: 'Test Inbank RefQuotes',
                provider: 'INBANK',
                providerConfig: { productCode: 'TEST', paymentDay: 15 },
                referenceRate: 5,
                margin: 2,
                commission: 1,
                maxInitialPayment: 50,
                maxFinalPayment: 20,
                minInstallments: 12,
                maxInstallments: 60,
                hasBalloonPayment: false,
            },
        });
        productId = product.id;

        // brutto 123000 → netto 100000, wkład 25% = 25000
        const listing = await app.prisma.listing.create({
            data: {
                make: 'TEST_REFQUOTES',
                model: 'X',
                pricePln: 123000,
                mileageKm: 50000,
                productionYear: 2020,
                isArchived: false,
                creditAvailable: true,
                creditProductId: productId,
                leasingAvailable: false,
            },
        });
        listingId = listing.id;

        // Trasa bierze findFirst aktywnego połączenia dostawcy, a przeliczenie — findMany (ostatnie wygrywa).
        // Lokalna baza może mieć dodatkowe aktywne połączenia INBANK, więc podajemy przeliczeniu to, które wybrałaby trasa.
        const routeConnection = await app.prisma.financingProviderConnection.findFirstOrThrow({
            where: { provider: 'INBANK', isActive: true },
        });
        ctxPrisma = new Proxy(app.prisma, {
            get(target, prop) {
                if (prop === 'financingProviderConnection') return { findMany: async () => [routeConnection] };
                return Reflect.get(target, prop, target);
            },
        }) as PrismaClient;
    });

    afterAll(async () => {
        await app.prisma.financingQuote.deleteMany({ where: { productId } });
        await app.prisma.listing.delete({ where: { id: listingId } });
        await app.prisma.financingProduct.delete({ where: { id: productId } });
        await app.prisma.financingProviderConnection.delete({ where: { id: connectionId } });
        await app.close();
        global.fetch = originalFetch;
    });

    beforeEach(() => {
        fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ payment_amount_monthly: 1500.5, total_cost: 95000 }),
        });
        global.fetch = fetchMock as any;
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('cron stores the full partner response and the calculator then hits it (one partner call total)', async () => {
        const result = await computeReferenceInstallments({ prisma: ctxPrisma, log: console }, listingId);
        expect(result?.creditInstallment).toBe(Math.round(1500.5 * 1.23));
        expect(fetchMock).toHaveBeenCalledTimes(1);
        // Bez VAT-marży partner dostaje kwotę netto (123000 / 1,23 = 100000) minus 25% wkładu.
        expect(JSON.parse(fetchMock.mock.calls[0][1].body).amount).toBe(75000);

        // Dokładnie to, co wysłałby kalkulator dla tej oferty.
        const res = await app.inject({
            method: 'POST',
            url: '/api/financing/calculate',
            payload: {
                productId,
                price: 100000,
                downPaymentAmount: 25000,
                period: 60,
                initialFeePercent: 25,
                finalPaymentPercent: 0,
                manufacturingYear: 2020,
                mileageKm: 50000,
            },
        });

        expect(res.statusCode).toBe(200);
        expect(res.json().monthlyInstallment).toBe(1500.5);
        expect(res.json().repaymentsAmountTotal).toBe(95000);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        const stored = await app.prisma.financingQuote.findMany({ where: { productId } });
        expect(stored).toHaveLength(1);
        expect(stored[0].response).toEqual(res.json());
    });

    it('VAT-margin listing: partner gets the offer price (not /1.23) and the credit installment is not multiplied by 1.23', async () => {
        const marginListing = await app.prisma.listing.create({
            data: {
                make: 'TEST_REFQUOTES',
                model: 'Margin',
                pricePln: 123000,
                mileageKm: 50000,
                productionYear: 2020,
                isArchived: false,
                creditAvailable: true,
                creditProductId: productId,
                leasingAvailable: false,
                vatMargin: true,
            },
        });
        try {
            const result = await computeReferenceInstallments({ prisma: ctxPrisma, log: console }, marginListing.id);

            expect(fetchMock).toHaveBeenCalledTimes(1);
            // 123000 − 25% wkładu (30750) = 92250 — cena oferty, bez dzielenia przez 1,23.
            expect(JSON.parse(fetchMock.mock.calls[0][1].body).amount).toBe(92250);
            expect(result?.creditInstallment).toBe(Math.round(1500.5));
        } finally {
            await app.prisma.listing.delete({ where: { id: marginListing.id } });
        }
    });

    it('recomputeAll({ onlyMissing }) computes only listings with referenceCalcAt = null', async () => {
        await app.prisma.listing.update({ where: { id: listingId }, data: { referenceCalcAt: null } });

        // Tylko nasza oferta ma referenceCalcAt — zawężamy proxy do niej, żeby nie ruszać innych ofert w bazie.
        const scoped = new Proxy(ctxPrisma, {
            get(target, prop) {
                if (prop === 'listing') {
                    return {
                        ...(Reflect.get(target, prop, target) as object),
                        findMany: (args: any) => app.prisma.listing.findMany({ ...args, where: { ...args.where, id: listingId } }),
                    };
                }
                return Reflect.get(target, prop, target);
            },
        }) as PrismaClient;

        const first = await recomputeAll({ prisma: scoped, log: console }, { onlyMissing: true });
        expect(first).toBe(1);
        expect((await app.prisma.listing.findUnique({ where: { id: listingId } }))!.referenceCalcAt).not.toBeNull();

        // Teraz oferta ma referenceCalcAt — kolejny przebieg jej nie rusza.
        fetchMock.mockClear();
        const second = await recomputeAll({ prisma: scoped, log: console }, { onlyMissing: true });
        expect(second).toBe(0);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
