import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';

describe('Hero banner routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.prisma.heroBanner.deleteMany({ where: { altText: { startsWith: 'TEST_BANNER' } } });
    await app.close();
  });

  beforeEach(async () => {
    await app.prisma.heroBanner.deleteMany({ where: { altText: { startsWith: 'TEST_BANNER' } } });
  });

  it('public endpoint returns only active banners, ordered by sortOrder', async () => {
    await app.prisma.heroBanner.create({
      data: { altText: 'TEST_BANNER_B', buttonLabel: 'B', buttonUrl: '/nowe', sortOrder: 2, isActive: true },
    });
    await app.prisma.heroBanner.create({
      data: { altText: 'TEST_BANNER_A', buttonLabel: 'A', buttonUrl: '/uzywane', sortOrder: 1, isActive: true },
    });
    await app.prisma.heroBanner.create({
      data: { altText: 'TEST_BANNER_HIDDEN', buttonLabel: 'H', buttonUrl: '/x', sortOrder: 0, isActive: false },
    });

    const res = await app.inject({ method: 'GET', url: '/api/hero-banners/public' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { banners: Array<{ altText: string; buttonLabel: string }> };
    const testBanners = body.banners.filter((b) => b.altText.startsWith('TEST_BANNER'));
    expect(testBanners.map((b) => b.altText)).toEqual(['TEST_BANNER_A', 'TEST_BANNER_B']);
  });

  it('admin list endpoint rejects unauthenticated requests', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/hero-banners' });
    expect(res.statusCode).toBe(401);
  });
});
