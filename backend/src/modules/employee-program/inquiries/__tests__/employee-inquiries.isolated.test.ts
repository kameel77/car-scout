import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import { createInquirySchema, employeeInquiriesRoutes } from '../employee-inquiries.routes.js';
import { generateSignedCsrfToken } from '../../auth/employee-session.helpers.js';

describe('Employee Inquiries - Schema Validation (Zod)', () => {
  const validBase = {
    offerId: 'cmu3offer0001anrf00000000',
    idempotencyKey: 'a0000000-0000-4000-8000-000000000001',
    contractParty: 'CONSUMER' as const,
    contactName: 'Jan Kowalski',
    contactEmail: 'jan.kowalski@example.com',
    contactPhone: '+48 500 600 700',
    consentPrivacy: true,
  };

  it('validates a valid CONSUMER inquiry payload without NIP', () => {
    const result = createInquirySchema.safeParse(validBase);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contractParty).toBe('CONSUMER');
      expect(result.data.consentPrivacy).toBe(true);
    }
  });

  it('rejects inquiry when consentPrivacy is false or omitted', () => {
    const falseConsent = createInquirySchema.safeParse({
      ...validBase,
      consentPrivacy: false,
    });
    expect(falseConsent.success).toBe(false);
    if (!falseConsent.success) {
      expect(falseConsent.error.errors[0].message).toContain('Wymagana jest zgoda na przetwarzanie danych osobowych');
    }

    const missingConsent = createInquirySchema.safeParse({
      ...validBase,
      consentPrivacy: undefined,
    });
    expect(missingConsent.success).toBe(false);
  });

  it('requires valid NIP (10-15 chars) for EMPLOYEE_B2B', () => {
    const missingNip = createInquirySchema.safeParse({
      ...validBase,
      contractParty: 'EMPLOYEE_B2B',
    });
    expect(missingNip.success).toBe(false);
    if (!missingNip.success) {
      expect(missingNip.error.errors[0].message).toContain('NIP');
    }

    const shortNip = createInquirySchema.safeParse({
      ...validBase,
      contractParty: 'EMPLOYEE_B2B',
      nip: '123456789', // 9 chars
    });
    expect(shortNip.success).toBe(false);

    const validNip = createInquirySchema.safeParse({
      ...validBase,
      contractParty: 'EMPLOYEE_B2B',
      nip: '1234567890', // 10 chars
    });
    expect(validNip.success).toBe(true);
  });

  it('requires valid NIP for EMPLOYER_COMPANY', () => {
    const missingNip = createInquirySchema.safeParse({
      ...validBase,
      contractParty: 'EMPLOYER_COMPANY',
    });
    expect(missingNip.success).toBe(false);

    const validNip = createInquirySchema.safeParse({
      ...validBase,
      contractParty: 'EMPLOYER_COMPANY',
      nip: 'PL1234567890', // 12 chars
    });
    expect(validNip.success).toBe(true);
  });

  it('strips injected accountId, companyId, and programId from payload', () => {
    const injected = {
      ...validBase,
      accountId: 'malicious-account-id',
      companyId: 'malicious-company-id',
      programId: 'malicious-program-id',
    };
    const parsed: any = createInquirySchema.parse(injected);
    expect(parsed.accountId).toBeUndefined();
    expect(parsed.companyId).toBeUndefined();
    expect(parsed.programId).toBeUndefined();
  });

  it('rejects invalid email address and non-UUID idempotencyKey', () => {
    const badEmail = createInquirySchema.safeParse({
      ...validBase,
      contactEmail: 'not-an-email',
    });
    expect(badEmail.success).toBe(false);

    const badKey = createInquirySchema.safeParse({
      ...validBase,
      idempotencyKey: 'not-a-uuid',
    });
    expect(badKey.success).toBe(false);
  });

  it('accepts both CUID and listing- prefixed virtual offer IDs', () => {
    const cuidOffer = createInquirySchema.safeParse({
      ...validBase,
      offerId: 'clw1234567890123456789012',
    });
    expect(cuidOffer.success).toBe(true);

    const virtualOffer = createInquirySchema.safeParse({
      ...validBase,
      offerId: 'listing-clw1234567890123456789012',
    });
    expect(virtualOffer.success).toBe(true);

    const invalidOffer = createInquirySchema.safeParse({
      ...validBase,
      offerId: 'invalid offer with spaces!',
    });
    expect(invalidOffer.success).toBe(false);
  });
});

describe('Employee Inquiries - Security & CSRF Enforcement', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    const jwtSecret = process.env.JWT_SECRET || 'test-jwt-secret-employee-isolated';
    await app.register(jwt, { secret: jwtSecret });

    app.decorate('prisma', {
      employeeAccount: { findUnique: vi.fn() },
      employeeInquiry: { findUnique: vi.fn(), create: vi.fn() },
    } as any);

    app.decorate('redis', {
      get: vi.fn(),
      set: vi.fn(),
    } as any);

    await app.register(employeeInquiriesRoutes);
  });

  it('rejects POST /api/employee/inquiries without credentials with 401 Unauthorized', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/employee/inquiries',
      payload: {
        offerId: 'cmu3offer0001anrf00000000',
        idempotencyKey: 'a0000000-0000-4000-8000-000000000001',
        contractParty: 'CONSUMER',
        contactName: 'Jan Kowalski',
        contactEmail: 'jan@example.com',
        contactPhone: '+48 500 600 700',
        consentPrivacy: true,
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it('rejects GET /api/employee/inquiries without credentials with 401 Unauthorized', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/employee/inquiries',
    });

    expect(res.statusCode).toBe(401);
  });
});
