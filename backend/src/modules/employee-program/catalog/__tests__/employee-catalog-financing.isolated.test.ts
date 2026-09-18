import { describe, it, expect, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { employeeCatalogRoutes } from '../employee-catalog.routes.js';
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS
} from '../../auth/employee-session.helpers.js';

// Bramka testowa E2 (brief-e2-product-overrides.md): pole `financing` w GET /api/employee/offers/:offerId
describe('Employee Catalog — financing config wiring (E2 §Zakres 2)', () => {
  let app: FastifyInstance;
  let fakeRedisStore: Map<string, { val: string; ttl: number }>;
  let fakePrisma: any;
  let validSessionCookie: string;
  let productOverrides: any[];
  const testJti = '87654321-4321-4234-8234-1234567890ab';
  const programId = 'prog_e2_1';
  const companyId = 'comp_e2_1';
  const accountId = 'acc_e2_user';
  const listingId = 'listing_e2_car1';

  const mockListing = {
    id: listingId,
    make: 'Skoda',
    model: 'Octavia',
    version: '2.0 TDI',
    productionYear: 2026,
    condition: 'NEW',
    isArchived: false,
    isReserved: false,
    pricePln: 150000,
    fuelType: 'DIESEL',
    transmission: 'AUTOMATIC',
    bodyType: 'Kombi',
    primaryImageUrl: null,
    imageUrls: [],
    enginePowerHp: null,
    engineCapacityCm3: null,
    doors: null,
    seats: null,
    color: null,
    paintType: null,
    drive: null,
    equipmentSafety: [],
    equipmentComfortExtras: [],
    equipmentAudioMultimedia: [],
    equipmentOther: [],
    additionalInfoHeader: null,
    additionalInfoContent: null,
    specsJson: null,
    employeeProgramOffers: []
  };

  function makeCreditProduct(overrides: Partial<any> = {}) {
    return {
      id: 'fp_credit_1',
      category: 'CREDIT',
      name: 'Kredyt Standard',
      referenceRate: 5.5,
      margin: 2.0,
      commission: 1.5,
      maxInitialPayment: 45,
      maxFinalPayment: 30,
      minInstallments: 12,
      maxInstallments: 60,
      hasBalloonPayment: true,
      provider: 'OWN',
      priority: 0,
      providerConfig: { secretApiKey: 'confidential-value' },
      ...overrides
    };
  }

  beforeEach(async () => {
    fakeRedisStore = new Map();
    productOverrides = [];

    const fakeRedis = {
      get: async (key: string) => fakeRedisStore.get(key)?.val ?? null,
      set: async (key: string, val: string, ...args: any[]) => {
        let ttl = 0;
        if (args[0] === 'EX' && typeof args[1] === 'number') ttl = args[1];
        fakeRedisStore.set(key, { val, ttl });
        return 'OK';
      },
      del: async (key: string) => (fakeRedisStore.delete(key) ? 1 : 0)
    };

    const mockAccount = {
      id: accountId,
      email: 'anna@firma.pl',
      isActive: true,
      membership: {
        id: 'mem_e2_1',
        accountId,
        companyId,
        programId,
        isActive: true,
        revokedAt: null,
        company: { id: companyId, name: 'Firma E2 S.A.', slug: 'firma-e2', isActive: true },
        program: { id: programId, name: 'Program E2', slug: 'program-e2', isActive: true }
      }
    };

    fakePrisma = {
      employeeAccount: {
        findUnique: async () => mockAccount
      },
      employeeProgram: {
        findUnique: async ({ where }: any) => {
          if (where.id === programId) {
            return { id: programId, scopeIncludeNew: true, scopeDiscountPct: null, defaultDiscountPct: 5 };
          }
          return null;
        }
      },
      listing: {
        findUnique: async ({ where }: any) => {
          if (where.id === listingId) return { ...mockListing };
          return null;
        }
      },
      employeeProgramOffer: {
        findMany: async () => [],
        findUnique: async () => null
      },
      employeeProductOverride: {
        findMany: async ({ where }: any) => {
          if (where.programId === programId && where.isEnabled === true) {
            return productOverrides;
          }
          return [];
        }
      }
    };

    app = Fastify();
    const jwtSecret = process.env.JWT_SECRET || 'test-jwt-secret-employee-isolated';
    await app.register(fastifyJwt, {
      secret: jwtSecret,
      sign: { expiresIn: '1h' }
    });

    app.decorate('prisma', fakePrisma as any);
    app.decorate('redis', fakeRedis as any);

    await app.register(employeeCatalogRoutes);
    await app.ready();

    const token = app.jwt.sign({
      accountId,
      email: 'anna@firma.pl',
      companyId,
      programId,
      realm: 'employee',
      aud: 'employee-portal',
      jti: testJti
    });

    fakeRedisStore.set(`ep:session:${testJti}`, {
      val: JSON.stringify({ accountId, companyId, programId }),
      ttl: SESSION_TTL_SECONDS
    });

    validSessionCookie = `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax`;
  });

  it('returns financing: null when the program has no enabled product overrides', async () => {
    productOverrides = [];

    const res = await app.inject({
      method: 'GET',
      url: `/api/employee/offers/listing-${listingId}`,
      headers: { cookie: validSessionCookie }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.financing).toBeNull();
  });

  it('returns financing.options built from enabled overrides, with rate = referenceRate + margin', async () => {
    productOverrides = [{
      id: 'ov_1',
      programId,
      financingProductId: 'fp_credit_1',
      isEnabled: true,
      b2cStatus: 'AVAILABLE',
      allowedContractParties: ['EMPLOYEE_B2B'],
      minDownPaymentPct: 10,
      maxDownPaymentPct: 40,
      allowedPeriods: [24, 36],
      financingProduct: makeCreditProduct()
    }];

    const res = await app.inject({
      method: 'GET',
      url: `/api/employee/offers/listing-${listingId}`,
      headers: { cookie: validSessionCookie }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.financing).not.toBeNull();
    expect(body.financing.options).toHaveLength(1);
    expect(body.financing.options[0]).toMatchObject({
      productId: 'fp_credit_1',
      category: 'CREDIT',
      minDownPaymentPct: 10,
      maxDownPaymentPct: 40,
      periods: [24, 36],
      annualRatePct: 7.5
    });
  });

  it('never leaks margin, commission, provider, or providerConfig in the JSON response', async () => {
    productOverrides = [{
      id: 'ov_2',
      programId,
      financingProductId: 'fp_credit_1',
      isEnabled: true,
      b2cStatus: 'AVAILABLE',
      allowedContractParties: ['EMPLOYEE_B2B'],
      minDownPaymentPct: null,
      maxDownPaymentPct: null,
      allowedPeriods: [],
      financingProduct: makeCreditProduct()
    }];

    const res = await app.inject({
      method: 'GET',
      url: `/api/employee/offers/listing-${listingId}`,
      headers: { cookie: validSessionCookie }
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain('margin');
    expect(res.body).not.toContain('commission');
    expect(res.body).not.toContain('providerConfig');
    expect(res.body).not.toContain('confidential-value');
    expect(res.body).not.toContain('"provider"');
  });

  it('filters out UNAVAILABLE and RENT-category overrides, keeping only eligible options', async () => {
    productOverrides = [
      {
        id: 'ov_unavailable',
        programId,
        financingProductId: 'fp_unavailable',
        isEnabled: true,
        b2cStatus: 'UNAVAILABLE',
        allowedContractParties: ['EMPLOYEE_B2B'],
        minDownPaymentPct: null,
        maxDownPaymentPct: null,
        allowedPeriods: [],
        financingProduct: makeCreditProduct({ id: 'fp_unavailable' })
      },
      {
        id: 'ov_rent',
        programId,
        financingProductId: 'fp_rent',
        isEnabled: true,
        b2cStatus: 'AVAILABLE',
        allowedContractParties: ['EMPLOYEE_B2B'],
        minDownPaymentPct: null,
        maxDownPaymentPct: null,
        allowedPeriods: [],
        financingProduct: makeCreditProduct({ id: 'fp_rent', category: 'RENT' })
      },
      {
        id: 'ov_ok',
        programId,
        financingProductId: 'fp_credit_1',
        isEnabled: true,
        b2cStatus: 'AVAILABLE',
        allowedContractParties: ['EMPLOYEE_B2B'],
        minDownPaymentPct: null,
        maxDownPaymentPct: null,
        allowedPeriods: [],
        financingProduct: makeCreditProduct()
      }
    ];

    const res = await app.inject({
      method: 'GET',
      url: `/api/employee/offers/listing-${listingId}`,
      headers: { cookie: validSessionCookie }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.financing.options).toHaveLength(1);
    expect(body.financing.options[0].productId).toBe('fp_credit_1');
  });

  it('drops a misconfigured override (min > max down payment) without failing the request, leaving an empty options list', async () => {
    productOverrides = [{
      id: 'ov_bad',
      programId,
      financingProductId: 'fp_credit_1',
      isEnabled: true,
      b2cStatus: 'AVAILABLE',
      allowedContractParties: ['EMPLOYEE_B2B'],
      minDownPaymentPct: 80,
      maxDownPaymentPct: 20,
      allowedPeriods: [],
      financingProduct: makeCreditProduct()
    }];

    const res = await app.inject({
      method: 'GET',
      url: `/api/employee/offers/listing-${listingId}`,
      headers: { cookie: validSessionCookie }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    // the enabled override exists (isEnabled: true) but fails business validation, so the
    // position disappears from options — it does not force the whole config back to null.
    expect(body.financing).toEqual({ options: [] });
  });

  it('clamps periods outside the product installment range and maxDownPaymentPct above the product limit', async () => {
    productOverrides = [{
      id: 'ov_clamp',
      programId,
      financingProductId: 'fp_credit_1',
      isEnabled: true,
      b2cStatus: 'AVAILABLE',
      allowedContractParties: ['EMPLOYEE_B2B'],
      minDownPaymentPct: null,
      maxDownPaymentPct: 90, // above product's maxInitialPayment (45)
      allowedPeriods: [6, 24, 96], // 6 and 96 are outside [12, 60]
      financingProduct: makeCreditProduct()
    }];

    const res = await app.inject({
      method: 'GET',
      url: `/api/employee/offers/listing-${listingId}`,
      headers: { cookie: validSessionCookie }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.financing.options[0].periods).toEqual([24]);
    expect(body.financing.options[0].maxDownPaymentPct).toBe(45);
  });
});
