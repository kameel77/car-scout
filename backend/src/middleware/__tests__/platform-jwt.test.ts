import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { readFileSync } from 'node:fs';

// Exercise the actual trusted callback configured by app.ts without booting
// its database clients, partner bootstrap or environment loader.
async function appJwtOptions() {
  const source = readFileSync(new URL('../../app.ts', import.meta.url), 'utf8');
  if (!source.includes('trusted: trustPlatformJwt')) return {};
  const { trustPlatformJwt } = await import('../platform-jwt.js');
  return { trusted: trustPlatformJwt };
}

describe('platform JWT realm isolation', () => {
  it.each([
    { email: 'fixture@example.invalid', realm: 'employee', aud: 'employee-portal' },
    { email: 'fixture@example.invalid', realm: 'employee', userId: 'admin-fixture', role: 'ADMIN' },
    { email: 'fixture@example.invalid', aud: 'employee-portal', userId: 'admin-fixture' },
    { email: 'fixture@example.invalid', realm: 'employee-csrf', userId: 'admin-fixture' },
    { email: 'fixture@example.invalid', realm: 'platform' },
  ])('rejects employee claims even with platform identity: %j', async claims => {
    const app = Fastify();
    await app.register(jwt, { secret: 'isolated-test-signing-key-not-a-credential', ...await appJwtOptions() });
    app.get('/admin-probe', { preHandler: async request => { await request.jwtVerify(); } }, async () => ({ ok: true }));
    const response = await app.inject({ url: '/admin-probe', headers: { authorization: `Bearer ${app.jwt.sign(claims)}` } });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('retains compatibility with legacy platform tokens', async () => {
    const app = Fastify();
    await app.register(jwt, { secret: 'isolated-test-signing-key-not-a-credential', ...await appJwtOptions() });
    app.get('/admin-probe', { preHandler: async request => { await request.jwtVerify(); } }, async () => ({ ok: true }));
    const token = app.jwt.sign({ userId: 'platform-fixture', email: 'fixture@example.invalid', role: 'ADMIN' });
    expect((await app.inject({ url: '/admin-probe', headers: { authorization: `Bearer ${token}` } })).statusCode).toBe(200);
    await app.close();
  });
});
