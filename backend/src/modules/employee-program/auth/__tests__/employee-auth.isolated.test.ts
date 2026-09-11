import { describe, it, expect, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import bcrypt from 'bcrypt';
import { employeeAuthRoutes } from '../employee-auth.routes.js';
import {
  parseCookiesConstrained,
  formatCookieHeader,
  generateSignedCsrfToken,
  SESSION_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  SESSION_TTL_SECONDS
} from '../employee-session.helpers.js';
import { EmployeeJwtPayload } from '../employee-auth.types.js';

const TEST_CSRF_SECRET = 'employee-program-csrf-default-secret-salt-32chars';

describe('Employee Auth Isolated Routes & Middleware (P3a)', () => {
  let app: FastifyInstance;
  let fakeRedisStore: Map<string, { val: string; ttl: number }>;
  let fakePrisma: any;
  let redisFailNext: boolean = false;
  let mockAccount: any;

  beforeEach(async () => {
    fakeRedisStore = new Map();
    redisFailNext = false;

    mockAccount = {
      id: 'acc_test_123',
      email: 'jan.kowalski@action.pl',
      passwordHash: await bcrypt.hash('Password123!', 10),
      firstName: 'Jan',
      lastName: 'Kowalski',
      phone: '+48123456789',
      isActive: true,
      createdAt: new Date(),
      membership: {
        id: 'mem_1',
        accountId: 'acc_test_123',
        companyId: 'comp_action',
        programId: 'prog_action_auto',
        isActive: true,
        revokedAt: null,
        company: {
          id: 'comp_action',
          name: 'Action S.A.',
          slug: 'action',
          isActive: true
        },
        program: {
          id: 'prog_action_auto',
          name: 'Action Auto Program',
          slug: 'action-auto',
          isActive: true
        }
      }
    };

    const fakeRedis = {
      get: async (key: string) => {
        if (redisFailNext) throw new Error('Redis connection lost');
        return fakeRedisStore.get(key)?.val ?? null;
      },
      set: async (key: string, val: string, ...args: any[]) => {
        if (redisFailNext) throw new Error('Redis connection lost');
        let ttl = 0;
        if (args[0] === 'EX' && typeof args[1] === 'number') {
          ttl = args[1];
        }
        fakeRedisStore.set(key, { val, ttl });
        return 'OK';
      },
      del: async (key: string) => {
        if (redisFailNext) throw new Error('Redis connection lost');
        return fakeRedisStore.delete(key) ? 1 : 0;
      }
    };

    fakePrisma = {
      employeeAccount: {
        findUnique: async ({ where }: any) => {
          if (where.email === mockAccount.email || where.id === mockAccount.id) {
            const clone = JSON.parse(JSON.stringify(mockAccount));
            clone.createdAt = new Date();
            return clone;
          }
          return null;
        },
        create: async ({ data }: any) => {
          return {
            id: 'acc_created_456',
            email: data.email,
            firstName: data.firstName || null,
            lastName: data.lastName || null,
            phone: data.phone || null,
            isActive: true,
            createdAt: new Date()
          };
        },
        update: async () => mockAccount
      },
      employeeRegistrationCode: {
        findUnique: async () => ({
          id: 'code_1',
          codeHash: 'hash123',
          companyId: 'comp_action',
          programId: 'prog_action_auto',
          isActive: true,
          expiresAt: null,
          company: { id: 'comp_action', name: 'Action S.A.', isActive: true },
          program: { id: 'prog_action_auto', name: 'Action Auto Program', isActive: true }
        })
      },
      employeeMembership: {
        create: async () => ({ id: 'mem_created_456' })
      },
      employeeMembershipAudit: {
        create: async () => ({ id: 'audit_1' })
      },
      $transaction: async (cb: any) => cb(fakePrisma)
    };

    app = Fastify();
    await app.register(fastifyJwt, {
      secret: 'super-secret-employee-test-key-32chars!',
      sign: { expiresIn: '1h' }
    });

    app.decorate('prisma', fakePrisma as any);
    app.decorate('redis', fakeRedis as any);

    await app.register(employeeAuthRoutes);
    await app.ready();
  });

  describe('Cookie parser helper tests', () => {
    it('parses standard cookie headers', () => {
      const map = parseCookiesConstrained('a=1; b=hello_world; c=xyz');
      expect(map.get('a')).toBe('1');
      expect(map.get('b')).toBe('hello_world');
      expect(map.get('c')).toBe('xyz');
    });

    it('rejects duplicate cookie names to prevent smuggling / confusion', () => {
      expect(() => {
        parseCookiesConstrained('session=first; other=1; session=second');
      }).toThrow(/Duplicate cookie name/);
    });

    it('handles empty or undefined cookie strings', () => {
      expect(parseCookiesConstrained(undefined).size).toBe(0);
      expect(parseCookiesConstrained('').size).toBe(0);
    });
  });

  describe('GET /api/employee/auth/csrf', () => {
    it('returns csrfToken in body and sets __Host-ep-csrf cookie', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/employee/auth/csrf'
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json).toHaveProperty('csrfToken');
      expect(json.headerName).toBe('X-CSRF-Token');
      expect(typeof json.csrfToken).toBe('string');
      expect(json.csrfToken.length).toBeGreaterThan(16);

      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : (setCookie as string);
      expect(cookieStr).toContain('__Host-ep-csrf=');
      expect(cookieStr).toContain('Path=/');
      expect(cookieStr).toContain('SameSite=Strict');
      expect(cookieStr).toContain('Secure');
      expect(cookieStr).not.toContain('HttpOnly'); // CSRF token must be readable by client JS
    });

    it('reuses existing valid CSRF cookie without issuing new cookie to prevent multi-tab race', async () => {
      const existingToken = generateSignedCsrfToken(app.jwt);
      const res = await app.inject({
        method: 'GET',
        url: '/api/employee/auth/csrf',
        headers: {
          cookie: `${CSRF_COOKIE_NAME}=${existingToken}`
        }
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().csrfToken).toBe(existingToken);
      expect(res.headers['set-cookie']).toBeUndefined();
    });
  });

  describe('CSRF Middleware on Mutating Routes', () => {
    it('rejects POST /api/employee/auth/login when CSRF token is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/employee/auth/login',
        headers: {
          host: 'portal.test',
          origin: 'https://portal.test'
        },
        payload: {
          email: 'jan.kowalski@action.pl',
          password: 'Password123!'
        }
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().message).toMatch(/CSRF/i);
    });

    it('rejects POST /api/employee/auth/login when CSRF token header does not match cookie', async () => {
      const signedToken = generateSignedCsrfToken(app.jwt);
      const res = await app.inject({
        method: 'POST',
        url: '/api/employee/auth/login',
        headers: {
          host: 'portal.test',
          origin: 'https://portal.test',
          cookie: `${CSRF_COOKIE_NAME}=${signedToken}`,
          [CSRF_HEADER_NAME]: 'token-different-in-header'
        },
        payload: {
          email: 'jan.kowalski@action.pl',
          password: 'Password123!'
        }
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().message).toMatch(/CSRF/i);
    });

    it('rejects request with duplicate cookie header formatting', async () => {
      const signedToken = generateSignedCsrfToken(app.jwt);
      const res = await app.inject({
        method: 'POST',
        url: '/api/employee/auth/login',
        headers: {
          host: 'portal.test',
          origin: 'https://portal.test',
          cookie: `${CSRF_COOKIE_NAME}=${signedToken}; ${CSRF_COOKIE_NAME}=${signedToken}`,
          [CSRF_HEADER_NAME]: signedToken
        },
        payload: {
          email: 'jan.kowalski@action.pl',
          password: 'Password123!'
        }
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().message).toMatch(/zduplikowane/i);
    });

    it('rejects cross-site Sec-Fetch-Site requests', async () => {
      const signedToken = generateSignedCsrfToken(app.jwt);
      const res = await app.inject({
        method: 'POST',
        url: '/api/employee/auth/login',
        headers: {
          host: 'portal.test',
          origin: 'https://portal.test',
          'sec-fetch-site': 'cross-site',
          cookie: `${CSRF_COOKIE_NAME}=${signedToken}`,
          [CSRF_HEADER_NAME]: signedToken
        },
        payload: {
          email: 'jan.kowalski@action.pl',
          password: 'Password123!'
        }
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().message).toMatch(/cross-site/i);
    });

    it('rejects requests with mismatching Origin header', async () => {
      const signedToken = generateSignedCsrfToken(app.jwt);
      const res = await app.inject({
        method: 'POST',
        url: '/api/employee/auth/login',
        headers: {
          host: 'portal.motolia.pl',
          origin: 'https://evil-attacker.com',
          cookie: `${CSRF_COOKIE_NAME}=${signedToken}`,
          [CSRF_HEADER_NAME]: signedToken
        },
        payload: {
          email: 'jan.kowalski@action.pl',
          password: 'Password123!'
        }
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().message).toMatch(/Origin/i);
    });

    it('rejects requests with Origin header containing a path (must be exact origin)', async () => {
      const signedToken = generateSignedCsrfToken(app.jwt);
      const res = await app.inject({
        method: 'POST',
        url: '/api/employee/auth/login',
        headers: {
          host: 'portal.motolia.pl',
          origin: 'https://portal.motolia.pl/some/path',
          cookie: `${CSRF_COOKIE_NAME}=${signedToken}`,
          [CSRF_HEADER_NAME]: signedToken
        },
        payload: {
          email: 'jan.kowalski@action.pl',
          password: 'Password123!'
        }
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().message).toMatch(/Origin/i);
    });

    it('rejects requests with http Origin header (Strict HTTPS requirement)', async () => {
      const signedToken = generateSignedCsrfToken(app.jwt);
      const res = await app.inject({
        method: 'POST',
        url: '/api/employee/auth/login',
        headers: {
          host: 'portal.motolia.pl',
          origin: 'http://portal.motolia.pl',
          cookie: `${CSRF_COOKIE_NAME}=${signedToken}`,
          [CSRF_HEADER_NAME]: signedToken
        },
        payload: {
          email: 'jan.kowalski@action.pl',
          password: 'Password123!'
        }
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().message).toMatch(/HTTPS/i);
    });

    it('rejects requests missing both Origin and Referer', async () => {
      const signedToken = generateSignedCsrfToken(app.jwt);
      const res = await app.inject({
        method: 'POST',
        url: '/api/employee/auth/login',
        headers: {
          host: 'portal.motolia.pl',
          cookie: `${CSRF_COOKIE_NAME}=${signedToken}`,
          [CSRF_HEADER_NAME]: signedToken
        },
        payload: {
          email: 'jan.kowalski@action.pl',
          password: 'Password123!'
        }
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().message).toMatch(/Origin lub Referer/i);
    });

    it('allows requests with valid Referer when Origin is absent', async () => {
      const signedToken = generateSignedCsrfToken(app.jwt);
      const res = await app.inject({
        method: 'POST',
        url: '/api/employee/auth/login',
        headers: {
          host: 'portal.motolia.pl',
          referer: 'https://portal.motolia.pl/login',
          cookie: `${CSRF_COOKIE_NAME}=${signedToken}`,
          [CSRF_HEADER_NAME]: signedToken
        },
        payload: {
          email: 'not-an-email',
          password: ''
        }
      });

      // Passes CSRF validation and fails at route body validation (400 Bad Request)
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/employee/auth/validate-code', () => {
    it('returns 500 without leaking internal error message when service throws unhandled 500 error', async () => {
      fakePrisma.employeeRegistrationCode.findUnique = async () => {
        throw new Error('Database password hash leak: select * from secret_keys where root');
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/employee/auth/validate-code',
        payload: { code: 'CRASH_CODE' }
      });

      expect(res.statusCode).toBe(500);
      const json = res.json();
      expect(json.error).toBe('Internal Server Error');
      expect(json.message).toBe('Wystąpił błąd podczas walidacji kodu');
      expect(JSON.stringify(json)).not.toContain('Database password hash leak');
    });
  });

  describe('POST /api/employee/auth/login with cookie sessions', () => {
    it('rejects if body is invalid', async () => {
      const csrf = generateSignedCsrfToken(app.jwt);
      const res = await app.inject({
        method: 'POST',
        url: '/api/employee/auth/login',
        headers: {
          host: 'localhost:3000',
          origin: 'https://localhost:3000',
          cookie: `${CSRF_COOKIE_NAME}=${csrf}`,
          [CSRF_HEADER_NAME]: csrf
        },
        payload: {
          email: 'not-an-email',
          password: ''
        }
      });

      expect(res.statusCode).toBe(400);
    });

    it('sets HttpOnly Secure SameSite=Lax session cookie and DOES NOT return token in body', async () => {
      const csrf = generateSignedCsrfToken(app.jwt);
      const res = await app.inject({
        method: 'POST',
        url: '/api/employee/auth/login',
        headers: {
          host: 'localhost:3000',
          origin: 'https://localhost:3000',
          cookie: `${CSRF_COOKIE_NAME}=${csrf}`,
          [CSRF_HEADER_NAME]: csrf
        },
        payload: {
          email: mockAccount.email,
          password: 'Password123!'
        }
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['cache-control']).toContain('no-store');
      const body = res.json();
      expect(body).not.toHaveProperty('token'); // STRICT: No token in JSON body
      expect(body).toHaveProperty('employee');
      expect(body.employee.email).toBe(mockAccount.email);
      expect(body.employee.company.slug).toBe('action');

      // Check Set-Cookie headers
      const setCookies = res.headers['set-cookie'];
      expect(setCookies).toBeDefined();
      const cookiesList = Array.isArray(setCookies) ? setCookies : [setCookies as string];

      const sessionCookie = cookiesList.find(c => c.startsWith(`${SESSION_COOKIE_NAME}=`));
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toContain('HttpOnly');
      expect(sessionCookie).toContain('Secure');
      expect(sessionCookie).toContain('SameSite=Lax');
      expect(sessionCookie).toContain('Path=/');

      // Verify session stored in Redis allowlist by jti
      expect(fakeRedisStore.size).toBe(1);
      const [redisKey, redisEntry] = Array.from(fakeRedisStore.entries())[0];
      expect(redisKey).toMatch(/^ep:session:/);
      expect(redisEntry.ttl).toBe(SESSION_TTL_SECONDS);
      const parsedStored = JSON.parse(redisEntry.val);
      expect(parsedStored.accountId).toBe(mockAccount.id);
      expect(parsedStored.companyId).toBe('comp_action');
      expect(parsedStored.programId).toBe('prog_action_auto');
    });
  });

  describe('GET /api/employee/auth/me Protected Endpoint', () => {
    it('rejects Bearer token in Authorization header (ADR-02: cookie only)', async () => {
      const token = app.jwt.sign({
        accountId: mockAccount.id,
        email: mockAccount.email,
        companyId: 'comp_action',
        programId: 'prog_action_auto',
        realm: 'employee',
        aud: 'employee-portal',
        jti: 'some-jti'
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/employee/auth/me',
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().message).toMatch(/brak ciasteczka sesyjnego/i);
    });

    it('rejects tokens containing legacy userId claim or admin realm', async () => {
      const adminToken = app.jwt.sign({
        userId: 'admin_user_123',
        email: 'admin@motolia.pl',
        role: 'admin'
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/employee/auth/me',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${adminToken}`
        }
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().message).toMatch(/nie posiada uprawnień portalu pracowniczego/i);
    });

    it('rejects if token has invalid realm or audience', async () => {
      const invalidRealmToken = app.jwt.sign({
        accountId: mockAccount.id,
        email: mockAccount.email,
        companyId: 'comp_action',
        programId: 'prog_action_auto',
        realm: 'customer',
        aud: 'employee-portal',
        jti: '00000000-0000-4000-a000-000000000000'
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/employee/auth/me',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${invalidRealmToken}`
        }
      });

      expect(res.statusCode).toBe(403);
    });

    it('rejects if session is missing from Redis allowlist (expired/logged out/restart)', async () => {
      const validJwt = app.jwt.sign({
        accountId: mockAccount.id,
        email: mockAccount.email,
        companyId: 'comp_action',
        programId: 'prog_action_auto',
        realm: 'employee',
        aud: 'employee-portal',
        jti: '99999999-9999-4999-a999-999999999999'
      });

      // No entry in fakeRedisStore

      const res = await app.inject({
        method: 'GET',
        url: '/api/employee/auth/me',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${validJwt}`
        }
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().message).toMatch(/wygasła lub została unieważniona/i);
    });

    it('fails closed (500) if Redis errors on session lookup', async () => {
      const jti = '11111111-1111-4111-a111-111111111111';
      const validJwt = app.jwt.sign({
        accountId: mockAccount.id,
        email: mockAccount.email,
        companyId: 'comp_action',
        programId: 'prog_action_auto',
        realm: 'employee',
        aud: 'employee-portal',
        jti
      });

      fakeRedisStore.set(`ep:session:${jti}`, {
        val: JSON.stringify({
          accountId: mockAccount.id,
          companyId: 'comp_action',
          programId: 'prog_action_auto'
        }),
        ttl: 3600
      });
      redisFailNext = true; // Trigger redis error

      const res = await app.inject({
        method: 'GET',
        url: '/api/employee/auth/me',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${validJwt}`
        }
      });

      expect(res.statusCode).toBe(500);
      expect(res.json().message).toMatch(/Błąd weryfikacji stanu sesji/i);
    });

    it('rejects if database account is deactivated', async () => {
      const jti = '22222222-2222-4222-a222-222222222222';
      const validJwt = app.jwt.sign({
        accountId: mockAccount.id,
        email: mockAccount.email,
        companyId: 'comp_action',
        programId: 'prog_action_auto',
        realm: 'employee',
        aud: 'employee-portal',
        jti
      });

      fakeRedisStore.set(`ep:session:${jti}`, {
        val: JSON.stringify({
          accountId: mockAccount.id,
          companyId: 'comp_action',
          programId: 'prog_action_auto'
        }),
        ttl: 3600
      });
      mockAccount.isActive = false;

      const res = await app.inject({
        method: 'GET',
        url: '/api/employee/auth/me',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${validJwt}`
        }
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().message).toMatch(/nieaktywne/i);
      mockAccount.isActive = true; // restore
    });

    it('rejects if token companyId does not match current active membership', async () => {
      const jti = '33333333-3333-4333-a333-333333333333';
      const validJwt = app.jwt.sign({
        accountId: mockAccount.id,
        email: mockAccount.email,
        companyId: 'comp_other_tampered',
        programId: 'prog_action_auto',
        realm: 'employee',
        aud: 'employee-portal',
        jti
      });

      fakeRedisStore.set(`ep:session:${jti}`, {
        val: JSON.stringify({
          accountId: mockAccount.id,
          companyId: 'comp_other_tampered',
          programId: 'prog_action_auto'
        }),
        ttl: 3600
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/employee/auth/me',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${validJwt}`
        }
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().message).toMatch(/Brak aktywnego przypisania/i);
    });

    it('sets generic 500 without leaking sensitive exception data on unexpected route crash', async () => {
      fakePrisma.employeeAccount.findUnique = async () => {
        throw new Error('Database password hash leak or sql connection error info');
      };

      const jti = '55555555-5555-4555-a555-555555555555';
      const validJwt = app.jwt.sign({
        accountId: mockAccount.id,
        email: mockAccount.email,
        companyId: 'comp_action',
        programId: 'prog_action_auto',
        realm: 'employee',
        aud: 'employee-portal',
        jti
      });

      fakeRedisStore.set(`ep:session:${jti}`, {
        val: JSON.stringify({
          accountId: mockAccount.id,
          companyId: 'comp_action',
          programId: 'prog_action_auto'
        }),
        ttl: 3600
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/employee/auth/me',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${validJwt}`
        }
      });

      expect(res.statusCode).toBe(500);
      const json = res.json();
      expect(json.error).toBe('Internal Server Error');
      expect(json.message).toBe('Błąd weryfikacji tożsamości pracownika');
      expect(JSON.stringify(json)).not.toContain('Database password hash leak');
    });

    it('succeeds for valid active session cookie and verified active membership', async () => {
      const jti = '44444444-4444-4444-a444-444444444444';
      const validJwt = app.jwt.sign({
        accountId: mockAccount.id,
        email: mockAccount.email,
        companyId: 'comp_action',
        programId: 'prog_action_auto',
        realm: 'employee',
        aud: 'employee-portal',
        jti
      });

      fakeRedisStore.set(`ep:session:${jti}`, {
        val: JSON.stringify({
          accountId: mockAccount.id,
          companyId: 'comp_action',
          programId: 'prog_action_auto'
        }),
        ttl: 3600
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/employee/auth/me',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${validJwt}`
        }
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json).toHaveProperty('employee');
      expect(json.employee.id).toBe(mockAccount.id);
      expect(json.employee.email).toBe(mockAccount.email);
    });
  });

  describe('POST /api/employee/auth/logout', () => {
    it('requires valid CSRF token and session, invalidates Redis allowlist and clears cookies', async () => {
      const jti = '77777777-7777-4777-a777-777777777777';
      const validJwt = app.jwt.sign({
        accountId: mockAccount.id,
        email: mockAccount.email,
        companyId: 'comp_action',
        programId: 'prog_action_auto',
        realm: 'employee',
        aud: 'employee-portal',
        jti
      });

      fakeRedisStore.set(`ep:session:${jti}`, {
        val: JSON.stringify({
          accountId: mockAccount.id,
          companyId: 'comp_action',
          programId: 'prog_action_auto'
        }),
        ttl: 3600
      });
      const csrf = generateSignedCsrfToken(app.jwt);

      // 1. Mutating call with CSRF token and session cookie
      const res = await app.inject({
        method: 'POST',
        url: '/api/employee/auth/logout',
        headers: {
          host: 'portal.test',
          origin: 'https://portal.test',
          cookie: `${SESSION_COOKIE_NAME}=${validJwt}; ${CSRF_COOKIE_NAME}=${csrf}`,
          [CSRF_HEADER_NAME]: csrf
        }
      });

      expect(res.statusCode).toBe(200);
      expect(fakeRedisStore.has(`ep:session:${jti}`)).toBe(false);

      // Verify clear cookies
      const setCookies = res.headers['set-cookie'];
      expect(setCookies).toBeDefined();
      const cookiesList = Array.isArray(setCookies) ? setCookies : [setCookies as string];

      const sessionCookie = cookiesList.find(c => c.startsWith(`${SESSION_COOKIE_NAME}=`));
      expect(sessionCookie).toContain('Max-Age=0');

      const csrfCookie = cookiesList.find(c => c.startsWith(`${CSRF_COOKIE_NAME}=`));
      expect(csrfCookie).toContain('Max-Age=0');
    });

    it('fails with 500 and does NOT clear cookies when Redis del fails', async () => {
      const jti = '88888888-8888-4888-a888-888888888888';
      const validJwt = app.jwt.sign({
        accountId: mockAccount.id,
        email: mockAccount.email,
        companyId: 'comp_action',
        programId: 'prog_action_auto',
        realm: 'employee',
        aud: 'employee-portal',
        jti
      });

      fakeRedisStore.set(`ep:session:${jti}`, {
        val: JSON.stringify({
          accountId: mockAccount.id,
          companyId: 'comp_action',
          programId: 'prog_action_auto'
        }),
        ttl: 3600
      });
      const csrf = generateSignedCsrfToken(app.jwt);

      redisFailNext = true;

      const res = await app.inject({
        method: 'POST',
        url: '/api/employee/auth/logout',
        headers: {
          host: 'portal.test',
          origin: 'https://portal.test',
          cookie: `${SESSION_COOKIE_NAME}=${validJwt}; ${CSRF_COOKIE_NAME}=${csrf}`,
          [CSRF_HEADER_NAME]: csrf
        }
      });

      expect(res.statusCode).toBe(500);
      const json = res.json();
      expect(json.error).toBe('Internal Server Error');
      const setCookies = res.headers['set-cookie'];
      expect(setCookies).toBeUndefined();
    });
  });
});
