import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { encryptSecret, decryptSecret } from '../../utils/crypto.js';
import {
    parseDealerCodeAndName,
    mapPewneAutoFuel,
    mapRawCarToNormalized,
    extractPowerHp,
    extractEngineCapacity,
    extractTransmission,
    extractDrive,
    extractBodyType,
    PewneAutoProvider
} from '../providers/pewneauto.provider.js';
import { StockSyncEngine } from '../stock-sync-engine.service.js';
import { StockFeedProvider, StockFeedFetchResult } from '../../types/stock-sync.types.js';

const prisma = new PrismaClient();

describe('PewneAuto Crypto & Parsing', () => {
    it('szyfruje i deszyfruje sekret z wersjonowaniem (v1:iv:authTag:ciphertext)', () => {
        const secret = 'super-secret-token-12345!@#';
        const encrypted = encryptSecret(secret);
        expect(encrypted).not.toBe(secret);
        const parts = encrypted.split(':');
        expect(parts.length).toBe(4); // v1:iv:authTag:ciphertext
        expect(parts[0]).toBe('v1');

        const decrypted = decryptSecret(encrypted);
        expect(decrypted).toBe(secret);
    });

    it('obsługuje wsteczną kompatybilność deszyfrowania formatu legacy (iv:authTag:ciphertext)', () => {
        const secret = 'legacy-secret-token';
        // Generujemy szyfrogram w starym formacie 3-częściowym
        const encrypted = encryptSecret(secret);
        const parts = encrypted.split(':');
        const legacyFormat = `${parts[1]}:${parts[2]}:${parts[3]}`;
        
        const decrypted = decryptSecret(legacyFormat);
        expect(decrypted).toBe(secret);
    });

    it('poprawnie parsuje dealer_code_and_name oraz miasto', () => {
        const res1 = parseDealerCodeAndName('010 Toyota Piaseczno o. ZGORZAŁA', null);
        expect(res1.rawCode).toBe('010');
        expect(res1.rawName).toBe('Toyota Piaseczno o. ZGORZAŁA');

        const res2 = parseDealerCodeAndName(null, 'Carter Gdańsk');
        expect(res2.rawCode).toBeUndefined();
        expect(res2.rawName).toBe('Carter Gdańsk');
    });

    it('poprawnie mapuje typy paliwa i hybrydy', () => {
        expect(mapPewneAutoFuel('Hybryda', 1, 0)).toBe('Hybryda');
        expect(mapPewneAutoFuel('Hybryda Plug-in', 1, 0)).toBe('Hybryda Plug-in');
        expect(mapPewneAutoFuel('Benzyna', 0, 1)).toBe('Elektryczny');
        expect(mapPewneAutoFuel('Diesel', 0, 0)).toBe('Diesel');
    });

    it('poprawnie mapuje condition: używane auto z brakującym przebiegiem NIE staje się nowe', () => {
        const rawUsedNoMileage: any = {
            id: 1001,
            brand_name: 'Toyota',
            model_name: 'Corolla',
            year: 2019,
            mileage: undefined, // brak przebiegu
            price: 60000,
            priceGross: 60000,
            car_type_class: 'used',
            car_type_text: 'Używany'
        };
        const normalized = mapRawCarToNormalized(rawUsedNoMileage);
        expect(normalized).not.toBeNull();
        expect(normalized?.condition).toBe('USED');
        expect(normalized?.mileageKm).toBe(0);

        const rawNewCar: any = {
            id: 1002,
            brand_name: 'Toyota',
            model_name: 'Yaris Cross',
            year: 2024,
            mileage: 5,
            price: 110000,
            priceGross: 110000,
            car_type_class: 'new',
            car_type_text: 'Nowy'
        };
        const normalizedNew = mapRawCarToNormalized(rawNewCar);
        expect(normalizedNew?.condition).toBe('NEW');
    });

    it('poprawnie przelicza cenę netto na brutto przy priceType: "netto"', () => {
        const rawNetto: any = {
            id: 1003,
            brand_name: 'Toyota',
            model_name: 'Proace',
            year: 2022,
            mileage: 30000,
            price: 100000, // 100k netto
            priceGross: 0,
            priceType: 'netto'
        };
        const normalized = mapRawCarToNormalized(rawNetto);
        expect(normalized).not.toBeNull();
        expect(normalized?.pricePln).toBe(123000); // 100k * 1.23
        expect(normalized?.priceType).toBe('netto');
    });

    it('odrzuca wiersz bez nazwy marki i zwraca null', () => {
        const rawNoBrand: any = {
            id: 1004,
            name: '',
            brand_name: '',
            price: 50000
        };
        const normalized = mapRawCarToNormalized(rawNoBrand);
        expect(normalized).toBeNull();
    });
});

