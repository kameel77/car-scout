import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';

describe('Widgets Admin Routes Authz', () => {
    let app: FastifyInstance;
    let managerToken: string;
    let adminToken: string;
    let testWidgetId: string;

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
        if (testWidgetId) {
            await app.prisma.widget.deleteMany({ where: { id: testWidgetId } });
        }
        await app.close();
    });

    it('rejects POST /api/admin/widgets for non-admin', async () => {
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
    
    it('accepts POST /api/admin/widgets for admin', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/admin/widgets',
            headers: { authorization: `Bearer ${adminToken}` },
            payload: { name: 'Test', isActive: true, placement: 'HOME', vehicleSources: [], selectionMode: 'FEATURED' }
        });
        expect(res.statusCode).toBe(200); // the route logic says return widget
        testWidgetId = res.json().id;
    });
});
