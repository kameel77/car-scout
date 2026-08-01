import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';
import crypto from 'crypto';

/**
 * Regresja: import ogłoszenia BEZ VIN, a następnie ponowny import TEGO SAMEGO
 * ogłoszenia już Z VIN-em kończył się błędem
 *   "Unique constraint failed on the fields: (`listing_id`)"
 *
 * Przyczyna: lookup istniejącego rekordu używał `else if` — gdy VIN był podany,
 * wyszukiwanie po listingId nigdy się nie wykonywało, więc kod wpadał w INSERT.
 */
describe('POST /api/v1/external/listings — upsert po VIN i listingId', () => {
    let app: FastifyInstance;
    let dealerId: string;
    let otherDealerId: string;
    let apiKey: string;
    let partnerId: string;

    const suffix = crypto.randomBytes(4).toString('hex');
    const otomotoId = `test-otomoto-${suffix}`;
    const vinA = 'WVWZZZ1KZAW' + suffix.toUpperCase().replace(/[IOQ]/g, '0').padEnd(6, '0').slice(0, 6);
    const createdListingIds: string[] = [];

    const basePayload = () => ({
        dealerId,
        make: 'Nissan',
        model: 'Qashqai',
        version: '1.3 DIG-T MHEV N-Connecta',
        productionYear: 2022,
        mileageKm: 45000,
        pricePln: 108900,
        listingId: otomotoId,
        listingUrl: 'https://www.otomoto.pl/osobowe/oferta/test.html'
    });

    const post = (payload: Record<string, unknown>) => app.inject({
        method: 'POST',
        url: '/api/v1/external/listings',
        headers: { authorization: `Bearer ${apiKey}` },
        payload
    });

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();

        const dealer = await app.prisma.dealer.create({
            data: { name: `Test Dealer ${suffix}`, addressLine1: 'ul. Testowa 1' }
        });
        dealerId = dealer.id;

        const other = await app.prisma.dealer.create({
            data: { name: `Other Dealer ${suffix}`, addressLine1: 'ul. Inna 2' }
        });
        otherDealerId = other.id;

        apiKey = `cs_partner_test_${suffix}`;
        const partner = await app.prisma.partner.create({
            data: {
                name: `Test Partner ${suffix}`,
                apiKey,
                isActive: true,
                mappings: {
                    create: [
                        { dealerId, externalId: dealerId },
                        { dealerId: otherDealerId, externalId: otherDealerId }
                    ]
                }
            }
        });
        partnerId = partner.id;
    });

    afterAll(async () => {
        await app.prisma.listing.deleteMany({ where: { id: { in: createdListingIds } } });
        await app.prisma.listing.deleteMany({ where: { listingId: otomotoId } });
        await app.prisma.partner.deleteMany({ where: { id: partnerId } });
        await app.prisma.dealer.deleteMany({ where: { id: { in: [dealerId, otherDealerId] } } });
        await app.close();
    });

    it('tworzy ogłoszenie bez VIN, a ponowny import z VIN aktualizuje ten sam rekord', async () => {
        const first = await post(basePayload());
        expect(first.statusCode).toBe(201);
        const created = first.json();
        expect(created.created).toBe(true);
        expect(created.vin).toBeNull();
        createdListingIds.push(created.id);

        // Sedno regresji — wcześniej ta próba kończyła się HTTP 500.
        const second = await post({ ...basePayload(), vin: vinA, mileageKm: 46000 });
        expect(second.statusCode).toBe(201);
        const updated = second.json();

        expect(updated.created).toBe(false);
        expect(updated.id).toBe(created.id);
        expect(updated.vin).toBe(vinA);

        const row = await app.prisma.listing.findUnique({ where: { id: created.id } });
        expect(row?.mileageKm).toBe(46000);
        expect(row?.listingId).toBe(otomotoId);

        const count = await app.prisma.listing.count({ where: { listingId: otomotoId } });
        expect(count).toBe(1);
    });

    it('aktualizuje po VIN, gdy listingId nie został przesłany', async () => {
        const res = await post({
            dealerId,
            make: 'Nissan',
            model: 'Qashqai',
            productionYear: 2022,
            mileageKm: 47000,
            pricePln: 105000,
            vin: vinA
        });
        expect(res.statusCode).toBe(201);
        expect(res.json().created).toBe(false);

        // listingId nie może zostać wyzerowany przez payload, który go nie zawiera.
        const row = await app.prisma.listing.findUnique({ where: { vin: vinA } });
        expect(row?.listingId).toBe(otomotoId);
        expect(row?.mileageKm).toBe(47000);
    });

    it('zwraca 409, gdy VIN należy już do innego ogłoszenia', async () => {
        const otherOtomotoId = `test-otomoto-other-${suffix}`;
        const seed = await post({ ...basePayload(), listingId: otherOtomotoId });
        expect(seed.statusCode).toBe(201);
        createdListingIds.push(seed.json().id);

        const conflict = await post({ ...basePayload(), listingId: otherOtomotoId, vin: vinA });
        expect(conflict.statusCode).toBe(409);
        expect(conflict.json().error).toContain(vinA);

        await app.prisma.listing.deleteMany({ where: { listingId: otherOtomotoId } });
    });

    it('odrzuca próbę przejęcia ogłoszenia przez innego dealera', async () => {
        const res = await post({ ...basePayload(), dealerId: otherDealerId, vin: vinA });
        expect(res.statusCode).toBe(403);
    });

    it('lookup zgłasza istnienie ogłoszenia po listingId i po VIN', async () => {
        const byListing = await app.inject({
            method: 'GET',
            url: `/api/v1/external/listings/lookup?listingId=${otomotoId}`,
            headers: { authorization: `Bearer ${apiKey}` }
        });
        expect(byListing.statusCode).toBe(200);
        expect(byListing.json().exists).toBe(true);

        const byVin = await app.inject({
            method: 'GET',
            url: `/api/v1/external/listings/lookup?vin=${vinA}`,
            headers: { authorization: `Bearer ${apiKey}` }
        });
        expect(byVin.json().exists).toBe(true);
        expect(byVin.json().make).toBe('Nissan');

        const missing = await app.inject({
            method: 'GET',
            url: `/api/v1/external/listings/lookup?listingId=nieistniejace-${suffix}`,
            headers: { authorization: `Bearer ${apiKey}` }
        });
        expect(missing.json().exists).toBe(false);
    });
});
