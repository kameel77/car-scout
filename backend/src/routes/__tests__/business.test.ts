import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';

describe('Business — GET /api/business/offers', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await app.prisma.listing.deleteMany({ where: { make: 'TEST_BUSINESS' } });
    await app.redis.del('business:offers');
  });

  async function createListing(overrides: any = {}) {
    return app.prisma.listing.create({
      data: {
        make: 'TEST_BUSINESS',
        model: 'M' + Math.random().toString(36).slice(2, 7),
        pricePln: 150000,
        mileageKm: 0,
        productionYear: 2025,
        isFeatured: false,
        isBusinessFeatured: false,
        isArchived: false,
        ...overrides,
      },
    });
  }

  it('returns listings flagged isBusinessFeatured', async () => {
    const flagged = await createListing({ isBusinessFeatured: true });
    await createListing({ isBusinessFeatured: false });

    const res = await app.inject({ method: 'GET', url: '/api/business/offers' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.offers.some((o: any) => o.id === flagged.id)).toBe(true);
    expect(body.offers.every((o: any) => o.isBusinessFeatured)).toBe(true);
  });

  it('falls back to isFeatured when no isBusinessFeatured offers exist', async () => {
    const featured = await createListing({ isFeatured: true, isBusinessFeatured: false });

    const res = await app.inject({ method: 'GET', url: '/api/business/offers' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.offers.some((o: any) => o.id === featured.id)).toBe(true);
  });

  it('excludes archived listings', async () => {
    await createListing({ isBusinessFeatured: true, isArchived: true });

    const res = await app.inject({ method: 'GET', url: '/api/business/offers' });
    const body = res.json();
    expect(body.offers.every((o: any) => o.make !== 'TEST_BUSINESS' || !o.isArchived)).toBe(true);
  });
});
