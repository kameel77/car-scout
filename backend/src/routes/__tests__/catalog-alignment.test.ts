import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import { __resetRenderCache } from '../render.js';
import { generateListingSlug } from '../../utils/url-utils.js';
import { clearApiCache } from '../../services/api-cache.js';

const TEMPLATE = `<!doctype html><html><head><title>OLD</title><meta name="description" content="OLDD" /></head><body><div id="root"></div></body></html>`;

describe('Catalog SSR and API Alignment (Brief 2026-09-24)', () => {
    let app: FastifyInstance;
    let rentalCompanyId: string;
    let rentalVehicleId1: string;
    let rentalVehicleId2: string;
    let origSettings: any = null;

    const testTimestamp = Date.now();

    beforeAll(async () => {
        process.env.BRAND = 'motolia';
        process.env.FRONTEND_URL = 'https://motolia.pl';
        app = await buildApp();
        await app.ready();

        // Save original appSettings and set defaults for catalog test
        origSettings = await app.prisma.appSettings.findUnique({ where: { id: 'default' } });
        await app.prisma.appSettings.upsert({
            where: { id: 'default' },
            update: {
                defaultSortCars: 'price_asc',
                defaultSortRental: 'minMonthlyRateNet_asc',
            },
            create: {
                id: 'default',
                defaultSortCars: 'price_asc',
                defaultSortRental: 'minMonthlyRateNet_asc',
            },
        });

        // Create test rental company and vehicles with active assignments & matrix entries
        const company = await app.prisma.rentalCompany.create({
            data: {
                name: `Test Alignment Rental Co ${testTimestamp}`,
                slug: `test-alignment-rental-co-${testTimestamp}`,
                isActive: true,
                insuranceAddMode: 'INSURANCE_INCLUDED',
            },
        });
        rentalCompanyId = company.id;

        const vehicle1 = await app.prisma.rentalVehicle.create({
            data: {
                slug: `test-rental-beta-${testTimestamp}`,
                make: 'TestRentalMake',
                model: 'Beta',
                version: 'Comfort',
                productionYear: 2025,
                isPublished: true,
                isActive: true,
                ownerRentalCompanyId: rentalCompanyId,
                primaryImageUrl: 'https://motolia.pl/uploads/rental-images/beta/0.webp',
            },
        });
        rentalVehicleId1 = vehicle1.id;

        const vehicle2 = await app.prisma.rentalVehicle.create({
            data: {
                slug: `test-rental-alpha-${testTimestamp}`,
                make: 'TestRentalMake',
                model: 'Alpha',
                version: 'Prestige',
                productionYear: 2025,
                isPublished: true,
                isActive: true,
                ownerRentalCompanyId: rentalCompanyId,
                primaryImageUrl: 'https://motolia.pl/uploads/rental-images/alpha/0.webp',
            },
        });
        rentalVehicleId2 = vehicle2.id;

        const assignment1 = await app.prisma.vehicleRentalAssignment.create({
            data: {
                vehicleId: rentalVehicleId1,
                rentalCompanyId,
                isActive: true,
            },
        });

        const assignment2 = await app.prisma.vehicleRentalAssignment.create({
            data: {
                vehicleId: rentalVehicleId2,
                rentalCompanyId,
                isActive: true,
            },
        });

        // Beta has lower monthlyRateNet (1200) -> should sort first
        await app.prisma.rentalMatrixEntry.create({
            data: {
                assignmentId: assignment1.id,
                annualMileageKm: 10000,
                contractMonths: 36,
                initialPaymentPct: 0,
                initialPaymentAmountNet: 0,
                monthlyRateNet: 1200,
                monthlyRateGross: 1476,
                offerType: 'all',
            },
        });

        // Alpha has higher monthlyRateNet (1600) -> should sort second
        await app.prisma.rentalMatrixEntry.create({
            data: {
                assignmentId: assignment2.id,
                annualMileageKm: 10000,
                contractMonths: 36,
                initialPaymentPct: 0,
                initialPaymentAmountNet: 0,
                monthlyRateNet: 1600,
                monthlyRateGross: 1968,
                offerType: 'all',
            },
        });
    });

    beforeEach(async () => {
        await clearApiCache();
        await __resetRenderCache();
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response(TEMPLATE, { status: 200 }))
        );
    });

    afterAll(async () => {
        if (origSettings) {
            await app.prisma.appSettings.update({
                where: { id: 'default' },
                data: {
                    defaultSortCars: origSettings.defaultSortCars,
                    defaultSortRental: origSettings.defaultSortRental,
                },
            });
        }
        if (rentalCompanyId) {
            await app.prisma.rentalMatrixEntry.deleteMany({
                where: { assignment: { rentalCompanyId } },
            });
            await app.prisma.vehicleRentalAssignment.deleteMany({
                where: { rentalCompanyId },
            });
            await app.prisma.rentalVehicle.deleteMany({
                where: { ownerRentalCompanyId: rentalCompanyId },
            });
            await app.prisma.rentalCompany.deleteMany({
                where: { id: rentalCompanyId },
            });
        }
        await app.close();
        vi.unstubAllGlobals();
    });

    it('/samochody: SSR slugs match /api/listings slugs in exact order and preload first card', async () => {
        const renderRes = await app.inject({
            method: 'GET',
            url: '/api/render?path=/samochody',
            headers: { host: 'motolia.pl' }
        });
        expect(renderRes.statusCode).toBe(200);

        const apiRes = await app.inject({
            method: 'GET',
            url: '/api/listings?rateType=credit&rateBasis=gross&sortBy=price_asc&currency=PLN&page=1&perPage=32',
            headers: { host: 'motolia.pl' }
        });
        expect(apiRes.statusCode).toBe(200);

        const ssrSlugs = [...renderRes.body.matchAll(/href="\/oferta\/([^"]+)"/g)].map(m => m[1]).slice(0, 12);
        const apiData = JSON.parse(apiRes.body);
        const apiSlugs = (apiData.listings || []).map((l: any) =>
            generateListingSlug(l.make, l.model, l.version, l.productionYear, l.bodyType, l.fuelType, l.id)
        ).slice(0, 12);

        expect(ssrSlugs.length).toBeGreaterThan(0);
        expect(ssrSlugs).toEqual(apiSlugs);

        // Preload should target the 1st card image
        const firstCard = apiData.listings[0];
        const firstImage = firstCard?.primaryImageUrl;
        if (firstImage && firstImage.includes('/uploads/')) {
            const base = firstImage.slice(0, -'.webp'.length);
            expect(renderRes.body).toContain(`${base}-lg.webp`);
        } else if (!firstImage) {
            expect(renderRes.body).toContain('/motolia-placeholder.webp');
        }
    });

    it('/uzywane: SSR slugs match /api/listings?status=USED slugs in exact order and preload first card', async () => {
        const renderRes = await app.inject({
            method: 'GET',
            url: '/api/render?path=/uzywane',
            headers: { host: 'motolia.pl' }
        });
        expect(renderRes.statusCode).toBe(200);

        const apiRes = await app.inject({
            method: 'GET',
            url: '/api/listings?status=USED&rateType=credit&rateBasis=gross&sortBy=price_asc&currency=PLN&page=1&perPage=32',
            headers: { host: 'motolia.pl' }
        });
        expect(apiRes.statusCode).toBe(200);

        const ssrSlugs = [...renderRes.body.matchAll(/href="\/oferta\/([^"]+)"/g)].map(m => m[1]).slice(0, 12);
        const apiData = JSON.parse(apiRes.body);
        const apiSlugs = (apiData.listings || []).map((l: any) =>
            generateListingSlug(l.make, l.model, l.version, l.productionYear, l.bodyType, l.fuelType, l.id)
        ).slice(0, 12);

        expect(ssrSlugs.length).toBeGreaterThan(0);
        expect(ssrSlugs).toEqual(apiSlugs);

        const firstCard = apiData.listings[0];
        const firstImage = firstCard?.primaryImageUrl;
        if (firstImage && firstImage.includes('/uploads/')) {
            const base = firstImage.slice(0, -'.webp'.length);
            expect(renderRes.body).toContain(`${base}-lg.webp`);
        } else if (!firstImage) {
            expect(renderRes.body).toContain('/motolia-placeholder.webp');
        }
    });

    it('/nowe: SSR slugs match /api/listings?status=NEW slugs in exact order and preload first card', async () => {
        const renderRes = await app.inject({
            method: 'GET',
            url: '/api/render?path=/nowe',
            headers: { host: 'motolia.pl' }
        });
        expect(renderRes.statusCode).toBe(200);

        const apiRes = await app.inject({
            method: 'GET',
            url: '/api/listings?status=NEW&rateType=credit&rateBasis=gross&sortBy=price_asc&currency=PLN&page=1&perPage=32',
            headers: { host: 'motolia.pl' }
        });
        expect(apiRes.statusCode).toBe(200);

        const ssrSlugs = [...renderRes.body.matchAll(/href="\/oferta\/([^"]+)"/g)].map(m => m[1]).slice(0, 12);
        const apiData = JSON.parse(apiRes.body);
        const apiSlugs = (apiData.listings || []).map((l: any) =>
            generateListingSlug(l.make, l.model, l.version, l.productionYear, l.bodyType, l.fuelType, l.id)
        ).slice(0, 12);

        expect(ssrSlugs.length).toBeGreaterThan(0);
        expect(ssrSlugs).toEqual(apiSlugs);

        const firstCard = apiData.listings[0];
        const firstImage = firstCard?.primaryImageUrl;
        if (firstImage && firstImage.includes('/uploads/')) {
            const base = firstImage.slice(0, -'.webp'.length);
            expect(renderRes.body).toContain(`${base}-lg.webp`);
        } else if (!firstImage) {
            expect(renderRes.body).toContain('/motolia-placeholder.webp');
        }
    });

    it('/wynajem-dlugoterminowy: SSR slugs match client API default view and image preload exists', async () => {
        const t0 = performance.now();
        const renderRes = await app.inject({
            method: 'GET',
            url: '/api/render?path=/wynajem-dlugoterminowy',
            headers: { host: 'motolia.pl' }
        });
        const duration = performance.now() - t0;
        expect(renderRes.statusCode).toBe(200);
        expect(duration).toBeLessThan(1000); // Fast response time

        const apiRes = await app.inject({
            method: 'GET',
            url: '/api/rental/vehicles?page=1&limit=12&sortBy=minMonthlyRateNet&sortOrder=asc&offerType=b2b&priceBasis=net',
            headers: { host: 'motolia.pl' }
        });
        expect(apiRes.statusCode).toBe(200);

        const ssrSlugs = [...renderRes.body.matchAll(/href="\/wynajem-dlugoterminowy\/([^"]+)"/g)].map(m => m[1]).slice(0, 12);
        const apiData = JSON.parse(apiRes.body);
        const apiSlugs = (apiData.vehicles || []).map((v: any) => v.slug || v.id).slice(0, 12);

        expect(ssrSlugs.length).toBeGreaterThan(0);
        expect(ssrSlugs).toEqual(apiSlugs);

        // Preload should exist and target the first card
        expect(renderRes.body).toContain('<link rel="preload" as="image"');
        const firstVehicle = apiData.vehicles[0];
        const firstImg = firstVehicle?.primaryImageUrl || (firstVehicle?.imageUrls && firstVehicle.imageUrls[0]);
        if (firstImg && firstImg.includes('/uploads/')) {
            const base = firstImg.slice(0, -'.webp'.length);
            expect(renderRes.body).toContain(`${base}-lg.webp`);
        } else if (!firstImg) {
            expect(renderRes.body).toContain('/motolia-placeholder.webp');
        }
    });
});

