import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';

describe('CRM Tracking Routes', () => {
    let app: FastifyInstance;
    let token: string;
    const testUuid = 'test-uuid-123';
    const testSessionId = 'test-session-456';

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
        token = app.jwt.sign({ userId: 'test-user', email: 'test@example.com', role: 'admin' });
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(async () => {
        // Clean up test data
        await app.prisma.crmTrackingVisit.deleteMany({
            where: { session: { uuid: testUuid } }
        });
        await app.prisma.crmTrackingSession.deleteMany({
            where: { uuid: testUuid }
        });
    });

    describe('POST /api/crm-tracking/visit', () => {
        it('should successfully track a visit', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/crm-tracking/visit',
                payload: {
                    uuid: testUuid,
                    sessionId: testSessionId,
                    url: '/test-page',
                    visitedAt: new Date().toISOString()
                }
            });

            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ success: true });

            // Verify session was created
            const session = await app.prisma.crmTrackingSession.findUnique({
                where: { id: testSessionId }
            });
            expect(session).toBeTruthy();
            expect(session?.uuid).toBe(testUuid);

            // Verify visit was recorded
            const visits = await app.prisma.crmTrackingVisit.findMany({
                where: { sessionId: testSessionId }
            });
            expect(visits).toHaveLength(1);
            expect(visits[0].url).toBe('/test-page');
        });

        it('should reject invalid timestamp', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/crm-tracking/visit',
                payload: {
                    uuid: testUuid,
                    sessionId: testSessionId,
                    url: '/test-page',
                    visitedAt: 'invalid-date'
                }
            });

            expect(response.statusCode).toBe(400);
            expect(response.json()).toHaveProperty('error');
        });

        it('should use current time if visitedAt is not provided', async () => {
            const beforeRequest = new Date();

            const response = await app.inject({
                method: 'POST',
                url: '/api/crm-tracking/visit',
                payload: {
                    uuid: testUuid,
                    sessionId: testSessionId,
                    url: '/test-page'
                }
            });

            const afterRequest = new Date();

            expect(response.statusCode).toBe(200);

            const visits = await app.prisma.crmTrackingVisit.findMany({
                where: { sessionId: testSessionId }
            });
            expect(visits).toHaveLength(1);
            expect(visits[0].visitedAt.getTime()).toBeGreaterThanOrEqual(beforeRequest.getTime());
            expect(visits[0].visitedAt.getTime()).toBeLessThanOrEqual(afterRequest.getTime());
        });
    });

    describe('GET /api/crm-tracking/:uuid', () => {
        beforeEach(async () => {
            // Create test data
            await app.prisma.crmTrackingSession.create({
                data: {
                    id: testSessionId,
                    uuid: testUuid,
                    lastSeenAt: new Date()
                }
            });

            await app.prisma.crmTrackingVisit.createMany({
                data: [
                    {
                        sessionId: testSessionId,
                        url: '/page-1',
                        visitedAt: new Date('2024-01-01T10:00:00Z')
                    },
                    {
                        sessionId: testSessionId,
                        url: '/page-2',
                        visitedAt: new Date('2024-01-01T11:00:00Z')
                    },
                    {
                        sessionId: testSessionId,
                        url: '/page-3',
                        visitedAt: new Date('2024-01-02T10:00:00Z')
                    }
                ]
            });
        });

        it('should require authentication', async () => {
            const response = await app.inject({
                method: 'GET',
                url: `/api/crm-tracking/${testUuid}`
            });

            expect(response.statusCode).toBe(401);
        });

        it('should retrieve all visits for a UUID', async () => {
            // Mock authentication
            const response = await app.inject({
                method: 'GET',
                url: `/api/crm-tracking/${testUuid}`,
                headers: {
                    authorization: `Bearer ${token}`
                }
            });

            expect(response.statusCode).toBe(200);
            const data = response.json();

            expect(data.clientUuid).toBe(testUuid);
            expect(data.trackingSessionId).toBe(testSessionId);
            expect(data.visits).toHaveLength(3);
            expect(data.visits[0].url).toBe('/page-1');
            expect(data.range).toBeDefined();
            expect(data.range.from).toBe('2024-01-01T10:00:00.000Z');
            expect(data.range.to).toBe('2024-01-02T10:00:00.000Z');
        });

        it('should filter visits by date range', async () => {
            const response = await app.inject({
                method: 'GET',
                url: `/api/crm-tracking/${testUuid}?from=2024-01-01T10:30:00Z&to=2024-01-01T23:59:59Z`,
                headers: {
                    authorization: `Bearer ${token}`
                }
            });

            expect(response.statusCode).toBe(200);
            const data = response.json();

            expect(data.visits).toHaveLength(1);
            expect(data.visits[0].url).toBe('/page-2');
        });

        it('should return empty visits for non-existent UUID', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/crm-tracking/non-existent-uuid',
                headers: {
                    authorization: `Bearer ${token}`
                }
            });

            expect(response.statusCode).toBe(200);
            const data = response.json();

            expect(data.clientUuid).toBe('non-existent-uuid');
            expect(data.trackingSessionId).toBeNull();
            expect(data.visits).toHaveLength(0);
            expect(data.range).toBeUndefined();
        });
    });
});
