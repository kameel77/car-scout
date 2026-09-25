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

    // Cache-Control publiczny wymaga hosta produkcyjnego (isProductionHost) — inaczej globalny
    // onSend guard w app.ts (de-indexing na dev/staging) nadpisuje wszystko na 'private, no-store'.
    const prevBrand = process.env.BRAND;
    const prevFrontendUrl = process.env.FRONTEND_URL;
    process.env.BRAND = 'motolia';
    process.env.FRONTEND_URL = 'https://motolia.pl';
    try {
      const res = await app.inject({ method: 'GET', url: '/api/hero-banners/public', headers: { host: 'motolia.pl' } });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { banners: Array<{ altText: string; buttonLabel: string }> };
      const testBanners = body.banners.filter((b) => b.altText.startsWith('TEST_BANNER'));
      expect(testBanners.map((b) => b.altText)).toEqual(['TEST_BANNER_A', 'TEST_BANNER_B']);
      expect(res.headers['cache-control']).toBe('public, max-age=0, s-maxage=300');
    } finally {
      if (prevBrand === undefined) delete process.env.BRAND; else process.env.BRAND = prevBrand;
      if (prevFrontendUrl === undefined) delete process.env.FRONTEND_URL; else process.env.FRONTEND_URL = prevFrontendUrl;
    }
  });

  it('admin list endpoint rejects unauthenticated requests', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/hero-banners' });
    expect(res.statusCode).toBe(401);
  });
});
