import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';

describe('PartnerAds Admin Routes Authz', () => {
    let app: FastifyInstance;
    let managerToken: string;
    let adminToken: string;
    let contentManagerToken: string;
    let testAdId: string;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();

        managerToken = app.jwt.sign({
            userId: 'manager-test',
            email: 'm@test.com',
            role: 'manager',
            memberships: [
                { id: 'm1', scopeType: 'PLATFORM', scopeId: 'PLATFORM', role: 'PLATFORM_MANAGER', isDefaultContext: true }
            ],
            activeContext: { scopeType: 'PLATFORM', scopeId: 'PLATFORM' }
        });

        adminToken = app.jwt.sign({
            userId: 'admin-test',
            email: 'a@test.com',
            role: 'admin',
            memberships: [
                { id: 'm2', scopeType: 'PLATFORM', scopeId: 'PLATFORM', role: 'SUPERADMIN_PLATFORM', isDefaultContext: true }
            ],
            activeContext: { scopeType: 'PLATFORM', scopeId: 'PLATFORM' }
        });

        contentManagerToken = app.jwt.sign({
            userId: 'cm-test',
            email: 'cm@test.com',
            role: 'manager',
            memberships: [
                { id: 'm3', scopeType: 'PLATFORM', scopeId: 'PLATFORM', role: 'CONTENT_MANAGER_PLATFORM', isDefaultContext: true }
            ],
            activeContext: { scopeType: 'PLATFORM', scopeId: 'PLATFORM' }
        });
    });

    afterAll(async () => {
        if (testAdId) {
            await app.prisma.partnerAd.deleteMany({ where: { id: testAdId } });
        }
        await app.close();
    });

    it('rejects POST /api/admin/partner-ads for PLATFORM_MANAGER (lacks content:write)', async () => {
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
    
    it('accepts POST /api/admin/partner-ads for CONTENT_MANAGER_PLATFORM (has content:write)', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/admin/partner-ads',
            headers: { authorization: `Bearer ${contentManagerToken}` },
            payload: { placement: 'SEARCH_GRID', url: 'https://test.com' }
        });
        expect(res.statusCode).toBe(200);
        testAdId = res.json().ad.id;
    });

    it('accepts POST /api/admin/partner-ads for SUPERADMIN_PLATFORM', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/admin/partner-ads',
            headers: { authorization: `Bearer ${adminToken}` },
            payload: { placement: 'SEARCH_GRID', url: 'https://test.com' }
        });
        expect(res.statusCode).toBe(200);
        await app.prisma.partnerAd.deleteMany({ where: { id: res.json().ad.id } });
    });
});
