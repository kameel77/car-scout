import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../../../app.js';

describe('Employee Programs Admin Routes (/api/admin/employee-programs)', () => {
  let app: FastifyInstance;
  let superadminToken: string;
  let unauthorizedToken: string;
  let createdCompanyId: string;
  let createdProgramId: string;
  let testListingId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    superadminToken = app.jwt.sign({
      userId: 'superadmin-test-id',
      email: 'superadmin@motolia.pl',
      role: 'admin',
      memberships: [
        { id: 'm-super', scopeType: 'PLATFORM', scopeId: 'PLATFORM', role: 'SUPERADMIN_PLATFORM', isDefaultContext: true }
      ],
      activeContext: { scopeType: 'PLATFORM', scopeId: 'PLATFORM' }
    });

    unauthorizedToken = app.jwt.sign({
      userId: 'dealer-emp-id',
      email: 'dealer@emp.pl',
      role: 'employee',
      memberships: [
        { id: 'm-emp', scopeType: 'DEALER', scopeId: 'd1', role: 'DEALER_EMPLOYEE', isDefaultContext: true }
      ],
      activeContext: { scopeType: 'DEALER', scopeId: 'd1' }
    });

    // Create a mock listing for offer testing
    const listing = await app.prisma.listing.create({
      data: {
        make: 'Toyota',
        model: 'Corolla',
        version: '1.8 Hybrid Comfort',
        productionYear: 2024,
        mileageKm: 15000,
        pricePln: 110000,
        isArchived: false,
        fuelType: 'HYBRID',
        transmission: 'AUTOMATIC',
        bodyType: 'SEDAN'
      }
    });
    testListingId = listing.id;
  });

  afterAll(async () => {
    if (createdCompanyId) {
      await app.prisma.employeeCompany.deleteMany({ where: { id: createdCompanyId } });
    }
    if (testListingId) {
      await app.prisma.listing.deleteMany({ where: { id: testListingId } });
    }
    await app.close();
  });

  // -------------------------------------------------------------------------
  // 1. Authorization checks
  // -------------------------------------------------------------------------
  it('rejects unauthenticated requests with 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/employee-programs/companies'
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects unauthorized users lacking platform:settings:write with 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/employee-programs/companies',
      headers: { authorization: `Bearer ${unauthorizedToken}` }
    });
    expect(res.statusCode).toBe(403);
  });

  // -------------------------------------------------------------------------
  // 2. Company & Program creation
  // -------------------------------------------------------------------------
  it('creates a company and default program with starter Moya benefit policy', async () => {
    const companyName = `Testowa Korporacja ${Date.now()}`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/employee-programs/companies',
      headers: { authorization: `Bearer ${superadminToken}` },
      payload: {
        name: companyName,
        nip: '1234567890',
        programName: `Program Samochodowy ${companyName}`,
        defaultDiscountPct: 7.5
      }
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.company).toBeDefined();
    expect(body.company.name).toBe(companyName);
    expect(body.company.slug).toBeDefined();
    expect(body.company.programs.length).toBe(1);

    const program = body.company.programs[0];
    expect(program.defaultDiscountPct).toBe('7.5');
    expect(program.benefitPolicies.length).toBe(1);
    expect(program.benefitPolicies[0].name).toContain('Moya');

    createdCompanyId = body.company.id;
    createdProgramId = program.id;
  });

  it('rejects duplicate company name with 409 Conflict', async () => {
    const existing = await app.prisma.employeeCompany.findUnique({ where: { id: createdCompanyId } });
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/employee-programs/companies',
      headers: { authorization: `Bearer ${superadminToken}` },
      payload: {
        name: existing!.name
      }
    });

    expect(res.statusCode).toBe(409);
  });

  // -------------------------------------------------------------------------
  // 3. Registration code generation
  // -------------------------------------------------------------------------
  it('generates a registration code and returns rawCode strictly once in response', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/employee-programs/programs/${createdProgramId}/registration-codes`,
      headers: { authorization: `Bearer ${superadminToken}` },
      payload: {
        label: 'Pilotaż HR'
      }
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.code).toBeDefined();
    expect(body.rawCode).toBeDefined();
    expect(body.rawCode).toMatch(/^[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+$/);
    expect(body.code.codeHash).toBeUndefined(); // codeHash is not leaked

    // Verify in DB that only codeHash is stored
    const inDb = await app.prisma.employeeRegistrationCode.findUnique({
      where: { id: body.code.id }
    });
    expect(inDb).toBeDefined();
    expect(inDb?.codeHash).toBeDefined();
    expect(inDb?.codeHash).not.toBe(body.rawCode);
  });

  // -------------------------------------------------------------------------
  // 4. Special offer creation
  // -------------------------------------------------------------------------
  it('assigns a listing to the program as a special offer', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/employee-programs/programs/${createdProgramId}/offers`,
      headers: { authorization: `Bearer ${superadminToken}` },
      payload: {
        listingId: testListingId,
        customPricePln: 99900,
        discountPct: 9.18
      }
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.offer).toBeDefined();
    expect(body.offer.sourceType).toBe('FINANCING');
    expect(body.offer.customPricePln).toBe(99900);
  });

  it('rejects duplicate offer for the same listing with 409 Conflict', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/employee-programs/programs/${createdProgramId}/offers`,
      headers: { authorization: `Bearer ${superadminToken}` },
      payload: {
        listingId: testListingId
      }
    });

    expect(res.statusCode).toBe(409);
  });

  // -------------------------------------------------------------------------
  // 5. Matrix set creation
  // -------------------------------------------------------------------------
  it('creates an employee matrix set', async () => {
    // Create a temporary rental company
    const rentalCompany = await app.prisma.rentalCompany.create({
      data: {
        name: `Test Fleet ${Date.now()}`,
        slug: `test-fleet-${Date.now()}`,
        isActive: true
      }
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/employee-programs/matrix-sets',
      headers: { authorization: `Bearer ${superadminToken}` },
      payload: {
        rentalCompanyId: rentalCompany.id,
        name: 'Matryca Flotowa Action 2026',
        description: 'Dedykowana matryca 36/48 miesięcy'
      }
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.matrixSet.name).toBe('Matryca Flotowa Action 2026');

    // Create a vehicle and assignment for rental company
    const vehicle = await app.prisma.rentalVehicle.create({
      data: {
        make: 'Hyundai',
        model: 'Tucson',
        version: '1.6 T-GDI Smart',
        productionYear: 2024,
        mileageKm: 0,
        fuelType: 'BENZYNA',
        transmission: 'MANUAL',
        bodyType: 'SUV',
        enginePowerHp: 150,
        catalogPrice: 145000,
        isActive: true
      }
    });

    const assignment = await app.prisma.vehicleRentalAssignment.create({
      data: {
        vehicleId: vehicle.id,
        rentalCompanyId: rentalCompany.id,
        isActive: true
      }
    });

    // Test matrix CSV import (provider format)
    const csvContent = [
      'car_id,term_months,mileage_yearly,monthly_cost_net,initial_payment_pct,initial_payment_amount',
      `${vehicle.id},36,20000,1650.00,10,14500.00`,
      `${vehicle.id},48,20000,1520.00,10,14500.00`
    ].join('\n');

    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const multipartBody = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="ayvens_action.csv"',
      'Content-Type: text/csv',
      '',
      csvContent,
      `--${boundary}--`
    ].join('\r\n');

    const importRes = await app.inject({
      method: 'POST',
      url: `/api/admin/employee-programs/matrix-sets/${body.matrixSet.id}/import?label=Q3-2026`,
      headers: {
        authorization: `Bearer ${superadminToken}`,
        'content-type': `multipart/form-data; boundary=${boundary}`
      },
      payload: multipartBody
    });

    expect(importRes.statusCode).toBe(201);
    const importBody = JSON.parse(importRes.body);
    expect(importBody.version).toBeDefined();
    expect(importBody.version.status).toBe('DRAFT');
    expect(importBody.rowsInserted).toBe(2);

    // Test publishing version
    const publishRes = await app.inject({
      method: 'POST',
      url: `/api/admin/employee-programs/matrix-versions/${importBody.version.id}/publish`,
      headers: { authorization: `Bearer ${superadminToken}` }
    });

    expect(publishRes.statusCode).toBe(200);
    const publishBody = JSON.parse(publishRes.body);
    expect(publishBody.version.status).toBe('PUBLISHED');
    expect(publishBody.version.publishedAt).toBeDefined();

    // Clean up
    await app.prisma.employeeMatrixRow.deleteMany({ where: { versionId: importBody.version.id } });
    await app.prisma.employeeMatrixVersion.deleteMany({ where: { matrixSetId: body.matrixSet.id } });
    await app.prisma.employeeMatrixSet.deleteMany({ where: { id: body.matrixSet.id } });
    await app.prisma.vehicleRentalAssignment.deleteMany({ where: { id: assignment.id } });
    await app.prisma.rentalVehicle.deleteMany({ where: { id: vehicle.id } });
    await app.prisma.rentalCompany.deleteMany({ where: { id: rentalCompany.id } });
  });
});
