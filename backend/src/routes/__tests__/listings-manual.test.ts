import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';

describe('Manual Listing Entry — POST /api/listings', () => {
    let app: FastifyInstance;
    let platformToken: string;
    let dealerAdminToken: string;
    let dealerId: string;
    let otherDealerId: string;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();

        // Create test dealers
        const dealerA = await app.prisma.dealer.create({
            data: { name: 'Test Dealer A', addressLine1: 'Addr A' },
        });
        dealerId = dealerA.id;
        const dealerB = await app.prisma.dealer.create({
            data: { name: 'Test Dealer B', addressLine1: 'Addr B' },
        });
        otherDealerId = dealerB.id;

        platformToken = app.jwt.sign({
            userId: 'platform-test',
            email: 'p@test.com',
            role: 'admin',
            activeContext: { scopeType: 'PLATFORM', scopeId: 'PLATFORM' },
        });
        dealerAdminToken = app.jwt.sign({
            userId: 'dealer-admin-test',
            email: 'da@test.com',
            memberships: [{
                id: 'm1',
                scopeType: 'DEALER',
                scopeId: dealerId,
                role: 'DEALER_ADMIN',
                isDefaultContext: true,
            }],
            activeContext: { scopeType: 'DEALER', scopeId: dealerId },
        });
    });

    afterAll(async () => {
        await app.prisma.listing.deleteMany({ where: { dealerId: { in: [dealerId, otherDealerId] } } });
        await app.prisma.dealer.deleteMany({ where: { id: { in: [dealerId, otherDealerId] } } });
        await app.close();
    });

    beforeEach(async () => {
        await app.prisma.listing.deleteMany({ where: { dealerId: { in: [dealerId, otherDealerId] } } });
    });

    const validBody = (overrides: Partial<any> = {}) => ({
        make: 'Toyota',
        model: 'Yaris',
        productionYear: 2026,
        pricePln: 95000,
        mileageKm: 0,
        condition: 'NEW',
        financingPriceBase: 'BROKER_PRICE_PLN',
        ...overrides,
    });

    it('creates a manual listing with entrySource=MANUAL and lastManualEditAt set', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/listings',
            headers: { authorization: `Bearer ${dealerAdminToken}` },
            payload: validBody(),
        });

        expect(response.statusCode).toBe(201);
        const { listing } = response.json();
        expect(listing.entrySource).toBe('MANUAL');
        expect(listing.lastManualEditAt).toBeTruthy();
        expect(listing.brokerPricePln).toBeGreaterThan(listing.pricePln);
        expect(listing.dealerId).toBe(dealerId);
        expect(listing.slug).toBeTruthy();
    });

    it('rejects NEW with mileageKm >= 100', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/listings',
            headers: { authorization: `Bearer ${dealerAdminToken}` },
            payload: validBody({ mileageKm: 200 }),
        });
        expect(response.statusCode).toBe(400);
        expect(response.json().errors).toEqual(
            expect.arrayContaining([expect.objectContaining({ field: 'mileageKm' })])
        );
    });

    it('rejects USED without mileageKm', async () => {
        const body = validBody({ condition: 'USED' });
        delete body.mileageKm;
        const response = await app.inject({
            method: 'POST',
            url: '/api/listings',
            headers: { authorization: `Bearer ${dealerAdminToken}` },
            payload: body,
        });
        expect(response.statusCode).toBe(400);
    });

    it('rejects invalid VIN format', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/listings',
            headers: { authorization: `Bearer ${dealerAdminToken}` },
            payload: validBody({ vin: 'INVALIDOOO0000000' }),
        });
        expect(response.statusCode).toBe(400);
        expect(response.json().errors).toEqual(
            expect.arrayContaining([expect.objectContaining({ field: 'vin' })])
        );
    });

    it('forbids dealer admin from creating for another dealer', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/listings',
            headers: { authorization: `Bearer ${dealerAdminToken}` },
            payload: validBody({ dealerId: otherDealerId }),
        });
        expect(response.statusCode).toBe(403);
    });

    it('uses dealerId from active context when missing in body', async () => {
        const body = validBody();
        delete body.dealerId;
        const response = await app.inject({
            method: 'POST',
            url: '/api/listings',
            headers: { authorization: `Bearer ${dealerAdminToken}` },
            payload: body,
        });
        expect(response.statusCode).toBe(201);
        expect(response.json().listing.dealerId).toBe(dealerId);
    });

    it('platform admin can create for any dealer with explicit dealerId', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/listings',
            headers: { authorization: `Bearer ${platformToken}` },
            payload: validBody({ dealerId: otherDealerId }),
        });
        expect(response.statusCode).toBe(201);
        expect(response.json().listing.dealerId).toBe(otherDealerId);
    });
});

