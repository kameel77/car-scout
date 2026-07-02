import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';

describe('PartnerAds Admin Routes Authz', () => {
    let app: FastifyInstance;
    let managerToken: string;
    let adminToken: string;
    let testAdId: string;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();

        managerToken = app.jwt.sign({
            userId: 'manager-test',
            email: 'm@test.com',
            role: 'manager',
            activeContext: { scopeType: 'PLATFORM', scopeId: 'PLATFORM' }
        });

        adminToken = app.jwt.sign({
            userId: 'admin-test',
            email: 'a@test.com',
            role: 'admin',
            activeContext: { scopeType: 'PLATFORM', scopeId: 'PLATFORM' }
        });
    });

    afterAll(async () => {
        if (testAdId) {
            await app.prisma.partnerAd.deleteMany({ where: { id: testAdId } });
        }
        await app.close();
    });

    it('rejects POST /api/admin/partner-ads for non-admin', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/admin/partner-ads',
            headers: { authorization: `Bearer ${managerToken}` },
            payload: { placement: 'SEARCH_GRID', url: 'https://test.com' }
        });
        expect(res.statusCode).toBe(403);
    });
    
    it('rejects POST /api/admin/partner-ads without token', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/admin/partner-ads',
            payload: { placement: 'SEARCH_GRID', url: 'https://test.com' }
        });
        expect(res.statusCode).toBe(401);
    });
    
    it('accepts POST /api/admin/partner-ads for admin', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/admin/partner-ads',
            headers: { authorization: `Bearer ${adminToken}` },
            payload: { placement: 'SEARCH_GRID', url: 'https://test.com' }
        });
        expect(res.statusCode).toBe(200);
        testAdId = res.json().ad.id;
    });
});
