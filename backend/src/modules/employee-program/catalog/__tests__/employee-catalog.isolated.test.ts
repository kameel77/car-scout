import { describe, it, expect, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { employeeCatalogRoutes, calculateOfferPricing } from '../employee-catalog.routes.js';
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS
} from '../../auth/employee-session.helpers.js';

describe('Employee Catalog Isolated & Pricing Unit Tests', () => {
  describe('calculateOfferPricing logic (§4 briefu)', () => {
    it('Case 1: customPricePln takes priority over discountPct and defaultDiscountPct', () => {
      // List price 100,000, customPrice 85,000, discountPct 10%, default 5%
      const pricing = calculateOfferPricing(100000, 85000, 10, 5);
      expect(pricing.employeePricePln).toBe(85000);
      expect(pricing.savingsPln).toBe(15000);
      expect(pricing.discountPct).toBe(15.0);
    });

    it('Case 2: discountPct used when customPricePln is null', () => {
      // List price 71,900, 8% discount -> 66,148
      const pricing = calculateOfferPricing(71900, null, 8, 5);
      expect(pricing.employeePricePln).toBe(66148);
      expect(pricing.savingsPln).toBe(5752);
      expect(pricing.discountPct).toBe(8.0);
    });

    it('Case 2b: Handles non-integer discount with 2 decimal places without trailing zeroes', () => {
      // List price 100,000, discount 7.25% -> 92,750
      const pricing = calculateOfferPricing(100000, null, 7.25, null);
      expect(pricing.employeePricePln).toBe(92750);
      expect(pricing.savingsPln).toBe(7250);
      expect(pricing.discountPct).toBe(7.25);
    });

    it('Case 3: program.defaultDiscountPct used when offer discounts are null', () => {
      // List price 100,000, default 10% -> 90,000
      const pricing = calculateOfferPricing(100000, null, null, 10);
      expect(pricing.employeePricePln).toBe(90000);
      expect(pricing.savingsPln).toBe(10000);
      expect(pricing.discountPct).toBe(10.0);
    });

    it('Case 4: defaults to listPrice and 0 discount when no discounts set', () => {
      const pricing = calculateOfferPricing(50000, null, null, null);
      expect(pricing.employeePricePln).toBe(50000);
      expect(pricing.savingsPln).toBe(0);
      expect(pricing.discountPct).toBe(0);
    });

    it('Handles Prisma.Decimal objects via .toNumber()', () => {
      const fakeDecimal = {
        toNumber: () => 8.5
      };
      const pricing = calculateOfferPricing(100000, null, fakeDecimal, null);
      expect(pricing.employeePricePln).toBe(91500);
      expect(pricing.discountPct).toBe(8.5);
    });

    it('Clamps employeePrice never > listPrice and never < 0', () => {
      // customPrice higher than list price should clamp to listPrice
      const pricingHigh = calculateOfferPricing(50000, 60000, null, null);
      expect(pricingHigh.employeePricePln).toBe(50000);
      expect(pricingHigh.savingsPln).toBe(0);

      // negative customPrice should clamp to 0
      const pricingLow = calculateOfferPricing(50000, -1000, null, null);
      expect(pricingLow.employeePricePln).toBe(0);
      expect(pricingLow.savingsPln).toBe(50000);
      expect(pricingLow.discountPct).toBe(100.0);
    });

    it('Correctly calculates Finarena examples: Toyota Yaris & VW Tayron at 8%', () => {
      // Toyota Yaris: 71,900 list -> 66,148
      const yaris = calculateOfferPricing(71900, null, 8, null);
      expect(yaris.employeePricePln).toBe(66148);
      expect(yaris.savingsPln).toBe(5752);
      expect(yaris.discountPct).toBe(8.0);

      // VW Tayron: 173,900 list -> 159,988
      const tayron = calculateOfferPricing(173900, null, 8, null);
      expect(tayron.employeePricePln).toBe(159988);
      expect(tayron.savingsPln).toBe(13912);
      expect(tayron.discountPct).toBe(8.0);
    });
  });

  describe('Isolated Routes (Fastify inject with session)', () => {
    let app: FastifyInstance;
    let fakeRedisStore: Map<string, { val: string; ttl: number }>;
    let fakePrisma: any;
    let validSessionCookie: string;
    const testJti = '12345678-1234-4234-8234-1234567890ab';
    const programAId = 'prog_action_a';
    const companyAId = 'comp_action_a';
    const accountAId = 'acc_user_a';

    beforeEach(async () => {
      fakeRedisStore = new Map();

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
        id: accountAId,
        email: 'jan@action.pl',
        isActive: true,
        membership: {
          id: 'mem_1',
          accountId: accountAId,
          companyId: companyAId,
          programId: programAId,
          isActive: true,
          revokedAt: null,
          company: { id: companyAId, name: 'Action S.A.', slug: 'action', isActive: true },
          program: { id: programAId, name: 'Action Program', slug: 'action-prog', isActive: true }
        }
      };

      fakePrisma = {
        employeeAccount: {
          findUnique: async () => mockAccount
        },
        employeeProgram: {
          findUnique: async ({ where }: any) => {
            if (where.id === programAId) {
              return { id: programAId, defaultDiscountPct: 5 };
            }
            return null;
          }
        },
        employeeProgramOffer: {
          findMany: async () => [],
          findUnique: async () => null
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

      // Sign session JWT
      const token = app.jwt.sign({
        accountId: accountAId,
        email: 'jan@action.pl',
        companyId: companyAId,
        programId: programAId,
        realm: 'employee',
        aud: 'employee-portal',
        jti: testJti
      });

      fakeRedisStore.set(`ep:session:${testJti}`, {
        val: JSON.stringify({
          accountId: accountAId,
          companyId: companyAId,
          programId: programAId
        }),
        ttl: SESSION_TTL_SECONDS
      });

      validSessionCookie = `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax`;
    });

    it('Returns 401 when session cookie is missing', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/employee/offers'
      });
      expect(res.statusCode).toBe(401);
      const json = JSON.parse(res.body);
      expect(json.error).toBe('Unauthorized');
    });

    it('Returns 400 when limit is invalid string (e.g. limit=abc)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/employee/offers?limit=abc',
        headers: {
          cookie: validSessionCookie
        }
      });
      expect(res.statusCode).toBe(400);
      const json = JSON.parse(res.body);
      expect(json.error).toBe('Bad Request');
      expect(json.message).toBe('Nieprawidłowe parametry zapytania');
    });

    it('Returns 400 when limit is out of range (e.g. limit=999)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/employee/offers?limit=999',
        headers: {
          cookie: validSessionCookie
        }
      });
      expect(res.statusCode).toBe(400);
      const json = JSON.parse(res.body);
      expect(json.error).toBe('Bad Request');
      expect(json.message).toBe('Nieprawidłowe parametry zapytania');
    });

    it('Returns 404 for GET /api/employee/offers/:offerId if offer does not exist', async () => {
      const validCuid = 'clx1234567890123456789012';
      const res = await app.inject({
        method: 'GET',
        url: `/api/employee/offers/${validCuid}`,
        headers: {
          cookie: validSessionCookie
        }
      });
      expect(res.statusCode).toBe(404);
      const json = JSON.parse(res.body);
      expect(json.error).toBe('Not Found');
      expect(json.message).toBe('Oferta nie została znaleziona');
    });
  });
});
