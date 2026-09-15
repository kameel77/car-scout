import crypto from 'crypto';
import { FastifyReply, FastifyRequest } from 'fastify';
import { EmployeeJwtPayload } from './employee-auth.types.js';
import {
  parseCookiesConstrained,
  verifySignedCsrfToken,
  SESSION_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME
} from './employee-session.helpers.js';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(id: unknown): id is string {
  return typeof id === 'string' && UUID_V4_REGEX.test(id);
}

export async function verifyEmployeeCsrf(request: FastifyRequest, reply: FastifyReply) {
  // Safe methods do not require CSRF token
  const method = request.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return;
  }

  // 1. Origin / Referer Validation (Strict HTTPS Origin exact https://${Host})
  const host = request.headers.host;
  const origin = request.headers.origin;
  const referer = request.headers.referer;
  const secFetchSite = request.headers['sec-fetch-site'] as string | undefined;

  // Reject cross-site fetch metadata when present
  if (secFetchSite && secFetchSite === 'cross-site') {
    return reply.code(403).send({
      error: 'Forbidden',
      message: 'Zablokowano niebezpieczne żądanie cross-site (Sec-Fetch-Site: cross-site)'
    });
  }

  if (!host || typeof host !== 'string' || host.trim().length === 0) {
    return reply.code(403).send({
      error: 'Forbidden',
      message: 'Brak lub nieprawidłowy nagłówek Host'
    });
  }

  const expectedOrigin = `https://${host}`;

  if (origin !== undefined) {
    if (typeof origin !== 'string' || origin === 'null' || origin.trim().length === 0) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: 'Nieprawidłowy nagłówek Origin'
      });
    }

    let parsedOrigin: URL;
    try {
      parsedOrigin = new URL(origin);
    } catch {
      return reply.code(403).send({
        error: 'Forbidden',
        message: 'Nieprawidłowy nagłówek Origin'
      });
    }

    if (parsedOrigin.protocol !== 'https:') {
      return reply.code(403).send({
        error: 'Forbidden',
        message: 'Nagłówek Origin musi używać protokołu HTTPS'
      });
    }

    if (origin !== expectedOrigin) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: 'Niezgodność nagłówka Origin z hostem serwera'
      });
    }
  } else if (referer !== undefined) {
    if (typeof referer !== 'string' || referer.trim().length === 0) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: 'Nieprawidłowy nagłówek Referer'
      });
    }

    let parsedReferer: URL;
    try {
      parsedReferer = new URL(referer);
    } catch {
      return reply.code(403).send({
        error: 'Forbidden',
        message: 'Nieprawidłowy nagłówek Referer'
      });
    }

    if (parsedReferer.protocol !== 'https:') {
      return reply.code(403).send({
        error: 'Forbidden',
        message: 'Nagłówek Referer musi używać protokołu HTTPS'
      });
    }

    if (parsedReferer.origin !== expectedOrigin) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: 'Niezgodność nagłówka Referer z hostem serwera'
      });
    }
  } else {
    // Missing both Origin and Referer -> reject
    return reply.code(403).send({
      error: 'Forbidden',
      message: 'Wymagany nagłówek Origin lub Referer dla żądań modyfikujących'
    });
  }

  // 2. Cookie parsing & Duplicate Rejection
  let cookies: Map<string, string>;
  try {
    cookies = parseCookiesConstrained(request.headers.cookie);
  } catch (err) {
    return reply.code(403).send({
      error: 'Forbidden',
      message: 'Nieprawidłowe nagłówki cookies (wykryto zduplikowane nazwy ciasteczek)'
    });
  }

  const cookieToken = cookies.get(CSRF_COOKIE_NAME);
  const headerToken = request.headers[CSRF_HEADER_NAME] as string | undefined;

  if (!cookieToken || !headerToken) {
    return reply.code(403).send({
      error: 'Forbidden',
      message: 'Brak tokena CSRF w nagłówku lub ciasteczku'
    });
  }

  // Verify token matches in constant time
  let tokensMatch = false;
  try {
    tokensMatch =
      cookieToken.length === headerToken.length &&
      crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken));
  } catch {
    tokensMatch = false;
  }

  if (!tokensMatch) {
    return reply.code(403).send({
      error: 'Forbidden',
      message: 'Niezgodność tokena CSRF w nagłówku z ciasteczkiem'
    });
  }

  // 3. Verify cryptographic signature and claims of CSRF JWT token via fastify.jwt
  const fastify = request.server;
  if (!fastify.jwt || !verifySignedCsrfToken(cookieToken, fastify.jwt)) {
    return reply.code(403).send({
      error: 'Forbidden',
      message: 'Podrobiony lub nieprawidłowo podpisany token CSRF'
    });
  }
}