describe('Manual Listing Entry — PATCH /api/listings/:id', () => {
    let app: FastifyInstance;
    let _platformToken: string;
    let dealerAdminToken: string;
    let dealerId: string;
    let manualListingId: string;
    let csvListingId: string;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();

        const dealer = await app.prisma.dealer.create({
            data: { name: 'PATCH Test Dealer', addressLine1: 'PATCH Addr' },
        });
        dealerId = dealer.id;

        _platformToken = app.jwt.sign({
            userId: 'p-patch',
            email: 'pp@test.com',
            role: 'admin',
            activeContext: { scopeType: 'PLATFORM', scopeId: 'PLATFORM' },
        });
        dealerAdminToken = app.jwt.sign({
            userId: 'da-patch',
            email: 'dap@test.com',
            memberships: [{
                id: 'mp',
                scopeType: 'DEALER',
                scopeId: dealerId,
                role: 'DEALER_ADMIN',
                isDefaultContext: true,
            }],
            activeContext: { scopeType: 'DEALER', scopeId: dealerId },
        });
    });

    afterAll(async () => {
        await app.prisma.listing.deleteMany({ where: { dealerId } });
        await app.prisma.dealer.delete({ where: { id: dealerId } });
        await app.close();
    });

    beforeEach(async () => {
        await app.prisma.listing.deleteMany({ where: { dealerId } });

        const manual = await app.prisma.listing.create({
            data: {
                make: 'Toyota', model: 'Yaris', productionYear: 2026,
                pricePln: 95000, brokerPricePln: 98325, mileageKm: 0,
                condition: 'NEW', financingPriceBase: 'BROKER_PRICE_PLN',
                entrySource: 'MANUAL', dealerId,
            },
        });
        manualListingId = manual.id;

        const csv = await app.prisma.listing.create({
            data: {
                make: 'Volvo', model: 'XC60', productionYear: 2024,
                pricePln: 250000, brokerPricePln: 258750, mileageKm: 30000,
                condition: 'USED', financingPriceBase: 'BROKER_PRICE_PLN',
                entrySource: 'CSV', dealerId,
            },
        });
        csvListingId = csv.id;
    });

    it('MANUAL: updates pricePln and recalculates brokerPricePln', async () => {
        const response = await app.inject({
            method: 'PATCH',
            url: `/api/listings/${manualListingId}`,
            headers: { authorization: `Bearer ${dealerAdminToken}` },
            payload: { pricePln: 100000, make: 'Toyota', model: 'Yaris', productionYear: 2026, mileageKm: 0, condition: 'NEW' },
        });
        expect(response.statusCode).toBe(200);
        const { listing } = response.json();
        expect(listing.pricePln).toBe(100000);
        expect(listing.brokerPricePln).toBeGreaterThan(100000);
        expect(listing.lastManualEditAt).toBeTruthy();
    });

    it('CSV: ignores pricePln in payload (not whitelisted)', async () => {
        const response = await app.inject({
            method: 'PATCH',
            url: `/api/listings/${csvListingId}`,
            headers: { authorization: `Bearer ${dealerAdminToken}` },
            payload: { pricePln: 999999, isFeatured: true },
        });
        expect(response.statusCode).toBe(200);
        const { listing } = response.json();
        expect(listing.pricePln).toBe(250000);
        expect(listing.isFeatured).toBe(true);
        expect(listing.lastManualEditAt).toBeTruthy();
    });

    it('CSV: accepts catalogPrice and isChineseBrand', async () => {
        const response = await app.inject({
            method: 'PATCH',
            url: `/api/listings/${csvListingId}`,
            headers: { authorization: `Bearer ${dealerAdminToken}` },
            payload: { catalogPrice: 280000, isChineseBrand: false },
        });
        expect(response.statusCode).toBe(200);
        expect(response.json().listing.catalogPrice).toBe(280000);
    });

    it('returns 404 for nonexistent listing', async () => {
        const response = await app.inject({
            method: 'PATCH',
            url: `/api/listings/cnonexistentid000000000000`,
            headers: { authorization: `Bearer ${dealerAdminToken}` },
            payload: { isFeatured: true },
        });
        expect(response.statusCode).toBe(404);
    });
});
