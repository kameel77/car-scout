import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';

describe('Marketing Feeds — /facebook-feed.csv & /google-feed.xml', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await app.prisma.listing.deleteMany({ where: { make: 'TEST_FEED_MAKE' } });
    await app.prisma.rentalVehicle.deleteMany({ where: { make: 'TEST_FEED_MAKE' } });
  });

  it('includes NEW listings and excludes USED listings in facebook-feed.csv and google-feed.xml', async () => {
    // 1. Create a NEW listing
    await app.prisma.listing.create({
      data: {
        make: 'TEST_FEED_MAKE',
        model: 'ModelNew',
        condition: 'NEW',
        pricePln: 200000,
        mileageKm: 10,
        productionYear: 2026,
        isArchived: false,
      },
    });

    // 2. Create a USED listing
    await app.prisma.listing.create({
      data: {
        make: 'TEST_FEED_MAKE',
        model: 'ModelUsed',
        condition: 'USED',
        pricePln: 100000,
        mileageKm: 50000,
        productionYear: 2021,
        isArchived: false,
      },
    });

    // 3. Create a NEW RentalVehicle
    await app.prisma.rentalVehicle.create({
      data: {
        make: 'TEST_FEED_MAKE',
        model: 'RentalNew',
        condition: 'NEW',
        sellingPrice: 150000,
        productionYear: 2025,
        isActive: true,
      },
    });

    // 4. Create a USED RentalVehicle
    await app.prisma.rentalVehicle.create({
      data: {
        make: 'TEST_FEED_MAKE',
        model: 'RentalUsed',
        condition: 'USED',
        sellingPrice: 90000,
        productionYear: 2020,
        isActive: true,
      },
    });

    // Test Facebook CSV Feed
    const csvRes = await app.inject({ method: 'GET', url: '/facebook-feed.csv' });
    expect(csvRes.statusCode).toBe(200);
    const csvBody = csvRes.body;

    expect(csvBody).toContain('TEST_FEED_MAKE ModelNew');
    expect(csvBody).toContain('TEST_FEED_MAKE RentalNew');
    expect(csvBody).not.toContain('TEST_FEED_MAKE ModelUsed');
    expect(csvBody).not.toContain('TEST_FEED_MAKE RentalUsed');
    expect(csvBody).not.toContain(',used,');

    // Test Google XML Feed
    const xmlRes = await app.inject({ method: 'GET', url: '/google-feed.xml' });
    expect(xmlRes.statusCode).toBe(200);
    const xmlBody = xmlRes.body;

    expect(xmlBody).toContain('TEST_FEED_MAKE ModelNew');
    expect(xmlBody).toContain('TEST_FEED_MAKE RentalNew');
    expect(xmlBody).not.toContain('TEST_FEED_MAKE ModelUsed');
    expect(xmlBody).not.toContain('TEST_FEED_MAKE RentalUsed');
    expect(xmlBody).not.toContain('<g:condition>used</g:condition>');
    expect(xmlBody).toContain('<g:condition>new</g:condition>');
  });

  it('converts .webp image URLs to .jpg for Google Ads and Meta compliance', async () => {
    // Create a new listing with .webp images
    await app.prisma.listing.create({
      data: {
        make: 'TEST_FEED_MAKE',
        model: 'WebpImageCar',
        condition: 'NEW',
        pricePln: 180000,
        mileageKm: 10,
        productionYear: 2026,
        primaryImageUrl: '/uploads/csflow-images/csflow-61916/5.webp',
        isArchived: false,
      },
    });

    // Create a rental vehicle with .webp images
    await app.prisma.rentalVehicle.create({
      data: {
        make: 'TEST_FEED_MAKE',
        model: 'RentalWebpCar',
        condition: 'NEW',
        sellingPrice: 120000,
        productionYear: 2025,
        primaryImageUrl: 'https://motolia.pl/uploads/rental-images/xyz/0.webp?v=2',
        isActive: true,
      },
    });

    // Check Facebook CSV Feed
    const csvRes = await app.inject({ method: 'GET', url: '/facebook-feed.csv' });
    expect(csvRes.statusCode).toBe(200);
    const csvBody = csvRes.body;
    expect(csvBody).toContain('/uploads/csflow-images/csflow-61916/5.jpg');
    expect(csvBody).not.toContain('/uploads/csflow-images/csflow-61916/5.webp');
    expect(csvBody).toContain('https://motolia.pl/uploads/rental-images/xyz/0.jpg?v=2');
    expect(csvBody).not.toContain('0.webp');

    // Check Google XML Feed
    const xmlRes = await app.inject({ method: 'GET', url: '/google-feed.xml' });
    expect(xmlRes.statusCode).toBe(200);
    const xmlBody = xmlRes.body;
    expect(xmlBody).toContain('/uploads/csflow-images/csflow-61916/5.jpg');
    expect(xmlBody).toContain('https://motolia.pl/uploads/rental-images/xyz/0.jpg?v=2');
    expect(xmlBody).not.toContain('.webp');

    // Verify on-the-fly serving of .jpg when the source file on disk is .webp
    const imgRes = await app.inject({
      method: 'GET',
      url: '/uploads/csflow-images/csflow-61916/5.jpg',
    });
    expect(imgRes.statusCode).toBe(200);
    expect(imgRes.headers['content-type']).toBe('image/jpeg');
    expect(imgRes.rawPayload.length).toBeGreaterThan(0);
  });
});
