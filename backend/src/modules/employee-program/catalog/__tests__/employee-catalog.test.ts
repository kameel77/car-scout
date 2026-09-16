import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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

describe('Employee Catalog Real DB & Redis Integration Tests (P3b)', () => {
  if (process.env.EMPLOYEE_INTEGRATION_RUNNER_MARKER !== 'EMPLOYEE_INTEGRATION_RUNNER_ACTIVE_SAFE_V1') {
    it.skip('SKIPPED: Integration tests require dedicated disposable environment via `node scripts/test-employee-integration.mjs`', () => {});
    return;
  }

  let app: FastifyInstance;
  let prisma: PrismaClient;
  let redis: Redis;

  const companyAId = 'test-company-action-p3b';
  const programAId = 'test-program-action-p3b';
  const companyBId = 'test-company-finarena-p3b';
  const programBId = 'test-program-finarena-p3b';

  const plainCodeA = 'ACTION-CATALOG-2026';
  const plainCodeB = 'FINARENA-CATALOG-2026';

  const emailA = 'pracownik.action@action.pl';
  const emailB = 'pracownik.finarena@finarena.pl';
  const testPassword = 'Password123!';

  let sessionCookieA: string;
  let sessionCookieB: string;

  let offerA1Id: string;
  let offerA2Id: string;
  let offerA3ArchivedId: string;
  let offerA4InactiveId: string;
  let offerA5NullListingId: string;
  let offerB1Id: string;

  let listing1InitialUpdatedAt: Date;
  let listing2InitialUpdatedAt: Date;

  async function cleanupTestData() {
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
        id: { in: ['test-listing-yaris', 'test-listing-tayron', 'test-listing-bmw', 'test-listing-archived', 'test-listing-inactive'] }
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
        name: 'Action S.A.',
        slug: 'action-p3b',
        isActive: true
      }
    });

    await prisma.employeeProgram.create({
      data: {
        id: programAId,
        companyId: companyAId,
        name: 'Action Auto Program',
        slug: 'action-auto-p3b',
        isActive: true,
        defaultDiscountPct: 5.0
      }
    });

    await prisma.employeeCompany.create({
      data: {
        id: companyBId,
        name: 'Finarena Sp. z o.o.',
        slug: 'finarena-p3b',
        isActive: true
      }
    });

    await prisma.employeeProgram.create({
      data: {
        id: programBId,
        companyId: companyBId,
        name: 'Finarena Program Pracowniczy',
        slug: 'finarena-auto-p3b',
        isActive: true,
        defaultDiscountPct: 8.0
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

    // 3. Register and authenticate Employee A
    const csrfResA = await app.inject({
      method: 'GET',
      url: '/api/employee/auth/csrf',
      headers: { host: TEST_HOST, origin: TEST_ORIGIN }
    });
    const csrfTokenA = JSON.parse(csrfResA.body).csrfToken;
    const csrfCookieA = csrfResA.headers['set-cookie'] as string;

    const regResA = await app.inject({
      method: 'POST',
      url: '/api/employee/auth/register',
      headers: {
        host: TEST_HOST,
        origin: TEST_ORIGIN,
        cookie: csrfCookieA,
        [CSRF_HEADER_NAME]: csrfTokenA
      },
      payload: {
        code: plainCodeA,
        email: emailA,
        password: testPassword,
        firstName: 'Adam',
        lastName: 'Actionowski'
      }
    });
    function extractSessionCookie(setCookiesHeader: unknown): string {
      const list = Array.isArray(setCookiesHeader) ? setCookiesHeader : [setCookiesHeader as string];
      const sessionHeader = list.find((c) => c && c.startsWith(`${SESSION_COOKIE_NAME}=`));
      const match = sessionHeader?.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
      return `${SESSION_COOKIE_NAME}=${match ? match[1] : ''}`;
    }

    expect(regResA.statusCode).toBe(201);
    sessionCookieA = extractSessionCookie(regResA.headers['set-cookie']);

    // 4. Register and authenticate Employee B
    const csrfResB = await app.inject({
      method: 'GET',
      url: '/api/employee/auth/csrf',
      headers: { host: TEST_HOST, origin: TEST_ORIGIN }
    });
    const csrfTokenB = JSON.parse(csrfResB.body).csrfToken;
    const csrfCookieB = csrfResB.headers['set-cookie'] as string;

    const regResB = await app.inject({
      method: 'POST',
      url: '/api/employee/auth/register',
      headers: {
        host: TEST_HOST,
        origin: TEST_ORIGIN,
        cookie: csrfCookieB,
        [CSRF_HEADER_NAME]: csrfTokenB
      },
      payload: {
        code: plainCodeB,
        email: emailB,
        password: testPassword,
        firstName: 'Filip',
        lastName: 'Finarenowski'
      }
    });
    expect(regResB.statusCode).toBe(201);
    sessionCookieB = extractSessionCookie(regResB.headers['set-cookie']);

    // 5. Seed Listings in Motolia database
    const yarisListing = await prisma.listing.create({
      data: {
        id: 'test-listing-yaris',
        make: 'Toyota',
        model: 'Yaris',
        version: 'Yaris Hybrid 1.5 Comfort',
        productionYear: 2026,
        mileageKm: 5,
        pricePln: 71900,
        fuelType: 'HYBRID',
        transmission: 'AUTOMATIC',
        bodyType: 'HATCHBACK',
        primaryImageUrl: 'https://images.motolia.pl/yaris-main.jpg',
        imageUrls: [
          'https://images.motolia.pl/yaris-1.jpg',
          'https://images.motolia.pl/yaris-2.jpg',
          'https://images.motolia.pl/yaris-3.jpg',
          'https://images.motolia.pl/yaris-4.jpg',
          'https://images.motolia.pl/yaris-5.jpg',
          'https://images.motolia.pl/yaris-6-overflow.jpg'
        ],
        isArchived: false
      }
    });
    listing1InitialUpdatedAt = yarisListing.updatedAt;

    const tayronListing = await prisma.listing.create({
      data: {
        id: 'test-listing-tayron',
        make: 'Volkswagen',
        model: 'Tayron',
        version: 'Tayron 1.5 eTSI Elegance',
        productionYear: 2026,
        mileageKm: 10,
        pricePln: 173900,
        fuelType: 'MILD_HYBRID',
        transmission: 'AUTOMATIC',
        bodyType: 'SUV',
        primaryImageUrl: 'https://images.motolia.pl/tayron-main.jpg',
        imageUrls: ['https://images.motolia.pl/tayron-1.jpg'],
        isArchived: false
      }
    });
    listing2InitialUpdatedAt = tayronListing.updatedAt;

    await prisma.listing.create({
      data: {
        id: 'test-listing-bmw',
        make: 'BMW',
        model: '320i',
        version: 'M Sport',
        productionYear: 2026,
        mileageKm: 0,
        pricePln: 220000,
        fuelType: 'PETROL',
        transmission: 'AUTOMATIC',
        bodyType: 'SEDAN',
        isArchived: false
      }
    });

    await prisma.listing.create({
      data: {
        id: 'test-listing-archived',
        make: 'Audi',
        model: 'A4',
        productionYear: 2025,
        mileageKm: 25000,
        pricePln: 140000,
        isArchived: true
      }
    });

    await prisma.listing.create({
      data: {
        id: 'test-listing-inactive',
        make: 'Skoda',
        model: 'Octavia',
        productionYear: 2026,
        mileageKm: 0,
        pricePln: 110000,
        isArchived: false
      }
    });

    // 6. Seed Benefit Policy for Program A
    const benefitPolicyA = await prisma.employeeBenefitPolicy.create({
      data: {
        programId: programAId,
        name: 'Pakiet Powitalny Moya',
        moyaCardAmount: 500,
        fuelDiscount: '15 gr/l',
        consultantCare: true,
        termsText: 'Regulamin programu korzyści Moya 2026'
      }
    });

    // 7. Seed Offers for Program A
    const offerA1 = await prisma.employeeProgramOffer.create({
      data: {
        programId: programAId,
        sourceType: 'FINANCING',
        listingId: 'test-listing-yaris',
        discountPct: 8.0,
        benefitPolicyId: benefitPolicyA.id,
        isActive: true
      }
    });
    offerA1Id = offerA1.id;

    const offerA2 = await prisma.employeeProgramOffer.create({
      data: {
        programId: programAId,
        sourceType: 'FINANCING',
        listingId: 'test-listing-tayron',
        discountPct: 8.0,
        isActive: true
      }
    });
    offerA2Id = offerA2.id;

    const offerA3 = await prisma.employeeProgramOffer.create({
      data: {
        programId: programAId,
        sourceType: 'FINANCING',
        listingId: 'test-listing-archived',
        discountPct: 8.0,
        isActive: true
      }
    });
    offerA3ArchivedId = offerA3.id;

    const offerA4 = await prisma.employeeProgramOffer.create({
      data: {
        programId: programAId,
        sourceType: 'FINANCING',
        listingId: 'test-listing-inactive',
        discountPct: 5.0,
        isActive: false
      }
    });
    offerA4InactiveId = offerA4.id;

    // Pułapka 2: Offer with listingId: null in PostgreSQL
    const offerA5 = await prisma.employeeProgramOffer.create({
      data: {
        programId: programAId,
        sourceType: 'FINANCING',
        listingId: null,
        discountPct: 5.0,
        isActive: true
      }
    });
    offerA5NullListingId = offerA5.id;

    // 8. Seed Offer for Program B
    const offerB1 = await prisma.employeeProgramOffer.create({
      data: {
        programId: programBId,
        sourceType: 'FINANCING',
        listingId: 'test-listing-bmw',
        discountPct: 10.0,
        isActive: true
      }
    });
    offerB1Id = offerB1.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('1. CRITICAL: Enforces strict tenant isolation and filters inactive/archived offers', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/employee/offers',
      headers: {
        host: TEST_HOST,
        origin: TEST_ORIGIN,
        cookie: sessionCookieA
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(Array.isArray(body.offers)).toBe(true);
    // Program A should see EXACTLY 2 offers: Yaris and Tayron
    expect(body.offers.length).toBe(2);

    const offerIds = body.offers.map((o: any) => o.id);
    expect(offerIds).toContain(offerA1Id);
    expect(offerIds).toContain(offerA2Id);

    // Assert zero leaked offers from Program B!
    expect(offerIds).not.toContain(offerB1Id);

    // Assert excluded: archived listing, inactive offer, and broken null-listing offer
    expect(offerIds).not.toContain(offerA3ArchivedId);
    expect(offerIds).not.toContain(offerA4InactiveId);
    expect(offerIds).not.toContain(offerA5NullListingId);

    // Verify Yaris payload and pricing
    const yaris = body.offers.find((o: any) => o.id === offerA1Id);
    expect(yaris).toBeDefined();
    expect(yaris.vehicle.make).toBe('Toyota');
    expect(yaris.vehicle.model).toBe('Yaris');
    expect(yaris.pricing.listPricePln).toBe(71900);
    expect(yaris.pricing.employeePricePln).toBe(66148);
    expect(yaris.pricing.savingsPln).toBe(5752);
    expect(yaris.pricing.discountPct).toBe(8.0);

    // Verify imageUrls truncated to max 5 items
    expect(yaris.vehicle.imageUrls.length).toBe(5);
    expect(yaris.vehicle.imageUrls).not.toContain('https://images.motolia.pl/yaris-6-overflow.jpg');

    // Verify Benefit Policy payload
    expect(yaris.benefit).not.toBeNull();
    expect(yaris.benefit.name).toBe('Pakiet Powitalny Moya');
    expect(yaris.benefit.moyaCardAmount).toBe(500);
    expect(yaris.benefit.fuelDiscount).toBe('15 gr/l');
    expect(yaris.benefit.consultantCare).toBe(true);

    // Verify Tayron payload and pricing
    const tayron = body.offers.find((o: any) => o.id === offerA2Id);
    expect(tayron).toBeDefined();
    expect(tayron.vehicle.make).toBe('Volkswagen');
    expect(tayron.pricing.listPricePln).toBe(173900);
    expect(tayron.pricing.employeePricePln).toBe(159988);
    expect(tayron.pricing.savingsPln).toBe(13912);
    expect(tayron.pricing.discountPct).toBe(8.0);
    expect(tayron.benefit).toBeNull();
  });

  it('1b. Malicious query parameter override: passing ?programId=foreign does not bypass tenant isolation', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/employee/offers?programId=${programBId}`,
      headers: {
        host: TEST_HOST,
        origin: TEST_ORIGIN,
        cookie: sessionCookieA
      }
    });

    // When Zod validates query, programId in query is either stripped or ignored, but NEVER used to load program B offers!
    const body = JSON.parse(res.body);
    const offerIds = (body.offers || []).map((o: any) => o.id);
    // MUST NOT return Program B offers!
    expect(offerIds).not.toContain(offerB1Id);
    expect(offerIds).toContain(offerA1Id);
  });

  it('2. Tenant isolation on GET /api/employee/offers/:offerId returns 404 for foreign offers', async () => {
    // Employee A attempts to view Program B's offer
    const resForbidden = await app.inject({
      method: 'GET',
      url: `/api/employee/offers/${offerB1Id}`,
      headers: {
        host: TEST_HOST,
        origin: TEST_ORIGIN,
        cookie: sessionCookieA
      }
    });

    // MUST be 404, never 403 (to prevent tenant probing)
    expect(resForbidden.statusCode).toBe(404);
    const json = JSON.parse(resForbidden.body);
    expect(json.error).toBe('Not Found');

    // Employee A requests their own offer -> 200
    const resOwn = await app.inject({
      method: 'GET',
      url: `/api/employee/offers/${offerA1Id}`,
      headers: {
        host: TEST_HOST,
        origin: TEST_ORIGIN,
        cookie: sessionCookieA
      }
    });
    expect(resOwn.statusCode).toBe(200);
    const ownBody = JSON.parse(resOwn.body);
    expect(ownBody.id).toBe(offerA1Id);
    expect(ownBody.pricing.employeePricePln).toBe(66148);

    // Employee A requests broken null-listing offer -> 404
    const resNullListing = await app.inject({
      method: 'GET',
      url: `/api/employee/offers/${offerA5NullListingId}`,
      headers: {
        host: TEST_HOST,
        origin: TEST_ORIGIN,
        cookie: sessionCookieA
      }
    });
    expect(resNullListing.statusCode).toBe(404);
  });

  it('3. Filters results using search parameter (make, model, version) on real DB', async () => {
    // Search for 'yaris' (case-insensitive)
    const resYaris = await app.inject({
      method: 'GET',
      url: '/api/employee/offers?search=yaris',
      headers: {
        host: TEST_HOST,
        origin: TEST_ORIGIN,
        cookie: sessionCookieA
      }
    });
    expect(resYaris.statusCode).toBe(200);
    const yarisList = JSON.parse(resYaris.body).offers;
    expect(yarisList.length).toBe(1);
    expect(yarisList[0].id).toBe(offerA1Id);

    // Search for 'Tayron'
    const resTayron = await app.inject({
      method: 'GET',
      url: '/api/employee/offers?search=Tayron',
      headers: {
        host: TEST_HOST,
        origin: TEST_ORIGIN,
        cookie: sessionCookieA
      }
    });
    expect(resTayron.statusCode).toBe(200);
    const tayronList = JSON.parse(resTayron.body).offers;
    expect(tayronList.length).toBe(1);
    expect(tayronList[0].id).toBe(offerA2Id);

    // Search for non-existent vehicle
    const resNone = await app.inject({
      method: 'GET',
      url: '/api/employee/offers?search=Ferrari',
      headers: {
        host: TEST_HOST,
        origin: TEST_ORIGIN,
        cookie: sessionCookieA
      }
    });
    expect(resNone.statusCode).toBe(200);
    const emptyList = JSON.parse(resNone.body).offers;
    expect(emptyList.length).toBe(0);
  });

  it('4. Read-only guarantee: Listing records remain completely unmutated', async () => {
    const freshListing1 = await prisma.listing.findUnique({
      where: { id: 'test-listing-yaris' }
    });
    const freshListing2 = await prisma.listing.findUnique({
      where: { id: 'test-listing-tayron' }
    });

    expect(freshListing1?.updatedAt.toISOString()).toBe(listing1InitialUpdatedAt.toISOString());
    expect(freshListing2?.updatedAt.toISOString()).toBe(listing2InitialUpdatedAt.toISOString());
  });
});
