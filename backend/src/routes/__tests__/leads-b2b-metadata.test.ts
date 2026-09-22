import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';

describe('B2B Lead Metadata Validation and Persistence', () => {
    let app: FastifyInstance;
    let adminToken: string;
    const TEST_EMAIL = 'b2b-metadata-test@benefivo.pl';
    const TEST_EMAIL_RETAIL = 'retail-metadata-test@motolia.pl';

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
        adminToken = app.jwt.sign({
            userId: 'admin-test-b2b',
            email: 'admin@benefivo.pl',
            role: 'admin'
        });
    });

    afterAll(async () => {
        await app.prisma.lead.deleteMany({
            where: { email: { in: [TEST_EMAIL, TEST_EMAIL_RETAIL] } }
        });
        await app.close();
    });

    beforeEach(async () => {
        await app.prisma.lead.deleteMany({
            where: { email: { in: [TEST_EMAIL, TEST_EMAIL_RETAIL] } }
        });
    });

    it('creates an employer_b2b lead with 4 structured metadata keys and contact name only', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/leads',
            payload: {
                leadType: 'employer_b2b',
                trafficSource: 'benefivo_b2b',
                name: 'Jan Kowalski',
                email: TEST_EMAIL,
                phone: '+48 500 600 700',
                message: 'Firma: Acme Corp Sp. z o.o. (NIP: 123-456-78-90)\nOsoba kontaktowa: Jan Kowalski\nWielkość zespołu: 50-100\nModel programu: Mieszany',
                consentPrivacy: true,
                metadata: {
                    companyName: 'Acme Corp Sp. z o.o.',
                    companyNip: '123-456-78-90',
                    teamSize: '50-100 pracowników',
                    benefitModel: 'Dostęp pracowniczy (bez kosztów firmy)'
                }
            }
        });

        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.lead?.id).toBeTruthy();

        const saved = await app.prisma.lead.findUnique({ where: { id: body.lead.id } });
        expect(saved).not.toBeNull();
        expect(saved?.name).toBe('Jan Kowalski');
        expect(saved?.leadType).toBe('employer_b2b');
        expect(saved?.referenceNumber).toMatch(/^BNF-/);
        expect(saved?.metadata).toEqual({
            companyName: 'Acme Corp Sp. z o.o.',
            companyNip: '123-456-78-90',
            teamSize: '50-100 pracowników',
            benefitModel: 'Dostęp pracowniczy (bez kosztów firmy)'
        });

        // Verify GET /api/leads returns metadata
        const getRes = await app.inject({
            method: 'GET',
            url: '/api/leads?leadType=employer_b2b',
            headers: { authorization: `Bearer ${adminToken}` }
        });
        expect(getRes.statusCode).toBe(200);
        const getBody = getRes.json();
        const found = getBody.leads.find((l: any) => l.id === body.lead.id);
        expect(found).toBeDefined();
        expect(found.metadata).toEqual({
            companyName: 'Acme Corp Sp. z o.o.',
            companyNip: '123-456-78-90',
            teamSize: '50-100 pracowników',
            benefitModel: 'Dostęp pracowniczy (bez kosztów firmy)'
        });
    });

    it('rejects payload with unknown keys in metadata with 400', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/leads',
            payload: {
                leadType: 'employer_b2b',
                trafficSource: 'benefivo_b2b',
                name: 'Jan Kowalski',
                email: TEST_EMAIL,
                phone: '+48 500 600 700',
                message: 'Test message',
                consentPrivacy: true,
                metadata: {
                    companyName: 'Acme Corp',
                    companyNip: '1234567890',
                    teamSize: '50',
                    benefitModel: 'standard',
                    unknownProperty: 'hacker_payload'
                }
            }
        });

        expect(res.statusCode).toBe(400);
        const body = res.json();
        expect(body.error).toContain('Nieprawidłowe metadane');
    });

    it('rejects payload with invalid companyNip characters with 400', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/leads',
            payload: {
                leadType: 'employer_b2b',
                trafficSource: 'benefivo_b2b',
                name: 'Jan Kowalski',
                email: TEST_EMAIL,
                phone: '+48 500 600 700',
                message: 'Test message',
                consentPrivacy: true,
                metadata: {
                    companyName: 'Acme Corp',
                    companyNip: 'PL1234567890!@#',
                    teamSize: '50',
                    benefitModel: 'standard'
                }
            }
        });

        expect(res.statusCode).toBe(400);
    });

    it('sets metadata to null for retail lead types even if metadata is passed', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/leads',
            payload: {
                leadType: 'sale',
                name: 'Anna Nowak',
                email: TEST_EMAIL_RETAIL,
                phone: '+48 500 111 222',
                message: 'Zapytanie o auto',
                consentPrivacy: true,
                metadata: {
                    companyName: 'Ignored Company',
                    companyNip: '1234567890',
                    teamSize: '10',
                    benefitModel: 'standard'
                }
            }
        });

        expect(res.statusCode).toBe(200);
        const body = res.json();
        const saved = await app.prisma.lead.findUnique({ where: { id: body.lead.id } });
        expect(saved).not.toBeNull();
        expect(saved?.leadType).toBe('sale');
        expect(saved?.referenceNumber).toMatch(/^AF-/);
        expect(saved?.metadata).toBeNull();
    });

    it('sets metadata to null when metadata is omitted', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/leads',
            payload: {
                leadType: 'employer_b2b',
                name: 'Piotr Wiśniewski',
                email: TEST_EMAIL,
                phone: '+48 500 222 333',
                message: 'Bez metadanych',
                consentPrivacy: true
            }
        });

        expect(res.statusCode).toBe(200);
        const body = res.json();
        const saved = await app.prisma.lead.findUnique({ where: { id: body.lead.id } });
        expect(saved).not.toBeNull();
        expect(saved?.metadata).toBeNull();
    });
});
