import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';

describe('POST /api/csp-report', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    it('accepts a valid application/csp-report body and returns 204', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/csp-report',
            headers: { 'content-type': 'application/csp-report' },
            payload: JSON.stringify({
                'csp-report': {
                    'document-uri': 'https://motolia.pl/',
                    'violated-directive': 'script-src',
                    'blocked-uri': 'https://evil.example.com/x.js',
                    disposition: 'report',
                },
            }),
        });

        expect(res.statusCode).toBe(204);
        expect(res.body).toBe('');
    });

    it('accepts a valid application/reports+json body and returns 204', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/csp-report',
            headers: { 'content-type': 'application/reports+json' },
            payload: JSON.stringify([
                {
                    type: 'csp-violation',
                    url: 'https://motolia.pl/',
                    body: {
                        documentURL: 'https://motolia.pl/',
                        effectiveDirective: 'script-src',
                        blockedURL: 'https://evil.example.com/x.js',
                        disposition: 'enforce',
                    },
                },
            ]),
        });

        expect(res.statusCode).toBe(204);
        expect(res.body).toBe('');
    });

    it('returns 204 for a malformed body without throwing', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/csp-report',
            headers: { 'content-type': 'application/csp-report' },
            payload: '{not valid json',
        });

        expect(res.statusCode).toBe(204);
    });

    it('returns 204 for an empty body', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/csp-report',
            headers: { 'content-type': 'application/csp-report' },
            payload: '',
        });

        expect(res.statusCode).toBe(204);
    });

    it('requires no authentication', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/csp-report',
            headers: { 'content-type': 'application/csp-report' },
            payload: JSON.stringify({ 'csp-report': {} }),
        });

        expect(res.statusCode).not.toBe(401);
        expect(res.statusCode).toBe(204);
    });
});
