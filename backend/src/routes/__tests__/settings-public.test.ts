import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';

describe('Settings — public vs admin allowlist', () => {
    let app: FastifyInstance;
    let original: any;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();

        original = await app.prisma.appSettings.findUnique({ where: { id: 'default' } });
        await app.prisma.appSettings.upsert({
            where: { id: 'default' },
            update: {
                smtpHost: 'smtp.test.internal',
                smtpUser: 'smtp-user@test.internal',
                smtpPassword: 'super-secret-password',
                smtpPort: 465,
                smtpFromEmail: 'from@test.internal',
                smtpRecipientEmail: 'recipient@test.internal',
                pdfParserSystemPrompt: 'TEST_SECRET_PROMPT',
                pdfParserLlmModel: 'test-model',
                leadRecipientUserId: 'user-123',
                siteNamePl: 'Test Site PL',
                displayCurrency: 'PLN',
            },
            create: {
                id: 'default',
                legalDocuments: {},
                smtpHost: 'smtp.test.internal',
                smtpUser: 'smtp-user@test.internal',
                smtpPassword: 'super-secret-password',
                smtpPort: 465,
                smtpFromEmail: 'from@test.internal',
                smtpRecipientEmail: 'recipient@test.internal',
                pdfParserSystemPrompt: 'TEST_SECRET_PROMPT',
                leadRecipientUserId: 'user-123',
                siteNamePl: 'Test Site PL',
                displayCurrency: 'PLN',
            },
        });
    });

    afterAll(async () => {
        if (original) {
            await app.prisma.appSettings.update({
                where: { id: 'default' },
                data: {
                    smtpHost: original.smtpHost,
                    smtpUser: original.smtpUser,
                    smtpPassword: original.smtpPassword,
                    smtpPort: original.smtpPort,
                    smtpFromEmail: original.smtpFromEmail,
                    smtpRecipientEmail: original.smtpRecipientEmail,
                    pdfParserSystemPrompt: original.pdfParserSystemPrompt,
                    pdfParserLlmModel: original.pdfParserLlmModel,
                    leadRecipientUserId: original.leadRecipientUserId,
                    siteNamePl: original.siteNamePl,
                    displayCurrency: original.displayCurrency,
                },
            });
        }
        await app.close();
    });

    it('GET /api/settings does not leak smtp*, pdfParser*, or leadRecipientUserId', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/settings' });
        expect(res.statusCode).toBe(200);
        const body = res.json();

        const leakedKeys = Object.keys(body).filter((key) => /^smtp/.test(key) || /^pdfParser/.test(key));
        expect(leakedKeys).toEqual([]);
        expect(body).not.toHaveProperty('leadRecipientUserId');
    });

    it('GET /api/settings still returns the public fields the frontend needs', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/settings' });
        expect(res.statusCode).toBe(200);
        const body = res.json();

        expect(body.siteNamePl).toBe('Test Site PL');
        expect(body.displayCurrency).toBe('PLN');
        expect(body).toHaveProperty('legalDocuments');
        expect(body).toHaveProperty('enabledLanguages');
    });

    it('GET /api/settings is edge-cacheable (anonymous public response)', async () => {
        // Cache-Control publiczny wymaga hosta produkcyjnego (isProductionHost) — inaczej globalny
        // onSend guard w app.ts (de-indexing na dev/staging) nadpisuje wszystko na 'private, no-store'.
        const prevBrand = process.env.BRAND;
        const prevFrontendUrl = process.env.FRONTEND_URL;
        process.env.BRAND = 'motolia';
        process.env.FRONTEND_URL = 'https://motolia.pl';
        try {
            const res = await app.inject({ method: 'GET', url: '/api/settings', headers: { host: 'motolia.pl' } });
            expect(res.statusCode).toBe(200);
            expect(res.headers['cache-control']).toBe('public, max-age=0, s-maxage=300');
        } finally {
            if (prevBrand === undefined) delete process.env.BRAND; else process.env.BRAND = prevBrand;
            if (prevFrontendUrl === undefined) delete process.env.FRONTEND_URL; else process.env.FRONTEND_URL = prevFrontendUrl;
        }
    });

    it('GET /api/admin/settings requires auth (401 without token)', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/admin/settings' });
        expect(res.statusCode).toBe(401);
    });

    it('GET /api/admin/settings returns the full record (masked password) for an admin', async () => {
        const adminToken = app.jwt.sign({
            userId: 'admin-test',
            email: 'a@test.com',
            role: 'admin',
            activeContext: { scopeType: 'PLATFORM', scopeId: 'PLATFORM' },
        });

        const res = await app.inject({
            method: 'GET',
            url: '/api/admin/settings',
            headers: { authorization: `Bearer ${adminToken}` },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();

        expect(body.smtpHost).toBe('smtp.test.internal');
        expect(body.leadRecipientUserId).toBe('user-123');
        expect(body.smtpPassword).toBe('••••••••');
    });
});