describe('StockSyncEngine — Integracja PewneAuto', () => {
    let testGroup: any;
    let testSource: any;

    beforeAll(async () => {
        testGroup = await prisma.dealerGroup.create({
            data: {
                name: 'Test Grupa Chodzen',
                slug: 'test-grupa-chodzen'
            }
        });

        testSource = await prisma.pewneAutoSource.create({
            data: {
                name: 'Toyota Chodzen Test',
                slug: 'chodzen-test',
                clientId: 'test-client',
                clientSecretEncrypted: encryptSecret('test-secret'),
                dealerGroupId: testGroup.id
            }
        });
    });

    afterAll(async () => {
        await prisma.priceHistory.deleteMany({
            where: { listing: { pewneautoSourceId: testSource.id } }
        });
        await prisma.listing.deleteMany({
            where: {
                OR: [
                    { pewneautoSourceId: testSource.id },
                    { vin: { in: ['VINTESTPEWNEAUTO001', 'VINTESTPEWNEAUTO002', 'VINTESTPEWNEAUTO003', 'VINCSVPEWNEAUTOMIGRATE'] } }
                ]
            }
        });
        await prisma.dealer.deleteMany({
            where: { pewneautoSourceId: testSource.id }
        });
        await prisma.pewneAutoSource.delete({
            where: { id: testSource.id }
        });
        await prisma.dealerGroup.delete({
            where: { id: testGroup.id }
        });
        await prisma.$disconnect();
    });

    beforeEach(async () => {
        await prisma.priceHistory.deleteMany({
            where: { listing: { pewneautoSourceId: testSource.id } }
        });
        await prisma.listing.deleteMany({
            where: {
                OR: [
                    { pewneautoSourceId: testSource.id },
                    { vin: { in: ['VINTESTPEWNEAUTO001', 'VINTESTPEWNEAUTO002', 'VINTESTPEWNEAUTO003', 'VINCSVPEWNEAUTOMIGRATE'] } }
                ]
            }
        });
    });

    it('zapisuje nowe oferty, deduplikuje po VIN, rejestruje historię cen i tworzy salon dealera', async () => {
        const mockCars = [
            mapRawCarToNormalized({
                id: 5001,
                vin: 'VINTESTPEWNEAUTO001',
                brand_name: 'Toyota',
                model_name: 'Yaris',
                year: 2022,
                mileage: 20000,
                price: 65000,
                priceGross: 65000,
                dealer_code_and_name: '010 Toyota Piaseczno',
                img: 'https://panel.pewneauto.pl/img1.png',
                reserved: 0
            })!,
            mapRawCarToNormalized({
                id: 5002,
                vin: 'VINTESTPEWNEAUTO002',
                brand_name: 'Lexus',
                model_name: 'NX 350h',
                year: 2023,
                mileage: 15000,
                price: 220000,
                priceGross: 220000,
                dealer_code_and_name: '210 Lexus Warszawa Puławska',
                img: 'https://panel.pewneauto.pl/img2.png',
                reserved: 1
            })!
        ];

        const mockProvider: StockFeedProvider = {
            providerSlug: 'pewneauto',
            fetchCars: async () => ({
                cars: mockCars,
                totalCount: 2,
                totalPages: 1
            })
        };

        const engine = new StockSyncEngine(prisma);
        const result = await engine.executeSync(mockProvider, {
            sourceId: testSource.id,
            sourceSlug: testSource.slug,
            providerName: 'PewneAuto',
            dealerGroupId: testGroup.id
        });

        expect('success' in result && result.success).toBe(true);
        if ('inserted' in result) {
            expect(result.inserted).toBe(2);
            expect(result.updated).toBe(0);
        }

        // Sprawdź czy oferty są w bazie
        const listings = await prisma.listing.findMany({
            where: { pewneautoSourceId: testSource.id },
            include: { dealer: true }
        });
        expect(listings.length).toBe(2);

        const yaris = listings.find(l => l.vin === 'VINTESTPEWNEAUTO001')!;
        expect(yaris.pricePln).toBe(65000);
        expect(yaris.isReserved).toBe(false);
        expect(yaris.dealer?.name).toBe('Toyota Piaseczno');
        expect(yaris.dealer?.dealerGroupId).toBe(testGroup.id);

        const lexus = listings.find(l => l.vin === 'VINTESTPEWNEAUTO002')!;
        expect(lexus.pricePln).toBe(220000);
        expect(lexus.isReserved).toBe(true);
        expect(lexus.dealer?.name).toBe('Lexus Warszawa Puławska');

        // Test aktualizacji ceny i archiwizacji
        const updatedCars = [
            mapRawCarToNormalized({
                id: 5001,
                vin: 'VINTESTPEWNEAUTO001',
                brand_name: 'Toyota',
                model_name: 'Yaris',
                year: 2022,
                mileage: 20000,
                price: 62000, // Obniżka ceny!
                priceGross: 62000,
                dealer_code_and_name: '010 Toyota Piaseczno',
                reserved: 0
            })!
            // 5002 usunięte z feedu -> powinno zostać zarchiwizowane
        ];

        const syncResult2 = await engine.executeSync({
            providerSlug: 'pewneauto',
            fetchCars: async () => ({ cars: updatedCars, totalCount: 1, totalPages: 1 })
        }, {
            sourceId: testSource.id,
            sourceSlug: testSource.slug,
            providerName: 'PewneAuto',
            dealerGroupId: testGroup.id,
            forceSync: true // pomijamy bezpiecznik dla testu archiwizacji 1 z 2
        });

        if ('updated' in syncResult2) {
            expect(syncResult2.updated).toBe(1);
            expect(syncResult2.archived).toBe(1);
            expect(syncResult2.priceChanges).toBe(1);
        }

        const yarisUpdated = await prisma.listing.findUnique({ where: { id: yaris.id } });
        expect(yarisUpdated?.pricePln).toBe(62000);
        expect(yarisUpdated?.isArchived).toBe(false);

        const lexusArchived = await prisma.listing.findUnique({ where: { id: lexus.id } });
        expect(lexusArchived?.isArchived).toBe(true);
        expect(lexusArchived?.archivedReason).toBe('pewneauto_removed');

        // Sprawdź historię cen dla Yarisa
        const priceHistory = await prisma.priceHistory.findMany({
            where: { listingId: yaris.id }
        });
        expect(priceHistory.length).toBe(2); // 65000 przy create + 62000 przy update
    });

    it('Cross-source VIN match: migruje istniejące auto z CSV do PewneAuto i czyści powiązania CSFlow', async () => {
        // Utwórz ofertę z CSV
        const csvListing = await prisma.listing.create({
            data: {
                listingId: 'csv-test-car-999',
                slug: 'toyota-corolla-csv-test-slug',
                vin: 'VINCSVPEWNEAUTOMIGRATE',
                make: 'Toyota',
                model: 'Corolla',
                pricePln: 90000,
                productionYear: 2020,
                mileageKm: 50000,
                entrySource: 'CSV',
                csflowCarId: 12345 // symulacja starego powiązania
            }
        });

        // Feed z PewneAuto zawierający ten sam VIN
        const pewneAutoCar = mapRawCarToNormalized({
            id: 8888,
            vin: 'VINCSVPEWNEAUTOMIGRATE',
            brand_name: 'Toyota',
            model_name: 'Corolla',
            year: 2020,
            mileage: 50000,
            price: 88000,
            priceGross: 88000,
            dealer_code_and_name: '010 Toyota Piaseczno',
            reserved: 0
        })!;

        const engine = new StockSyncEngine(prisma);
        const result = await engine.executeSync({
            providerSlug: 'pewneauto',
            fetchCars: async () => ({ cars: [pewneAutoCar], totalCount: 1, totalPages: 1 })
        }, {
            sourceId: testSource.id,
            sourceSlug: testSource.slug,
            providerName: 'PewneAuto',
            dealerGroupId: testGroup.id
        });

        if ('updated' in result) {
            expect(result.updated).toBe(1);
            expect(result.inserted).toBe(0);
        }

        const migratedListing = await prisma.listing.findUnique({ where: { id: csvListing.id } });
        expect(migratedListing?.entrySource).toBe('PEWNEAUTO');
        expect(migratedListing?.pewneautoSourceId).toBe(testSource.id);
        expect(migratedListing?.pewneautoCarId).toBe(8888);
        expect(migratedListing?.csflowCarId).toBeNull(); // CSFlow wyczyszczone (P1.9)
        expect(migratedListing?.slug).toBe('toyota-corolla-csv-test-slug'); // Slug zachowany!
        expect(migratedListing?.pricePln).toBe(88000);
    });

    it('Ochrona ręcznej archiwizacji ("Manual archive") oraz automatyczne przywracanie ofert zarchiwizowanych przez PewneAuto', async () => {
        // Oferta edytowana ręcznie i zarchiwizowana ręcznie przez admina ("Manual archive")
        const manualListing = await prisma.listing.create({
            data: {
                listingId: 'pewneauto-manual-test-1',
                slug: 'toyota-custom-model-slug',
                vin: 'VINTESTMANUAL001',
                make: 'Toyota',
                model: 'Corolla Wersja Specjalna Handlowca', // ręcznie zmodyfikowany model
                version: 'Custom Edition',
                pricePln: 95000,
                productionYear: 2021,
                mileageKm: 30000,
                isArchived: true,
                archivedReason: 'Manual archive',
                lastManualEditAt: new Date(),
                pewneautoSourceId: testSource.id,
                pewneautoCarId: 9001
            }
        });

        // Druga oferta zarchiwizowana wcześniej automatycznie przez PewneAuto ("pewneauto_removed")
        const autoArchivedListing = await prisma.listing.create({
            data: {
                listingId: 'pewneauto-auto-archived-2',
                slug: 'toyota-yaris-auto-archived-slug',
                vin: 'VINTESTAUTOARCHIVED002',
                make: 'Toyota',
                model: 'Yaris',
                pricePln: 60000,
                productionYear: 2022,
                mileageKm: 25000,
                isArchived: true,
                archivedReason: 'pewneauto_removed',
                pewneautoSourceId: testSource.id,
                pewneautoCarId: 9002
            }
        });

        // Trzecia oferta zarchiwizowana wcześniej z powodu braku w imporcie CSV ("Not in latest import")
        const csvArchivedListing = await prisma.listing.create({
            data: {
                listingId: 'pewneauto-csv-archived-3',
                slug: 'toyota-camry-csv-archived-slug',
                vin: 'VINTESTCSVARCHIVED003',
                make: 'Toyota',
                model: 'Camry',
                pricePln: 110000,
                productionYear: 2023,
                mileageKm: 15000,
                isArchived: true,
                archivedReason: 'Not in latest import',
                pewneautoSourceId: testSource.id,
                pewneautoCarId: 9003
            }
        });

        const feedCars = [
            mapRawCarToNormalized({
                id: 9001,
                vin: 'VINTESTMANUAL001',
                brand_name: 'Toyota',
                model_name: 'Corolla', // feed ma surowy model
                subname: 'Standard',
                year: 2021,
                mileage: 35000,
                price: 92000,
                priceGross: 92000,
                dealer_code_and_name: '010 Toyota Piaseczno',
                reserved: 0
            })!,
            mapRawCarToNormalized({
                id: 9002,
                vin: 'VINTESTAUTOARCHIVED002',
                brand_name: 'Toyota',
                model_name: 'Yaris',
                year: 2022,
                mileage: 25000,
                price: 59000,
                priceGross: 59000,
                dealer_code_and_name: '010 Toyota Piaseczno',
                reserved: 0
            })!,
            mapRawCarToNormalized({
                id: 9003,
                vin: 'VINTESTCSVARCHIVED003',
                brand_name: 'Toyota',
                model_name: 'Camry',
                year: 2023,
                mileage: 15000,
                price: 109000,
                priceGross: 109000,
                dealer_code_and_name: '010 Toyota Piaseczno',
                reserved: 0
            })!
        ];

        const engine = new StockSyncEngine(prisma);
        await engine.executeSync({
            providerSlug: 'pewneauto',
            fetchCars: async () => ({ cars: feedCars, totalCount: 3, totalPages: 1 })
        }, {
            sourceId: testSource.id,
            sourceSlug: testSource.slug,
            providerName: 'PewneAuto',
            dealerGroupId: testGroup.id
        });

        // 1. manualListing: model/wersja i status archiwizacji NIE zostały nadpisane
        const updatedManual = await prisma.listing.findUnique({ where: { id: manualListing.id } });
        expect(updatedManual?.model).toBe('Corolla Wersja Specjalna Handlowca');
        expect(updatedManual?.version).toBe('Custom Edition');
        expect(updatedManual?.isArchived).toBe(true);
        expect(updatedManual?.archivedReason).toBe('Manual archive');
        expect(updatedManual?.mileageKm).toBe(35000);
        expect(updatedManual?.pricePln).toBe(92000);

        // 2. autoArchivedListing: oferta automatycznie przywrócona (isArchived: false, archivedReason: null)
        const updatedAuto = await prisma.listing.findUnique({ where: { id: autoArchivedListing.id } });
        expect(updatedAuto?.isArchived).toBe(false);
        expect(updatedAuto?.archivedReason).toBeNull();
        expect(updatedAuto?.pricePln).toBe(59000);

        // 3. csvArchivedListing: oferta z 'Not in latest import' również automatycznie przywrócona
        const updatedCsv = await prisma.listing.findUnique({ where: { id: csvArchivedListing.id } });
        expect(updatedCsv?.isArchived).toBe(false);
        expect(updatedCsv?.archivedReason).toBeNull();
        expect(updatedCsv?.pricePln).toBe(109000);

        await prisma.listing.deleteMany({ where: { id: { in: [manualListing.id, autoArchivedListing.id, csvArchivedListing.id] } } });
    });

    it('Circuit Breaker: blokuje masową archiwizację gdy feed drastycznie spada', async () => {
        const engine = new StockSyncEngine(prisma);
        
        // Symulacja: poprzednio 100 aut, teraz tylko 0 aut (spadek 100% > próg 20%)
        const result = await engine.executeSync({
            providerSlug: 'pewneauto',
            fetchCars: async () => ({ cars: [], totalCount: 0, totalPages: 1 })
        }, {
            sourceId: testSource.id,
            sourceSlug: testSource.slug,
            providerName: 'PewneAuto',
            lastSuccessfulCount: 100,
            circuitBreakerThreshold: 0.20
        });

        expect('circuitBreakerTriggered' in result && result.circuitBreakerTriggered).toBe(true);
        expect('success' in result && result.success).toBe(false);
    });

    it('Dry-Run: generuje szczegółowy raport symulacji bez modyfikacji bazy', async () => {
        const mockCars = [
            mapRawCarToNormalized({
                id: 7001,
                vin: 'VINTESTPEWNEAUTO003',
                brand_name: 'Toyota',
                model_name: 'RAV4',
                year: 2023,
                mileage: 10000,
                price: 150000,
                priceGross: 150000,
                dealer_code_and_name: '010 Toyota Piaseczno',
                reserved: 0
            })!
        ];

        const engine = new StockSyncEngine(prisma);
        const dryRunReport = await engine.executeSync({
            providerSlug: 'pewneauto',
            fetchCars: async () => ({ cars: mockCars, totalCount: 1, totalPages: 1 })
        }, {
            sourceId: testSource.id,
            sourceSlug: testSource.slug,
            providerName: 'PewneAuto',
            dealerGroupId: testGroup.id,
            dryRun: true
        });

        expect('toInsertCount' in dryRunReport).toBe(true);
        if ('toInsertCount' in dryRunReport) {
            expect(dryRunReport.toInsertCount).toBe(1);
            expect(dryRunReport.totalFetched).toBe(1);
            expect(dryRunReport.samples.toInsert.length).toBe(1);
            expect(dryRunReport.samples.toInsert[0].make).toBe('Toyota');
        }

        // Baza powinna pozostać nietknięta
        const checkListing = await prisma.listing.findFirst({
            where: { vin: 'VINTESTPEWNEAUTO003' }
        });
        expect(checkListing).toBeNull();
    });

    it('PewneAuto Parsers: poprawnie ekstrahują moc, pojemność, skrzynię, napęd i typ nadwozia', () => {
        // Moc
        expect(extractPowerHp('1.8 Hybrid 140 KM')).toBe(140);
        expect(extractPowerHp('1.5 130KM Executive')).toBe(130);
        expect(extractPowerHp('1.6 132 hp')).toBe(132);
        expect(extractPowerHp('Brak mocy w tekście')).toBeNull();

        // Pojemność
        expect(extractEngineCapacity('Corolla 1.8 Hybrid')).toBe(1798);
        expect(extractEngineCapacity('Yaris 1.5 Dynamic Force')).toBe(1490);
        expect(extractEngineCapacity('RAV4 2.5 Hybrid')).toBe(2487);
        expect(extractEngineCapacity('Camry 2.0')).toBe(1987);

        // Skrzynia
        expect(extractTransmission('Hybryda', 1, 0, '')).toBe('Automatyczna');
        expect(extractTransmission('Benzyna', 0, 0, '1.6 6MT Manual')).toBe('Manualna');
        expect(extractTransmission('Elektryczny', 0, 1, '')).toBe('Automatyczna');

        // Napęd
        expect(extractDrive('1.5 Hybrid 130KM Executive AWD-i')).toBe('4x4 (AWD)');
        expect(extractDrive('2.0 Hybrid 4x4')).toBe('4x4 (AWD)');
        expect(extractDrive('1.8 Hybrid FWD')).toBe('Napęd na przednie koła (FWD)');

        // Nadwozie
        expect(extractBodyType('Corolla', 'Sedan Comfort', 4)).toBe('Sedan');
        expect(extractBodyType('Corolla', 'Touring Sports TS Kombi', 5)).toBe('Kombi');
        expect(extractBodyType('RAV4', 'RAV4 Executive', 5)).toBe('SUV');
        expect(extractBodyType('Yaris Cross', '1.5 Hybrid', 5)).toBe('SUV');
        expect(extractBodyType('Yaris', '1.5 Style', 5)).toBe('Hatchback');
        expect(extractBodyType('Proace Max', 'Furgon Heavy', 4)).toBe('Dostawczy / Van');
    });
});
