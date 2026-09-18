import { describe, it, expect, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { employeeRentalCatalogRoutes } from '../employee-rental-catalog.routes.js';
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS
} from '../../auth/employee-session.helpers.js';

describe('Employee Rental Matrix Regression Isolated Tests', () => {
  let app: FastifyInstance;
  let fakePrisma: any;
  let fakeRedisStore: Map<string, { val: string; ttl: number }>;
  let validSessionCookie: string;

  const accountId = 'acc-regression-1';
  const companyId = 'comp-regression-1';
  const programId = 'prog-regression-1';
  const testJti = '22222222-2222-4222-8222-222222222222';

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
              // Only DRAFT matrix versions exist, NO PUBLISHED version
              matrixSets: [
                {
                  matrixSet: {
                    id: 'set-draft-1',
                    b2cStatus: 'AVAILABLE',
                    allowedContractParties: ['EMPLOYEE_B2B', 'CONSUMER'],
                    versions: [] // Prisma filtered where: { status: 'PUBLISHED' } so DRAFT returns empty []
                  }
                }
              ]
            };
          }
          return null;
        }
      },
      rentalVehicle: {
        findMany: async () => [
          {
            id: 'veh-draft-only-1',
            make: 'Toyota',
            model: 'Corolla',
            version: 'Comfort',
            productionYear: 2024,
            transmission: 'AUTOMATIC',
            fuelType: 'HYBRID',
            bodyType: 'SEDAN',
            mainImageUrl: 'https://img.test/toyota.jpg',
            rentalAssignments: [
              {
                id: 'asg-draft-1',
                rentalCompanyId: 'rc-1',
                rentalCompany: {
                  id: 'rc-1',
                  name: 'Tajna Wypożyczalnia',
                  slug: 'tajna-wypozyczalnia',
                  logoUrl: 'https://img.test/logo.png'
                },
                matrixEntries: [], // No public entries
                employeeMatrixRows: [
                  // This row belongs to a DRAFT version
                  {
                    id: 'row-draft-1',
                    versionId: 'ver-draft-1',
                    rentalCompanyId: 'rc-1',
                    contractMonths: 36,
                    annualMileageKm: 20000,
                    initialPaymentPct: 10,
                    initialPaymentAmountNet: 10000,
                    monthlyRateNet: 1200,
                    monthlyRateGross: 1476,
                    allowedContractParties: ['EMPLOYEE_B2B'],
                    offerType: 'business'
                  }
                ]
              }
            ]
          }
        ],
        findFirst: async () => null
      }
    };

    app = Fastify();
    await app.register(fastifyJwt, {
      secret: 'test-jwt-secret-regression',
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
      val: JSON.stringify({ accountId, companyId, programId }),
      ttl: SESSION_TTL_SECONDS
    });

    validSessionCookie = `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax`;
  });

  it('Ensures rental offer tied only to DRAFT matrix version does NOT appear in listing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/employee/rental-offers',
      headers: { cookie: validSessionCookie }
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    // Because the matrix row is DRAFT and not in published versions map, the vehicle has no eligible rate
    expect(json.offers).toHaveLength(0);
  });
});
