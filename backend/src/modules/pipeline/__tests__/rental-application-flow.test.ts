import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { ScopeType, FinancingType, ClientType, PipelineApplicationState, PipelinePhase } from '@prisma/client';
import { buildApp } from '../../../app.js';
import { encryptPesel, decryptPesel } from '../../../services/pesel-crypto.js';

describe('Rental Application Flow (Stage 2 Integration)', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let dealerEmployeeToken: string;

  const testTimestamp = Date.now();
  let testCompanyId: string;
  let testVehicleId: string;
  let testAssignmentId: string;
  let testStockUnitId: string;
  let testFinancierId: string;

  const validPesel = '90010112349'; // Valid PESEL with correct checksum (10 - (61 % 10) = 9)
  const invalidChecksumPesel = '90010112348'; // Invalid checksum

  beforeAll(async () => {
    // Set 32-byte base64 encryption key for hermetic test run
    process.env.PESEL_ENCRYPTION_KEY = Buffer.alloc(32, 'k').toString('base64');

    app = await buildApp();
    await app.ready();

    adminToken = app.jwt.sign({
      userId: 'admin-stage2-test',
      email: 'admin-stage2@motolia.pl',
      role: 'manager',
      memberships: [
        {
          id: 'm-stage2-admin',
          scopeType: 'PLATFORM',
          scopeId: 'PLATFORM',
          role: 'PLATFORM_MANAGER',
          isDefaultContext: true,
        },
      ],
      activeContext: { scopeType: 'PLATFORM', scopeId: 'PLATFORM' },
    });

    dealerEmployeeToken = app.jwt.sign({
      userId: 'emp-stage2-test',
      email: 'emp-stage2@dealer.pl',
      role: 'employee',
      memberships: [
        {
          id: 'm-stage2-emp',
          scopeType: 'DEALER',
          scopeId: 'dealer-stage2',
          role: 'DEALER_EMPLOYEE',
          isDefaultContext: true,
        },
      ],
      activeContext: { scopeType: 'DEALER', scopeId: 'dealer-stage2' },
    });

    // 1. Fixture: RentalCompany
    const company = await app.prisma.rentalCompany.create({
      data: {
        name: `Test Rental Co ${testTimestamp}`,
        slug: `test-rental-co-${testTimestamp}`,
        isActive: false,
      },
    });
    testCompanyId = company.id;

    // 2. Fixture: RentalVehicle (Polo)
    const vehicle = await app.prisma.rentalVehicle.create({
      data: {
        slug: `test-stage2-polo-${testTimestamp}`,
        make: 'VOLKSWAGEN',
        model: 'Polo',
        version: '1.0 TSI Life Plus',
        productionYear: 2026,
        catalogPrice: 110000,
        isPublished: false,
        isActive: false,
        ownerRentalCompanyId: testCompanyId,
      },
    });
    testVehicleId = vehicle.id;

    // 3. Fixture: VehicleRentalAssignment (spec 991)
    const assignment = await app.prisma.vehicleRentalAssignment.create({
      data: {
        vehicleId: testVehicleId,
        rentalCompanyId: testCompanyId,
        externalVehicleId: `SPEC-${testTimestamp}`,
        isActive: true,
      },
    });
    testAssignmentId = assignment.id;

    // 4. Fixture: RentalMatrixEntry
    await app.prisma.rentalMatrixEntry.create({
      data: {
        assignmentId: testAssignmentId,
        contractMonths: 24,
        annualMileageKm: 20000,
        initialPaymentPct: 0,
        monthlyRateNet: 1600,
        monthlyRateGross: 1968,
        servicesIncluded: ['serwis'],
        tiresNoLimit: 150,
        insuranceExcess500: 250,
        insuranceNoLimit: 350,
        priceVariant: 'COMFORT',
        overMileageCost: 0.35,
        overMileageTiresNoLimit: 0.48,
      },
    });

    // 5. Fixture: RentalStockUnit
    const stockUnit = await app.prisma.rentalStockUnit.create({
      data: {
        rentalCompanyId: testCompanyId,
        stockNo: `STK-${testTimestamp}`,
        specNoRaw: `SPEC-${testTimestamp}`,
        specNo: `SPEC-${testTimestamp}`,
        make: 'VOLKSWAGEN',
        model: 'Polo',
        fuelType: 'BENZYNA',
        vehicleDeliveryDate: new Date('2026-10-15'),
        isActive: true,
      },
    });
    testStockUnitId = stockUnit.id;

    // 6. Fixture: PipelineFinancier (Ayvens)
    const ayvens = await app.prisma.pipelineFinancier.upsert({
      where: {
        scopeType_scopeId_code: {
          scopeType: ScopeType.PLATFORM,
          scopeId: 'PLATFORM',
          code: 'AYVENS',
        },
      },
      update: {
        name: 'Ayvens',
        isActive: true,
        supportedFinancing: [FinancingType.RENTAL],
        supportedClientTypes: [ClientType.B2C, ClientType.B2B],
        applicationEmailTo: ['wnioski@leaseplan.com'],
      },
      create: {
        scopeType: ScopeType.PLATFORM,
        scopeId: 'PLATFORM',
        code: 'AYVENS',
        name: 'Ayvens',
        isActive: true,
        supportedFinancing: [FinancingType.RENTAL],
        supportedClientTypes: [ClientType.B2C, ClientType.B2B],
        applicationEmailTo: ['wnioski@leaseplan.com'],
      },
    });
    testFinancierId = ayvens.id;
  });

  afterAll(async () => {
    // Hermetic cleanup
    try {
      await app.prisma.pipelineOpportunity.deleteMany({
        where: {
          customer: {
            phone: { startsWith: `555${testTimestamp.toString().slice(-4)}` },
          },
        },
      });
      await app.prisma.pipelineCustomer.deleteMany({
        where: {
          phone: { startsWith: `555${testTimestamp.toString().slice(-4)}` },
        },
      });
      if (testStockUnitId) {
        await app.prisma.pipelineVehicleCandidate.deleteMany({
          where: { rentalStockUnitId: testStockUnitId },
        });
        await app.prisma.rentalStockUnit.delete({ where: { id: testStockUnitId } });
      }
      if (testAssignmentId) {
        await app.prisma.rentalMatrixEntry.deleteMany({ where: { assignmentId: testAssignmentId } });
        await app.prisma.vehicleRentalAssignment.delete({ where: { id: testAssignmentId } });
      }
      if (testVehicleId) {
        await app.prisma.rentalVehicle.delete({ where: { id: testVehicleId } });
      }
      if (testCompanyId) {
        await app.prisma.rentalCompany.delete({ where: { id: testCompanyId } });
      }
    } catch (e) {
      console.error('Cleanup error:', e);
    }
    await app.close();
  });

  // AC 1 & 2: Full happy path submission and pipeline state
  it('submits B2C rental application, creates opportunity, sets PRECHECK_SUBMITTED, freezes offer, and attempts email', async () => {
    const phone = `555${testTimestamp.toString().slice(-4)}01`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/pipeline/rental-applications',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        clientType: 'B2C',
        fullName: 'Jan Kowalski',
        email: 'jan.kowalski@example.com',
        phone,
        pesel: validPesel,
        stockNo: `STK-${testTimestamp}`,
        months: 24,
        annualMileageKm: 20000,
        priceVariant: 'COMFORT',
        insuranceVariant: 'FULL_INSURANCE_1000',
        tiresIncluded: true,
      },
    });

    if (res.statusCode !== 201) {
      console.log('DEBUG RES BODY:', res.body);
    }
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);

    expect(body.opportunityId).toBeDefined();
    expect(body.opportunityNumber).toBeDefined();
    expect(body.applicationId).toBeDefined();
    expect(body.offerId).toBeDefined();
    expect(body.stockNo).toBe(`STK-${testTimestamp}`);
    expect(body.monthlyRateNet).toBe(1600 + 150); // 1600 (base) + 150 (tires) = 1750 (insurance 1000 is 0 PLN excess)
    expect(['SENT', 'FAILED']).toContain(body.emailStatus);
    expect(body.caseUrl).toBe(`/admin/pipeline?opp=${body.opportunityId}`);

    // Verify DB states
    const opp = await app.prisma.pipelineOpportunity.findUnique({
      where: { id: body.opportunityId },
      include: {
        customer: true,
        vehicleCandidates: true,
        offers: true,
        applications: true,
        events: true,
      },
    });

    expect(opp).toBeDefined();
    expect(opp?.phase).toBe(PipelinePhase.QUALIFICATION);
    expect(opp?.customer.fullName).toBe('Jan Kowalski');
    expect(opp?.customer.peselMasked).toBe('*******2349');
    expect(opp?.customer.peselEnc).toBeDefined();

    // Verify vehicle candidate selected with stock number
    expect(opp?.vehicleCandidates.length).toBe(1);
    expect(opp?.vehicleCandidates[0].selectionStatus).toBe('SELECTED');
    expect(opp?.vehicleCandidates[0].rentalStockUnitId).toBe(testStockUnitId);

    // Verify offer frozen
    expect(opp?.offers.length).toBe(1);
    expect(opp?.offers[0].rentalPriceVariant).toBe('COMFORT');
    expect(opp?.offers[0].rentalInsuranceVariant).toBe(1000);
    expect(opp?.offers[0].rentalTiresIncluded).toBe(true);
    expect(opp?.offers[0].monthlyRateGrosze).toBe(1750 * 100);

    // Verify application state
    expect(opp?.applications.length).toBe(1);
    expect(opp?.applications[0].state).toBe(PipelineApplicationState.PRECHECK_SUBMITTED);
    expect(opp?.applications[0].submittedFirstAt).toBeDefined();

    // Verify events recorded & AC 6: clean event log without PESEL
    const eventTypes = opp?.events.map((e) => e.type);
    expect(eventTypes).toContain('OPPORTUNITY_CREATED');
    expect(eventTypes).toContain('APPLICATION_CREATED');
    expect(eventTypes).toContain('APPLICATION_SUBMITTED');
    expect(eventTypes).toContain('RENTAL_APPLICATION_EMAILED');

    const emailEvt = opp?.events.find((e) => e.type === 'RENTAL_APPLICATION_EMAILED');
    expect(emailEvt?.payload).toMatchObject({
      stockNo: `STK-${testTimestamp}`,
      variant: 'COMFORT',
      monthlyRateNet: 1750,
    });

    opp?.events.forEach((evt) => {
      expect(JSON.stringify(evt.payload)).not.toContain(validPesel);
    });
  });

  // AC 3: Rejects invalid PESEL checksum with HTTP 422
  it('returns HTTP 422 on invalid PESEL checksum without echoing PESEL', async () => {
    const phone = `555${testTimestamp.toString().slice(-4)}02`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/pipeline/rental-applications',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        clientType: 'B2C',
        fullName: 'Anna Nowak',
        phone,
        pesel: invalidChecksumPesel,
        stockNo: `STK-${testTimestamp}`,
        months: 24,
        annualMileageKm: 20000,
        priceVariant: 'COMFORT',
        insuranceVariant: 'NONE',
        tiresIncluded: false,
      },
    });

    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('Nieprawidłowa suma kontrolna numeru PESEL');
    expect(res.body).not.toContain(invalidChecksumPesel);

    // Verify no customer or opportunity was created in DB
    const cust = await app.prisma.pipelineCustomer.findFirst({ where: { phone } });
    expect(cust).toBeNull();
  });

  // AC 4: Fail-closed HTTP 503 when PESEL_ENCRYPTION_KEY is missing/corrupted
  it('returns HTTP 503 when PESEL_ENCRYPTION_KEY is invalid or missing', async () => {
    const origKey = process.env.PESEL_ENCRYPTION_KEY;
    try {
      delete process.env.PESEL_ENCRYPTION_KEY;
      const phone = `555${testTimestamp.toString().slice(-4)}03`;
      const res = await app.inject({
        method: 'POST',
        url: '/api/pipeline/rental-applications',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          clientType: 'B2C',
          fullName: 'Tomasz Lis',
          phone,
          pesel: validPesel,
          stockNo: `STK-${testTimestamp}`,
          months: 24,
          annualMileageKm: 20000,
          priceVariant: 'COMFORT',
          insuranceVariant: 'NONE',
          tiresIncluded: false,
        },
      });

      expect(res.statusCode).toBe(503);
      const body = JSON.parse(res.body);
      expect(body.message).toContain('Usługa szyfrowania danych wrażliwych jest chwilowo niedostępna');
    } finally {
      process.env.PESEL_ENCRYPTION_KEY = origKey;
    }
  });

  // AC 5: Ambiguous customer returns HTTP 409
  it('returns HTTP 409 Conflict with candidates when customer match is ambiguous', async () => {
    const rawPhone = `555${testTimestamp.toString().slice(-4)}04`;
    const normalizedPhone = `+48${rawPhone}`;
    // Create two customers with the same normalized phone
    await app.prisma.pipelineCustomer.createMany({
      data: [
        {
          scopeType: ScopeType.PLATFORM,
          scopeId: 'PLATFORM',
          fullName: 'Bliźniak 1',
          phone: normalizedPhone,
          clientType: ClientType.B2C,
        },
        {
          scopeType: ScopeType.PLATFORM,
          scopeId: 'PLATFORM',
          fullName: 'Bliźniak 2',
          phone: normalizedPhone,
          clientType: ClientType.B2C,
        },
      ],
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/pipeline/rental-applications',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        clientType: 'B2C',
        fullName: 'Bliźniak 1',
        phone: rawPhone,
        pesel: validPesel,
        stockNo: `STK-${testTimestamp}`,
        months: 24,
        annualMileageKm: 20000,
        priceVariant: 'COMFORT',
        insuranceVariant: 'NONE',
        tiresIncluded: false,
      },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('Znaleziono wielu klientów');
    expect(body.candidates.length).toBe(2);
  });

  // AC 6: PII leak guard in getOpportunityById
  it('does NOT leak peselEnc in GET /api/pipeline/opportunities/:id', async () => {
    const phone = `555${testTimestamp.toString().slice(-4)}05`;
    const submitRes = await app.inject({
      method: 'POST',
      url: '/api/pipeline/rental-applications',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        clientType: 'B2C',
        fullName: 'Piotr Zieliński',
        phone,
        pesel: validPesel,
        stockNo: `STK-${testTimestamp}`,
        months: 24,
        annualMileageKm: 20000,
        priceVariant: 'COMFORT',
        insuranceVariant: 'NONE',
        tiresIncluded: false,
      },
    });
    expect(submitRes.statusCode).toBe(201);
    const { opportunityId } = JSON.parse(submitRes.body);

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/pipeline/opportunities/${opportunityId}`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(getRes.statusCode).toBe(200);
    const getBody = JSON.parse(getRes.body);
    expect(getBody.customer).toBeDefined();
    expect(getBody.customer.peselEnc).toBeUndefined(); // PII guarded!
    expect(getBody.customer.peselMasked).toBe('*******2349');
  });

  // AC 7: PII endpoint authorization (pipeline:pii:read)
  it('authorizes GET /api/pipeline/customers/:id/pii only for authorized roles', async () => {
    const phone = `555${testTimestamp.toString().slice(-4)}06`;
    const submitRes = await app.inject({
      method: 'POST',
      url: '/api/pipeline/rental-applications',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        clientType: 'B2C',
        fullName: 'Robert Lewandowski',
        phone,
        pesel: validPesel,
        stockNo: `STK-${testTimestamp}`,
        months: 24,
        annualMileageKm: 20000,
        priceVariant: 'COMFORT',
        insuranceVariant: 'NONE',
        tiresIncluded: false,
      },
    });
    const { opportunityId } = JSON.parse(submitRes.body);

    const opp = await app.prisma.pipelineOpportunity.findUnique({
      where: { id: opportunityId },
    });
    const customerId = opp!.customerId;

    // Dealer employee lacks pipeline:pii:read -> 403
    const forbiddenRes = await app.inject({
      method: 'GET',
      url: `/api/pipeline/customers/${customerId}/pii`,
      headers: {
        authorization: `Bearer ${dealerEmployeeToken}`,
      },
    });
    expect(forbiddenRes.statusCode).toBe(403);

    // Platform manager has pipeline:pii:read -> 200 with decrypted PESEL
    const okRes = await app.inject({
      method: 'GET',
      url: `/api/pipeline/customers/${customerId}/pii`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });
    expect(okRes.statusCode).toBe(200);
    const okBody = JSON.parse(okRes.body);
    expect(okBody.pesel).toBe(validPesel);
    expect(okBody.peselMasked).toBe('*******2349');
  });

  // AC 8: Resend email endpoint
  it('allows resending partner application email via POST /api/pipeline/applications/:id/resend-email', async () => {
    const phone = `555${testTimestamp.toString().slice(-4)}07`;
    const submitRes = await app.inject({
      method: 'POST',
      url: '/api/pipeline/rental-applications',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        clientType: 'B2C',
        fullName: 'Wojciech Szczęsny',
        phone,
        pesel: validPesel,
        stockNo: `STK-${testTimestamp}`,
        months: 24,
        annualMileageKm: 20000,
        priceVariant: 'COMFORT',
        insuranceVariant: 'NONE',
        tiresIncluded: false,
      },
    });
    const { applicationId } = JSON.parse(submitRes.body);

    const resendRes = await app.inject({
      method: 'POST',
      url: `/api/pipeline/applications/${applicationId}/resend-email`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(resendRes.statusCode).toBe(200);
    const resendBody = JSON.parse(resendRes.body);
    expect(resendBody.applicationId).toBe(applicationId);
    expect(['SENT', 'FAILED']).toContain(resendBody.emailStatus);
  });
});
