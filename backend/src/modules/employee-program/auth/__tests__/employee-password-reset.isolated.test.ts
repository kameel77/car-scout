import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { employeeAuthRoutes } from '../employee-auth.routes.js';
import {
  generateSignedCsrfToken,
  formatSessionCookie,
  formatCsrfCookie,
  CSRF_HEADER_NAME
} from '../employee-session.helpers.js';

// Mock email service to prevent real email sending and spy on calls
const mockSendEmployeePasswordResetEmail = vi.fn().mockResolvedValue(undefined);
vi.mock('../../../../services/email.js', () => ({
  sendEmployeePasswordResetEmail: (...args: any[]) => mockSendEmployeePasswordResetEmail(...args)
}));

describe('Employee Password Reset Isolated Routes', () => {
  let app: FastifyInstance;
  let fakeRedisStore: Map<string, { val: string; ttl: number }>;
  let fakeTokens: any[];
  let mockAccount: any;
  let fakePrisma: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    fakeRedisStore = new Map();
    fakeTokens = [];

    process.env.EMPLOYEE_PORTAL_URL = 'https://pracownicy.test';

    mockAccount = {
      id: 'acc_test_reset_1',
      email: 'pracownik@firma.pl',
      passwordHash: await bcrypt.hash('OldPassword123!', 10),
      firstName: 'Adam',
      lastName: 'Nowak',
      phone: '+48123456789',
      isActive: true,
      sessionsValidAfter: null,
      createdAt: new Date(),
      membership: {
        id: 'mem_test_1',
        accountId: 'acc_test_reset_1',
        companyId: 'comp_1',
        programId: 'prog_1',
        isActive: true,
        revokedAt: null,
        company: { id: 'comp_1', name: 'Firma Sp. z o.o.', slug: 'firma', isActive: true },
        program: { id: 'prog_1', name: 'Program Aut', slug: 'prog-aut', isActive: true }
      }
    };

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

    fakePrisma = {
      employeeAccount: {
        findUnique: async ({ where }: any) => {
          if (where.email === mockAccount.email || where.id === mockAccount.id) {
            const clone = JSON.parse(JSON.stringify(mockAccount));
            clone.createdAt = new Date();
            clone.sessionsValidAfter = mockAccount.sessionsValidAfter ? new Date(mockAccount.sessionsValidAfter) : null;
            return clone;
          }
          return null;
        },
        update: async ({ where, data }: any) => {
          if (where.id === mockAccount.id) {
            Object.assign(mockAccount, data);
            return mockAccount;
          }
          throw new Error('Account not found');
        }
      },
      employeePasswordResetToken: {
        count: async ({ where }: any) => {
          return fakeTokens.filter((t) => {
            if (where.accountId && t.accountId !== where.accountId) return false;
            if (where.createdAt?.gte && t.createdAt < where.createdAt.gte) return false;
            return true;
          }).length;
        },
        create: async ({ data }: any) => {
          const record = {
            id: `tok_${fakeTokens.length + 1}`,
            accountId: data.accountId,
            tokenHash: data.tokenHash,
            expiresAt: data.expiresAt,
            usedAt: null,
            requestedIp: data.requestedIp || null,
            createdAt: new Date()
          };
          fakeTokens.push(record);
          return record;
        },
        findUnique: async ({ where }: any) => {
          const t = fakeTokens.find((item) => item.tokenHash === where.tokenHash);
          if (!t) return null;
          return {
            ...t,
            account: JSON.parse(JSON.stringify(mockAccount))
          };
        },
        updateMany: async ({ where, data }: any) => {
          let count = 0;
          const now = new Date();
          for (const item of fakeTokens) {
            let match = true;
            if (where.tokenHash && item.tokenHash !== where.tokenHash) match = false;
            if (where.accountId && item.accountId !== where.accountId) match = false;
            if (where.usedAt === null && item.usedAt !== null) match = false;
            if (where.expiresAt?.gt && item.expiresAt <= where.expiresAt.gt) match = false;

            if (match) {
              if (data.usedAt) item.usedAt = data.usedAt;
              count++;
            }
          }
          return { count };
        }
      },
      $transaction: async (cb: any) => cb(fakePrisma)
    };

    app = Fastify();
    await app.register(fastifyJwt, {
      secret: 'test-jwt-secret-employee-isolated-reset',
      sign: { expiresIn: '1h' }
    });

    app.decorate('prisma', fakePrisma as any);
    app.decorate('redis', fakeRedis as any);

    await app.register(employeeAuthRoutes);
    await app.ready();
  });

  function getValidCsrfHeaders() {
    const token = generateSignedCsrfToken(app.jwt);
    return {
      cookie: formatCsrfCookie(token),
      [CSRF_HEADER_NAME]: token,
      host: 'localhost:3000',
      origin: 'https://localhost:3000'
    };
  }

  describe('POST /api/employee/auth/forgot-password', () => {
    it('returns constant 200 for existing active account and sends email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/employee/auth/forgot-password',
        headers: getValidCsrfHeaders(),
        payload: { email: 'pracownik@firma.pl' }
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.message).toBe('Jeśli konto istnieje, wysłaliśmy link do zmiany hasła.');

      expect(fakeTokens.length).toBe(1);
      expect(mockSendEmployeePasswordResetEmail).toHaveBeenCalledTimes(1);

      // Verify token in DB is hashed, NOT raw
      const rawCallArg = mockSendEmployeePasswordResetEmail.mock.calls[0][2];
      const match = rawCallArg.match(/token=([a-zA-Z0-9_-]+)/);
      expect(match).toBeTruthy();
      const rawToken = match[1];

      const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      expect(fakeTokens[0].tokenHash).toBe(expectedHash);
      expect(fakeTokens[0].tokenHash).not.toBe(rawToken);
    });

    it('returns identical 200 and does NOT send email for non-existent account', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/employee/auth/forgot-password',
        headers: getValidCsrfHeaders(),
        payload: { email: 'nieistniejacy@firma.pl' }
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).message).toBe('Jeśli konto istnieje, wysłaliśmy link do zmiany hasła.');
      expect(fakeTokens.length).toBe(0);
      expect(mockSendEmployeePasswordResetEmail).not.toHaveBeenCalled();
    });

    it('returns identical 200 and does NOT send email for inactive account', async () => {
      mockAccount.isActive = false;

      const res = await app.inject({
        method: 'POST',
        url: '/api/employee/auth/forgot-password',
        headers: getValidCsrfHeaders(),
        payload: { email: 'pracownik@firma.pl' }
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).message).toBe('Jeśli konto istnieje, wysłaliśmy link do zmiany hasła.');
      expect(fakeTokens.length).toBe(0);
      expect(mockSendEmployeePasswordResetEmail).not.toHaveBeenCalled();
    });

    it('enforces rate limit of 3 tokens per hour per account', async () => {
      // 3 successful requests
      for (let i = 0; i < 3; i++) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/employee/auth/forgot-password',
          headers: getValidCsrfHeaders(),
          payload: { email: 'pracownik@firma.pl' }
        });
        expect(res.statusCode).toBe(200);
      }
      expect(fakeTokens.length).toBe(3);
      expect(mockSendEmployeePasswordResetEmail).toHaveBeenCalledTimes(3);

      // 4th request within an hour
      const res4 = await app.inject({
        method: 'POST',
        url: '/api/employee/auth/forgot-password',
        headers: getValidCsrfHeaders(),
        payload: { email: 'pracownik@firma.pl' }
      });

      expect(res4.statusCode).toBe(200);
      expect(JSON.parse(res4.body).message).toBe('Jeśli konto istnieje, wysłaliśmy link do zmiany hasła.');
      expect(fakeTokens.length).toBe(3); // no 4th token created
      expect(mockSendEmployeePasswordResetEmail).toHaveBeenCalledTimes(3); // no 4th email
    });
  });

  describe('POST /api/employee/auth/reset-password', () => {
    it('successfully resets password, updates sessionsValidAfter and clears cookies', async () => {
      // Create a valid token first
      const rawToken = 'test_raw_reset_token_secret_123';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      fakeTokens.push({
        id: 'tok_1',
        accountId: mockAccount.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        usedAt: null,
        requestedIp: '127.0.0.1',
        createdAt: new Date()
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/employee/auth/reset-password',
        headers: getValidCsrfHeaders(),
        payload: {
          token: rawToken,
          password: 'NewStrongPassword123!'
        }
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.message).toContain('Hasło zostało pomyślnie zmienione');

      // Verify token is marked as used
      expect(fakeTokens[0].usedAt).toBeInstanceOf(Date);

      // Verify account password changed and sessionsValidAfter is set
      const isNewPassword = await bcrypt.compare('NewStrongPassword123!', mockAccount.passwordHash);
      expect(isNewPassword).toBe(true);
      expect(mockAccount.sessionsValidAfter).toBeInstanceOf(Date);

      // Verify session cookies are cleared
      const setCookieHeader = res.headers['set-cookie'];
      expect(setCookieHeader).toBeDefined();
    });

    it('rejects second use of the same token with 400', async () => {
      const rawToken = 'test_single_use_token_123';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      fakeTokens.push({
        id: 'tok_1',
        accountId: mockAccount.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        usedAt: null,
        requestedIp: '127.0.0.1',
        createdAt: new Date()
      });

      // First use: success
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/employee/auth/reset-password',
        headers: getValidCsrfHeaders(),
        payload: { token: rawToken, password: 'NewPassword1!' }
      });
      expect(res1.statusCode).toBe(200);

      // Second use: 400
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/employee/auth/reset-password',
        headers: getValidCsrfHeaders(),
        payload: { token: rawToken, password: 'AnotherPassword2!' }
      });
      expect(res2.statusCode).toBe(400);
      expect(JSON.parse(res2.body).message).toBe('Link wygasł lub został już użyty');
    });

    it('rejects expired token with 400', async () => {
      const rawToken = 'test_expired_token_123';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      fakeTokens.push({
        id: 'tok_1',
        accountId: mockAccount.id,
        tokenHash,
        expiresAt: new Date(Date.now() - 1000), // expired 1s ago
        usedAt: null,
        requestedIp: '127.0.0.1',
        createdAt: new Date(Date.now() - 60000)
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/employee/auth/reset-password',
        headers: getValidCsrfHeaders(),
        payload: { token: rawToken, password: 'NewPassword1!' }
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).message).toBe('Link wygasł lub został już użyty');
    });
  });

  describe('Session Invalidation after Password Reset (verifyEmployeeAuth)', () => {
    it('invalidates old sessions when sessionsValidAfter is set', async () => {
      const jti = '11111111-2222-4333-8444-555555555555';
      const pastIat = Math.floor((Date.now() - 60000) / 1000); // 1 minute ago

      // Session in Redis
      fakeRedisStore.set(`ep:session:${jti}`, {
        val: JSON.stringify({
          accountId: mockAccount.id,
          companyId: mockAccount.membership.companyId,
          programId: mockAccount.membership.programId
        }),
        ttl: 3600
      });

      // Token created in the past
      const oldToken = app.jwt.sign({
        realm: 'employee',
        aud: 'employee-portal',
        accountId: mockAccount.id,
        email: mockAccount.email,
        companyId: mockAccount.membership.companyId,
        programId: mockAccount.membership.programId,
        jti,
        iat: pastIat,
        exp: Math.floor(Date.now() / 1000) + 3600
      });

      // Before password reset: /me succeeds
      const resBefore = await app.inject({
        method: 'GET',
        url: '/api/employee/auth/me',
        headers: {
          cookie: formatSessionCookie(oldToken)
        }
      });
      expect(resBefore.statusCode).toBe(200);

      // Now password reset happens: sessionsValidAfter is set to now
      mockAccount.sessionsValidAfter = new Date();

      // Old session with pastIat tries /me -> 401 Unauthorized
      const resAfter = await app.inject({
        method: 'GET',
        url: '/api/employee/auth/me',
        headers: {
          cookie: formatSessionCookie(oldToken)
        }
      });
      expect(resAfter.statusCode).toBe(401);
      expect(JSON.parse(resAfter.body).message).toBe('Sesja wygasła lub została unieważniona');

      // A new session created after the reset succeeds
      const newJti = '22222222-3333-4444-8555-666666666666';
      fakeRedisStore.set(`ep:session:${newJti}`, {
        val: JSON.stringify({
          accountId: mockAccount.id,
          companyId: mockAccount.membership.companyId,
          programId: mockAccount.membership.programId
        }),
        ttl: 3600
      });
      const newToken = app.jwt.sign({
        realm: 'employee',
        aud: 'employee-portal',
        accountId: mockAccount.id,
        email: mockAccount.email,
        companyId: mockAccount.membership.companyId,
        programId: mockAccount.membership.programId,
        jti: newJti,
        iat: Math.floor(Date.now() / 1000) + 1,
        exp: Math.floor(Date.now() / 1000) + 3600
      });

      const resNew = await app.inject({
        method: 'GET',
        url: '/api/employee/auth/me',
        headers: {
          cookie: formatSessionCookie(newToken)
        }
      });
      expect(resNew.statusCode).toBe(200);
    });

    it('rejects tokens missing a valid integer iat with 401', async () => {
      const jti = '33333333-4444-4555-8666-777777777777';
      fakeRedisStore.set(`ep:session:${jti}`, {
        val: JSON.stringify({
          accountId: mockAccount.id,
          companyId: mockAccount.membership.companyId,
          programId: mockAccount.membership.programId
        }),
        ttl: 3600
      });

      // Token without iat
      const tokenWithoutIat = app.jwt.sign({
        realm: 'employee',
        aud: 'employee-portal',
        accountId: mockAccount.id,
        email: mockAccount.email,
        companyId: mockAccount.membership.companyId,
        programId: mockAccount.membership.programId,
        jti,
        exp: Math.floor(Date.now() / 1000) + 3600
      }, { noTimestamp: true });

      const res = await app.inject({
        method: 'GET',
        url: '/api/employee/auth/me',
        headers: {
          cookie: formatSessionCookie(tokenWithoutIat)
        }
      });

      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).message).toBe('Nieprawidłowy znacznik czasu tokenu');
    });
  });
});
