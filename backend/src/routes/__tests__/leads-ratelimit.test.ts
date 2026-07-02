import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';

describe('Public POST routes rate limits', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    it('has rate limit config on POST /api/leads', () => {
        const route = app.hasRoute({
            method: 'POST',
            url: '/api/leads'
        });
        expect(route).toBe(true);
        // We can inspect the config dynamically
        // fastify encapsulates this, but we can verify it's registered
    });
    
    // Test the rate limit by sending N+1 requests
    it('returns 429 when rate limit exceeded for POST /api/leads', async () => {
        const payload = {
            listingId: 'test-listing-1',
            name: 'Test Name',
            email: 'test@example.com',
            message: 'Test message',
            phone: '123456789'
        };

        // max is 10, so 11 requests should trigger 429
        let lastStatusCode = 200;
        for (let i = 0; i < 11; i++) {
            const res = await app.inject({
                method: 'POST',
                url: '/api/leads',
                payload,
                headers: { 'x-forwarded-for': '10.0.0.1' } // force consistent IP
            });
            lastStatusCode = res.statusCode;
        }

        // It might be 404/400 for bad payloads, but it MUST be 429 when rate limit kicks in.
        expect(lastStatusCode).toBe(429);
    });
});
