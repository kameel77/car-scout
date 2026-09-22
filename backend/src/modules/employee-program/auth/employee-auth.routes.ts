import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  validateRegistrationCode,
  registerEmployeeWithCode,
  authenticateEmployee,
  getEmployeeProfile,
  emailSchema,
  passwordSchema
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
import {
  sendEmployeePasswordResetEmail,
  sendEmployeePasswordChangedEmail
} from '../../../services/email.js';

// Request Validation Schemas with Zod
const forgotPasswordSchema = z.object({
  email: emailSchema
});

const resetPasswordSchema = z.object({
  token: z.string().trim().min(1).max(256),
  password: passwordSchema
});

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

const updateProfileSchema = z.object({
  firstName: z.string().trim().max(100).optional().nullable(),
  lastName: z.string().trim().max(100).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable()
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Obecne hasło jest wymagane').max(128),
  newPassword: z.string().min(8, 'Hasło musi zawierać co najmniej 8 znaków')
    .refine(
      (val) => Buffer.byteLength(val, 'utf8') <= 72,
      'Hasło jest za długie (maks. 72 znaki)'
    )
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
        max: 600,
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
        max: 600,
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
      if (fastify.redis) {
        const codeFailKey = `ep:code:fail:${request.ip}`;
        const currentFails = await fastify.redis.get(codeFailKey);
        if (currentFails && parseInt(currentFails, 10) >= 250) {
          return reply.code(429).send({
            error: 'Too Many Requests',
            message: 'Zbyt wiele nieudanych prób walidacji kodu z tego adresu IP. Odczekaj 10 minut.'
          });
        }
      }

      const result = await validateRegistrationCode(fastify.prisma, parsed.data.code);
      return reply.code(200).send(result);
    } catch (err: any) {
      const status = typeof err.statusCode === 'number' ? err.statusCode : 500;
      if (status < 500 && fastify.redis && typeof fastify.redis.incr === 'function') {
        try {
          const codeFailKey = `ep:code:fail:${request.ip}`;
          const fails = await fastify.redis.incr(codeFailKey);
          if (fails === 1 && typeof fastify.redis.expire === 'function') {
            await fastify.redis.expire(codeFailKey, 600); // 10 min
          }
        } catch {
          // Redis failure tracking should not crash the error reply
        }
      }
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
        max: 300,
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
        max: 300,
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

    const normalizedEmail = parsed.data.email.toLowerCase().trim();
    const accountLockKey = `ep:login:fail:${normalizedEmail}:${request.ip}`;

    if (fastify.redis) {
      const currentFails = await fastify.redis.get(accountLockKey);
      if (currentFails && parseInt(currentFails, 10) >= 10) {
        return reply.code(429).send({
          error: 'Too Many Requests',
          message: 'Zbyt wiele nieudanych prób logowania na to konto z tego adresu IP. Spróbuj ponownie za 15 minut.'
        });
      }
    }

    try {
      const authResult = await authenticateEmployee(fastify.prisma, parsed.data.email, parsed.data.password);

      // Reset failure counter on successful authentication
      if (fastify.redis) {
        await fastify.redis.del(accountLockKey);
      }

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
      if ((status === 401 || status === 403) && fastify.redis && typeof fastify.redis.incr === 'function') {
        try {
          const fails = await fastify.redis.incr(accountLockKey);
          if (fails === 1 && typeof fastify.redis.expire === 'function') {
            await fastify.redis.expire(accountLockKey, 900); // 15 min
          }
        } catch {
          // Redis failure tracking should not crash the error reply
        }
      }
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

  // 4b. Aktualizacja profilu zalogowanego pracownika
  fastify.patch('/api/employee/auth/me', {
    preHandler: [verifyEmployeeAuth, verifyEmployeeCsrf],
    config: {
      rateLimit: {
        max: 300,
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    const employee = (request as any).employee;
    const parsed = updateProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: parsed.error.errors[0]?.message || 'Nieprawidłowe dane aktualizacji profilu'
      });
    }

    try {
      const updateData: { firstName?: string | null; lastName?: string | null; phone?: string | null } = {};
      if (parsed.data.firstName !== undefined) updateData.firstName = parsed.data.firstName;
      if (parsed.data.lastName !== undefined) updateData.lastName = parsed.data.lastName;
      if (parsed.data.phone !== undefined) updateData.phone = parsed.data.phone;

      await fastify.prisma.employeeAccount.update({
        where: { id: employee.accountId },
        data: updateData
      });

      const profile = await getEmployeeProfile(fastify.prisma, employee.accountId);
      return reply.code(200).send({ employee: profile });
    } catch (err: any) {
      const status = typeof err.statusCode === 'number' ? err.statusCode : 500;
      if (status >= 500) {
        fastify.log.error('Employee updateProfile failure');
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Wystąpił błąd podczas aktualizacji profilu'
        });
      }
      return reply.code(status).send({
        error: status === 404 ? 'Not Found' : 'Bad Request',
        message: err.message || 'Błąd aktualizacji profilu'
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

  // 6. Odzyskiwanie hasła (zapomniane hasło)
  fastify.post('/api/employee/auth/forgot-password', {
    preHandler: [verifyEmployeeCsrf],
    config: {
      rateLimit: {
        max: 150,
        timeWindow: '15 minutes'
      }
    }
  }, async (request, reply) => {
    const parseResult = forgotPasswordSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: parseResult.error.errors[0]?.message || 'Niepoprawny format adresu e-mail'
      });
    }

    const { email } = parseResult.data;
    const genericResponse = { message: 'Jeśli konto istnieje, wysłaliśmy link do zmiany hasła.' };

    try {
      const account = await fastify.prisma.employeeAccount.findUnique({
        where: { email },
        include: { membership: true }
      });

      if (!account || !account.isActive || !account.membership || !account.membership.isActive || account.membership.revokedAt !== null) {
        return reply.code(200).send(genericResponse);
      }

      // Limit per konto: maks 3 tokeny w ciągu godziny
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentTokensCount = await fastify.prisma.employeePasswordResetToken.count({
        where: {
          accountId: account.id,
          createdAt: { gte: oneHourAgo }
        }
      });

      if (recentTokensCount >= 3) {
        fastify.log.warn('Password reset token rate limit reached for account');
        return reply.code(200).send(genericResponse);
      }

      const rawToken = crypto.randomBytes(32).toString('base64url');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min
      const requestedIp = request.ip || null;

      await fastify.prisma.employeePasswordResetToken.create({
        data: {
          accountId: account.id,
          tokenHash,
          expiresAt,
          requestedIp
        }
      });

      const portalUrl = process.env.EMPLOYEE_PORTAL_URL?.replace(/\/+$/, '');
      if (!portalUrl) {
        fastify.log.warn('EMPLOYEE_PORTAL_URL not configured. Skipping password reset email notification.');
        return reply.code(200).send(genericResponse);
      }

      const resetLink = `${portalUrl}/reset-hasla?token=${rawToken}`;
      // Fire-and-forget: do not await email sending
      sendEmployeePasswordResetEmail(fastify, email, resetLink).catch((err) => {
        fastify.log.error(err, 'Failed to send employee password reset email asynchronously');
      });

      return reply.code(200).send(genericResponse);
    } catch (err) {
      fastify.log.error(err, 'Unexpected error during employee forgot-password');
      return reply.code(200).send(genericResponse);
    }
  });

  // 7. Zmiana hasła z tokenem
  fastify.post('/api/employee/auth/reset-password', {
    preHandler: [verifyEmployeeCsrf],
    config: {
      rateLimit: {
        max: 150,
        timeWindow: '15 minutes'
      }
    }
  }, async (request, reply) => {
    const parseResult = resetPasswordSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: parseResult.error.errors[0]?.message || 'Nieprawidłowe dane zmiany hasła'
      });
    }

    const { token, password } = parseResult.data;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Hashowanie bcrypt PRZED transakcją, aby nie blokować bazy Postgresa
    const newPasswordHash = await bcrypt.hash(password, 10);
    const now = new Date();
    const sessionsValidAfter = new Date(Math.floor(Date.now() / 1000) * 1000);

    try {
      await fastify.prisma.$transaction(async (tx) => {
        // Atomowy updateMany zużywający token
        const updateResult = await tx.employeePasswordResetToken.updateMany({
          where: {
            tokenHash,
            usedAt: null,
            expiresAt: { gt: now }
          },
          data: {
            usedAt: now
          }
        });

        if (updateResult.count !== 1) {
          const err: any = new Error('Link wygasł lub został już użyty');
          err.statusCode = 400;
          throw err;
        }

        const tokenRecord = await tx.employeePasswordResetToken.findUnique({
          where: { tokenHash },
          include: {
            account: {
              include: { membership: true }
            }
          }
        });

        if (
          !tokenRecord ||
          !tokenRecord.account ||
          !tokenRecord.account.isActive ||
          !tokenRecord.account.membership ||
          !tokenRecord.account.membership.isActive ||
          tokenRecord.account.membership.revokedAt !== null
        ) {
          const err: any = new Error('Link wygasł lub został już użyty');
          err.statusCode = 400;
          throw err;
        }

        // Unieważnienie wszystkich pozostałych niezużytych tokenów konta
        await tx.employeePasswordResetToken.updateMany({
          where: {
            accountId: tokenRecord.accountId,
            usedAt: null
          },
          data: {
            usedAt: now
          }
        });

        // Aktualizacja konta: nowe hasło + sessionsValidAfter
        await tx.employeeAccount.update({
          where: { id: tokenRecord.accountId },
          data: {
            passwordHash: newPasswordHash,
            sessionsValidAfter
          }
        });
      });

      // Wyczyszczenie ciasteczek sesji w odpowiedzi
      reply.header('Set-Cookie', [
        formatClearSessionCookie(),
        formatClearCsrfCookie()
      ]);

      return reply.code(200).send({
        message: 'Hasło zostało pomyślnie zmienione. Możesz się teraz zalogować.'
      });
    } catch (err: any) {
      if (err?.statusCode === 400) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: err.message || 'Link wygasł lub został już użyty'
        });
      }
      fastify.log.error(err, 'Unexpected error during employee reset-password');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Wystąpił błąd podczas zmiany hasła'
      });
    }
  });

  // 8. Zmiana hasła przez zalogowanego pracownika
  fastify.post('/api/employee/auth/change-password', {
    preHandler: [verifyEmployeeAuth, verifyEmployeeCsrf],
    config: {
      rateLimit: {
        max: 300,
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    const employee = (request as any).employee;
    const parsed = changePasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: parsed.error.errors[0]?.message || 'Nieprawidłowe dane formularza zmiany hasła'
      });
    }

    const { currentPassword, newPassword } = parsed.data;

    try {
      const account = await fastify.prisma.employeeAccount.findUnique({
        where: { id: employee.accountId }
      });

      if (!account || !account.isActive) {
        return reply.code(403).send({
          error: 'Forbidden',
          message: 'Konto jest nieaktywne'
        });
      }

      const isCurrentValid = await bcrypt.compare(currentPassword, account.passwordHash);
      if (!isCurrentValid) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Nieprawidłowe obecne hasło'
        });
      }

      // Hashowanie bcrypt przed zapisem do bazy
      const newPasswordHash = await bcrypt.hash(newPassword, 10);
      const nowSec = Math.floor(Date.now() / 1000);
      const sessionsValidAfter = new Date(nowSec * 1000);

      await fastify.prisma.employeeAccount.update({
        where: { id: employee.accountId },
        data: {
          passwordHash: newPasswordHash,
          sessionsValidAfter
        }
      });

      // Usunięcie starej sesji z Redis dla bieżącego tokena
      try {
        const cookies = parseCookiesConstrained(request.headers.cookie);
        const sessionJwt = cookies.get(SESSION_COOKIE_NAME);
        if (sessionJwt) {
          const payload = fastify.jwt.verify<EmployeeJwtPayload>(sessionJwt);
          if (payload?.jti && fastify.redis) {
            await fastify.redis.del(`ep:session:${payload.jti}`);
          }
        }
      } catch {
        // Ignoruj błąd parsowania starej sesji
      }

      // Wystawienie nowej sesji dla bieżącego urządzenia z iat równym nowSec
      const newJti = generateJti();
      const jwtPayload: EmployeeJwtPayload = {
        accountId: employee.accountId,
        email: employee.email,
        companyId: employee.companyId,
        programId: employee.programId,
        realm: 'employee',
        aud: 'employee-portal',
        jti: newJti,
        iat: nowSec
      };

      const newToken = fastify.jwt.sign(jwtPayload, { expiresIn: '7d' });

      if (fastify.redis) {
        await fastify.redis.set(
          `ep:session:${newJti}`,
          JSON.stringify({
            accountId: employee.accountId,
            companyId: employee.companyId,
            programId: employee.programId,
            createdAt: new Date(nowSec * 1000).toISOString()
          }),
          'EX',
          SESSION_TTL_SECONDS
        );
      }

      const csrfToken = generateSignedCsrfToken(fastify.jwt);
      reply.header('Set-Cookie', [
        formatSessionCookie(newToken),
        formatCsrfCookie(csrfToken)
      ]);

      // Fire-and-forget powiadomienie mailowe o zmianie hasła
      sendEmployeePasswordChangedEmail(fastify, employee.email).catch((err) => {
        fastify.log.error(err, 'Failed to send employee password changed confirmation email');
      });

      return reply.code(200).send({
        message: 'Hasło zmienione. Pozostałe urządzenia zostały wylogowane.'
      });
    } catch (err: any) {
      if (err?.statusCode === 400 || err?.statusCode === 403) {
        return reply.code(err.statusCode).send({
          error: err.statusCode === 403 ? 'Forbidden' : 'Bad Request',
          message: err.message
        });
      }
      fastify.log.error(err, 'Unexpected error during employee change-password');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Wystąpił błąd podczas zmiany hasła'
      });
    }
  });
}
