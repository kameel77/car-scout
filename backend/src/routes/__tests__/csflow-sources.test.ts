import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';

describe('CSFlow sources CRUD', () => {
    let app: FastifyInstance;
    let adminToken: string;
    const createdIds: string[] = [];

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
        adminToken = app.jwt.sign({
            userId: 'csflow-test-admin',
            email: 'csflow-admin@test.com',
            role: 'admin',
            activeContext: { scopeType: 'PLATFORM', scopeId: 'PLATFORM' },
        });
    });

    afterAll(async () => {
        await app.prisma.listing.deleteMany({ where: { csflowSourceId: { in: createdIds } } });
        await app.prisma.csflowSource.deleteMany({ where: { id: { in: createdIds } } });
        await app.close();
    });

    it('POST tworzy źródło z wygenerowanym slugiem', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/csflow/sources',
            headers: { authorization: `Bearer ${adminToken}` },
            payload: { name: 'Test Źródło Ąę', apiUrl: 'https://webapi.testzrodlo.csflow.pl' },
        });
        expect(res.statusCode).toBe(201);
        const { source } = res.json();
        createdIds.push(source.id);
        expect(source.slug).toBe('test-zrodlo-ae');
        expect(source.isEnabled).toBe(true);
    });

    it('POST odrzuca URL spoza *.csflow.pl oraz duplikat sluga', async () => {
        const bad = await app.inject({
            method: 'POST',
            url: '/api/csflow/sources',
            headers: { authorization: `Bearer ${adminToken}` },
            payload: { name: 'Zły URL', apiUrl: 'https://evil.example.com' },
        });
        expect(bad.statusCode).toBe(400);

        const dup = await app.inject({
            method: 'POST',
            url: '/api/csflow/sources',
            headers: { authorization: `Bearer ${adminToken}` },
            payload: { name: 'Duplikat', slug: 'test-zrodlo-ae', apiUrl: 'https://webapi.dup.csflow.pl' },
        });
        expect(dup.statusCode).toBe(400);
    });

    it('GET listuje źródła z licznikiem aktywnych ofert', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/csflow/sources',
            headers: { authorization: `Bearer ${adminToken}` },
        });
        expect(res.statusCode).toBe(200);
        const { sources } = res.json();
        const testSource = sources.find((s: any) => s.slug === 'test-zrodlo-ae');
        expect(testSource).toBeTruthy();
        expect(testSource.activeListings).toBe(0);
    });

    it('PATCH isEnabled=false archiwizuje oferty źródła', async () => {
        const sourceId = createdIds[0];
        await app.prisma.listing.create({
            data: {
                listingId: 'csflow-test-zrodlo-ae-777',
                csflowSourceId: sourceId,
                csflowCarId: 777,
                make: 'T', model: 'T',
                pricePln: 10000, productionYear: 2024, mileageKm: 0,
                slug: 'test-csflow-disable-777',
                marketplace: 'csflow',
            },
        });

        const res = await app.inject({
            method: 'PATCH',
            url: `/api/csflow/sources/${sourceId}`,
            headers: { authorization: `Bearer ${adminToken}` },
            payload: { isEnabled: false },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().source.isEnabled).toBe(false);

        const listing = await app.prisma.listing.findFirst({ where: { csflowSourceId: sourceId, csflowCarId: 777 } });
        expect(listing!.isArchived).toBe(true);
        expect(listing!.archivedReason).toBe('csflow_source_disabled');
    });

    it('wymaga uprawnień admina', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/csflow/sources' });
        expect(res.statusCode).toBe(401);
    });
});
