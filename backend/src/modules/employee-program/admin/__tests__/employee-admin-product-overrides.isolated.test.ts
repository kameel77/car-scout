import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { employeeAdminRoutes } from '../employee-admin.routes.js';

// Bramka testowa E2 (brief-e2-product-overrides.md §Zakres 3)
describe('Employee Admin Product Overrides Isolated Routes (E2)', () => {
  let app: FastifyInstance;
  let fakePrisma: any;
  let programId: string;
  let creditProduct: any;
  let leasingProduct: any;
  let rentProduct: any;
  let overrideStore: Map<string, any>;
  let authState: { role: string | null; withUserId: boolean };

  function overrideKey(pid: string, financingProductId: string) {
    return `${pid}::${financingProductId}`;
  }

  beforeEach(async () => {
    vi.clearAllMocks();

    programId = 'prog_overrides_1';
    overrideStore = new Map();

    creditProduct = {
      id: 'fp_credit',
      category: 'CREDIT',
      name: 'Kredyt Standard',
      referenceRate: 5.5,
      margin: 2.0,
      maxInitialPayment: 45,
      maxFinalPayment: 30,
      minInstallments: 12,
      maxInstallments: 60,
      hasBalloonPayment: true,
      priority: 0
    };
    leasingProduct = {
      id: 'fp_leasing',
      category: 'LEASING',
      name: 'Leasing Operacyjny',
      referenceRate: 4.0,
      margin: 3.0,
      maxInitialPayment: 45,
      maxFinalPayment: 40,
      minInstallments: 24,
      maxInstallments: 60,
      hasBalloonPayment: true,
      priority: 1
    };
    rentProduct = {
      id: 'fp_rent',
      category: 'RENT',
      name: 'Najem długoterminowy',
      referenceRate: 0,
      margin: 0,
      maxInitialPayment: 0,
      maxFinalPayment: 0,
      minInstallments: 12,
      maxInstallments: 48,
      hasBalloonPayment: false,
      priority: 0
    };

    const allProducts = [creditProduct, leasingProduct, rentProduct];

    fakePrisma = {
      employeeProgram: {
        findUnique: async ({ where }: any) => (where.id === programId ? { id: programId } : null)
      },
      financingProduct: {
        findMany: async ({ where }: any) => {
          if (where?.category?.in) {
            return allProducts.filter((p) => where.category.in.includes(p.category));
          }
          if (where?.id?.in) {
            return allProducts.filter((p) => where.id.in.includes(p.id));
          }
          return allProducts;
        }
      },
      employeeProductOverride: {
        findMany: async ({ where }: any) => {
          return Array.from(overrideStore.values()).filter((o) => o.programId === where.programId);
        },
        deleteMany: async ({ where }: any) => {
          let count = 0;
          for (const [key, o] of overrideStore.entries()) {
            if (o.programId !== where.programId) continue;
            const excluded = where.financingProductId?.notIn;
            if (!excluded || !excluded.includes(o.financingProductId)) {
              overrideStore.delete(key);
              count++;
            }
          }
          return { count };
        },
        upsert: async ({ where, create, update }: any) => {
          const key = overrideKey(where.programId_financingProductId.programId, where.programId_financingProductId.financingProductId);
          const existing = overrideStore.get(key);
          const record = existing ? { ...existing, ...update } : { ...create };
          overrideStore.set(key, record);
          return record;
        }
      },
      $transaction: async (cb: any) => cb(fakePrisma)
    };

    authState = { role: 'admin', withUserId: true };

    app = Fastify();
    await app.register(fastifyJwt, { secret: 'super-secret-key-1234567890123456' });
    app.decorate('prisma', fakePrisma);
    app.decorate('authenticate', async (request: any) => {
      request.user = authState.withUserId
        ? { userId: 'admin_1', email: 'admin@carscout.pl', role: authState.role }
        : { role: authState.role };
    });
    await app.register(employeeAdminRoutes);
    await app.ready();
  });

  function decorateAuth(role: string | null, withUserId = true) {
    authState = { role, withUserId };
  }

  describe('authorization', () => {
    it('GET returns 401 when no userId is present on the authenticated request', async () => {
      decorateAuth('admin', false);
      const res = await app.inject({ method: 'GET', url: `/api/admin/employee-programs/programs/${programId}/product-overrides` });
      expect(res.statusCode).toBe(401);
    });

    it('PUT returns 403 when the role lacks platform:settings:write', async () => {
      decorateAuth('manager');
      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/employee-programs/programs/${programId}/product-overrides`,
        payload: { overrides: [] }
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('with admin permission', () => {
    beforeEach(() => {
      decorateAuth('admin');
    });

    it('GET lists LEASING and CREDIT products with override: null when none configured', async () => {
      const res = await app.inject({ method: 'GET', url: `/api/admin/employee-programs/programs/${programId}/product-overrides` });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      const productIds = body.products.map((p: any) => p.productId);
      expect(productIds).toContain('fp_credit');
      expect(productIds).toContain('fp_leasing');
      expect(productIds).not.toContain('fp_rent');
      expect(body.products.every((p: any) => p.override === null)).toBe(true);
    });

    it('PUT rejects unknown financingProductId with 400', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/employee-programs/programs/${programId}/product-overrides`,
        payload: {
          overrides: [{
            financingProductId: 'does-not-exist',
            isEnabled: true,
            b2cStatus: 'AVAILABLE',
            allowedContractParties: ['EMPLOYEE_B2B'],
            minDownPaymentPct: null,
            maxDownPaymentPct: null,
            allowedPeriods: []
          }]
        }
      });
      expect(res.statusCode).toBe(400);
    });

    it('PUT rejects a RENT-category product with 400', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/employee-programs/programs/${programId}/product-overrides`,
        payload: {
          overrides: [{
            financingProductId: 'fp_rent',
            isEnabled: true,
            b2cStatus: 'AVAILABLE',
            allowedContractParties: ['EMPLOYEE_B2B'],
            minDownPaymentPct: null,
            maxDownPaymentPct: null,
            allowedPeriods: []
          }]
        }
      });
      expect(res.statusCode).toBe(400);
    });

    it('PUT rejects maxDownPaymentPct above the product limit with 400', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/employee-programs/programs/${programId}/product-overrides`,
        payload: {
          overrides: [{
            financingProductId: 'fp_credit',
            isEnabled: true,
            b2cStatus: 'AVAILABLE',
            allowedContractParties: ['EMPLOYEE_B2B'],
            minDownPaymentPct: null,
            maxDownPaymentPct: 90,
            allowedPeriods: []
          }]
        }
      });
      expect(res.statusCode).toBe(400);
    });

    it('PUT rejects min > max down payment with 400', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/employee-programs/programs/${programId}/product-overrides`,
        payload: {
          overrides: [{
            financingProductId: 'fp_credit',
            isEnabled: true,
            b2cStatus: 'AVAILABLE',
            allowedContractParties: ['EMPLOYEE_B2B'],
            minDownPaymentPct: 40,
            maxDownPaymentPct: 20,
            allowedPeriods: []
          }]
        }
      });
      expect(res.statusCode).toBe(400);
    });

    it('PUT rejects a period outside [minInstallments, maxInstallments] with 400', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/employee-programs/programs/${programId}/product-overrides`,
        payload: {
          overrides: [{
            financingProductId: 'fp_credit',
            isEnabled: true,
            b2cStatus: 'AVAILABLE',
            allowedContractParties: ['EMPLOYEE_B2B'],
            minDownPaymentPct: null,
            maxDownPaymentPct: null,
            allowedPeriods: [96]
          }]
        }
      });
      expect(res.statusCode).toBe(400);
    });

    it('PUT rejects empty allowedContractParties when isEnabled is true with 400', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/employee-programs/programs/${programId}/product-overrides`,
        payload: {
          overrides: [{
            financingProductId: 'fp_credit',
            isEnabled: true,
            b2cStatus: 'AVAILABLE',
            allowedContractParties: [],
            minDownPaymentPct: null,
            maxDownPaymentPct: null,
            allowedPeriods: []
          }]
        }
      });
      expect(res.statusCode).toBe(400);
    });

    it('PUT persists a valid override and GET reflects it afterwards', async () => {
      const putRes = await app.inject({
        method: 'PUT',
        url: `/api/admin/employee-programs/programs/${programId}/product-overrides`,
        payload: {
          overrides: [{
            financingProductId: 'fp_credit',
            isEnabled: true,
            b2cStatus: 'AVAILABLE',
            allowedContractParties: ['EMPLOYEE_B2B'],
            minDownPaymentPct: 10,
            maxDownPaymentPct: 40,
            allowedPeriods: [24, 36]
          }]
        }
      });
      expect(putRes.statusCode).toBe(200);

      const getRes = await app.inject({ method: 'GET', url: `/api/admin/employee-programs/programs/${programId}/product-overrides` });
      const body = JSON.parse(getRes.body);
      const credit = body.products.find((p: any) => p.productId === 'fp_credit');
      expect(credit.override).not.toBeNull();
      expect(credit.override.isEnabled).toBe(true);
      expect(credit.override.allowedPeriods).toEqual([24, 36]);
    });

    it('PUT performs a full replace: an override omitted from the payload is deleted', async () => {
      await app.inject({
        method: 'PUT',
        url: `/api/admin/employee-programs/programs/${programId}/product-overrides`,
        payload: {
          overrides: [
            {
              financingProductId: 'fp_credit',
              isEnabled: true,
              b2cStatus: 'AVAILABLE',
              allowedContractParties: ['EMPLOYEE_B2B'],
              minDownPaymentPct: null,
              maxDownPaymentPct: null,
              allowedPeriods: []
            },
            {
              financingProductId: 'fp_leasing',
              isEnabled: true,
              b2cStatus: 'AVAILABLE',
              allowedContractParties: ['EMPLOYEE_B2B'],
              minDownPaymentPct: null,
              maxDownPaymentPct: null,
              allowedPeriods: []
            }
          ]
        }
      });

      // Second PUT omits fp_leasing entirely -> its override must be deleted
      await app.inject({
        method: 'PUT',
        url: `/api/admin/employee-programs/programs/${programId}/product-overrides`,
        payload: {
          overrides: [{
            financingProductId: 'fp_credit',
            isEnabled: true,
            b2cStatus: 'AVAILABLE',
            allowedContractParties: ['EMPLOYEE_B2B'],
            minDownPaymentPct: null,
            maxDownPaymentPct: null,
            allowedPeriods: []
          }]
        }
      });

      const getRes = await app.inject({ method: 'GET', url: `/api/admin/employee-programs/programs/${programId}/product-overrides` });
      const body = JSON.parse(getRes.body);
      const leasing = body.products.find((p: any) => p.productId === 'fp_leasing');
      expect(leasing.override).toBeNull();
    });
  });
});
