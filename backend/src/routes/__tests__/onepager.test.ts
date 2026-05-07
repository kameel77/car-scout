import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
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

describe('Onepager — GET /api/onepager/pdf', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.INTERNAL_FRONTEND_URL = 'http://frontend:80';

    // Mock puppeteer service before app build
    vi.mock('../../services/puppeteer', () => ({
      getBrowser: vi.fn(async () => ({
        newPage: vi.fn(async () => ({
          setViewport: vi.fn(async () => {}),
          goto: vi.fn(async () => {}),
          waitForSelector: vi.fn(async () => {}),
          pdf: vi.fn(async () => Buffer.from('%PDF-fake-content')),
          close: vi.fn(async () => {}),
        })),
        isConnected: () => true,
      })),
      closeBrowser: vi.fn(async () => {}),
    }));

    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    vi.resetAllMocks();
  });

  it('returns PDF buffer with correct headers', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/onepager/pdf' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="carsalon-oferta-\d{4}-\d{2}-\d{2}\.pdf"/);
    expect(res.rawPayload.length).toBeGreaterThan(0);
  });

  it('rejects invalid ids format', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/onepager/pdf?ids=<%>',
    });
    expect(res.statusCode).toBe(400);
  });

  it('passes ids through to internal URL', async () => {
    const { getBrowser } = await import('../../services/puppeteer');
    const goto = vi.fn();
    (getBrowser as any).mockResolvedValueOnce({
      newPage: async () => ({
        setViewport: vi.fn(async () => {}),
        goto,
        waitForSelector: vi.fn(async () => {}),
        pdf: async () => Buffer.from('%PDF'),
        close: vi.fn(async () => {}),
      }),
    });
    await app.inject({ method: 'GET', url: '/api/onepager/pdf?ids=abc,def' });
    expect(goto).toHaveBeenCalledWith(
      expect.stringContaining('/dla-firm?print=1&ids=abc%2Cdef'),
      expect.any(Object)
    );
  });

  it('caches default PDF in Redis for 30 minutes', async () => {
    await app.redis.del('onepager:pdf:default');

    const res1 = await app.inject({ method: 'GET', url: '/api/onepager/pdf' });
    expect(res1.statusCode).toBe(200);

    const cached = await app.redis.getBuffer('onepager:pdf:default');
    expect(cached).toBeInstanceOf(Buffer);
    expect(cached!.length).toBeGreaterThan(0);

    const ttl = await app.redis.ttl('onepager:pdf:default');
    expect(ttl).toBeGreaterThan(1700);
    expect(ttl).toBeLessThanOrEqual(1800);
  });

  it('returns cached PDF without calling Puppeteer on second request', async () => {
    const { getBrowser } = await import('../../services/puppeteer');
    // Pre-populate cache
    await app.redis.set('onepager:pdf:default', Buffer.from('%PDF-cached'), 'EX', 1800);

    const callsBefore = (getBrowser as any).mock.calls.length;
    const res = await app.inject({ method: 'GET', url: '/api/onepager/pdf' });
    const callsAfter = (getBrowser as any).mock.calls.length;

    expect(res.statusCode).toBe(200);
    expect(callsAfter).toBe(callsBefore); // no new Puppeteer call
    expect(res.rawPayload.toString()).toBe('%PDF-cached');
  });

  it('does not cache when ids param is given', async () => {
    await app.redis.del('onepager:pdf:default');
    await app.inject({ method: 'GET', url: '/api/onepager/pdf?ids=abc' });
    const cached = await app.redis.get('onepager:pdf:default');
    expect(cached).toBeNull();
  });
});
