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
        id: { in: ['test-listing-yaris', 'test-listing-tayron', 'test-listing-bmw', 'test-listing-archived', 'test-listing-inactive', 'test-listing-corolla', 'test-listing-rav4'] }
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

  describe('Stage E1: Scope Rules (Katalog Pełny) and Exception Handling', () => {
    let corollaOfferId: string;

    beforeAll(async () => {
      // Seed NEW Listings
      await prisma.listing.create({
        data: {
          id: 'test-listing-corolla',
          make: 'Toyota',
          model: 'Corolla',
          version: '1.8 Hybrid Comfort',
          productionYear: 2026,
          mileageKm: 0,
          pricePln: 100000,
          fuelType: 'HYBRID',
          transmission: 'AUTOMATIC',
          bodyType: 'SEDAN',
          condition: 'NEW',
          isReserved: false,
          isArchived: false
        }
      });

      await prisma.listing.create({
        data: {
          id: 'test-listing-rav4',
          make: 'Toyota',
          model: 'RAV4',
          version: '2.5 Hybrid Selection',
          productionYear: 2026,
          mileageKm: 0,
          pricePln: 180000,
          fuelType: 'HYBRID',
          transmission: 'AUTOMATIC',
          bodyType: 'SUV',
          condition: 'NEW',
          isReserved: false,
          isArchived: false
        }
      });
    });

    afterAll(async () => {
      // Reset Program A scope rule
      await prisma.employeeProgram.update({
        where: { id: programAId },
        data: {
          scopeIncludeNew: false,
          scopeDiscountPct: null
        }
      });
      await prisma.employeeProgramOffer.deleteMany({
        where: {
          programId: programAId,
          OR: [
            { listingId: { in: ['test-listing-corolla', 'test-listing-rav4'] } },
            { sourceType: 'RENTAL' }
          ]
        }
      });
    });

    it('5. Enables scopeIncludeNew on Program A: NEW listings are automatically included with scope discount', async () => {
      // Update Program A: enable scopeIncludeNew with 7% discount
      await prisma.employeeProgram.update({
        where: { id: programAId },
        data: {
          scopeIncludeNew: true,
          scopeDiscountPct: 7.0
        }
      });

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

      // Program A has: Yaris (exception 8%), Tayron (exception 8%), Corolla (scope 7%), RAV4 (scope 7%)
      // Exactly 4 offers, no duplicates!
      expect(body.offers.length).toBe(4);

      const corollaOffer = body.offers.find((o: any) => o.id === 'listing-test-listing-corolla');
      expect(corollaOffer).toBeDefined();
      expect(corollaOffer.vehicle.make).toBe('Toyota');
      expect(corollaOffer.vehicle.model).toBe('Corolla');
      expect(corollaOffer.pricing.listPricePln).toBe(100000);
      expect(corollaOffer.pricing.employeePricePln).toBe(93000); // 100,000 * (1 - 0.07)
      expect(corollaOffer.pricing.savingsPln).toBe(7000);
      expect(corollaOffer.pricing.discountPct).toBe(7.0);

      // Yaris is STILL present with its exception pricing (8%), NOT scope pricing (7%)
      const yarisOffer = body.offers.find((o: any) => o.id === offerA1Id);
      expect(yarisOffer).toBeDefined();
      expect(yarisOffer.pricing.discountPct).toBe(8.0);
      expect(yarisOffer.pricing.employeePricePln).toBe(66148);

      // Verify no duplicate Yaris
      const yarisMatches = body.offers.filter((o: any) => o.vehicle.model === 'Yaris');
      expect(yarisMatches.length).toBe(1);
    });

    it('6. Exception overrides scope discount and deactivation safely falls back to scope rule', async () => {
      // Create explicit exception offer for Corolla with 12% discount
      const offer = await prisma.employeeProgramOffer.create({
        data: {
          programId: programAId,
          sourceType: 'FINANCING',
          listingId: 'test-listing-corolla',
          discountPct: 12.0,
          isActive: true
        }
      });
      corollaOfferId = offer.id;

      // 1) Fetch catalog: Corolla now uses the CUID and 12% discount
      const resActive = await app.inject({
        method: 'GET',
        url: '/api/employee/offers',
        headers: {
          host: TEST_HOST,
          origin: TEST_ORIGIN,
          cookie: sessionCookieA
        }
      });
      const activeBody = JSON.parse(resActive.body);
      const activeCorolla = activeBody.offers.find((o: any) => o.vehicle.model === 'Corolla');
      expect(activeCorolla).toBeDefined();
      expect(activeCorolla.id).toBe(corollaOfferId);
      expect(activeCorolla.pricing.discountPct).toBe(12.0);
      expect(activeCorolla.pricing.employeePricePln).toBe(88000);

      // 2) Deactivate exception offer: isActive = false
      await prisma.employeeProgramOffer.update({
        where: { id: corollaOfferId },
        data: { isActive: false }
      });

      // 3) Fetch catalog: Corolla is still returned via scope rule, but discount falls back to scopeDiscountPct (7%)!
      const resInactive = await app.inject({
        method: 'GET',
        url: '/api/employee/offers',
        headers: {
          host: TEST_HOST,
          origin: TEST_ORIGIN,
          cookie: sessionCookieA
        }
      });
      const inactiveBody = JSON.parse(resInactive.body);
      const inactiveCorolla = inactiveBody.offers.find((o: any) => o.vehicle.model === 'Corolla');
      expect(inactiveCorolla).toBeDefined();
      expect(inactiveCorolla.id).toBe('listing-test-listing-corolla');
      expect(inactiveCorolla.pricing.discountPct).toBe(7.0);
      expect(inactiveCorolla.pricing.employeePricePln).toBe(93000);
    });

    it('7. Exclusion (isExcluded: true, isActive: true) removes vehicle from catalog; deactivated exclusion (isActive: false) restores it', async () => {
      // 1) Set exception to isExcluded = true, isActive = true -> vehicle is excluded
      await prisma.employeeProgramOffer.update({
        where: { id: corollaOfferId },
        data: { isExcluded: true, isActive: true }
      });

      const resExcluded = await app.inject({
        method: 'GET',
        url: '/api/employee/offers',
        headers: {
          host: TEST_HOST,
          origin: TEST_ORIGIN,
          cookie: sessionCookieA
        }
      });
      expect(resExcluded.statusCode).toBe(200);
      const excludedBody = JSON.parse(resExcluded.body);

      // Corolla must NOT be in the catalog at all
      const corollaMatch = excludedBody.offers.find((o: any) => o.vehicle.model === 'Corolla');
      expect(corollaMatch).toBeUndefined();

      // Direct lookup of virtual listing ID should also return 404 when actively excluded
      const resExcludedDirect = await app.inject({
        method: 'GET',
        url: '/api/employee/offers/listing-test-listing-corolla',
        headers: {
          host: TEST_HOST,
          origin: TEST_ORIGIN,
          cookie: sessionCookieA
        }
      });
      expect(resExcludedDirect.statusCode).toBe(404);

      // 2) Deactivate exclusion: isActive = false -> exclusion is disabled, vehicle restores to catalog!
      await prisma.employeeProgramOffer.update({
        where: { id: corollaOfferId },
        data: { isExcluded: true, isActive: false }
      });

      const resRestored = await app.inject({
        method: 'GET',
        url: '/api/employee/offers',
        headers: {
          host: TEST_HOST,
          origin: TEST_ORIGIN,
          cookie: sessionCookieA
        }
      });
      expect(resRestored.statusCode).toBe(200);
      const restoredBody = JSON.parse(resRestored.body);

      const restoredCorolla = restoredBody.offers.find((o: any) => o.vehicle.model === 'Corolla');
      expect(restoredCorolla).toBeDefined();
      expect(restoredCorolla.id).toBe('listing-test-listing-corolla');

      // Direct lookup also works again
      const resRestoredDirect = await app.inject({
        method: 'GET',
        url: '/api/employee/offers/listing-test-listing-corolla',
        headers: {
          host: TEST_HOST,
          origin: TEST_ORIGIN,
          cookie: sessionCookieA
        }
      });
      expect(resRestoredDirect.statusCode).toBe(200);

      // Clean up offer
      await prisma.employeeProgramOffer.delete({
        where: { id: corollaOfferId }
      });
    });

    it('8. Keyset pagination works without P2025 across scope items and exceptions', async () => {
      // Program A has: Yaris, Tayron, Corolla, RAV4
      // Fetch page 1 with limit=2
      const resPage1 = await app.inject({
        method: 'GET',
        url: '/api/employee/offers?limit=2',
        headers: {
          host: TEST_HOST,
          origin: TEST_ORIGIN,
          cookie: sessionCookieA
        }
      });
      expect(resPage1.statusCode).toBe(200);
      const body1 = JSON.parse(resPage1.body);
      expect(body1.offers.length).toBe(2);
      expect(body1.nextCursor).toBeDefined();

      // Fetch page 2 with nextCursor
      const resPage2 = await app.inject({
        method: 'GET',
        url: `/api/employee/offers?limit=2&cursor=${body1.nextCursor}`,
        headers: {
          host: TEST_HOST,
          origin: TEST_ORIGIN,
          cookie: sessionCookieA
        }
      });
      expect(resPage2.statusCode).toBe(200);
      const body2 = JSON.parse(resPage2.body);
      expect(body2.offers.length).toBe(2);

      // Ensure no overlapping items between page 1 and page 2
      const page1Ids = body1.offers.map((o: any) => o.id);
      const page2Ids = body2.offers.map((o: any) => o.id);
      for (const id of page1Ids) {
        expect(page2Ids).not.toContain(id);
      }
    });

    it('9. GET /api/employee/offers/:offerId resolves virtual listing ID (listing-{id})', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/employee/offers/listing-test-listing-corolla',
        headers: {
          host: TEST_HOST,
          origin: TEST_ORIGIN,
          cookie: sessionCookieA
        }
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.id).toBe('listing-test-listing-corolla');
      expect(body.vehicle.model).toBe('Corolla');
      expect(body.pricing.discountPct).toBe(7.0);
      expect(body.pricing.employeePricePln).toBe(93000);
    });

    it('10. RENTAL offers (sourceType: RENTAL, listingId: null) are intentionally omitted from catalog in Stage E1', async () => {
      // Seed a RENTAL offer with listingId = null on Program A
      const rentalOffer = await prisma.employeeProgramOffer.create({
        data: {
          programId: programAId,
          sourceType: 'RENTAL',
          listingId: null,
          discountPct: 0,
          isActive: true
        }
      });

      // 1) List endpoint: query returns 200 OK without crashing; RENTAL offer is intentionally omitted
      const resList = await app.inject({
        method: 'GET',
        url: '/api/employee/offers',
        headers: {
          host: TEST_HOST,
          origin: TEST_ORIGIN,
          cookie: sessionCookieA
        }
      });
      expect(resList.statusCode).toBe(200);
      const listBody = JSON.parse(resList.body);
      const rentalInList = listBody.offers.find((o: any) => o.id === rentalOffer.id);
      expect(rentalInList).toBeUndefined();

      // 2) Single offer endpoint: returns 404 (handled in E3 with rate matrix resolution)
      const resSingle = await app.inject({
        method: 'GET',
        url: `/api/employee/offers/${rentalOffer.id}`,
        headers: {
          host: TEST_HOST,
          origin: TEST_ORIGIN,
          cookie: sessionCookieA
        }
      });
      expect(resSingle.statusCode).toBe(404);

      // Clean up
      await prisma.employeeProgramOffer.delete({
        where: { id: rentalOffer.id }
      });
    });
  });
});

