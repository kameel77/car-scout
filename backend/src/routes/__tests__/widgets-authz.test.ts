import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';

describe('Widgets Admin Routes Authz', () => {
    let app: FastifyInstance;
    let managerToken: string;
    let adminToken: string;
    let contentManagerToken: string;
    let testWidgetId: string;

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
        if (testWidgetId) {
            await app.prisma.widget.deleteMany({ where: { id: testWidgetId } });
        }
        await app.close();
    });

    it('rejects POST /api/admin/widgets for PLATFORM_MANAGER (lacks content:write)', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/admin/widgets',
            headers: { authorization: `Bearer ${managerToken}` },
            payload: { name: 'Test', isActive: true, placement: 'HOME', vehicleSources: [], selectionMode: 'FEATURED' }
        });
        expect(res.statusCode).toBe(403);
    });

    it('rejects POST /api/admin/widgets without token', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/admin/widgets',
            payload: { name: 'Test', isActive: true, placement: 'HOME', vehicleSources: [], selectionMode: 'FEATURED' }
        });
        expect(res.statusCode).toBe(401);
    });
    
    it('accepts POST /api/admin/widgets for CONTENT_MANAGER_PLATFORM (has content:write)', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/admin/widgets',
            headers: { authorization: `Bearer ${contentManagerToken}` },
            payload: { name: 'Test CM', isActive: true, placement: 'HOME', vehicleSources: [], selectionMode: 'FEATURED' }
        });
        expect(res.statusCode).toBe(200);
        testWidgetId = res.json().id;
    });

    it('accepts POST /api/admin/widgets for SUPERADMIN_PLATFORM', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/admin/widgets',
            headers: { authorization: `Bearer ${adminToken}` },
            payload: { name: 'Test Admin', isActive: true, placement: 'HOME', vehicleSources: [], selectionMode: 'FEATURED' }
        });
        expect(res.statusCode).toBe(200);
        await app.prisma.widget.deleteMany({ where: { id: res.json().id } });
    });
});
