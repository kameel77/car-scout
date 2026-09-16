import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import {
  createLightweightTestApp,
  assertSafeIntegrationEnvironment,
  TEST_HOST,
  TEST_ORIGIN
} from '../../auth/__tests__/employee-test-helper.js';
import {
  SESSION_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME
} from '../../auth/employee-session.helpers.js';

describe('Employee Inquiries Real DB & Redis Integration Tests (P3c)', () => {
  if (process.env.EMPLOYEE_INTEGRATION_RUNNER_MARKER !== 'EMPLOYEE_INTEGRATION_RUNNER_ACTIVE_SAFE_V1') {
    it.skip('SKIPPED: Integration tests require dedicated disposable environment via `node scripts/test-employee-integration.mjs`', () => {});
    return;
  }

  let app: FastifyInstance;
  let prisma: PrismaClient;
  let redis: Redis;

  const companyAId = 'test-company-inq-action';
  const programAId = 'test-program-inq-action';
  const companyBId = 'test-company-inq-finarena';
  const programBId = 'test-program-inq-finarena';

  const plainCodeA = 'ACTION-INQ-2026';
  const plainCodeB = 'FINARENA-INQ-2026';

  const emailA = 'pracownik.inq.action@action.pl';
  const emailB = 'pracownik.inq.finarena@finarena.pl';
  const testPassword = 'Password123!';

  let sessionCookieA: string;
  let sessionCookieB: string;

  let offerA1Id: string;
  let offerAArchivedId: string;
  let offerB1Id: string;

  const financingProd1Id = 'test-fin-prod-1';
  const financingProd2Id = 'test-fin-prod-2';

  function extractSessionCookie(setCookiesHeader: unknown): string {
    const list = Array.isArray(setCookiesHeader) ? setCookiesHeader : [setCookiesHeader as string];
    const sessionHeader = list.find((c) => c && c.startsWith(`${SESSION_COOKIE_NAME}=`));
    const match = sessionHeader?.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
    return `${SESSION_COOKIE_NAME}=${match ? match[1] : ''}`;
  }

  async function getCsrfHeaders(sessionCookie: string) {
    const res = await app.inject({
      method: 'GET',
      url: '/api/employee/auth/csrf',
      headers: { host: TEST_HOST, origin: TEST_ORIGIN, cookie: sessionCookie }
    });
    const csrfToken = JSON.parse(res.body).csrfToken;
    const rawCookies = res.headers['set-cookie'];
    const list = Array.isArray(rawCookies) ? rawCookies : [rawCookies as string];
    const csrfCookieHeader = list.find((c) => c && c.startsWith(`${CSRF_COOKIE_NAME}=`));
    const match = csrfCookieHeader?.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
    const csrfCookie = `${CSRF_COOKIE_NAME}=${match ? match[1] : ''}`;

    return {
      host: TEST_HOST,
      origin: TEST_ORIGIN,
      cookie: `${sessionCookie}; ${csrfCookie}`,
      [CSRF_HEADER_NAME]: csrfToken
    };
  }

  async function cleanupTestData() {
    await prisma.employeeInquiry.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } }
    });
    await prisma.lead.deleteMany({
      where: { leadType: 'employee' }
    });
    await prisma.employeeProductOverride.deleteMany({
      where: { programId: { in: [programAId, programBId] } }
    });
    await prisma.financingProduct.deleteMany({
      where: { id: { in: [financingProd1Id, financingProd2Id] } }
    });
    await prisma.employeeProgramOffer.deleteMany({
      where: { programId: { in: [programAId, programBId] } }
    });
    await prisma.employeeBenefitPolicy.deleteMany({
      where: { programId: { in: [programAId, programBId] } }
    });
    await prisma.employeeRegistrationCode.deleteMany({
      where: { programId: { in: [programAId, programBId] } }
    });
    await prisma.employeeMembershipAudit.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } }
    });
    await prisma.employeeMembership.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } }
    });
    await prisma.employeeAccount.deleteMany({
      where: { email: { in: [emailA, emailB] } }
    });
    await prisma.employeeProgram.deleteMany({
      where: { id: { in: [programAId, programBId] } }
    });
    await prisma.employeeCompany.deleteMany({
      where: { id: { in: [companyAId, companyBId] } }
    });
    await prisma.listing.deleteMany({
      where: {
        id: { in: ['test-listing-inq-active', 'test-listing-inq-archived', 'test-listing-inq-b'] }
      }
    });
  }

  beforeAll(async () => {
    assertSafeIntegrationEnvironment();

    const initialized = await createLightweightTestApp({
      enablePlatformJwtTrust: true
    });
    app = initialized.app;
    prisma = initialized.prisma;
    redis = initialized.redis;

    await cleanupTestData();

    // 1. Create Companies & Programs
    await prisma.employeeCompany.create({
      data: {
        id: companyAId,
        name: 'Action Inquiries S.A.',
        slug: 'action-inq-p3c',
        isActive: true
      }
    });

    await prisma.employeeProgram.create({
      data: {
        id: programAId,
        companyId: companyAId,
        name: 'Action Auto Program Inq',
        slug: 'action-auto-inq-p3c',
        isActive: true,
        defaultDiscountPct: 8.0
      }
    });

    await prisma.employeeCompany.create({
      data: {
        id: companyBId,
        name: 'Finarena Inquiries Sp. z o.o.',
        slug: 'finarena-inq-p3c',
        isActive: true
      }
    });

    await prisma.employeeProgram.create({
      data: {
        id: programBId,
        companyId: companyBId,
        name: 'Finarena Program Inq',
        slug: 'finarena-auto-inq-p3c',
        isActive: true,
        defaultDiscountPct: 10.0
      }
    });

    // 2. Registration codes
    const { hashRegistrationCode } = await import('../../auth/employee-auth.service.js');
    await prisma.employeeRegistrationCode.create({
      data: {
        companyId: companyAId,
        programId: programAId,
        codeHash: hashRegistrationCode(plainCodeA),
        isActive: true
      }
    });
    await prisma.employeeRegistrationCode.create({
      data: {
        companyId: companyBId,
        programId: programBId,
        codeHash: hashRegistrationCode(plainCodeB),
        isActive: true
      }
    });

    // 3. Register employees
    const csrfResA = await app.inject({
      method: 'GET',
      url: '/api/employee/auth/csrf',
      headers: { host: TEST_HOST, origin: TEST_ORIGIN }
    });
    const regResA = await app.inject({
      method: 'POST',
      url: '/api/employee/auth/register',
      headers: {
        host: TEST_HOST,
        origin: TEST_ORIGIN,
        cookie: csrfResA.headers['set-cookie'] as string,
        [CSRF_HEADER_NAME]: JSON.parse(csrfResA.body).csrfToken
      },
      payload: {
        code: plainCodeA,
        email: emailA,
        password: testPassword,
        firstName: 'Adam',
        lastName: 'Actionowski'
      }
    });
    sessionCookieA = extractSessionCookie(regResA.headers['set-cookie']);

    const csrfResB = await app.inject({
      method: 'GET',
      url: '/api/employee/auth/csrf',
      headers: { host: TEST_HOST, origin: TEST_ORIGIN }
    });
    const regResB = await app.inject({
      method: 'POST',
      url: '/api/employee/auth/register',
      headers: {
        host: TEST_HOST,
        origin: TEST_ORIGIN,
        cookie: csrfResB.headers['set-cookie'] as string,
        [CSRF_HEADER_NAME]: JSON.parse(csrfResB.body).csrfToken
      },
      payload: {
        code: plainCodeB,
        email: emailB,
        password: testPassword,
        firstName: 'Bartosz',
        lastName: 'Finarenowski'
      }
    });
    sessionCookieB = extractSessionCookie(regResB.headers['set-cookie']);

    // 4. Create Listings & Offers
    await prisma.listing.create({
      data: {
        id: 'test-listing-inq-active',
        make: 'Toyota',
        model: 'Yaris',
        version: '1.5 Hybrid Dynamic',
        productionYear: 2024,
        mileageKm: 5,
        pricePln: 100000,
        isArchived: false
      }
    });

    await prisma.listing.create({
      data: {
        id: 'test-listing-inq-archived',
        make: 'Renault',
        model: 'Clio',
        version: '1.0 TCe',
        productionYear: 2023,
        mileageKm: 5,
        pricePln: 80000,
        isArchived: true
      }
    });

    await prisma.listing.create({
      data: {
        id: 'test-listing-inq-b',
        make: 'BMW',
        model: '3 Series',
        version: '320i',
        productionYear: 2024,
        mileageKm: 5,
        pricePln: 200000,
        isArchived: false
      }
    });

    const offerA1 = await prisma.employeeProgramOffer.create({
      data: {
        programId: programAId,
        sourceType: 'FINANCING',
        listingId: 'test-listing-inq-active',
        discountPct: 8.0,
        isActive: true
      }
    });
    offerA1Id = offerA1.id;

    const offerAArchived = await prisma.employeeProgramOffer.create({
      data: {
        programId: programAId,
        sourceType: 'FINANCING',
        listingId: 'test-listing-inq-archived',
        isActive: true
      }
    });
    offerAArchivedId = offerAArchived.id;

    const offerB1 = await prisma.employeeProgramOffer.create({
      data: {
        programId: programBId,
        sourceType: 'FINANCING',
        listingId: 'test-listing-inq-b',
        isActive: true
      }
    });
    offerB1Id = offerB1.id;
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
    await prisma.$disconnect();
    await redis.quit();
  });

  beforeEach(async () => {
    const keys = await redis.keys('*rate-limit*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  // 1. IDEMPOTENCJA
  it('1. Idempotency: two POST requests with same idempotencyKey create 1 Inquiry and 1 Lead, second returns 200', async () => {
    const headersA = await getCsrfHeaders(sessionCookieA);
    const key = 'b0000000-0000-4000-8000-000000000001';

    const payload = {
      offerId: offerA1Id,
      idempotencyKey: key,
      contractParty: 'CONSUMER',
      contactName: 'Adam Actionowski',
      contactEmail: emailA,
      contactPhone: '+48 501 234 567',
      consentPrivacy: true
    };

    // First request -> 201 Created
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/employee/inquiries',
      headers: headersA,
      payload
    });

    expect(res1.statusCode).toBe(201);
    const body1 = JSON.parse(res1.body);
    expect(body1.inquiry.id).toBeDefined();
    expect(body1.inquiry.status).toBe('NEW');
    expect(body1.inquiry.referenceNumber).toMatch(/^PP-\d{8}$/);
    expect(body1.inquiry.pricing.employeePricePln).toBe(92000); // 100 000 - 8%

    // Second request with SAME idempotencyKey -> 200 OK
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/employee/inquiries',
      headers: headersA,
      payload
    });

    expect(res2.statusCode).toBe(200);
    const body2 = JSON.parse(res2.body);
    expect(body2.inquiry.id).toBe(body1.inquiry.id);
    expect(body2.inquiry.referenceNumber).toBe(body1.inquiry.referenceNumber);

    // Verify DB count: strictly 1 inquiry and 1 lead
    const inquiriesCount = await prisma.employeeInquiry.count({
      where: { idempotencyKey: key }
    });
    expect(inquiriesCount).toBe(1);

    const leadsCount = await prisma.lead.count({
      where: { referenceNumber: body1.inquiry.referenceNumber }
    });
    expect(leadsCount).toBe(1);
  });

  // 2. NIEZMIENNOŚĆ SNAPSHOTU
  it('2. Snapshot Immutability: modifying offer in DB does not alter already recorded snapshot', async () => {
    const headersA = await getCsrfHeaders(sessionCookieA);
    const key = 'b0000000-0000-4000-8000-000000000002';

    const res = await app.inject({
      method: 'POST',
      url: '/api/employee/inquiries',
      headers: headersA,
      payload: {
        offerId: offerA1Id,
        idempotencyKey: key,
        contractParty: 'CONSUMER',
        contactName: 'Adam Actionowski',
        contactEmail: emailA,
        contactPhone: '+48 501 234 567',
        consentPrivacy: true
      }
    });
    expect(res.statusCode).toBe(201);

    // Later: modify offer discount and list price drastically
    await prisma.employeeProgramOffer.update({
      where: { id: offerA1Id },
      data: { discountPct: 25.0 }
    });
    await prisma.listing.update({
      where: { id: 'test-listing-inq-active' },
      data: { pricePln: 150000 }
    });

    // Retrieve inquiries via GET /api/employee/inquiries
    const getRes = await app.inject({
      method: 'GET',
      url: '/api/employee/inquiries',
      headers: { host: TEST_HOST, cookie: sessionCookieA }
    });
    expect(getRes.statusCode).toBe(200);
    const { inquiries } = JSON.parse(getRes.body);
    const target = inquiries.find((i: any) => i.id === JSON.parse(res.body).inquiry.id);

    // Snapshot remains strictly 100 000 list price and 92 000 employee price (8% discount)
    expect(target.pricing.listPricePln).toBe(100000);
    expect(target.pricing.employeePricePln).toBe(92000);
    expect(target.pricing.discountPct).toBe(8);

    // Restore offer discount for other tests
    await prisma.employeeProgramOffer.update({
      where: { id: offerA1Id },
      data: { discountPct: 8.0 }
    });
    await prisma.listing.update({
      where: { id: 'test-listing-inq-active' },
      data: { pricePln: 100000 }
    });
  });

  // 3. IZOLACJA TENANTÓW
  it('3. Tenant Isolation: submitting on foreign offer returns 404, GET inquiries does not leak foreign inquiries', async () => {
    const headersA = await getCsrfHeaders(sessionCookieA);

    // Employee A attempts to submit inquiry on Employee B's offer
    const foreignRes = await app.inject({
      method: 'POST',
      url: '/api/employee/inquiries',
      headers: headersA,
      payload: {
        offerId: offerB1Id,
        idempotencyKey: 'b0000000-0000-4000-8000-000000000003',
        contractParty: 'CONSUMER',
        contactName: 'Adam Actionowski',
        contactEmail: emailA,
        contactPhone: '+48 501 234 567',
        consentPrivacy: true
      }
    });
    expect(foreignRes.statusCode).toBe(404);

    // Employee B creates an inquiry
    const headersB = await getCsrfHeaders(sessionCookieB);
    const bInqRes = await app.inject({
      method: 'POST',
      url: '/api/employee/inquiries',
      headers: headersB,
      payload: {
        offerId: offerB1Id,
        idempotencyKey: 'b0000000-0000-4000-8000-000000000004',
        contractParty: 'CONSUMER',
        contactName: 'Bartosz Finarenowski',
        contactEmail: emailB,
        contactPhone: '+48 502 999 888',
        consentPrivacy: true
      }
    });
    expect(bInqRes.statusCode).toBe(201);
    const bInquiryId = JSON.parse(bInqRes.body).inquiry.id;

    // Employee A gets inquiries -> must NOT see Employee B's inquiry
    const getResA = await app.inject({
      method: 'GET',
      url: '/api/employee/inquiries',
      headers: { host: TEST_HOST, cookie: sessionCookieA }
    });
    const { inquiries: inqsA } = JSON.parse(getResA.body);
    expect(inqsA.some((i: any) => i.id === bInquiryId)).toBe(false);
  });

  // 4. SERVER-SIDE SNAPSHOT (IGNOROWANIE PODRZUCANYCH CEN)
  it('4. Server-Side Calculation: client-injected pricing in body is ignored, calculated from server', async () => {
    const headersA = await getCsrfHeaders(sessionCookieA);

    const res = await app.inject({
      method: 'POST',
      url: '/api/employee/inquiries',
      headers: headersA,
      payload: {
        offerId: offerA1Id,
        idempotencyKey: 'b0000000-0000-4000-8000-000000000005',
        contractParty: 'CONSUMER',
        contactName: 'Adam Actionowski',
        contactEmail: emailA,
        contactPhone: '+48 501 234 567',
        consentPrivacy: true,
        pricePln: 1, // Malicious injected price
        employeePricePln: 1,
        discountPct: 99
      }
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.inquiry.pricing.employeePricePln).toBe(92000); // Server calculated, not 1 zł
    expect(body.inquiry.pricing.listPricePln).toBe(100000);
  });

  // 5. BRAK CSRF
  it('5. CSRF Protection: request without x-csrf-token returns 403 Forbidden', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/employee/inquiries',
      headers: {
        host: TEST_HOST,
        origin: TEST_ORIGIN,
        cookie: sessionCookieA
        // Missing CSRF header
      },
      payload: {
        offerId: offerA1Id,
        idempotencyKey: 'b0000000-0000-4000-8000-000000000006',
        contractParty: 'CONSUMER',
        contactName: 'Adam Actionowski',
        contactEmail: emailA,
        contactPhone: '+48 501 234 567',
        consentPrivacy: true
      }
    });

    expect(res.statusCode).toBe(403);
  });

  // 6. OFERTA NIEAKTYWNA / AUTO ZARCHIWIZOWANE
  it('6. Inactive/Archived Offer: submitting on archived car returns 409 Conflict', async () => {
    const headersA = await getCsrfHeaders(sessionCookieA);

    const res = await app.inject({
      method: 'POST',
      url: '/api/employee/inquiries',
      headers: headersA,
      payload: {
        offerId: offerAArchivedId,
        idempotencyKey: 'b0000000-0000-4000-8000-000000000007',
        contractParty: 'CONSUMER',
        contactName: 'Adam Actionowski',
        contactEmail: emailA,
        contactPhone: '+48 501 234 567',
        consentPrivacy: true
      }
    });

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).message).toContain('Ta oferta nie jest już dostępna');
  });

  // 7. CONTRACT PARTY NIEDOZWOLONY (SEMANTYKA ANY / SUMA)
  it('7. Contract Party: ANY semantics across multiple product overrides', async () => {
    // Setup 2 financing products and overrides on Program A
    await prisma.financingProduct.createMany({
      data: [
        {
          id: financingProd1Id,
          name: 'Leasing B2B Pro',
          category: 'leasing',
          referenceRate: 5.5,
          margin: 2.0,
          commission: 1.0,
          maxInitialPayment: 45.0,
          maxFinalPayment: 30.0,
          minInstallments: 24,
          maxInstallments: 60
        },
        {
          id: financingProd2Id,
          name: 'Wynajem Firmowy',
          category: 'rental',
          referenceRate: 5.5,
          margin: 2.0,
          commission: 1.0,
          maxInitialPayment: 45.0,
          maxFinalPayment: 30.0,
          minInstallments: 24,
          maxInstallments: 60
        }
      ]
    });

    // Override 1 allows ONLY EMPLOYEE_B2B
    await prisma.employeeProductOverride.create({
      data: {
        programId: programAId,
        financingProductId: financingProd1Id,
        isEnabled: true,
        allowedContractParties: ['EMPLOYEE_B2B']
      }
    });

    // Override 2 allows ONLY EMPLOYER_COMPANY
    await prisma.employeeProductOverride.create({
      data: {
        programId: programAId,
        financingProductId: financingProd2Id,
        isEnabled: true,
        allowedContractParties: ['EMPLOYER_COMPANY']
      }
    });

    const headersA = await getCsrfHeaders(sessionCookieA);

    // Case A: EMPLOYEE_B2B is allowed by Override 1 -> SUCCEEDS (201 Created)
    const b2bRes = await app.inject({
      method: 'POST',
      url: '/api/employee/inquiries',
      headers: headersA,
      payload: {
        offerId: offerA1Id,
        idempotencyKey: 'b0000000-0000-4000-8000-000000000008',
        contractParty: 'EMPLOYEE_B2B',
        contactName: 'Adam Actionowski',
        contactEmail: emailA,
        contactPhone: '+48 501 234 567',
        nip: '1234567890',
        consentPrivacy: true
      }
    });
    expect(b2bRes.statusCode).toBe(201);

    // Case B: CONSUMER is not allowed by ANY override -> FAILS (400 Bad Request)
    const consumerRes = await app.inject({
      method: 'POST',
      url: '/api/employee/inquiries',
      headers: headersA,
      payload: {
        offerId: offerA1Id,
        idempotencyKey: 'b0000000-0000-4000-8000-000000000009',
        contractParty: 'CONSUMER',
        contactName: 'Adam Actionowski',
        contactEmail: emailA,
        contactPhone: '+48 501 234 567',
        consentPrivacy: true
      }
    });
    expect(consumerRes.statusCode).toBe(400);
    expect(JSON.parse(consumerRes.body).message).toContain('Wybrana strona umowy nie jest dozwolona w tym programie');
  });

  // 8. TRANSAKCYJNOŚĆ
  it('8. Transactionality: atomic creation of EmployeeInquiry and Lead', async () => {
    // Both EmployeeInquiry and Lead must exist in DB and point to each other
    const inquiry = await prisma.employeeInquiry.findUnique({
      where: { idempotencyKey: 'b0000000-0000-4000-8000-000000000008' },
      include: { lead: true }
    });

    expect(inquiry).not.toBeNull();
    expect(inquiry?.leadId).toBeDefined();
    expect(inquiry?.lead?.listingId).toBe('test-listing-inq-active');
    expect(inquiry?.lead?.leadType).toBe('employee');
  });

  // 9. ZGODA RODO (§3.1a)
  it('9. Privacy Consent (RODO): consentPrivacy=false or omitted returns 400 without creating Lead; true records consentPrivacyAt', async () => {
    const headersA = await getCsrfHeaders(sessionCookieA);

    // False consent -> 400
    const resFalse = await app.inject({
      method: 'POST',
      url: '/api/employee/inquiries',
      headers: headersA,
      payload: {
        offerId: offerA1Id,
        idempotencyKey: 'b0000000-0000-4000-8000-000000000010',
        contractParty: 'EMPLOYEE_B2B',
        contactName: 'Adam Actionowski',
        contactEmail: emailA,
        contactPhone: '+48 501 234 567',
        nip: '1234567890',
        consentPrivacy: false
      }
    });
    expect(resFalse.statusCode).toBe(400);

    // Verify no lead created
    const leadFalse = await prisma.lead.findFirst({
      where: { message: { contains: '000000000010' } }
    });
    expect(leadFalse).toBeNull();

    // True consent -> 201 and Lead.consentPrivacyAt is set
    const resTrue = await app.inject({
      method: 'POST',
      url: '/api/employee/inquiries',
      headers: headersA,
      payload: {
        offerId: offerA1Id,
        idempotencyKey: 'b0000000-0000-4000-8000-000000000011',
        contractParty: 'EMPLOYEE_B2B',
        contactName: 'Adam Actionowski',
        contactEmail: emailA,
        contactPhone: '+48 501 234 567',
        nip: '1234567890',
        consentPrivacy: true
      }
    });
    expect(resTrue.statusCode).toBe(201);

    const createdInq = await prisma.employeeInquiry.findUnique({
      where: { idempotencyKey: 'b0000000-0000-4000-8000-000000000011' },
      include: { lead: true }
    });
    expect(createdInq?.lead?.consentPrivacyAt).not.toBeNull();
    expect(createdInq?.lead?.consentMarketingAt).toBeNull();
  });
});
