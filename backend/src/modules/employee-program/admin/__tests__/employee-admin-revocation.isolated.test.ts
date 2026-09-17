import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { employeeAdminRoutes } from '../employee-admin.routes.js';
import { employeeAuthRoutes } from '../../auth/employee-auth.routes.js';
import { formatSessionCookie } from '../../auth/employee-session.helpers.js';

describe('Employee Admin Revocation and Reinstatement Isolated Routes', () => {
  let app: FastifyInstance;
  let mockCompany: any;
  let mockProgram: any;
  let mockAccount: any;
  let mockMembership: any;
  let auditLogs: any[];
  let fakePrisma: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    auditLogs = [];

    mockCompany = {
      id: 'comp_test_1',
      name: 'Firma Testowa Sp. z o.o.',
      slug: 'firma-testowa',
      nip: '1234567890',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    mockProgram = {
      id: 'prog_test_1',
      companyId: 'comp_test_1',
      name: 'Program Partnerski',
      slug: 'program-partnerski',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    mockAccount = {
      id: 'acc_test_1',
      email: 'jan.kowalski@firma.pl',
      firstName: 'Jan',
      lastName: 'Kowalski',
      phone: '+48123456789',
      isActive: true,
      sessionsValidAfter: null,
      lastLoginAt: new Date(),
      createdAt: new Date()
    };

    mockMembership = {
      id: 'mem_test_1',
      accountId: 'acc_test_1',
      companyId: 'comp_test_1',
      programId: 'prog_test_1',
      isActive: true,
      revokedAt: null,
      createdAt: new Date(),
      account: mockAccount,
      company: mockCompany,
      program: mockProgram
    };

    fakePrisma = {
      employeeCompany: {
        findUnique: async ({ where }: any) => {
          if (where.id === mockCompany.id) return mockCompany;
          return null;
        }
      },
      employeeMembership: {
        findUnique: async ({ where }: any) => {
          if (where.id === mockMembership.id) {
            return { ...mockMembership };
          }
          return null;
        },
        findFirst: async ({ where }: any) => {
          if (where.accountId === mockAccount.id) {
            return {
              ...mockMembership,
              account: { ...mockAccount },
              company: { ...mockCompany },
              program: { ...mockProgram }
            };
          }
          return null;
        },
        count: async ({ where }: any) => {
          if (where.companyId === mockCompany.id) return 1;
          return 0;
        },
        findMany: async ({ where }: any) => {
          if (where.companyId === mockCompany.id) {
            return [{
              ...mockMembership,
              account: { ...mockAccount },
              program: { ...mockProgram }
            }];
          }
          return [];
        },
        update: async ({ where, data }: any) => {
          if (where.id === mockMembership.id) {
            Object.assign(mockMembership, data);
            return { ...mockMembership };
          }
          throw new Error('Membership not found');
        }
      },
      employeeMembershipAudit: {
        create: async ({ data }: any) => {
          const record = { id: `audit_${Date.now()}`, ...data, createdAt: new Date() };
          auditLogs.push(record);
          return record;
        }
      },
      employeeAccount: {
        findUnique: async ({ where }: any) => {
          if (where.id === mockAccount.id || where.email === mockAccount.email) {
            return {
              ...mockAccount,
              membership: {
                ...mockMembership,
                company: { ...mockCompany },
                program: { ...mockProgram }
              }
            };
          }
          return null;
        },
        update: async ({ where, data }: any) => {
          if (where.id === mockAccount.id) {
            Object.assign(mockAccount, data);
            return { ...mockAccount };
          }
          throw new Error('Account not found');
        }
      },
      $transaction: async (cb: any) => {
        return cb(fakePrisma);
      }
    };

    app = Fastify();
    await app.register(fastifyJwt, { secret: 'super-secret-key-1234567890123456' });

    // Mock authenticate decorator for admin routes
    app.decorate('authenticate', async (request: any) => {
      request.user = {
        userId: 'admin_user_42',
        email: 'admin@carscout.pl',
        role: 'admin' // Grants SUPERADMIN_PLATFORM with platform:settings:write
      };
    });

    const fakeRedisStore = new Map<string, string>();
    app.decorate('redis', {
      get: async (key: string) => fakeRedisStore.get(key) || null,
      set: async (key: string, val: string) => {
        fakeRedisStore.set(key, val);
        return 'OK';
      },
      del: async (key: string) => {
        fakeRedisStore.delete(key);
        return 1;
      }
    });

    app.decorate('prisma', fakePrisma);

    await app.register(employeeAdminRoutes);
    await app.register(employeeAuthRoutes);
    await app.ready();
  });

  it('GET /api/admin/employee-programs/companies/:companyId/accounts returns employee list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/employee-programs/companies/${mockCompany.id}/accounts`
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.accounts).toHaveLength(1);
    expect(body.accounts[0].email).toBe('jan.kowalski@firma.pl');
    expect(body.accounts[0].isActive).toBe(true);
    expect(body.accounts[0].revokedAt).toBeNull();
    expect(body.pagination.total).toBe(1);
  });

  it('POST /api/admin/employee-programs/memberships/:membershipId/revoke rejects short reason with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/employee-programs/memberships/${mockMembership.id}/revoke`,
      payload: { reason: 'no' }
    });

    expect(res.statusCode).toBe(400);
  });

  it('POST /api/admin/employee-programs/memberships/:membershipId/revoke revokes access, updates session time, and records audit with actorUserId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/employee-programs/memberships/${mockMembership.id}/revoke`,
      payload: { reason: 'Zwolnienie dyscyplinarne pracownika' }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('pomyślnie cofnięty');

    expect(mockMembership.isActive).toBe(false);
    expect(mockMembership.revokedAt).not.toBeNull();
    expect(mockAccount.sessionsValidAfter).not.toBeNull();

    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].action).toBe('REVOKED');
    expect(auditLogs[0].reason).toBe('Zwolnienie dyscyplinarne pracownika');
    expect(auditLogs[0].actorUserId).toBe('admin_user_42');
  });

  it('POST /api/admin/employee-programs/memberships/:membershipId/revoke is idempotent if already revoked', async () => {
    mockMembership.isActive = false;
    mockMembership.revokedAt = new Date();

    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/employee-programs/memberships/${mockMembership.id}/revoke`,
      payload: { reason: 'Ponowna próba' }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('już wcześniej cofnięty');
    expect(auditLogs).toHaveLength(0);
  });

  it('rejects employee session when token was issued before revocation', async () => {
    // Issue token at time T = now - 60 seconds
    const issuedAtSeconds = Math.floor(Date.now() / 1000) - 60;
    const jti = '11111111-2222-4333-8444-555555555555';
    const payload = {
      sub: mockAccount.id,
      accountId: mockAccount.id,
      email: mockAccount.email,
      companyId: mockCompany.id,
      programId: mockProgram.id,
      membershipId: mockMembership.id,
      realm: 'employee',
      aud: 'employee-portal',
      jti,
      iat: issuedAtSeconds,
      exp: issuedAtSeconds + 3600
    };
    const token = app.jwt.sign(payload);

    // Save session in redis
    await (app as any).redis.set(`ep:session:${jti}`, JSON.stringify({
      accountId: mockAccount.id,
      companyId: mockCompany.id,
      programId: mockProgram.id,
      membershipId: mockMembership.id,
      createdAt: new Date()
    }));

    // Revoke access
    mockMembership.isActive = false;
    mockMembership.revokedAt = new Date();

    const res = await app.inject({
      method: 'GET',
      url: '/api/employee/auth/me',
      headers: {
        cookie: formatSessionCookie(token)
      }
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('Brak aktywnego przypisania do programu');
  });

  it('rejects employee session when sessionsValidAfter is newer than token iat', async () => {
    // Reinstated membership, but old token issued before sessionsValidAfter
    mockMembership.isActive = true;
    mockMembership.revokedAt = null;

    const issuedAtSeconds = Math.floor(Date.now() / 1000) - 60;
    const jti = '22222222-3333-4444-8555-666666666666';
    const payload = {
      sub: mockAccount.id,
      accountId: mockAccount.id,
      email: mockAccount.email,
      companyId: mockCompany.id,
      programId: mockProgram.id,
      membershipId: mockMembership.id,
      realm: 'employee',
      aud: 'employee-portal',
      jti,
      iat: issuedAtSeconds,
      exp: issuedAtSeconds + 3600
    };
    const token = app.jwt.sign(payload);

    await (app as any).redis.set(`ep:session:${jti}`, JSON.stringify({
      accountId: mockAccount.id,
      companyId: mockCompany.id,
      programId: mockProgram.id,
      membershipId: mockMembership.id,
      createdAt: new Date()
    }));

    // sessionsValidAfter is 10s ago (newer than issuedAtSeconds which was 60s ago)
    mockAccount.sessionsValidAfter = new Date((issuedAtSeconds + 50) * 1000);

    const res = await app.inject({
      method: 'GET',
      url: '/api/employee/auth/me',
      headers: {
        cookie: formatSessionCookie(token)
      }
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('Sesja wygasła lub została unieważniona');
  });

  it('POST /api/admin/employee-programs/memberships/:membershipId/reinstate restores access and writes audit log', async () => {
    mockMembership.isActive = false;
    mockMembership.revokedAt = new Date();
    mockAccount.sessionsValidAfter = new Date();

    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/employee-programs/memberships/${mockMembership.id}/reinstate`,
      payload: { reason: 'Pomyłka HR - powrót pracownika' }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('pomyślnie przywrócony');

    expect(mockMembership.isActive).toBe(true);
    expect(mockMembership.revokedAt).toBeNull();

    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].action).toBe('REINSTATED');
    expect(auditLogs[0].reason).toBe('Pomyłka HR - powrót pracownika');
    expect(auditLogs[0].actorUserId).toBe('admin_user_42');
  });
});
