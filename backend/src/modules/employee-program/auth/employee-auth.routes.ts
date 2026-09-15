import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  validateRegistrationCode,
  registerEmployeeWithCode,
  authenticateEmployee,
  getEmployeeProfile
} from './employee-auth.service.js';
import { verifyEmployeeAuth, verifyEmployeeCsrf } from './employee-auth.middleware.js';
import { EmployeeJwtPayload } from './employee-auth.types.js';
import {
  generateSignedCsrfToken,
  verifySignedCsrfToken,
  generateJti,
  formatCsrfCookie,
  formatSessionCookie,
  formatClearSessionCookie,
  formatClearCsrfCookie,
  parseCookiesConstrained,
  SESSION_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  SESSION_TTL_SECONDS
} from './employee-session.helpers.js';

// Request Validation Schemas with Zod
const validateCodeSchema = z.object({
  code: z.string().trim().min(1).max(100)
});

const registerSchema = z.object({
  code: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(50).optional()
});

const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(128)
});

export async function employeeAuthRoutes(fastify: FastifyInstance) {
  // Scoped no-store hook for all employee routes
  fastify.addHook('onSend', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    reply.header('Pragma', 'no-cache');
  });

  // Scoped error handler to ensure unknown route exceptions return generic 500 without raw error / log PII
  fastify.setErrorHandler((error: any, _request: FastifyRequest, reply: FastifyReply) => {
    const statusCode = typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 600
      ? error.statusCode
      : 500;

    if (statusCode === 429) {
      return reply.code(429).send({
        statusCode: 429,
        error: 'Too Many Requests',
        message: error.message || 'Zbyt wiele żądań, spróbuj ponownie później'
      });
    }

    if (statusCode < 500) {
      return reply.code(statusCode).send({
        error: error.name || (statusCode === 400 ? 'Bad Request' : statusCode === 401 ? 'Unauthorized' : statusCode === 403 ? 'Forbidden' : statusCode === 404 ? 'Not Found' : 'Error'),
        message: error.message || 'Wystąpił błąd żądania'
      });
    }

    // 500+ Generic server error, no internal exception details or PII exposed
    fastify.log.error('Employee auth route internal error occurred');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Wystąpił wewnętrzny błąd serwera'
    });
  });

  // 0. Bootstrap CSRF Token (reusing existing valid cookie if present to avoid multi-tab race)
  fastify.get('/api/employee/auth/csrf', {
    config: {
      rateLimit: {
        max: 60,
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    let existingToken: string | undefined;

    try {
      const cookies = parseCookiesConstrained(request.headers.cookie);
      const candidate = cookies.get(CSRF_COOKIE_NAME);
      if (candidate && verifySignedCsrfToken(candidate, fastify.jwt)) {
        existingToken = candidate;
      }
    } catch {
      // Ignore parse error, we'll issue a fresh token
    }

    const token = existingToken || generateSignedCsrfToken(fastify.jwt);

    // If fresh or refreshed, ensure cookie is set
    if (!existingToken) {
      reply.header('Set-Cookie', formatCsrfCookie(token));
    }

    return reply.code(200).send({
      csrfToken: token,
      headerName: 'X-CSRF-Token'
    });
  });

  // 1. Walidacja kodu firmy (przed rejestracją)
  fastify.post('/api/employee/auth/validate-code', {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    const parsed = validateCodeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Kod rejestracyjny jest wymagany i nie może być pusty'
      });
    }

    try {
      const result = await validateRegistrationCode(fastify.prisma, parsed.data.code);
      return reply.code(200).send(result);
    } catch (err: any) {
      const status = typeof err.statusCode === 'number' ? err.statusCode : 500;
      if (status >= 500) {
        fastify.log.error('Employee validate-code failure');
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Wystąpił błąd podczas walidacji kodu'
        });
      }
      return reply.code(status).send({
        error: status === 404 ? 'Not Found' : status === 410 ? 'Gone' : status === 403 ? 'Forbidden' : 'Bad Request',
        message: err.message || 'Błąd walidacji kodu'
      });
    }
  });

  // 2. Rejestracja pracownika z kodem firmy
  fastify.post('/api/employee/auth/register', {
    preHandler: [verifyEmployeeCsrf],
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Nieprawidłowe dane formularza rejestracji'
      });
    }

    try {
      const profile = await registerEmployeeWithCode(fastify.prisma, parsed.data);

      const jti = generateJti();
      const jwtPayload: EmployeeJwtPayload = {
        accountId: profile.id,
        email: profile.email,
        companyId: profile.company.id,
        programId: profile.program.id,
        realm: 'employee',
        aud: 'employee-portal',
        jti
      };

      const token = fastify.jwt.sign(jwtPayload, { expiresIn: '7d' });

      // Save to Redis session allowlist fail-closed
      if (!fastify.redis) {
        throw { statusCode: 500, message: 'Brak połączenia z magazynem sesji' };
      }

      await fastify.redis.set(
        `ep:session:${jti}`,
        JSON.stringify({
          accountId: profile.id,
          companyId: profile.company.id,
          programId: profile.program.id,
          createdAt: new Date().toISOString()
        }),
        'EX',
        SESSION_TTL_SECONDS
      );

      const csrfToken = generateSignedCsrfToken(fastify.jwt);
      reply.header('Set-Cookie', [
        formatSessionCookie(token),
        formatCsrfCookie(csrfToken)
      ]);

      return reply.code(201).send({
        employee: profile
      });
    } catch (err: any) {
      const status = typeof err.statusCode === 'number' ? err.statusCode : 500;
      if (status >= 500) {
        fastify.log.error('Employee registration failure');
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Wystąpił błąd podczas rejestracji'
        });
      }
      return reply.code(status).send({
        error: status === 409 ? 'Conflict' : status === 400 ? 'Bad Request' : 'Error',
        message: err.message || 'Błąd rejestracji'
      });
    }
  });

  // 3. Logowanie pracownika
  fastify.post('/api/employee/auth/login', {
    preHandler: [verifyEmployeeCsrf],
    config: {
      rateLimit: {
        max: 15,
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Adres e-mail i hasło są wymagane'
      });
    }

    try {
      const authResult = await authenticateEmployee(fastify.prisma, parsed.data.email, parsed.data.password);

      const jti = generateJti();
      const jwtPayload: EmployeeJwtPayload = {
        accountId: authResult.account.id,
        email: authResult.account.email,
        companyId: authResult.membership.companyId,
        programId: authResult.membership.programId,
        realm: 'employee',
        aud: 'employee-portal',
        jti
      };

      const token = fastify.jwt.sign(jwtPayload, { expiresIn: '7d' });

      if (!fastify.redis) {
        throw { statusCode: 500, message: 'Brak połączenia z magazynem sesji' };
      }

      await fastify.redis.set(
        `ep:session:${jti}`,
        JSON.stringify({
          accountId: authResult.account.id,
          companyId: authResult.membership.companyId,
          programId: authResult.membership.programId,
          createdAt: new Date().toISOString()
        }),
        'EX',
        SESSION_TTL_SECONDS
      );

      const csrfToken = generateSignedCsrfToken(fastify.jwt);
      reply.header('Set-Cookie', [
        formatSessionCookie(token),
        formatCsrfCookie(csrfToken)
      ]);

      return reply.code(200).send({
        employee: {
          id: authResult.account.id,
          email: authResult.account.email,
          firstName: authResult.account.firstName,
          lastName: authResult.account.lastName,
          phone: (authResult.account as any).phone || null,
          company: {
            id: authResult.membership.companyId,
            name: authResult.membership.companyName,
            slug: authResult.membership.companySlug
          },
          program: {
            id: authResult.membership.programId,
            name: authResult.membership.programName,
            slug: authResult.membership.programSlug
          }
        }
      });
    } catch (err: any) {
      const status = typeof err.statusCode === 'number' ? err.statusCode : 500;
      if (status >= 500) {
        fastify.log.error('Employee login failure');
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Wystąpił błąd podczas logowania'
        });
      }
      return reply.code(status).send({
        error: status === 401 ? 'Unauthorized' : status === 403 ? 'Forbidden' : 'Error',
        message: err.message || 'Błąd logowania'
      });
    }
  });

  // 4. Profil zalogowanego pracownika
  fastify.get('/api/employee/auth/me', {
    preHandler: [verifyEmployeeAuth]
  }, async (request, reply) => {
    const employee = (request as any).employee;

    try {
      const profile = await getEmployeeProfile(fastify.prisma, employee.accountId);
      return reply.code(200).send({ employee: profile });
    } catch (err: any) {
      const status = typeof err.statusCode === 'number' ? err.statusCode : 500;
      if (status >= 500) {
        fastify.log.error('Employee getProfile failure');
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Wystąpił błąd podczas pobierania profilu'
        });
      }
      return reply.code(status).send({
        error: status === 404 ? 'Not Found' : status === 403 ? 'Forbidden' : 'Error',
        message: err.message || 'Błąd pobierania profilu'
      });
    }
  });

  // 5. Wylogowanie
  fastify.post('/api/employee/auth/logout', {
    preHandler: [verifyEmployeeCsrf]
  }, async (request, reply) => {
    let cookies: Map<string, string>;
    try {
      cookies = parseCookiesConstrained(request.headers.cookie);
    } catch (err) {
      return reply.code(400).send({ error: 'Bad Request', message: 'Błędny format cookies' });
    }

    const sessionJwt = cookies.get(SESSION_COOKIE_NAME);
    if (sessionJwt) {
      // Logout does not require active business permissions. Invalid or expired
      // cookies can be cleared, but must never select a Redis key for deletion.
      let payload: EmployeeJwtPayload | undefined;
      try {
        payload = fastify.jwt.verify<EmployeeJwtPayload>(sessionJwt);
      } catch { /* Already expired or invalid: clear only the browser cookies. */ }
      if (payload?.realm === 'employee' && payload.aud === 'employee-portal'
        && typeof payload.jti === 'string'
        && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.jti)
        && typeof payload.accountId === 'string' && payload.accountId.length > 0
        && typeof payload.companyId === 'string' && payload.companyId.length > 0
        && typeof payload.programId === 'string' && payload.programId.length > 0
        && !('userId' in payload) && Number.isInteger(payload.exp)
        && payload.exp! > Math.floor(Date.now() / 1000)) {
        if (!fastify.redis) {
          return reply.code(500).send({ error: 'Internal Server Error', message: 'Błąd podczas wylogowywania' });
        }
        try {
          await fastify.redis.del(`ep:session:${payload.jti}`);
        } catch (err) {
          fastify.log.error('Redis del error during employee logout');
          return reply.code(500).send({
            error: 'Internal Server Error',
            message: 'Błąd podczas unieważniania sesji'
          });
        }
      }
    }

    reply.header('Set-Cookie', [
      formatClearSessionCookie(),
      formatClearCsrfCookie()
    ]);

    return reply.code(200).send({ message: 'Wylogowano pomyślnie' });
  });
}
