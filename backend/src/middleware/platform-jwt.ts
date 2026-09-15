import type { FastifyRequest } from 'fastify';

/** Employee cookies are verified separately; never grant platform identity. */
export function trustPlatformJwt(_request: FastifyRequest, decoded: Record<string, unknown>): boolean {
  const audience = decoded.aud;
  return typeof decoded.userId === 'string' && decoded.userId.length > 0
    && (decoded.realm === undefined || decoded.realm === 'platform')
    && audience !== 'employee-portal'
    && !(Array.isArray(audience) && audience.includes('employee-portal'));
}
