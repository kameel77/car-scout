import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import {
  createLightweightTestApp,
  assertSafeIntegrationEnvironment,
  TEST_HOST,
  TEST_ORIGIN,
} from './employee-test-helper.js';
import { hashRegistrationCode } from '../employee-auth.service.js';
import {
  SESSION_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
} from '../employee-session.helpers.js';
import { trustPlatformJwt } from '../../../../middleware/platform-jwt.js';

describe('Employee Program Auth Real DB & Redis Integration Tests (P3a)', () => {
  // Opt-in gate guard: immediately refuse if not running under safe integration runner
  if (process.env.EMPLOYEE_INTEGRATION_RUNNER_MARKER !== 'EMPLOYEE_INTEGRATION_RUNNER_ACTIVE_SAFE_V1') {
    it.skip('SKIPPED: Integration tests require dedicated disposable environment via `node scripts/test-employee-integration.mjs`', () => {});
    return;
  }

  let app: FastifyInstance;
  let prisma: PrismaClient;
  let redis: Redis;

  const testCompanyId = 'test-company-action-p3a';
  const testProgramId = 'test-program-action-p3a';
  const testPlainCode = 'ACTION-BENEFIT-2026';
  const expiredPlainCode = 'EXPIRED-ACTION-CODE';
  const revokedPlainCode = 'REVOKED-ACTION-CODE';

  const testEmail = 'pracownik.testowy.p3a@action.pl';
  const testPassword = 'SuperBezpieczneHaslo123!';

  let activeSessionCookie: string;
  let activeCsrfToken: string;

  beforeAll(async () => {
    // Assert strictly guarded runner environment
    assertSafeIntegrationEnvironment();

    const initialized = await createLightweightTestApp({
      enablePlatformJwtTrust: true,
    });
    app = initialized.app;
    prisma = initialized.prisma;
    redis = initialized.redis;

    // Clean up any residual data in test DB & Redis
    await cleanupTestData();

    // 1. Create company and program
    const company = await prisma.employeeCompany.create({
      data: {
        id: testCompanyId,
        name: 'Action S.A. Test P3a',
        slug: 'action-test-p3a',
        isActive: true,
      },
    });

    const program = await prisma.employeeProgram.create({
      data: {
        id: testProgramId,
        companyId: company.id,
        name: 'Action Auto Program Test',
        slug: 'action-auto-p3a',
        isActive: true,
        defaultDiscountPct: 5.5,
      },
    });

    // 2. Active registration code
    await prisma.employeeRegistrationCode.create({
      data: {
        companyId: company.id,
        programId: program.id,
        codeHash: hashRegistrationCode(testPlainCode),
        label: 'Aktywny kod Action 2026',
        isActive: true,
      },
    });

    // 3. Expired registration code
    await prisma.employeeRegistrationCode.create({
      data: {
        companyId: company.id,
        programId: program.id,
        codeHash: hashRegistrationCode(expiredPlainCode),
        label: 'Wygasły kod Action',
        isActive: true,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // yesterday
      },
    });

    // 4. Revoked / inactive registration code
    await prisma.employeeRegistrationCode.create({
      data: {
        companyId: company.id,
        programId: program.id,
        codeHash: hashRegistrationCode(revokedPlainCode),
        label: 'Nieaktywny kod Action',
        isActive: false,
      },
    });
  });

  afterAll(async () => {
    await cleanupTestData();
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
    if (redis) await redis.quit();
  });

  async function cleanupTestData() {
    try {
      const accounts = await prisma.employeeAccount.findMany({
        where: {
          email: {
            in: [
              testEmail,
              'duplicate.test@action.pl',
              'parallel.reg.1@action.pl',
              'parallel.reg.2@action.pl',
              'parallel.conflict@action.pl',
            ],
          },
        },
        select: { id: true },
      });
      const accountIds = accounts.map((a) => a.id);

      if (accountIds.length > 0) {
        await prisma.employeeMembershipAudit.deleteMany({
          where: { accountId: { in: accountIds } },
        }).catch(() => {});

        await prisma.employeeMembership.deleteMany({
          where: { accountId: { in: accountIds } },
        }).catch(() => {});

        await prisma.employeeAccount.deleteMany({
          where: { id: { in: accountIds } },
        }).catch(() => {});
      }

      await prisma.employeeRegistrationCode.deleteMany({
        where: { companyId: testCompanyId },
      }).catch(() => {});

      await prisma.employeeProgram.deleteMany({
        where: { id: testProgramId },
      }).catch(() => {});

      await prisma.employeeCompany.deleteMany({
        where: { id: testCompanyId },
      }).catch(() => {});

      // Flush Redis keys
      const keys = await redis.keys('ep:session:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (e) {
      // ignore
    }
  }

  describe('0. CSRF Bootstrap (/api/employee/auth/csrf)', () => {
    it('returns a valid CSRF token and sets __Host-ep-csrf cookie', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/employee/auth/csrf',
        headers: {
          host: TEST_HOST,
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data).toHaveProperty('csrfToken');
      expect(data.headerName).toBe('X-CSRF-Token');
      expect(typeof data.csrfToken).toBe('string');
      expect(data.csrfToken.length).toBeGreaterThanOrEqual(32);

      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : (setCookie as string);
      expect(cookieStr).toContain('__Host-ep-csrf=');
      expect(cookieStr).toContain('SameSite=Strict');
      expect(cookieStr).toContain('Secure');
      expect(cookieStr).not.toContain('HttpOnly'); // accessible to JS

      activeCsrfToken = data.csrfToken;
    });
  });

  describe('1. Walidacja kodów rejestracyjnych (/api/employee/auth/validate-code)', () => {
    it('zwraca sukces dla aktywnego kodu rejestracyjnego', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/employee/auth/validate-code',
        headers: {
          host: TEST_HOST,
          origin: TEST_ORIGIN,
        },
        payload: { code: '  action-benefit-2026  ' },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.valid).toBe(true);
      expect(data.companyId).toBe(testCompanyId);
      expect(data.companyName).toBe('Action S.A. Test P3a');
      expect(data.programId).toBe(testProgramId);
      expect(data.programName).toBe('Action Auto Program Test');
    });

    it('zwraca 404 dla nieistniejącego kodu', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/employee/auth/validate-code',
        headers: {
          host: TEST_HOST,
          origin: TEST_ORIGIN,
        },
        payload: { code: 'NIEISTNIEJACY-KOD-123' },
      });

      expect(res.statusCode).toBe(404);
    });

    it('zwraca 410 dla wygasłego kodu rejestracyjnego', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/employee/auth/validate-code',
        headers: {
          host: TEST_HOST,
          origin: TEST_ORIGIN,
        },
        payload: { code: expiredPlainCode },
      });

      expect(res.statusCode).toBe(410);
    });

    it('zwraca 404 dla nieaktywnego / odwołanego kodu rejestracyjnego', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/employee/auth/validate-code',
        headers: {
          host: TEST_HOST,
          origin: TEST_ORIGIN,
        },
        payload: { code: revokedPlainCode },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('2. Rejestracja pracownika (/api/employee/auth/register)', () => {
    it('odrzuca rejestrację bez tokena CSRF (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/employee/auth/register',
        headers: {
          host: TEST_HOST,
          origin: TEST_ORIGIN,
        },
        payload: {
          code: testPlainCode,
          email: testEmail,
          password: testPassword,
          firstName: 'Jan',
          lastName: 'Kowalski',
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('rejestruje pracownika, zapisuje sesję w Redis, tworzy audyt w DB i NIE zwraca tokena w body (201 Created)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/employee/auth/register',
        headers: {
          host: TEST_HOST,
          origin: TEST_ORIGIN,
          cookie: `${CSRF_COOKIE_NAME}=${activeCsrfToken}`,
          [CSRF_HEADER_NAME]: activeCsrfToken,
        },
        payload: {
          code: testPlainCode,
          email: `  ${testEmail.toUpperCase()}  `,
          password: testPassword,
          firstName: 'Jan',
          lastName: 'Kowalski',
          phone: '+48 500 600 700',
        },
      });

      expect(res.statusCode).toBe(201);
      const data = res.json();
      expect(data).not.toHaveProperty('token'); // STRICT: No token in JSON body
      expect(data.employee.email).toBe(testEmail);
      expect(data.employee.firstName).toBe('Jan');
      expect(data.employee.lastName).toBe('Kowalski');
      expect(data.employee.company.name).toBe('Action S.A. Test P3a');

      // Verify Set-Cookie headers
      const setCookies = res.headers['set-cookie'];
      expect(setCookies).toBeDefined();
      const cookiesList = Array.isArray(setCookies) ? setCookies : [setCookies as string];

      const sessionCookieHeader = cookiesList.find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
      expect(sessionCookieHeader).toBeDefined();
      expect(sessionCookieHeader).toContain('HttpOnly');
      expect(sessionCookieHeader).toContain('Secure');
      expect(sessionCookieHeader).toContain('SameSite=Lax');

      const csrfCookieHeader = cookiesList.find((c) => c.startsWith(`${CSRF_COOKIE_NAME}=`));
      expect(csrfCookieHeader).toBeDefined();

      // Extract session cookie value
      const match = sessionCookieHeader?.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
      expect(match).toBeTruthy();
      activeSessionCookie = match![1];

      // Verify DB atomic persistence
      const account = await prisma.employeeAccount.findUnique({
        where: { email: testEmail },
        include: { membership: true, membershipAudit: true },
      });

      expect(account).toBeDefined();
      expect(account?.isActive).toBe(true);
      expect(account?.membership?.companyId).toBe(testCompanyId);
      expect(account?.membership?.programId).toBe(testProgramId);
      expect(account?.membershipAudit.length).toBe(1);
      expect(account?.membershipAudit[0].action).toBe('CREATED');
      expect(account?.membershipAudit[0].reason).toContain('Rejestracja');

      // Verify Redis allowlist entry
      const jwtPayload = app.jwt.decode<{ jti: string }>(activeSessionCookie);
      expect(jwtPayload?.jti).toBeDefined();
      const redisVal = await redis.get(`ep:session:${jwtPayload!.jti}`);
      expect(redisVal).toBeDefined();
      const parsedRedis = JSON.parse(redisVal!);
      expect(parsedRedis.accountId).toBe(account!.id);
    });

    it('odrzuca duplikat rejestracji na ten sam e-mail (409 Conflict)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/employee/auth/register',
        headers: {
          host: TEST_HOST,
          origin: TEST_ORIGIN,
          cookie: `${CSRF_COOKIE_NAME}=${activeCsrfToken}`,
          [CSRF_HEADER_NAME]: activeCsrfToken,
        },
        payload: {
          code: testPlainCode,
          email: testEmail,
          password: testPassword,
        },
      });

      expect(res.statusCode).toBe(409);
    });

    it('obsługuje równoległą rejestrację tego samego e-maila: dokładnie jeden 201 i jeden 409', async () => {
      const conflictEmail = 'parallel.conflict@action.pl';

      const [res1, res2] = await Promise.all([
        app.inject({
          method: 'POST',
          url: '/api/employee/auth/register',
          headers: {
            host: TEST_HOST,
            origin: TEST_ORIGIN,
            cookie: `${CSRF_COOKIE_NAME}=${activeCsrfToken}`,
            [CSRF_HEADER_NAME]: activeCsrfToken,
          },
          payload: {
            code: testPlainCode,
            email: conflictEmail,
            password: testPassword,
            firstName: 'Parallel1',
          },
        }),
        app.inject({
          method: 'POST',
          url: '/api/employee/auth/register',
          headers: {
            host: TEST_HOST,
            origin: TEST_ORIGIN,
            cookie: `${CSRF_COOKIE_NAME}=${activeCsrfToken}`,
            [CSRF_HEADER_NAME]: activeCsrfToken,
          },
          payload: {
            code: testPlainCode,
            email: conflictEmail,
            password: testPassword,
            firstName: 'Parallel2',
          },
        }),
      ]);

      const statusCodes = [res1.statusCode, res2.statusCode].sort();
      expect(statusCodes).toEqual([201, 409]);

      // Sprawdzenie spójności bazy
      const accounts = await prisma.employeeAccount.findMany({
        where: { email: conflictEmail },
        include: { membership: true, membershipAudit: true },
      });
      expect(accounts.length).toBe(1);
      expect(accounts[0].membershipAudit.length).toBe(1);
    });
  });

  describe('3. Logowanie pracownika (/api/employee/auth/login)', () => {
    it('poprawnie loguje pracownika, tworzy sesję w Redis i zwraca ciastka bez tokena w body', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/employee/auth/login',
        headers: {
          host: TEST_HOST,
          origin: TEST_ORIGIN,
          cookie: `${CSRF_COOKIE_NAME}=${activeCsrfToken}`,
          [CSRF_HEADER_NAME]: activeCsrfToken,
        },
        payload: {
          email: testEmail,
          password: testPassword,
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data).not.toHaveProperty('token'); // STRICT: No token in body
      expect(data.employee.email).toBe(testEmail);
      expect(data.employee.company.id).toBe(testCompanyId);

      // Extract new session cookie
      const setCookies = res.headers['set-cookie'];
      const cookiesList = Array.isArray(setCookies) ? setCookies : [setCookies as string];
      const sessionCookieHeader = cookiesList.find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
      const match = sessionCookieHeader?.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
      expect(match).toBeTruthy();
      activeSessionCookie = match![1];

      // Verify Redis
      const jwtPayload = app.jwt.decode<{ jti: string }>(activeSessionCookie);
      const redisVal = await redis.get(`ep:session:${jwtPayload!.jti}`);
      expect(redisVal).toBeTruthy();
    });

    it('odrzuca logowanie z błędnym hasłem (401 Unauthorized)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/employee/auth/login',
        headers: {
          host: TEST_HOST,
          origin: TEST_ORIGIN,
          cookie: `${CSRF_COOKIE_NAME}=${activeCsrfToken}`,
          [CSRF_HEADER_NAME]: activeCsrfToken,
        },
        payload: {
          email: testEmail,
          password: 'ZleHaslo123!',
        },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('4. Profil pracownika i weryfikacja sesji (/api/employee/auth/me)', () => {
    it('zwraca profil dla aktywnej sesji ciasteczkowej', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/employee/auth/me',
        headers: {
          host: TEST_HOST,
          cookie: `${SESSION_COOKIE_NAME}=${activeSessionCookie}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.employee.email).toBe(testEmail);
      expect(data.employee.company.id).toBe(testCompanyId);
      expect(data.employee.program.id).toBe(testProgramId);
    });

    it('odrzuca autoryzację Bearer Header (ADR-02: cookie-only)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/employee/auth/me',
        headers: {
          host: TEST_HOST,
          authorization: 'Bearer ' + activeSessionCookie,
        },
      });

      expect(res.statusCode).toBe(401);
    });

    it('odrzuca sesję gdy firma pracodawcy zostanie dezaktywowana w bazie (403 Forbidden)', async () => {
      // Wyłącz firmę
      await prisma.employeeCompany.update({
        where: { id: testCompanyId },
        data: { isActive: false },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/employee/auth/me',
        headers: {
          host: TEST_HOST,
          cookie: `${SESSION_COOKIE_NAME}=${activeSessionCookie}`,
        },
      });

      expect(res.statusCode).toBe(403);

      // Przywróć firmę
      await prisma.employeeCompany.update({
        where: { id: testCompanyId },
        data: { isActive: true },
      });
    });

    it('odrzuca sesję gdy program pracowniczy zostanie dezaktywowany w bazie (403 Forbidden)', async () => {
      // Wyłącz program
      await prisma.employeeProgram.update({
        where: { id: testProgramId },
        data: { isActive: false },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/employee/auth/me',
        headers: {
          host: TEST_HOST,
          cookie: `${SESSION_COOKIE_NAME}=${activeSessionCookie}`,
        },
      });

      expect(res.statusCode).toBe(403);

      // Przywróć program
      await prisma.employeeProgram.update({
        where: { id: testProgramId },
        data: { isActive: true },
      });
    });

    it('odrzuca sesję gdy członkostwo pracownika (membership) zostanie dezaktywowane (403 Forbidden)', async () => {
      const account = await prisma.employeeAccount.findUnique({
        where: { email: testEmail },
        include: { membership: true },
      });

      await prisma.employeeMembership.update({
        where: { id: account!.membership!.id },
        data: { isActive: false },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/employee/auth/me',
        headers: {
          host: TEST_HOST,
          cookie: `${SESSION_COOKIE_NAME}=${activeSessionCookie}`,
        },
      });

      expect(res.statusCode).toBe(403);

      // Przywróć członkostwo
      await prisma.employeeMembership.update({
        where: { id: account!.membership!.id },
        data: { isActive: true },
      });
    });

    it('odrzuca token sesyjny, którego jti został usunięty z Redis allowlist (401 Unauthorized)', async () => {
      const jwtPayload = app.jwt.decode<{ jti: string }>(activeSessionCookie);
      await redis.del(`ep:session:${jwtPayload!.jti}`);

      const res = await app.inject({
        method: 'GET',
        url: '/api/employee/auth/me',
        headers: {
          host: TEST_HOST,
          cookie: `${SESSION_COOKIE_NAME}=${activeSessionCookie}`,
        },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('5. Izolacja Realmów (Admin vs Employee Isolation)', () => {
    it('odrzuca token admina platformy (legacy userId/platform realm) na trasie pracowniczej (403 Forbidden)', async () => {
      const platformAdminToken = app.jwt.sign({
        userId: 'admin-platform-test-p3a',
        email: 'admin@motolia.pl',
        role: 'admin',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/employee/auth/me',
        headers: {
          host: TEST_HOST,
          cookie: `${SESSION_COOKIE_NAME}=${platformAdminToken}`,
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('współdzielony helper trustPlatformJwt odrzuca token pracownika jako tożsamość platformy', async () => {
      const employeePayload = {
        accountId: 'acc_123',
        email: 'jan@action.pl',
        companyId: testCompanyId,
        programId: testProgramId,
        realm: 'employee',
        aud: 'employee-portal',
      };

      const isTrusted = trustPlatformJwt({} as any, employeePayload);
      expect(isTrusted).toBe(false);
    });
  });

  describe('6. Wylogowanie pracownika (/api/employee/auth/logout)', () => {
    it('wylogowuje pracownika, usuwa sesję z Redis i czyści cookies', async () => {
      // 1. Zaloguj ponownie aby mieć świeży stan
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/employee/auth/login',
        headers: {
          host: TEST_HOST,
          origin: TEST_ORIGIN,
          cookie: `${CSRF_COOKIE_NAME}=${activeCsrfToken}`,
          [CSRF_HEADER_NAME]: activeCsrfToken,
        },
        payload: {
          email: testEmail,
          password: testPassword,
        },
      });

      expect(loginRes.statusCode).toBe(200);
      const setCookies = loginRes.headers['set-cookie'];
      const cookiesList = Array.isArray(setCookies) ? setCookies : [setCookies as string];
      const sessionCookieHeader = cookiesList.find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
      const match = sessionCookieHeader?.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
      const sessionCookie = match![1];

      const jwtPayload = app.jwt.decode<{ jti: string }>(sessionCookie);
      expect(await redis.get(`ep:session:${jwtPayload!.jti}`)).toBeTruthy();

      // 2. Wykonaj wylogowanie z nagłówkiem CSRF
      const logoutRes = await app.inject({
        method: 'POST',
        url: '/api/employee/auth/logout',
        headers: {
          host: TEST_HOST,
          origin: TEST_ORIGIN,
          cookie: `${SESSION_COOKIE_NAME}=${sessionCookie}; ${CSRF_COOKIE_NAME}=${activeCsrfToken}`,
          [CSRF_HEADER_NAME]: activeCsrfToken,
        },
      });

      expect(logoutRes.statusCode).toBe(200);

      // Sprawdź czy wpis w Redis został usunięty
      const sessionInRedis = await redis.get(`ep:session:${jwtPayload!.jti}`);
      expect(sessionInRedis).toBeNull();

      // Sprawdź czy ciasteczka zostały wyczyszczone (Max-Age=0)
      const logoutSetCookies = logoutRes.headers['set-cookie'];
      const logoutCookiesList = Array.isArray(logoutSetCookies) ? logoutSetCookies : [logoutSetCookies as string];
      const clearedSession = logoutCookiesList.find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
      expect(clearedSession).toContain('Max-Age=0');

      // 3. Kolejne zapytanie do /me z tym ciastkiem zwraca 401
      const meRes = await app.inject({
        method: 'GET',
        url: '/api/employee/auth/me',
        headers: {
          host: TEST_HOST,
          cookie: `${SESSION_COOKIE_NAME}=${sessionCookie}`,
        },
      });

      expect(meRes.statusCode).toBe(401);
    });
  });
});
