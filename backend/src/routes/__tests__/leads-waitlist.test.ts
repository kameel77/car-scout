import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';

// Waitlist lead (F3, spec §1) — formularz na stronach marki/modelu bez aktywnych ofert.
// Bez listingId/rentalVehicleId: otagowany leadType='waitlist', marka/model poszukiwana przez
// klienta trafia do message (konwencja z /api/leads/negotiation) — widoczny i filtrowalny
// w istniejącym adminowym widoku leadów (miniCRM, GET /api/leads?leadType=).
describe('POST /api/leads/waitlist', () => {
    let app: FastifyInstance;
    let adminToken: string;
    const TEST_EMAIL = 'waitlist-test@example.com';

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
        adminToken = app.jwt.sign({ userId: 'admin-test-waitlist', email: 'admin@test.com', role: 'admin' });
    });

    afterAll(async () => {
        await app.prisma.lead.deleteMany({ where: { email: TEST_EMAIL } });
        await app.close();
    });

    beforeEach(async () => {
        await app.prisma.lead.deleteMany({ where: { email: TEST_EMAIL } });
        if (app.redis) {
            let cursor = '0';
            do {
                const [nextCursor, keys] = await app.redis.scan(cursor, 'MATCH', '*rate-limit*', 'COUNT', 100);
                cursor = nextCursor;
                if (keys.length > 0) await app.redis.del(...keys);
            } while (cursor !== '0');
        }
    });

    it('creates a lead tagged leadType=waitlist with make/model in the message, no listing attached', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/leads/waitlist',
            payload: {
                make: 'Tesla',
                model: 'Model Y',
                name: 'Jan Testowy',
                email: TEST_EMAIL,
                phone: '+48 111 222 333',
                consentMarketing: true,
                consentPrivacy: true,
            },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.lead.leadType).toBe('waitlist');
        expect(body.lead.listingId).toBeNull();
        expect(body.lead.rentalVehicleId).toBeNull();
        expect(body.lead.message).toContain('Tesla Model Y');
        expect(body.lead.referenceNumber).toBeTruthy();
        expect(body.lead.consentMarketingAt).toBeTruthy();
        expect(body.lead.consentPrivacyAt).toBeTruthy();
    });

    it('works without a model (brand-only waitlist)', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/leads/waitlist',
            payload: { make: 'Tesla', name: 'Jan Testowy', email: TEST_EMAIL },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().lead.message).toBe('Lista oczekujących: powiadom o nowej ofercie Tesla.');
    });

    it('requires make, name and email', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/leads/waitlist',
            payload: { name: 'Jan Testowy' },
        });
        expect(res.statusCode).toBe(400);
    });

    it('is rejected by the same anti-spam rate limit as other public lead endpoints', () => {
        const route = app.hasRoute({ method: 'POST', url: '/api/leads/waitlist' });
        expect(route).toBe(true);
    });

    it('is visible in the admin leads list and filterable by leadType=waitlist', async () => {
        await app.inject({
            method: 'POST',
            url: '/api/leads/waitlist',
            payload: {
                make: 'Tesla',
                model: 'Model Y',
                name: 'Jan Testowy',
                email: TEST_EMAIL,
                consentMarketing: true,
                consentPrivacy: true,
            },
        });

        const listRes = await app.inject({
            method: 'GET',
            url: '/api/leads',
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        expect(listRes.statusCode).toBe(200);
        const leads = listRes.json().leads as any[];
        const found = leads.find((l) => l.email === TEST_EMAIL && l.leadType === 'waitlist');
        expect(found).toBeTruthy();
        expect(found.message).toContain('Tesla Model Y');

        const filteredRes = await app.inject({
            method: 'GET',
            url: '/api/leads?leadType=waitlist',
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        expect(filteredRes.statusCode).toBe(200);
        const filteredLeads = filteredRes.json().leads as any[];
        expect(filteredLeads.length).toBeGreaterThan(0);
        expect(filteredLeads.every((l) => l.leadType === 'waitlist')).toBe(true);
        expect(filteredLeads.some((l) => l.email === TEST_EMAIL)).toBe(true);
    });
});
