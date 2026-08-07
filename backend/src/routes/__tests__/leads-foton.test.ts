import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';

describe('POST /api/leads with foton lead types', () => {
    let app: FastifyInstance;
    let adminToken: string;
    const TEST_EMAIL = 'foton-lead-test@example.com';

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
        adminToken = app.jwt.sign({ userId: 'admin-test-foton', email: 'admin@test.com', role: 'admin' });
    });

    afterAll(async () => {
        await app.prisma.lead.deleteMany({ where: { email: TEST_EMAIL } });
        await app.close();
    });

    beforeEach(async () => {
        await app.prisma.lead.deleteMany({ where: { email: TEST_EMAIL } });
    });

    it('creates a foton_fleet lead with trafficSource foton_landing', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/leads',
            payload: {
                name: 'Firma Flotowa Sp. z o.o.',
                email: TEST_EMAIL,
                phone: '+48 600 111 222',
                leadType: 'foton_fleet',
                trafficSource: 'foton_landing',
                message: 'Segment: Flota / Użytkowe\nWybrany model: FOTON eToano Pro',
                consentPrivacy: true,
            },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.lead.id).toBeTruthy();

        // Verify lead saved in database
        const savedLead = await app.prisma.lead.findUnique({ where: { id: body.lead.id } });
        expect(savedLead).not.toBeNull();
        expect(savedLead?.leadType).toBe('foton_fleet');
        expect(savedLead?.trafficSource).toBe('foton_landing');
    });

    it('creates a foton_lifestyle lead', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/leads',
            payload: {
                name: 'Marek Nowak',
                email: TEST_EMAIL,
                phone: '+48 600 333 444',
                leadType: 'foton_lifestyle',
                trafficSource: 'foton_landing',
                message: 'Segment: Lifestyle / Pickupy\nWybrany model: FOTON Tunland G7',
                consentPrivacy: true,
            },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.lead.id).toBeTruthy();

        const savedLead = await app.prisma.lead.findUnique({ where: { id: body.lead.id } });
        expect(savedLead?.leadType).toBe('foton_lifestyle');
    });

    it('allows filtering foton leads via GET /api/leads?leadType=foton_fleet', async () => {
        // Create fleet lead
        await app.inject({
            method: 'POST',
            url: '/api/leads',
            payload: {
                name: 'Flota Test',
                email: TEST_EMAIL,
                leadType: 'foton_fleet',
                consentPrivacy: true,
            },
        });

        const listRes = await app.inject({
            method: 'GET',
            url: '/api/leads?leadType=foton_fleet',
            headers: { authorization: `Bearer ${adminToken}` },
        });
        expect(listRes.statusCode).toBe(200);
        const filtered = listRes.json().leads as any[];
        expect(filtered.some((l) => l.email === TEST_EMAIL && l.leadType === 'foton_fleet')).toBe(true);
    });
});
