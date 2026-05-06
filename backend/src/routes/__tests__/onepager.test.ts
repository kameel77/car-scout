import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';

describe('Onepager — GET /api/onepager/offers', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Cleanup any data created in previous tests
    await app.prisma.listing.deleteMany({
      where: { make: 'TEST_ONEPAGER' },
    });
  });

  async function createListing(overrides: any = {}) {
    return app.prisma.listing.create({
      data: {
        make: 'TEST_ONEPAGER',
        model: 'M' + Math.random().toString(36).slice(2, 7),
        pricePln: 100000,
        mileageKm: 5000,
        productionYear: 2024,
        isFeatured: false,
        isArchived: false,
        ...overrides,
      },
    });
  }

  it('returns 6 featured offers when 6+ exist', async () => {
    for (let i = 0; i < 7; i++) {
      await createListing({ isFeatured: true });
    }
    const res = await app.inject({ method: 'GET', url: '/api/onepager/offers' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.offers).toHaveLength(6);
    expect(body.offers.every((o: any) => o.isFeatured)).toBe(true);
  });

  it('falls back to newest when < 6 featured', async () => {
    const featured = await createListing({ isFeatured: true });  // 1 featured
    for (let i = 0; i < 5; i++) {
      await createListing({ isFeatured: false });  // 5 non-featured
    }
    const res = await app.inject({ method: 'GET', url: '/api/onepager/offers' });
    const body = res.json();
    expect(body.offers).toHaveLength(6);
    // The specific TEST_ONEPAGER featured listing must appear in the response
    expect(body.offers.some((o: any) => o.id === featured.id)).toBe(true);
  });

  it('returns only requested ids in given order', async () => {
    const a = await createListing();
    const b = await createListing();
    const c = await createListing();
    const res = await app.inject({
      method: 'GET',
      url: `/api/onepager/offers?ids=${c.id},${a.id},${b.id}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.offers.map((o: any) => o.id)).toEqual([c.id, a.id, b.id]);
  });

  it('rejects invalid ids format', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/onepager/offers?ids=<script>',
    });
    expect(res.statusCode).toBe(400);
  });

  it('skips archived listings', async () => {
    await createListing({ isFeatured: true, isArchived: true });
    const res = await app.inject({ method: 'GET', url: '/api/onepager/offers' });
    const body = res.json();
    expect(body.offers.every((o: any) => o.make !== 'TEST_ONEPAGER' || !o.isArchived)).toBe(true);
  });
});
