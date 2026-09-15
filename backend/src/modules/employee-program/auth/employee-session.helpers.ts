import crypto from 'crypto';
import type { JWT } from '@fastify/jwt';
import { EmployeeCsrfJwtPayload } from './employee-auth.types.js';

export const SESSION_COOKIE_NAME = '__Host-ep-session';
export const CSRF_COOKIE_NAME = '__Host-ep-csrf';
export const CSRF_HEADER_NAME = 'x-csrf-token';
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
export const CSRF_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Constrained cookie parser with duplicate rejection.
 * Rejects parsing if duplicate cookie names exist in header.
 */
export function parseCookiesConstrained(cookieHeader: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return map;
  }

  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const name = trimmed.substring(0, eqIdx).trim();
    const value = trimmed.substring(eqIdx + 1).trim();

    if (map.has(name)) {
      // Duplicate cookie name detected — reject by throwing to prevent smuggling attacks
      throw new Error(`Duplicate cookie name detected: ${name}`);
    }
    map.set(name, value);
  }

  return map;
}

/**
 * Generates a signed CSRF JWT using fastify.jwt instance with dedicated realm/aud/nonce.
 */
export function generateSignedCsrfToken(jwtSigner: JWT): string {
  const nonce = crypto.randomUUID();
  const payload = {
    realm: 'employee-csrf',
    aud: 'employee-csrf',
    nonce
  };
  return jwtSigner.sign(payload as any, { expiresIn: '7d' });
}

/**
 * Verifies a signed CSRF JWT token with strict realm, aud, nonce and expiration checks.
 */
export function verifySignedCsrfToken(token: string | undefined, jwtSigner: JWT): boolean {
  if (!token || typeof token !== 'string') return false;
  try {
    const payload = jwtSigner.verify<EmployeeCsrfJwtPayload>(token);
    if (!payload || typeof payload !== 'object') return false;

    if (
      payload.realm !== 'employee-csrf' ||
      payload.aud !== 'employee-csrf' ||
      typeof payload.nonce !== 'string' ||
      payload.nonce.trim().length === 0
    ) {
      return false;
    }

    if (!Number.isInteger(payload.exp)) return false;
    if (payload.exp !== undefined) {
      if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
        return false;
      }
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (payload.exp <= nowSeconds) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

export function generateJti(): string {
  return crypto.randomUUID();
}

export function formatCookieHeader(
  name: string,
  value: string,
  options: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Lax' | 'Strict' | 'None';
    path?: string;
    maxAge?: number;
  } = {}
): string {
  const parts: string[] = [`${name}=${value}`];
  parts.push(`Path=${options.path || '/'}`);

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  if (options.httpOnly) {
    parts.push('HttpOnly');
  }

  // Strict Host-only Secure cookie per ADR-02 contract
  if (options.secure ?? true) {
    parts.push('Secure');
  }

  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }

  return parts.join('; ');
}

export function formatSessionCookie(jwt: string, maxAge: number = SESSION_TTL_SECONDS): string {
  return formatCookieHeader(SESSION_COOKIE_NAME, jwt, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge
  });
}

export function formatClearSessionCookie(): string {
  return formatCookieHeader(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 0
  });
}

export function formatCsrfCookie(csrfToken: string, maxAge: number = SESSION_TTL_SECONDS): string {
  return formatCookieHeader(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false, // Accessible to client JavaScript for Double-Submit pattern
    secure: true,
    sameSite: 'Strict',
    path: '/',
    maxAge
  });
}

export function formatClearCsrfCookie(): string {
  return formatCookieHeader(CSRF_COOKIE_NAME, '', {
    httpOnly: false,
    secure: true,
    sameSite: 'Strict',
    path: '/',
    maxAge: 0
  });
}
