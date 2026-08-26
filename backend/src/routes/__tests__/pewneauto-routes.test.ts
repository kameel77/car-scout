import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';

describe('PewneAuto routes CRUD & RBAC', () => {
    let app: FastifyInstance;
    let adminToken: string;
    let normalToken: string;
    const createdIds: string[] = [];

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
        adminToken = app.jwt.sign({
            userId: 'pewneauto-test-admin',
            email: 'pewneauto-admin@test.com',
            role: 'admin',
            activeContext: { scopeType: 'PLATFORM', scopeId: 'PLATFORM' },
        });
        normalToken = app.jwt.sign({
            userId: 'pewneauto-test-user',
            email: 'user@test.com',
            role: 'user',
            activeContext: { scopeType: 'PLATFORM', scopeId: 'PLATFORM' },
        });
    });

    afterAll(async () => {
        if (createdIds.length > 0) {
            await app.prisma.listing.deleteMany({ where: { pewneautoSourceId: { in: createdIds } } });
            await app.prisma.pewneAutoSource.deleteMany({ where: { id: { in: createdIds } } });
        }
        await app.close();
    });

    it('POST /api/pewneauto/sources — tworzy nowe źródło z zaszyfrowanym sekretem (v1) i maskuje go w odpowiedzi', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/pewneauto/sources',
            headers: { authorization: `Bearer ${adminToken}` },
            payload: {
                name: 'Toyota Chodzeń Route Test',
                clientId: 'test-client-id-123',
                clientSecret: 'tajny-klucz-api-456'
            }
        });

        expect(res.statusCode).toBe(201);
        const { source } = res.json();
        createdIds.push(source.id);
        expect(source.slug).toBe('toyota-chodzen-route-test');
        expect(source.clientSecret).toBe('••••••••');
        expect(source.isEnabled).toBe(true);

        // Sprawdź w bazie czy w kolumnie clientSecretEncrypted jest wersjonowany szyfrogram (v1:iv:tag:ct)
        const inDb = await app.prisma.pewneAutoSource.findUnique({ where: { id: source.id } });
        expect(inDb?.clientSecretEncrypted).not.toBe('tajny-klucz-api-456');
        const parts = inDb?.clientSecretEncrypted.split(':');
        expect(parts?.length).toBe(4);
        expect(parts?.[0]).toBe('v1');
    });

    it('POST /api/pewneauto/sources — odrzuca nieprawidłowe URL-e (brak HTTPS lub domena zewnętrzna)', async () => {
        const badHttp = await app.inject({
            method: 'POST',
            url: '/api/pewneauto/sources',
            headers: { authorization: `Bearer ${adminToken}` },
            payload: {
                name: 'Bad URL Test 1',
                clientId: 'test',
                clientSecret: 'secret',
                tokenUrl: 'http://panel.pewneauto.pl/oauth2' // brak https
            }
        });
        expect(badHttp.statusCode).toBe(400);

        const badDomain = await app.inject({
            method: 'POST',
            url: '/api/pewneauto/sources',
            headers: { authorization: `Bearer ${adminToken}` },
            payload: {
                name: 'Bad URL Test 2',
                clientId: 'test',
                clientSecret: 'secret',
                tokenUrl: 'https://evil.attacker.com/token' // obca domena
            }
        });
        expect(badDomain.statusCode).toBe(400);
    });

    it('GET /api/pewneauto/sources — zwraca listę zamaskowanych źródeł z licznikiem aktywnych aut', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/pewneauto/sources',
            headers: { authorization: `Bearer ${adminToken}` }
        });

        expect(res.statusCode).toBe(200);
        const { sources } = res.json();
        expect(Array.isArray(sources)).toBe(true);
        const created = sources.find((s: any) => createdIds.includes(s.id));
        expect(created).toBeDefined();
        expect(created.clientSecret).toBe('••••••••');
        expect(typeof created.activeListings).toBe('number');
    });

    it('POST /api/pewneauto/sources — blokuje użytkowników bez uprawnień stock:sources:write (403)', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/pewneauto/sources',
            headers: { authorization: `Bearer ${normalToken}` },
            payload: {
                name: 'Unauthorized Test',
                clientId: 'test',
                clientSecret: 'secret'
            }
        });

        expect(res.statusCode).toBe(403);
    });

    it('PATCH /api/pewneauto/sources/:id — pozwala na edycję nazwy i zmianę statusu isEnabled', async () => {
        const targetId = createdIds[0];
        const res = await app.inject({
            method: 'PATCH',
            url: `/api/pewneauto/sources/${targetId}`,
            headers: { authorization: `Bearer ${adminToken}` },
            payload: {
                name: 'Toyota Chodzeń Route Test Updated',
                isEnabled: false
            }
        });

        expect(res.statusCode).toBe(200);
        const { source } = res.json();
        expect(source.name).toBe('Toyota Chodzeń Route Test Updated');
        expect(source.isEnabled).toBe(false);
    });

    it('DELETE /api/pewneauto/sources/:id — usuwa źródło i archiwizuje powiązane oferty', async () => {
        const targetId = createdIds.pop()!;
        const res = await app.inject({
            method: 'DELETE',
            url: `/api/pewneauto/sources/${targetId}`,
            headers: { authorization: `Bearer ${adminToken}` }
        });

        expect(res.statusCode).toBe(200);
        const check = await app.prisma.pewneAutoSource.findUnique({ where: { id: targetId } });
        expect(check).toBeNull();
    });
});
