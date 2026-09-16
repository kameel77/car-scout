import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
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

describe('Employee Long-Term Rental Real DB & Redis Integration Tests (E3)', () => {
  if (process.env.EMPLOYEE_INTEGRATION_RUNNER_MARKER !== 'EMPLOYEE_INTEGRATION_RUNNER_ACTIVE_SAFE_V1') {
    it.skip('SKIPPED: Integration tests require dedicated disposable environment via `node scripts/test-employee-integration.mjs`', () => {});
    return;
  }

  let app: FastifyInstance;
  let prisma: PrismaClient;
  let redis: Redis;

  const companyAId = 'test-company-rental-a';
  const programAId = 'test-program-rental-a';
  const companyBId = 'test-company-rental-b';
  const programBId = 'test-program-rental-b';

  const plainCodeA = 'RENTAL-CODE-A-2026';
  const plainCodeB = 'RENTAL-CODE-B-2026';

  const emailA = 'pracownik.rental.a@firma-a.pl';
  const emailB = 'pracownik.rental.b@firma-b.pl';
  const testPassword = 'Password123!';

  let sessionCookieA: string;
  let sessionCookieB: string;

  const rentalCompanyAId = 'test-rc-ayvens-e3';
  const rentalCompanyBId = 'test-rc-arval-e3';

  const vehicleAId = 'test-veh-corolla-e3';
  const vehicleBId = 'test-veh-tucson-e3';

  const assignmentAId = 'test-asg-corolla-ayvens-e3';
  const assignmentBId = 'test-asg-tucson-arval-e3';

  const matrixSetAId = 'test-matrix-set-a';
  const matrixVersionAId = 'test-matrix-ver-a';

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
    await prisma.employeeProgramOffer.deleteMany({
      where: { programId: { in: [programAId, programBId] } }
    });
    await prisma.employeeProgramMatrixSet.deleteMany({
      where: { programId: { in: [programAId, programBId] } }
    });
    await prisma.employeeMatrixRow.deleteMany({
      where: { assignmentId: { in: [assignmentAId, assignmentBId] } }
    });
    await prisma.employeeMatrixVersion.deleteMany({
      where: { id: { in: [matrixVersionAId] } }
    });
    await prisma.employeeMatrixSet.deleteMany({
      where: { id: { in: [matrixSetAId] } }
    });
    await prisma.rentalMatrixEntry.deleteMany({
      where: { assignmentId: { in: [assignmentAId, assignmentBId] } }
    });
    await prisma.vehicleRentalAssignment.deleteMany({
      where: { id: { in: [assignmentAId, assignmentBId] } }
    });
    await prisma.rentalVehicle.deleteMany({
      where: { id: { in: [vehicleAId, vehicleBId] } }
    });
    await prisma.rentalCompany.deleteMany({
      where: { id: { in: [rentalCompanyAId, rentalCompanyBId] } }
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
        name: 'Firma Testowa A',
        slug: 'firma-rental-a',
        isActive: true
      }
    });

    await prisma.employeeProgram.create({
      data: {
        id: programAId,
        companyId: companyAId,
        name: 'Program Najmu A',
        slug: 'program-rental-a',
        isActive: true,
        scopeIncludeRental: true,
        scopeIncludeNew: false
      }
    });

    await prisma.employeeCompany.create({
      data: {
        id: companyBId,
        name: 'Firma Testowa B',
        slug: 'firma-rental-b',
        isActive: true
      }
    });

    await prisma.employeeProgram.create({
      data: {
        id: programBId,
        companyId: companyBId,
        name: 'Program Najmu B',
        slug: 'program-rental-b',
        isActive: true,
        scopeIncludeRental: true,
        scopeIncludeNew: false
      }
    });

    // 2. Registration codes & accounts
    const { hashRegistrationCode } = await import('../../auth/employee-auth.service.js');
    await prisma.employeeRegistrationCode.create({
      data: {
        id: 'code-rental-a',
        companyId: companyAId,
        programId: programAId,
        codeHash: hashRegistrationCode(plainCodeA),
        isActive: true
      }
    });

    await prisma.employeeRegistrationCode.create({
      data: {
        id: 'code-rental-b',
        companyId: companyBId,
        programId: programBId,
        codeHash: hashRegistrationCode(plainCodeB),
        isActive: true
      }
    });

    // Register User A
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
        firstName: 'Anna',
        lastName: 'Rentalowa'
      }
    });
    expect(regResA.statusCode).toBe(201);
    sessionCookieA = extractSessionCookie(regResA.headers['set-cookie']);

    // Register User B
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
        firstName: 'Bartek',
        lastName: 'Rentalowy'
      }
    });
    expect(regResB.statusCode).toBe(201);
    sessionCookieB = extractSessionCookie(regResB.headers['set-cookie']);

    // 3. Rental Companies
    await prisma.rentalCompany.create({
      data: {
        id: rentalCompanyAId,
        name: 'Ayvens Polska',
        slug: 'ayvens-polska',
        isActive: true
      }
    });

    await prisma.rentalCompany.create({
      data: {
        id: rentalCompanyBId,
        name: 'Arval Service Lease',
        slug: 'arval-sl',
        isActive: true
      }
    });

    // 4. Rental Vehicles
    await prisma.rentalVehicle.create({
      data: {
        id: vehicleAId,
        make: 'Toyota',
        model: 'Corolla',
        version: '1.8 Hybrid Comfort',
        productionYear: 2026,
        fuelType: 'HYBRID',
        transmission: 'AUTOMATIC',
        bodyType: 'SEDAN',
        isActive: true,
        isPublished: true,
        imageUrls: ['https://img.test/corolla-1.jpg', 'https://img.test/corolla-2.jpg']
      }
    });

    await prisma.rentalVehicle.create({
      data: {
        id: vehicleBId,
        make: 'Hyundai',
        model: 'Tucson',
        version: '1.6 T-GDI Smart',
        productionYear: 2026,
        fuelType: 'BENZYNA',
        transmission: 'AUTOMATIC',
        bodyType: 'SUV',
        isActive: true,
        isPublished: true,
        imageUrls: ['https://img.test/tucson-1.jpg']
      }
    });

    // 5. Vehicle Rental Assignments
    await prisma.vehicleRentalAssignment.create({
      data: {
        id: assignmentAId,
        vehicleId: vehicleAId,
        rentalCompanyId: rentalCompanyAId,
        isActive: true
      }
    });

    await prisma.vehicleRentalAssignment.create({
      data: {
        id: assignmentBId,
        vehicleId: vehicleBId,
        rentalCompanyId: rentalCompanyBId,
        isActive: true
      }
    });

    // 6. Public Rental Matrix Entries for Assignment A (Corolla)
    await prisma.rentalMatrixEntry.createMany({
      data: [
        {
          id: 'rme-a-1',
          assignmentId: assignmentAId,
          contractMonths: 36,
          annualMileageKm: 20000,
          initialPaymentPct: 10,
          initialPaymentAmountNet: 12000,
          initialPaymentAmountGross: 14760,
          monthlyRateNet: 1500,
          monthlyRateGross: 1845,
          offerType: 'all',
          servicesIncluded: ['SERWIS', 'OPONY']
        },
        {
          id: 'rme-a-2',
          assignmentId: assignmentAId,
          contractMonths: 24,
          annualMileageKm: 15000,
          initialPaymentPct: 0,
          initialPaymentAmountNet: 0,
          initialPaymentAmountGross: 0,
          monthlyRateNet: 1800,
          monthlyRateGross: 2214,
          offerType: 'all',
          servicesIncluded: ['SERWIS']
        }
      ]
    });

    // Public Rental Matrix Entry for Assignment B (Tucson)
    await prisma.rentalMatrixEntry.create({
      data: {
        id: 'rme-b-1',
        assignmentId: assignmentBId,
        contractMonths: 36,
        annualMileageKm: 20000,
        initialPaymentPct: 10,
        initialPaymentAmountNet: 15000,
        initialPaymentAmountGross: 18450,
        monthlyRateNet: 2100,
        monthlyRateGross: 2583,
        offerType: 'all',
        servicesIncluded: ['SERWIS', 'OPONY', 'UBEZPIECZENIE']
      }
    });
  });

  afterAll(async () => {
    await cleanupTestData();
    if (redis) {
      await redis.quit();
    }
  });

  // Scenario 1: GET /api/employee/rental-offers returns minMonthlyRateGross and rateSource
  it('1. GET /api/employee/rental-offers returns offers with lowest gross rate and rateSource', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/employee/rental-offers',
      headers: { host: TEST_HOST, origin: TEST_ORIGIN, cookie: sessionCookieA }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.offers).toBeDefined();
    expect(body.offers.length).toBeGreaterThanOrEqual(1);

    const corollaOffer = body.offers.find((o: any) => o.id === `rental-${vehicleAId}`);
    expect(corollaOffer).toBeDefined();
    expect(corollaOffer.sourceType).toBe('RENTAL');
    expect(corollaOffer.vehicle.make).toBe('Toyota');
    expect(corollaOffer.vehicle.model).toBe('Corolla');
    expect(corollaOffer.rental.fromMonthlyRateGross).toBe(1845); // min(1845, 2214)
    expect(corollaOffer.rental.rateSource).toBe('PUBLIC_MATRIX');
    expect(corollaOffer.rental.rentalCompanies).toContain('Ayvens Polska');
  });

  // Scenario 2: GET /api/employee/rental-offers/:id returns details and sorted rentalOptions
  it('2. GET /api/employee/rental-offers/:id returns vehicle specs and sorted rentalOptions', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/employee/rental-offers/rental-${vehicleAId}`,
      headers: { host: TEST_HOST, origin: TEST_ORIGIN, cookie: sessionCookieA }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.id).toBe(`rental-${vehicleAId}`);
    expect(body.sourceType).toBe('RENTAL');
    expect(body.vehicle.make).toBe('Toyota');
    expect(body.rentalOptions).toBeDefined();
    expect(body.rentalOptions.length).toBe(1);

    const option = body.rentalOptions[0];
    expect(option.rentalCompanyName).toBe('Ayvens Polska');
    expect(option.rateSource).toBe('PUBLIC_MATRIX');
    expect(option.rows.length).toBe(2);

    // Verify sorting: contractMonths ascending (24 before 36)
    expect(option.rows[0].contractMonths).toBe(24);
    expect(option.rows[1].contractMonths).toBe(36);
  });

  // Scenario 3: B2B employee gets rateSource: 'EMPLOYEE_MATRIX' when published version is linked
  it('3. B2B employee gets rateSource EMPLOYEE_MATRIX with private matrix linked and published', async () => {
    // Create private matrix set for Ayvens linked to Program A
    await prisma.employeeMatrixSet.create({
      data: {
        id: matrixSetAId,
        rentalCompanyId: rentalCompanyAId,
        name: 'Ayvens Flota Zamknięta dla Firmy A',
        allowedContractParties: ['EMPLOYEE_B2B', 'EMPLOYER_COMPANY'],
        b2cStatus: 'REQUIRES_CONFIRMATION'
      }
    });

    await prisma.employeeProgramMatrixSet.create({
      data: {
        programId: programAId,
        matrixSetId: matrixSetAId
      }
    });

    // Create published matrix version with discounted rates
    await prisma.employeeMatrixVersion.create({
      data: {
        id: matrixVersionAId,
        matrixSetId: matrixSetAId,
        versionNumber: 1,
        label: 'Taryfa Promocyjna B2B Q3',
        status: 'PUBLISHED',
        publishedAt: new Date()
      }
    });

    await prisma.employeeMatrixRow.create({
      data: {
        id: 'emr-a-1',
        versionId: matrixVersionAId,
        assignmentId: assignmentAId,
        contractMonths: 36,
        annualMileageKm: 20000,
        initialPaymentPct: 10,
        initialPaymentAmountNet: 12000,
        monthlyRateNet: 1350, // lower than public 1500
        monthlyRateGross: 1660.5,
        servicesIncluded: ['SERWIS', 'OPONY']
      }
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/employee/rental-offers/rental-${vehicleAId}?contractParty=EMPLOYEE_B2B`,
      headers: { host: TEST_HOST, origin: TEST_ORIGIN, cookie: sessionCookieA }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const option = body.rentalOptions[0];
    expect(option.rateSource).toBe('EMPLOYEE_MATRIX');
    expect(option.matrixVersionId).toBe(matrixVersionAId);

    const row = option.rows.find((r: any) => r.contractMonths === 36 && r.annualMileageKm === 20000);
    expect(row).toBeDefined();
    expect(row.monthlyRateNet).toBe(1350);
  });

  // Scenario 4: CONSUMER employee gets rateSource: 'PUBLIC_MATRIX' even with private matrix linked
  it('4. CONSUMER employee gets PUBLIC_MATRIX rates even with private matrix linked', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/employee/rental-offers/rental-${vehicleAId}?contractParty=CONSUMER`,
      headers: { host: TEST_HOST, origin: TEST_ORIGIN, cookie: sessionCookieA }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const option = body.rentalOptions[0];
    expect(option.rateSource).toBe('PUBLIC_MATRIX');
    expect(option.matrixVersionId).toBeNull();

    // Public row is 1500 net, not private 1350
    const row = option.rows.find((r: any) => r.contractMonths === 36 && r.annualMileageKm === 20000);
    expect(row).toBeDefined();
    expect(row.monthlyRateNet).toBe(1500);
  });

  // Scenario 5: Public fallback when no matrix set linked
  it('5. Public fallback when no matrix set linked to program', async () => {
    // User B program has no matrix sets linked
    const res = await app.inject({
      method: 'GET',
      url: `/api/employee/rental-offers/rental-${vehicleBId}?contractParty=EMPLOYEE_B2B`,
      headers: { host: TEST_HOST, origin: TEST_ORIGIN, cookie: sessionCookieB }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const option = body.rentalOptions[0];
    expect(option.rateSource).toBe('PUBLIC_MATRIX');
  });

  // Scenario 6: Public fallback when matrix set version is DRAFT
  it('6. Public fallback when matrix set version is DRAFT', async () => {
    await prisma.employeeMatrixVersion.update({
      where: { id: matrixVersionAId },
      data: { status: 'DRAFT' }
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/employee/rental-offers/rental-${vehicleAId}?contractParty=EMPLOYEE_B2B`,
      headers: { host: TEST_HOST, origin: TEST_ORIGIN, cookie: sessionCookieA }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.rentalOptions[0].rateSource).toBe('PUBLIC_MATRIX');

    // Restore to PUBLISHED
    await prisma.employeeMatrixVersion.update({
      where: { id: matrixVersionAId },
      data: { status: 'PUBLISHED' }
    });
  });

  // Scenario 7: Public fallback when matrix set version is expired (effectiveTo < now)
  it('7. Public fallback when matrix set version is expired', async () => {
    await prisma.employeeMatrixVersion.update({
      where: { id: matrixVersionAId },
      data: { effectiveTo: new Date(Date.now() - 86400000) } // expired yesterday
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/employee/rental-offers/rental-${vehicleAId}?contractParty=EMPLOYEE_B2B`,
      headers: { host: TEST_HOST, origin: TEST_ORIGIN, cookie: sessionCookieA }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.rentalOptions[0].rateSource).toBe('PUBLIC_MATRIX');

    // Remove expiration date
    await prisma.employeeMatrixVersion.update({
      where: { id: matrixVersionAId },
      data: { effectiveTo: null }
    });
  });

  // Scenario 8: Excluded rental assignment not returned in catalog list
  it('8. Excluded rental assignment is not returned in catalog list', async () => {
    // Create an exclusion offer for Assignment A in Program A
    const exclusion = await prisma.employeeProgramOffer.create({
      data: {
        id: 'exclusion-asg-a',
        programId: programAId,
        assignmentId: assignmentAId,
        sourceType: 'RENTAL',
        isExcluded: true,
        isActive: true
      }
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/employee/rental-offers',
      headers: { host: TEST_HOST, origin: TEST_ORIGIN, cookie: sessionCookieA }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const corollaOffer = body.offers.find((o: any) => o.id === `rental-${vehicleAId}`);
    expect(corollaOffer).toBeUndefined();

    // Clean up exclusion for next tests
    await prisma.employeeProgramOffer.delete({ where: { id: exclusion.id } });
  });

  // Scenario 9: Direct GET /rental-offers/:id for excluded assignment returns 404
  it('9. Direct GET /rental-offers/:id for excluded assignment returns 404', async () => {
    const exclusion = await prisma.employeeProgramOffer.create({
      data: {
        id: 'exclusion-asg-a-direct',
        programId: programAId,
        assignmentId: assignmentAId,
        sourceType: 'RENTAL',
        isExcluded: true,
        isActive: true
      }
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/employee/rental-offers/rental-${vehicleAId}`,
      headers: { host: TEST_HOST, origin: TEST_ORIGIN, cookie: sessionCookieA }
    });

    expect(res.statusCode).toBe(404);

    // Deactivating exclusion restores access
    await prisma.employeeProgramOffer.update({
      where: { id: exclusion.id },
      data: { isActive: false }
    });

    const restoredRes = await app.inject({
      method: 'GET',
      url: `/api/employee/rental-offers/rental-${vehicleAId}`,
      headers: { host: TEST_HOST, origin: TEST_ORIGIN, cookie: sessionCookieA }
    });

    expect(restoredRes.statusCode).toBe(200);

    await prisma.employeeProgramOffer.delete({ where: { id: exclusion.id } });
  });

  // Scenario 10: scopeIncludeRental: false returns empty [] in list and 404 in details
  it('10. scopeIncludeRental: false returns empty [] in list and 404 in details', async () => {
    await prisma.employeeProgram.update({
      where: { id: programAId },
      data: { scopeIncludeRental: false }
    });

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/employee/rental-offers',
      headers: { host: TEST_HOST, origin: TEST_ORIGIN, cookie: sessionCookieA }
    });

    expect(listRes.statusCode).toBe(200);
    const listBody = JSON.parse(listRes.body);
    expect(listBody.offers).toEqual([]);
    expect(listBody.nextCursor).toBeNull();

    const detailRes = await app.inject({
      method: 'GET',
      url: `/api/employee/rental-offers/rental-${vehicleAId}`,
      headers: { host: TEST_HOST, origin: TEST_ORIGIN, cookie: sessionCookieA }
    });

    expect(detailRes.statusCode).toBe(404);

    // Restore scopeIncludeRental
    await prisma.employeeProgram.update({
      where: { id: programAId },
      data: { scopeIncludeRental: true }
    });
  });

  // Scenario 11: POST /api/employee/inquiries creates EmployeeInquiry and Lead with rental fields
  it('11. POST /api/employee/inquiries creates EmployeeInquiry (RENTAL, PP-...) and Lead with rental* fields', async () => {
    const csrfHeaders = await getCsrfHeaders(sessionCookieA);

    const payload = {
      offerId: `rental-${vehicleAId}`,
      idempotencyKey: crypto.randomUUID(),
      contractParty: 'EMPLOYEE_B2B',
      nip: '5252525252',
      contactName: 'Anna Rentalowa',
      contactEmail: 'anna.rentalowa@firma-a.pl',
      contactPhone: '+48 500 600 700',
      consentPrivacy: true,
      notes: 'Proszę o kontakt w godzinach porannych',
      rentalSelection: {
        assignmentId: assignmentAId,
        contractMonths: 36,
        annualMileageKm: 20000,
        initialPaymentPct: 10,
        initialPaymentAmountNet: 12000
      }
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/employee/inquiries',
      headers: csrfHeaders,
      payload
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.inquiry).toBeDefined();
    expect(body.inquiry.id).toBeDefined();
    expect(body.inquiry.referenceNumber).toMatch(/^PP-\d+$/);
    expect(body.inquiry.status).toBe('NEW');

    // Verify DB EmployeeInquiry
    const inquiry = await prisma.employeeInquiry.findUnique({
      where: { id: body.inquiry.id },
      include: { lead: true }
    });

    expect(inquiry).toBeDefined();
    expect(inquiry?.companyId).toBe(companyAId);

    const snap = inquiry?.calculationSnapshot as any;
    expect(snap.sourceType).toBe('RENTAL');
    expect(snap.vehicle.make).toBe('Toyota');
    expect(snap.vehicle.model).toBe('Corolla');
    expect(snap.rental).toBeDefined();
    expect(snap.rental.rentalCompanyName).toBe('Ayvens Polska');
    expect(snap.rental.contractMonths).toBe(36);
    expect(snap.rental.annualMileageKm).toBe(20000);
    expect(snap.rental.monthlyRateNet).toBe(1350); // B2B private rate

    // Verify Lead in CRM
    const lead = inquiry?.lead;
    expect(lead).toBeDefined();
    expect(lead?.leadType).toBe('employee');
    expect(lead?.rentalVehicleId).toBe(vehicleAId);
    expect(lead?.listingId).toBeNull();
    expect(lead?.rentalCompanyName).toBe('Ayvens Polska');
    expect(lead?.rentalContractMonths).toBe(36);
    expect(lead?.rentalAnnualMileageKm).toBe(20000);
    expect(lead?.rentalMonthlyRate).toBe(1350);
    expect(lead?.message).toContain('Zapytanie o najem: Toyota Corolla');
    expect(lead?.message).toContain('Dostawca: Ayvens Polska');
  });

  // Scenario 12: Server-side recalculation of rental rates on POST /inquiries
  it('12. Server-side recalculation on POST /inquiries verifies against DB matrix entries', async () => {
    const csrfHeaders = await getCsrfHeaders(sessionCookieA);

    // Attempt to submit with non-existent mileage / months combination
    const invalidPayload = {
      offerId: `rental-${vehicleAId}`,
      idempotencyKey: crypto.randomUUID(),
      contractParty: 'EMPLOYEE_B2B',
      nip: '5252525252',
      contactName: 'Anna Rentalowa',
      contactEmail: 'anna.rentalowa@firma-a.pl',
      contactPhone: '+48 500 600 700',
      consentPrivacy: true,
      rentalSelection: {
        assignmentId: assignmentAId,
        contractMonths: 60, // Not available in matrix
        annualMileageKm: 50000,
        initialPaymentPct: 30
      }
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/employee/inquiries',
      headers: csrfHeaders,
      payload: invalidPayload
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('Wybrany wariant nie jest już dostępny');
  });

  // Scenario 13: GET /api/employee/inquiries returns rental inquiry with rental snapshot
  it('13. GET /api/employee/inquiries returns rental inquiry with rental snapshot and PP- reference', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/employee/inquiries',
      headers: { host: TEST_HOST, origin: TEST_ORIGIN, cookie: sessionCookieA }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.inquiries).toBeDefined();
    expect(body.inquiries.length).toBeGreaterThanOrEqual(1);

    const rentalInq = body.inquiries.find((i: any) => i.sourceType === 'RENTAL' || i.rental !== null);
    expect(rentalInq).toBeDefined();
    expect(rentalInq.referenceNumber).toMatch(/^PP-\d+$/);
    expect(rentalInq.rental).toBeDefined();
    expect(rentalInq.rental.monthlyRateNet).toBe(1350);
  });

  // Scenario 14: Tenant isolation: Company B employee cannot access Company A private rates
  it('14. Tenant isolation: Company B employee cannot access Company A private rates or offers', async () => {
    // User B from Company B queries vehicle A (Ayvens)
    const res = await app.inject({
      method: 'GET',
      url: `/api/employee/rental-offers/rental-${vehicleAId}?contractParty=EMPLOYEE_B2B`,
      headers: { host: TEST_HOST, origin: TEST_ORIGIN, cookie: sessionCookieB }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const option = body.rentalOptions[0];

    // User B does NOT have Ayvens matrix linked to Program B, so falls back to PUBLIC_MATRIX
    expect(option.rateSource).toBe('PUBLIC_MATRIX');
    expect(option.matrixVersionId).toBeNull();
    const row = option.rows.find((r: any) => r.contractMonths === 36 && r.annualMileageKm === 20000);
    expect(row.monthlyRateNet).toBe(1500); // public 1500, NOT Company A private 1350!
  });
});
