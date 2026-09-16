import { describe, it, expect, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { employeeRentalCatalogRoutes } from '../employee-rental-catalog.routes.js';
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS
} from '../../auth/employee-session.helpers.js';

describe('Employee Rental Catalog Isolated Unit Tests', () => {
  let app: FastifyInstance;
  let fakePrisma: any;
  let fakeRedisStore: Map<string, { val: string; ttl: number }>;
  let validSessionCookie: string;

  const accountId = 'acc-1';
  const companyId = 'comp-1';
  const programId = 'prog-1';
  const testJti = '11111111-1111-4111-8111-111111111111';

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
      id: accountId,
      email: 'pracownik@firma.pl',
      isActive: true,
      membership: {
        id: 'mem-1',
        accountId,
        companyId,
        programId,
        isActive: true,
        revokedAt: null,
        company: { id: companyId, name: 'Firma Sp. z o.o.', slug: 'firma', isActive: true },
        program: { id: programId, name: 'Program Aut', slug: 'program-aut', isActive: true }
      }
    };

    fakePrisma = {
      employeeAccount: {
        findUnique: async () => mockAccount
      },
      employeeProgram: {
        findUnique: async ({ where }: any) => {
          if (where.id === programId) {
            return {
              id: programId,
              scopeIncludeRental: true,
              matrixSets: []
            };
          }
          return null;
        }
      },
      rentalVehicle: {
        findMany: async () => [],
        findFirst: async () => null
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

    await app.register(employeeRentalCatalogRoutes);
    await app.ready();

    const token = app.jwt.sign({
      accountId,
      email: 'pracownik@firma.pl',
      companyId,
      programId,
      realm: 'employee',
      aud: 'employee-portal',
      jti: testJti
    });

    fakeRedisStore.set(`ep:session:${testJti}`, {
      val: JSON.stringify({
        accountId,
        companyId,
        programId
      }),
      ttl: SESSION_TTL_SECONDS
    });

    validSessionCookie = `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax`;
  });

  it('Returns 401 when session cookie is missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/employee/rental-offers'
    });
    expect(res.statusCode).toBe(401);
  });

  it('Returns 200 with empty offers when scopeIncludeRental is false', async () => {
    fakePrisma.employeeProgram.findUnique = async () => ({
      id: programId,
      scopeIncludeRental: false,
      matrixSets: []
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/employee/rental-offers',
      headers: { cookie: validSessionCookie }
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.offers).toEqual([]);
    expect(json.nextCursor).toBeNull();
  });

  it('Returns 404 when program does not exist', async () => {
    fakePrisma.employeeProgram.findUnique = async () => null;

    const res = await app.inject({
      method: 'GET',
      url: '/api/employee/rental-offers',
      headers: { cookie: validSessionCookie }
    });

    expect(res.statusCode).toBe(404);
  });

  it('Returns rental offers with correct schema and rates when scopeIncludeRental is true', async () => {
    fakePrisma.rentalVehicle.findMany = async () => [
      {
        id: 'rv-1',
        make: 'Audi',
        model: 'A4',
        version: 'S-line',
        productionYear: 2025,
        fuelType: 'DIESEL',
        transmission: 'AUTOMATIC',
        bodyType: 'SEDAN',
        primaryImageUrl: 'https://img.example.com/1.jpg',
        imageUrls: ['https://img.example.com/1.jpg', 'https://img.example.com/2.jpg'],
        rentalAssignments: [
          {
            id: 'asg-1',
            rentalCompanyId: 'rc-1',
            rentalCompany: { name: 'Ayvens' },
            matrixEntries: [
              {
                contractMonths: 36,
                annualMileageKm: 15000,
                initialPaymentPct: 10,
                monthlyRateNet: 2000,
                monthlyRateGross: 2460,
                offerType: 'all',
                servicesIncluded: []
              }
            ]
          }
        ]
      }
    ];

    const res = await app.inject({
      method: 'GET',
      url: '/api/employee/rental-offers',
      headers: { cookie: validSessionCookie }
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.offers).toHaveLength(1);
    const offer = json.offers[0];
    expect(offer.id).toBe('rental-rv-1');
    expect(offer.sourceType).toBe('RENTAL');
    expect(offer.vehicle.make).toBe('Audi');
    expect(offer.rental.fromMonthlyRateGross).toBe(2460);
    expect(offer.rental.rateSource).toBe('PUBLIC_MATRIX');
    expect(offer.rental.rentalCompanies).toEqual(['Ayvens']);
    expect(json.nextCursor).toBeNull();
  });

  it('Returns nextCursor when vehicles count exceeds limit', async () => {
    fakePrisma.rentalVehicle.findMany = async () => [
      {
        id: 'rv-1',
        make: 'Audi',
        model: 'A4',
        productionYear: 2025,
        rentalAssignments: [
          {
            id: 'asg-1',
            rentalCompany: { name: 'Ayvens' },
            matrixEntries: [{ monthlyRateNet: 1000, monthlyRateGross: 1230, offerType: 'all' }]
          }
        ]
      },
      {
        id: 'rv-2',
        make: 'BMW',
        model: '320i',
        productionYear: 2025,
        rentalAssignments: [
          {
            id: 'asg-2',
            rentalCompany: { name: 'Arval' },
            matrixEntries: [{ monthlyRateNet: 1200, monthlyRateGross: 1476, offerType: 'all' }]
          }
        ]
      }
    ];

    const res = await app.inject({
      method: 'GET',
      url: '/api/employee/rental-offers?limit=1',
      headers: { cookie: validSessionCookie }
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.offers).toHaveLength(1);
    expect(json.offers[0].id).toBe('rental-rv-1');
    expect(json.nextCursor).toBe('rv-1');
  });

  describe('GET /api/employee/rental-offers/:id', () => {
    it('Returns 404 when vehicle is not found', async () => {
      fakePrisma.rentalVehicle.findFirst = async () => null;

      const res = await app.inject({
        method: 'GET',
        url: '/api/employee/rental-offers/rental-non-existent',
        headers: { cookie: validSessionCookie }
      });

      expect(res.statusCode).toBe(404);
    });

    it('Returns 404 when scopeIncludeRental is false', async () => {
      fakePrisma.employeeProgram.findUnique = async () => ({
        id: programId,
        scopeIncludeRental: false,
        matrixSets: []
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/employee/rental-offers/rental-rv-1',
        headers: { cookie: validSessionCookie }
      });

      expect(res.statusCode).toBe(404);
    });

    it('Returns 200 with vehicle specs and rentalOptions grid', async () => {
      fakePrisma.rentalVehicle.findFirst = async () => ({
        id: 'rv-1',
        make: 'Audi',
        model: 'A4',
        version: 'S-line',
        productionYear: 2025,
        fuelType: 'DIESEL',
        transmission: 'AUTOMATIC',
        bodyType: 'SEDAN',
        primaryImageUrl: 'https://img.example.com/1.jpg',
        imageUrls: ['https://img.example.com/1.jpg'],
        doors: 4,
        seats: 5,
        enginePowerHp: 190,
        engineCapacityCm3: 1968,
        equipmentSafety: ['ABS', 'ESP'],
        rentalAssignments: [
          {
            id: 'asg-1',
            rentalCompanyId: 'rc-1',
            rentalCompany: { name: 'Ayvens', slug: 'ayvens', logoUrl: null },
            matrixEntries: [
              {
                contractMonths: 36,
                annualMileageKm: 15000,
                initialPaymentPct: 10,
                initialPaymentAmountNet: 0,
                monthlyRateNet: 2000,
                monthlyRateGross: 2460,
                offerType: 'all',
                servicesIncluded: ['serwis']
              }
            ]
          }
        ]
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/employee/rental-offers/rental-rv-1',
        headers: { cookie: validSessionCookie }
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.id).toBe('rental-rv-1');
      expect(json.sourceType).toBe('RENTAL');
      expect(json.vehicle.make).toBe('Audi');
      expect(json.vehicle.doors).toBe(4);
      expect(json.vehicle.equipmentSafety).toContain('ABS');
      expect(json.rentalOptions).toHaveLength(1);
      expect(json.rentalOptions[0].assignmentId).toBe('asg-1');
      expect(json.rentalOptions[0].rentalCompanyName).toBe('Ayvens');
      expect(json.rentalOptions[0].rows).toHaveLength(1);
      expect(json.rentalOptions[0].rows[0].monthlyRateGross).toBe(2460);
    });
  });
});
