import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';

vi.mock('../../utils/csflow-client.js', () => ({
    getCSFlowCars: vi.fn(),
    getCSFlowCarDetails: vi.fn(),
}));
vi.mock('../csflow-image-downloader.js', () => ({
    downloadAndCacheImages: vi.fn(),
    queueListingImagesDownload: vi.fn(),
}));

import { getCSFlowCars, getCSFlowCarDetails } from '../../utils/csflow-client.js';
import { syncCSFlowAPI } from '../csflow.service.js';

const prisma = new PrismaClient();

const mockCar = (id: number, overrides: any = {}) => ({
    id,
    vin: `TESTVINCSFLOW${id}`,
    price: 100000,
    production_year: '2024',
    mileage: '10',
    brand_name: 'TestBrand',
    model_name: 'TestModel',
    invoice_vat: 1,
    tax_type_id: 1,
    dealer: {
        id: 9001,
        name: 'Test CSFlow Dealer',
        address: 'Testowa 1',
        city: 'Warszawa',
    },
    ...overrides,
});

describe('syncCSFlowAPI — multi-source', () => {
    let sourceA: any;
    let sourceB: any;
    let group: any;

    beforeAll(async () => {
        group = await prisma.dealerGroup.create({
            data: { name: 'Test Group CSFlow', slug: 'test-group-csflow' },
        });
        sourceA = await prisma.csflowSource.create({
            data: { name: 'Test A', slug: 'testa', apiUrl: 'https://webapi.testa.csflow.pl', dealerGroupId: group.id },
        });
        sourceB = await prisma.csflowSource.create({
            data: { name: 'Test B', slug: 'testb', apiUrl: 'https://webapi.testb.csflow.pl' },
        });
        // Aktywna oferta źródła B — sync A nie może jej ruszyć
        await prisma.listing.create({
            data: {
                listingId: 'csflow-testb-111',
                csflowSourceId: sourceB.id,
                csflowCarId: 111,
                make: 'B-Brand', model: 'B-Model',
                pricePln: 50000, productionYear: 2023, mileageKm: 5,
                slug: 'test-csflow-b-111',
                marketplace: 'csflow',
            },
        });
    });

    afterAll(async () => {
        await prisma.listing.deleteMany({ where: { csflowSourceId: { in: [sourceA.id, sourceB.id] } } });
        await prisma.dealer.deleteMany({ where: { csflowSourceId: { in: [sourceA.id, sourceB.id] } } });
        await prisma.csflowSource.deleteMany({ where: { id: { in: [sourceA.id, sourceB.id] } } });
        await prisma.dealerGroup.delete({ where: { id: group.id } });
        await prisma.$disconnect();
    });

    it('insertuje oferty z listingId csflow-{slug}-{carId}, nie archiwizuje innych źródeł, przypisuje dealerGroup', async () => {
        vi.mocked(getCSFlowCars).mockResolvedValue([{ id: 222 }]);
        vi.mocked(getCSFlowCarDetails).mockResolvedValue(mockCar(222));

        const result = await syncCSFlowAPI(prisma, sourceA);

        expect(result.inserted).toBe(1);
        expect(getCSFlowCars).toHaveBeenCalledWith('https://webapi.testa.csflow.pl');

        const created = await prisma.listing.findFirst({
            where: { csflowSourceId: sourceA.id, csflowCarId: 222 },
            include: { dealer: true },
        });
        expect(created).toBeTruthy();
        expect(created!.listingId).toBe('csflow-testa-222');
        expect(created!.dealer!.csflowDealerId).toBe(9001);
        expect(created!.dealer!.csflowSourceId).toBe(sourceA.id);
        expect(created!.dealer!.dealerGroupId).toBe(group.id);

        // Oferta źródła B nietknięta
        const bListing = await prisma.listing.findFirst({ where: { csflowSourceId: sourceB.id, csflowCarId: 111 } });
        expect(bListing!.isArchived).toBe(false);
    });

    it('drugi sync aktualizuje (nie insertuje) i archiwizuje auta nieobecne w API', async () => {
        vi.mocked(getCSFlowCars).mockResolvedValue([{ id: 333 }]);
        vi.mocked(getCSFlowCarDetails).mockResolvedValue(mockCar(333));

        const first = await syncCSFlowAPI(prisma, sourceA);
        expect(first.inserted).toBe(1);
        expect(first.archived).toBe(1); // auto 222 zniknęło z API

        const second = await syncCSFlowAPI(prisma, sourceA);
        expect(second.inserted).toBe(0);
        expect(second.updated).toBe(1);

        const archived = await prisma.listing.findFirst({ where: { csflowSourceId: sourceA.id, csflowCarId: 222 } });
        expect(archived!.isArchived).toBe(true);
    });
});
