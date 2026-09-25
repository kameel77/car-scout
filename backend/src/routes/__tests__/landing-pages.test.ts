import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';
import * as cacheInvalidation from '../../services/cache-invalidation.service.js';

describe('Landing page routes', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let listing1Id: string;
  let listing2Id: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    adminToken = app.jwt.sign({ userId: 'admin-test-lp', email: 'admin@test.com', role: 'admin' });

    await app.prisma.dealer.deleteMany({ where: { name: 'LP Test Dealer' } });

    // Create dummy dealer and listings for testing
    const dealer = await app.prisma.dealer.create({
      data: { name: 'LP Test Dealer', addressLine1: 'Test Str 1' },
    });

    const l1 = await app.prisma.listing.create({
      data: {
        dealerId: dealer.id,
        make: 'Audi',
        model: 'A4',
        pricePln: 150000,
        productionYear: 2023,
        mileageKm: 15000,
        bodyType: 'sedan',
        fuelType: 'benzyna',
      },
    });
    const l2 = await app.prisma.listing.create({
      data: {
        dealerId: dealer.id,
        make: 'BMW',
        model: '320i',
        pricePln: 180000,
        productionYear: 2024,
        mileageKm: 5000,
        bodyType: 'sedan',
        fuelType: 'benzyna',
      },
    });

    listing1Id = l1.id;
    listing2Id = l2.id;
  });

  afterAll(async () => {
    await app.prisma.lead.deleteMany({ where: { phone: '+48999888777' } });
    await app.prisma.landingPage.deleteMany({ where: { slug: { startsWith: 'test-lp-' } } });
    const ids = [listing1Id, listing2Id].filter(Boolean);
    if (ids.length > 0) {
      await app.prisma.listing.deleteMany({ where: { id: { in: ids } } });
    }
    await app.prisma.dealer.deleteMany({ where: { name: 'LP Test Dealer' } });
    await app.close();
  });

  beforeEach(async () => {
    await app.prisma.lead.deleteMany({ where: { phone: '+48999888777' } });
    await app.prisma.landingPage.deleteMany({ where: { slug: { startsWith: 'test-lp-' } } });
  });

  it('public endpoint returns 200 and listings in MANUAL selection mode', async () => {
    await app.prisma.landingPage.create({
      data: {
        slug: 'test-lp-manual',
        name: 'Test LP Manual',
        heroTitle: 'Wyjątkowy leasing 1%',
        selectionMode: 'MANUAL',
        listingIds: [listing2Id, listing1Id],
        isActive: true,
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/landing-pages/public/test-lp-manual',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.landingPage.slug).toBe('test-lp-manual');
    expect(body.landingPage.listings.length).toBe(2);
    expect(body.landingPage.listings[0].id).toBe(listing2Id);
    expect(body.landingPage.listings[1].id).toBe(listing1Id);
  });

  it('public endpoint returns 200 and listings in FILTERED selection mode', async () => {
    await app.prisma.landingPage.create({
      data: {
        slug: 'test-lp-filtered',
        name: 'Test LP Filtered',
        heroTitle: 'Auta z rocznika 2024',
        selectionMode: 'FILTERED',
        filterParams: { brand: ['BMW'], minYear: 2024 },
        isActive: true,
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/landing-pages/public/test-lp-filtered',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.landingPage.slug).toBe('test-lp-filtered');
    expect(body.landingPage.listings.length).toBeGreaterThanOrEqual(1);
    expect(body.landingPage.listings.some((l: any) => l.id === listing2Id)).toBe(true);
  });

  it('public endpoint returns 404 for inactive LP', async () => {
    await app.prisma.landingPage.create({
      data: {
        slug: 'test-lp-inactive',
        name: 'Test LP Inactive',
        heroTitle: 'Nieaktywna strona',
        isActive: false,
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/landing-pages/public/test-lp-inactive',
    });

    expect(res.statusCode).toBe(404);
  });

  it('public endpoint returns 410 for expired LP', async () => {
    await app.prisma.landingPage.create({
      data: {
        slug: 'test-lp-expired',
        name: 'Test LP Expired',
        heroTitle: 'Wygasła oferta',
        isActive: true,
        validTo: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/landing-pages/public/test-lp-expired',
    });

    expect(res.statusCode).toBe(410);
  });

  it('POST /api/leads/quick assigns landingPageId and trafficSource when landingPageSlug and src are provided', async () => {
    const lp = await app.prisma.landingPage.create({
      data: {
        slug: 'test-lp-lead',
        name: 'Test LP Lead',
        heroTitle: 'Szybki kontakt z LP',
        isActive: true,
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/leads/quick',
      payload: {
        phone: '+48999888777',
        landingPageSlug: 'test-lp-lead',
        src: 'google_ads_b2b',
      },
    });

    expect(res.statusCode).toBe(200);
    const createdLead = await app.prisma.lead.findFirst({
      where: { phone: '+48999888777' },
    });
    expect(createdLead).toBeTruthy();
    expect(createdLead?.landingPageId).toBe(lp.id);
    expect(createdLead?.trafficSource).toBe('google_ads_b2b');
  });

  it('POST /api/leads/quick succeeds without attribution if landingPageSlug is unknown', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/leads/quick',
      payload: {
        phone: '+48999888777',
        landingPageSlug: 'non-existent-slug-xyz',
        src: 'facebook_qr',
      },
    });

    expect(res.statusCode).toBe(200);
    const createdLead = await app.prisma.lead.findFirst({
      where: { phone: '+48999888777' },
    });
    expect(createdLead).toBeTruthy();
    expect(createdLead?.landingPageId).toBeNull();
    expect(createdLead?.trafficSource).toBe('facebook_qr');
  });

  it('admin routes reject unauthenticated requests', async () => {
    const listRes = await app.inject({ method: 'GET', url: '/api/landing-pages' });
    expect(listRes.statusCode).toBe(401);

    const postRes = await app.inject({
      method: 'POST',
      url: '/api/landing-pages',
      payload: { slug: 'test-lp-auth', name: 'Auth test', heroTitle: 'Title' },
    });
    expect(postRes.statusCode).toBe(401);
  });

  it('admin CRUD flow works for authorized admin user', async () => {
    // Create
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/landing-pages',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        slug: 'test-lp-crud',
        name: 'CRUD LP',
        audience: 'B2B Leasing',
        heroTitle: 'Oferta specjalna dla firm',
        discount: 5000,
        selectionMode: 'MANUAL',
        listingIds: [listing1Id],
        sections: {
          faq: { enabled: true, items: [{ q: 'Jak to działa?', a: 'Bardzo prosto.' }] },
        },
      },
    });
    expect(createRes.statusCode).toBe(200);
    const created = createRes.json().landingPage;
    expect(created.id).toBeTruthy();
    expect(created.discount).toBe(5000);

    // List
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/landing-pages',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(listRes.statusCode).toBe(200);
    const pages = listRes.json().landingPages;
    expect(pages.some((p: any) => p.slug === 'test-lp-crud')).toBe(true);

    // Update
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/landing-pages/${created.id}`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        heroTitle: 'Zaktualizowany tytuł hero',
        discount: 6000,
      },
    });
    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.json().landingPage.heroTitle).toBe('Zaktualizowany tytuł hero');
    expect(updateRes.json().landingPage.discount).toBe(6000);

    // Preview listings
    const previewRes = await app.inject({
      method: 'GET',
      url: `/api/landing-pages/${created.id}/preview-listings`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(previewRes.statusCode).toBe(200);
    expect(previewRes.json().count).toBe(1);

    // Delete
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/landing-pages/${created.id}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(deleteRes.statusCode).toBe(200);
  });

  it('create/update/delete purge the Cloudflare/SSR cache for the /promo/:slug URL (Task 1a gap fix)', async () => {
    const purgeSpy = vi.spyOn(cacheInvalidation, 'invalidateOfferCache');
    try {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/landing-pages',
        headers: { Authorization: `Bearer ${adminToken}` },
        payload: {
          slug: 'test-lp-purge',
          name: 'Purge LP',
          heroTitle: 'Oferta specjalna',
          selectionMode: 'MANUAL',
          listingIds: [listing1Id],
        },
      });
      expect(createRes.statusCode).toBe(200);
      const created = createRes.json().landingPage;
      expect(purgeSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        urls: ['/promo/test-lp-purge'],
      }));

      purgeSpy.mockClear();
      const updateRes = await app.inject({
        method: 'PUT',
        url: `/api/landing-pages/${created.id}`,
        headers: { Authorization: `Bearer ${adminToken}` },
        payload: { heroTitle: 'Nowy tytuł' },
      });
      expect(updateRes.statusCode).toBe(200);
      expect(purgeSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        urls: ['/promo/test-lp-purge'],
      }));

      purgeSpy.mockClear();
      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/landing-pages/${created.id}`,
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(deleteRes.statusCode).toBe(200);
      expect(purgeSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        urls: ['/promo/test-lp-purge'],
      }));
    } finally {
      purgeSpy.mockRestore();
    }
  });
});
