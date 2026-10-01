import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';

// Test równoważności wyszukiwania `q` w GET /api/listings: ma przechodzić zarówno przed, jak i po
// przeniesieniu warunku `q` do jednorazowego zapytania o listę ID. Marka jest unikalna per uruchomienie,
// bo publiczne odpowiedzi są cache'owane w Redisie po pełnym query string.
describe('GET /api/listings — wyszukiwanie tekstowe (q)', () => {
    let app: FastifyInstance;
    const MAKE = `TESTSEARCH${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

    const base = {
        make: MAKE,
        version: 'Base',
        productionYear: 2022,
        pricePln: 80000,
        mileageKm: 10000,
        isArchived: false,
    };

    const search = async (query: string) => {
        const res = await app.inject({ method: 'GET', url: `/api/listings?${query}` });
        expect(res.statusCode).toBe(200);
        return res.json();
    };

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
        await app.prisma.listing.deleteMany({ where: { make: MAKE } });
        await app.prisma.listing.createMany({
            data: [
                { ...base, model: 'Alpha', fuelType: 'Diesel', bodyType: 'SUV', condition: 'USED', equipmentSafety: ['ABS'] },
                { ...base, model: 'Alpha', fuelType: 'Benzyna', bodyType: 'SUV', condition: 'NEW' },
                { ...base, model: 'Beta', fuelType: 'Benzyna', bodyType: 'Sedan', condition: 'USED' },
                { ...base, model: 'Beta', fuelType: 'Diesel', bodyType: 'SUV', condition: 'USED' },
                { ...base, model: 'Alpha', fuelType: 'Diesel', bodyType: 'SUV', condition: 'USED', isArchived: true },
            ],
        });
    });

    afterAll(async () => {
        await app.prisma.listing.deleteMany({ where: { make: MAKE } });
        await app.close();
    });

    it('1. fraza po marce zwraca dokładnie oferty tej marki (bez archiwalnych)', async () => {
        const data = await search(`q=${MAKE}&perPage=50`);
        expect(data.count).toBe(4);
        expect(data.listings).toHaveLength(4);
        expect(data.listings.every((l: any) => l.make === MAKE)).toBe(true);
        expect(data.totalPages).toBe(1);
    });

    it('2. fraza dwuwyrazowa (marka + model) zawęża wyniki (AND)', async () => {
        const data = await search(`q=${MAKE}+Alpha&perPage=50`);
        expect(data.count).toBe(2);
        expect(data.listings.every((l: any) => l.model === 'Alpha')).toBe(true);
    });

    it('3. fraza trafia ofertę po wyposażeniu (tablice)', async () => {
        const data = await search(`q=${MAKE}+ABS&perPage=50`);
        expect(data.count).toBe(1);
        expect(data.listings[0].model).toBe('Alpha');
        expect(data.listings[0].fuelType).toBe('Diesel');
    });

    it('4. facety fuelType / bodyType / byCondition mają poprawne liczniki dla frazy', async () => {
        // inny perPage niż w teście 1, żeby nie trafić w cache Redisa i policzyć facety od nowa
        const data = await search(`q=${MAKE}&perPage=40`);
        expect(data.facets.fuelType).toEqual({ diesel: 2, petrol: 2 });
        expect(data.facets.bodyType).toEqual({ SUV: 3, Sedan: 1 });
        expect(data.facets.model).toEqual({ Alpha: 2, Beta: 2 });
        expect(data.byCondition).toEqual({ NEW: 1, USED: 3 });
    });

    it('5. fraza bez trafień zwraca puste wyniki i puste facety', async () => {
        const data = await search(`q=${MAKE}NOMATCH&perPage=50`);
        expect(data.listings).toEqual([]);
        expect(data.count).toBe(0);
        expect(data.byCondition).toEqual({ NEW: 0, USED: 0 });
        expect(data.facets.fuelType).toEqual({});
        expect(data.facets.bodyType).toEqual({});
        expect(data.facets.model).toEqual({});
        expect(data.facets.city).toEqual({});
    });

    it('6. fraza + filtr facetu zawęża listę, a facet pomija własny wymiar', async () => {
        const data = await search(`q=${MAKE}&fuelType=diesel&perPage=50`);
        expect(data.count).toBe(2);
        expect(data.listings.every((l: any) => l.fuelType === 'Diesel')).toBe(true);
        // facet paliwa pokazuje wszystkie paliwa w obrębie frazy
        expect(data.facets.fuelType).toEqual({ diesel: 2, petrol: 2 });
        // pozostałe facety respektują filtr paliwa
        expect(data.facets.bodyType).toEqual({ SUV: 2 });
        expect(data.byCondition).toEqual({ NEW: 0, USED: 2 });
    });
});