export async function verifyEmployeeAuth(request: FastifyRequest, reply: FastifyReply) {
  const fastify = request.server;

  // 1. Explicitly reject Bearer tokens or Authorization header for employee auth
  // (ADR-02: host-only HttpOnly Secure SameSite=Lax session cookie only)

  // 2. Parse cookie header strictly
  let cookies: Map<string, string>;
  try {
    cookies = parseCookiesConstrained(request.headers.cookie);
  } catch (err) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Nieprawidłowy nagłówek cookie sesji'
    });
  }

  const sessionJwt = cookies.get(SESSION_COOKIE_NAME);
  if (!sessionJwt) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Brak aktywnej sesji (brak ciasteczka sesyjnego)'
    });
  }

  // 3. Verify JWT directly via fastify.jwt.verify (never request.jwtVerify to preserve realm isolation)
  let payload: EmployeeJwtPayload;
  try {
    payload = fastify.jwt.verify<EmployeeJwtPayload>(sessionJwt);
  } catch (err) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Nieprawidłowy lub wygasły token sesji'
    });
  }

  // 4. Strict Realm, Audience, UUID jti, String IDs, and finite integer exp check
  if (
    !payload ||
    typeof payload !== 'object' ||
    payload.realm !== 'employee' ||
    payload.aud !== 'employee-portal' ||
    typeof payload.accountId !== 'string' ||
    payload.accountId.trim().length === 0 ||
    typeof payload.email !== 'string' ||
    payload.email.trim().length === 0 ||
    typeof payload.companyId !== 'string' ||
    payload.companyId.trim().length === 0 ||
    typeof payload.programId !== 'string' ||
    payload.programId.trim().length === 0 ||
    !isValidUuid(payload.jti) ||
    (payload as any).userId !== undefined // Explicitly reject legacy admin userId
  ) {
    return reply.code(403).send({
      error: 'Forbidden',
      message: 'Token sesji nie posiada uprawnień portalu pracowniczego'
    });
  }

  if (!Number.isInteger(payload.exp)) {
    return reply.code(403).send({ error: 'Forbidden', message: 'Wymagany poprawny czas wygaśnięcia tokena' });
  }
  if (payload.exp !== undefined) {
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: 'Nieprawidłowy czas wygaśnięcia tokena'
      });
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp <= nowSec) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Token sesji wygasł'
      });
    }
  }

  // 5. Session Redis allowlist check (fail-closed on Redis error)
  // Bind Redis JSON accountId/companyId/programId to JWT claims
  if (!fastify.redis) {
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Brak dostępu do magazynu sesji'
    });
  }

  try {
    const sessionKey = `ep:session:${payload.jti}`;
    const sessionRaw = await fastify.redis.get(sessionKey);
    if (!sessionRaw) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Sesja wygasła lub została unieważniona'
      });
    }

    let sessionData: any;
    try {
      sessionData = JSON.parse(sessionRaw);
    } catch {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Nieprawidłowy stan sesji w magazynie'
      });
    }

    if (
      !sessionData ||
      sessionData.accountId !== payload.accountId ||
      sessionData.companyId !== payload.companyId ||
      sessionData.programId !== payload.programId
    ) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: 'Niezgodność danych sesji z magazynem sesji'
      });
    }
  } catch (err: any) {
    if (err?.statusCode === 401 || err?.statusCode === 403) {
      throw err;
    }
    fastify.log.error('Redis error during employee session check (failing closed)');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Błąd weryfikacji stanu sesji'
    });
  }

  // 6. Check current DB state for active account, membership, company, and program
  // Verify companyId and programId match active database records; deny membership.revokedAt
  try {
    const account = await fastify.prisma.employeeAccount.findUnique({
      where: { id: payload.accountId },
      include: {
        membership: {
          include: {
            company: { select: { id: true, name: true, slug: true, isActive: true } },
            program: { select: { id: true, name: true, slug: true, isActive: true } }
          }
        }
      }
    });

    if (!account || !account.isActive) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: 'Konto pracownika jest nieaktywne lub nie istnieje'
      });
    }

    const membership = account.membership;
    if (
      !membership ||
      !membership.isActive ||
      membership.revokedAt !== null ||
      membership.companyId !== payload.companyId ||
      membership.programId !== payload.programId ||
      !membership.company?.isActive ||
      !membership.program?.isActive
    ) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: 'Brak aktywnego przypisania do programu lub firmy'
      });
    }

    // Attach verified employee to request
    (request as any).employee = {
      accountId: account.id,
      email: account.email,
      companyId: membership.companyId,
      programId: membership.programId,
      jti: payload.jti,
      account,
      membership
    };
  } catch (err: any) {
    fastify.log.error('Prisma error during employee auth verification');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Błąd weryfikacji tożsamości pracownika'
    });
  }
}
