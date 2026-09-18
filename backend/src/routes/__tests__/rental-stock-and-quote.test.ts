import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import FormData from 'form-data';
import { buildApp } from '../../app.js';
import { extractSpecNo, parseDeliveryDate, parseRentalStockCSV } from '../../services/rental-stock-parser.js';

describe('Rental Stock & Valuation Engine (Etap 1)', () => {
    let app: FastifyInstance;
    let token: string;
    let companyId: string;
    let vehicleId: string;
    let assignmentId: string;

    const testTimestamp = Date.now();

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();

        token = app.jwt.sign({
            userId: 'test-admin',
            email: 'admin@motolia.pl',
            role: 'manager',
            memberships: [
                { id: 'm1', scopeType: 'PLATFORM', scopeId: 'PLATFORM', role: 'PLATFORM_MANAGER', isDefaultContext: true }
            ],
            activeContext: { scopeType: 'PLATFORM', scopeId: 'PLATFORM' }
        });

        // Create isolated test rental company
        const company = await app.prisma.rentalCompany.create({
            data: {
                name: `Test Ayvens ${testTimestamp}`,
                slug: `test-ayvens-${testTimestamp}`,
                isActive: false
            }
        });
        companyId = company.id;

        // Create test vehicle for Polo (spec 294)
        const vehicle = await app.prisma.rentalVehicle.create({
            data: {
                slug: `test-polo-${testTimestamp}`,
                make: 'VOLKSWAGEN',
                model: 'Polo',
                version: '1.0 Tsi 95km Dsg 7 Life Plus',
                productionYear: 2026,
                isPublished: false,
                isActive: false,
                ownerRentalCompanyId: companyId
            }
        });
        vehicleId = vehicle.id;

        // Create assignment for spec 294
        const assignment = await app.prisma.vehicleRentalAssignment.create({
            data: {
                vehicleId,
                rentalCompanyId: companyId,
                externalVehicleId: '294',
                calculationId: '3047166',
                isActive: false
            }
        });
        assignmentId = assignment.id;
    });

    afterAll(async () => {
        // Clean up test data
        await app.prisma.rentalStockUnit.deleteMany({ where: { rentalCompanyId: companyId } });
        await app.prisma.rentalMatrixEntry.deleteMany({
            where: { assignment: { rentalCompanyId: companyId } }
        });
        await app.prisma.vehicleRentalAssignment.deleteMany({ where: { rentalCompanyId: companyId } });
        await app.prisma.rentalVehicle.deleteMany({ where: { ownerRentalCompanyId: companyId } });
        await app.prisma.rentalCompany.deleteMany({ where: { id: companyId } });

        await app.close();
    });

    // ── KRYTERIUM 1: Regex specyfikacji ───────────────────────────────
    describe('Kryterium 1: Regex ekstrakcji numeru specyfikacji', () => {
        it('prawidłowo ekstrahuje specNo i specNoNote z zestawu realnych danych', () => {
            const cases = [
                { raw: '291 (Warszawa)', expSpec: '291', expNote: 'Warszawa' },
                { raw: '302(Katowice)', expSpec: '302', expNote: 'Katowice' },
                { raw: '260 - Katowice', expSpec: '260', expNote: 'Katowice' },
                { raw: '306 Kraków', expSpec: '306', expNote: 'Kraków' },
                { raw: 'B103 (Katowice)', expSpec: 'B103', expNote: 'Katowice' },
                { raw: '306B', expSpec: '306B', expNote: null },
                { raw: '321', expSpec: '321', expNote: null },
            ];

            for (const c of cases) {
                const res = extractSpecNo(c.raw);
                expect(res.specNo).toBe(c.expSpec);
                expect(res.specNoNote).toBe(c.expNote);
            }
        });

        it('zwraca null dla pustych wartości', () => {
            expect(extractSpecNo(null)).toEqual({ specNo: null, specNoNote: null });
            expect(extractSpecNo('')).toEqual({ specNo: null, specNoNote: null });
            expect(extractSpecNo('   ')).toEqual({ specNo: null, specNoNote: null });
        });

        it('prawidłowo parsuje różne formaty dat dostawy', () => {
            expect(parseDeliveryDate('2027-02-01')?.toISOString().split('T')[0]).toBe('2027-02-01');
            expect(parseDeliveryDate('01.02.2027')?.toISOString().split('T')[0]).toBe('2027-02-01');
            expect(parseDeliveryDate('')).toBeNull();
            expect(parseDeliveryDate(null)).toBeNull();
        });
    });

    // ── KRYTERIUM 2: Regresja na blokadzie duplikatów ──────────────────
    describe('Kryterium 2: Regresja na blokadzie duplikatów cennika (3 × N wierszy)', () => {
        it('import 3 wariantów cennika (base, 6, 8) tworzy dokładnie 3 x N wierszy bez cichej utraty', async () => {
            // Fixture cennika providera z 2 wierszami (N = 2) dla spec 294
            const fixtureCSV = [
                'car_id,calc_id,term_months,mileage_yearly,monthly_cost_net,insurance_500,insurance_nolim,tires_nolim,over_mileage,over_mileage_tires',
                '294,3047166,36,10000,949,61,180,120,0.38,0.53',
                '294,3047167,48,10000,919,55,160,110,0.36,0.50'
            ].join('\n');

            const importVariant = async (variant: string) => {
                const form = new FormData();
                form.append('file', Buffer.from(fixtureCSV), {
                    filename: `cennik_${variant}.csv`,
                    contentType: 'text/csv'
                });

                const res = await app.inject({
                    method: 'POST',
                    url: `/api/rental-matrix/import?rentalCompanyId=${companyId}&priceVariant=${variant}`,
                    headers: {
                        authorization: `Bearer ${token}`,
                        ...form.getHeaders()
                    },
                    payload: form.getBuffer()
                });

                expect(res.statusCode).toBe(200);
                return JSON.parse(res.body);
            };

            const resBase = await importVariant('base');
            expect(resBase.inserted).toBe(2);

            const res6 = await importVariant('6');
            expect(res6.inserted).toBe(2);

            const res8 = await importVariant('8');
            expect(res8.inserted).toBe(2);

            // Sprawdzenie liczby wierszy w bazie: musi być dokładnie 3 * 2 = 6 wierszy
            const totalCount = await app.prisma.rentalMatrixEntry.count({
                where: { assignmentId }
            });
            expect(totalCount).toBe(6);

            // Sprawdzenie, że każdy wariant istnieje
            const baseEntries = await app.prisma.rentalMatrixEntry.count({
                where: { assignmentId, priceVariant: 'base' }
            });
            const p6Entries = await app.prisma.rentalMatrixEntry.count({
                where: { assignmentId, priceVariant: '6' }
            });
            const p8Entries = await app.prisma.rentalMatrixEntry.count({
                where: { assignmentId, priceVariant: '8' }
            });
            expect(baseEntries).toBe(2);
            expect(p6Entries).toBe(2);
            expect(p8Entries).toBe(2);
        });
    });

    // ── KRYTERIA 3 & 4: Wycena i rozbicie składników ───────────────────
    describe('Kryteria 3 i 4: Wycena zgodna z realnym mailem oraz rozbicie składników', () => {
        beforeAll(async () => {
            // Utwórz egzemplarz stoku dla VW Polo 3460697
            await app.prisma.rentalStockUnit.create({
                data: {
                    rentalCompanyId: companyId,
                    stockNo: '3460697',
                    specNoRaw: '294',
                    specNo: '294',
                    specNoNote: null,
                    make: 'VOLKSWAGEN',
                    model: 'Polo',
                    modelDescription: 'Polo 1.0 Tsi 95km Dsg 7 Life Plus',
                    color: 'Niebieski Crystal',
                    fuelType: 'benzyna',
                    vehicleDeliveryDate: new Date('2027-02-01'),
                    isActive: true
                }
            });
        });

        it('Kryterium 3: zwraca 949 zł netto (1167.27 zł brutto) dla wariantu bazowego (36m, 10k km, udział 1000, bez opon)', async () => {
            const res = await app.inject({
                method: 'GET',
                url: `/api/rental-stock/3460697/quote?companyId=${companyId}&months=36&annualKm=10000&insurance=1000&tires=false&variant=base`
            });

            expect(res.statusCode).toBe(200);
            const data = JSON.parse(res.body);

            expect(data.stockNo).toBe('3460697');
            expect(data.specNo).toBe('294');
            expect(data.vehicle.make).toBe('VOLKSWAGEN');
            expect(data.vehicle.model).toBe('Polo');
            expect(data.vehicleDeliveryDate).toBe('2027-02-01');
            expect(data.variant).toBe('base');
            expect(data.breakdown).toEqual({
                baseNet: 949,
                baseGross: 1167.27,
                insuranceNet: 0,
                insuranceGross: 0,
                excessSurchargeNet: 0,
                tiresNet: 0
            });
            expect(data.monthlyRateNet).toBe(949);
            expect(data.monthlyRateGross).toBe(1167.27);
            expect(data.overMileageNet).toBe(0.38);
            expect(data.overMileageUnavailable).toBeUndefined();
        });

        it('Kryterium 4: rozbicie składników: insurance=500 -> 1010 zł', async () => {
            const res = await app.inject({
                method: 'GET',
                url: `/api/rental-stock/3460697/quote?companyId=${companyId}&months=36&annualKm=10000&insurance=500&tires=false&variant=base`
            });

            expect(res.statusCode).toBe(200);
            const data = JSON.parse(res.body);
            expect(data.breakdown.excessSurchargeNet).toBe(61);
            expect(data.monthlyRateNet).toBe(1010);
            expect(data.overMileageNet).toBe(0.38);
        });

        it('Kryterium 4: rozbicie składników: insurance=0 -> 1129 zł', async () => {
            const res = await app.inject({
                method: 'GET',
                url: `/api/rental-stock/3460697/quote?companyId=${companyId}&months=36&annualKm=10000&insurance=0&tires=false&variant=base`
            });

            expect(res.statusCode).toBe(200);
            const data = JSON.parse(res.body);
            expect(data.breakdown.excessSurchargeNet).toBe(180);
            expect(data.monthlyRateNet).toBe(1129);
            expect(data.overMileageNet).toBe(0.38);
        });

        it('Kryterium 4: rozbicie składników: tires=true -> 1069 zł oraz overMileageNet = 0.53 z wariantu z oponami', async () => {
            const res = await app.inject({
                method: 'GET',
                url: `/api/rental-stock/3460697/quote?companyId=${companyId}&months=36&annualKm=10000&insurance=1000&tires=true&variant=base`
            });

            expect(res.statusCode).toBe(200);
            const data = JSON.parse(res.body);
            expect(data.breakdown.tiresNet).toBe(120);
            expect(data.monthlyRateNet).toBe(1069);
            expect(data.overMileageNet).toBe(0.53);
        });

        it('obsługa braku over_mileage_tires przy tires=true zwraca overMileageNet: null i overMileageUnavailable: true', async () => {
            // Tymczasowo wyczyść overMileageTiresNoLimit
            await app.prisma.rentalMatrixEntry.updateMany({
                where: { assignmentId, contractMonths: 36, annualMileageKm: 10000, priceVariant: 'base' },
                data: { overMileageTiresNoLimit: null }
            });

            const res = await app.inject({
                method: 'GET',
                url: `/api/rental-stock/3460697/quote?companyId=${companyId}&months=36&annualKm=10000&insurance=1000&tires=true&variant=base`
            });

            expect(res.statusCode).toBe(200);
            const data = JSON.parse(res.body);
            expect(data.overMileageNet).toBeNull();
            expect(data.overMileageUnavailable).toBe(true);

            // Przywróć wartość 0.53
            await app.prisma.rentalMatrixEntry.updateMany({
                where: { assignmentId, contractMonths: 36, annualMileageKm: 10000, priceVariant: 'base' },
                data: { overMileageTiresNoLimit: 0.53 }
            });
        });
    });

    // ── KRYTERIA 5 & 6: Import stoku, raport niedopasowań i upsert ─────
    describe('Kryteria 5 i 6: Raport niedopasowań stoku, upsert i dezaktywacja', () => {
        // Fixture 8 aut: 1 z cennikiem (Polo 294) i 7 bez cennika
        const stockFixtureCSV = [
            'stock_no,spec_no,vin,reg_no,make,model,model_description,body_type,color,fuel,dealer,docs_delivery_date,vehicle_delivery_date',
            '3460697,294,WVWZZZAWZHY123456,,VOLKSWAGEN,Polo,Polo 1.0 Tsi 95km Dsg 7 Life Plus,hatchback,Niebieski Crystal,benzyna,Grupa Cichy-Zasada,2027-01-11,2027-02-01',
            '3417358,321 (Warszawa),,,AUDI,A4,A4 Avant 35 TFSI,kombi,Czarny,benzyna,Krotoski,2026-08-15,2026-09-05',
            '3417359,269,,,BMW,118i,118i M Sport,hatchback,Szary,benzyna,Bawaria,2026-08-15,2026-09-05',
            '3417360,285,,,CUPRA,Formentor,Formentor 1.5 TSI,suv,Biały,benzyna,Plichta,2026-08-15,2026-09-05',
            '3417361,259,,,SKODA,Octavia,Octavia Combi 1.5 TSI,kombi,Srebrny,benzyna,Auto Wimar,2026-08-15,2026-09-05',
            '3417362,256,,,TOYOTA,Corolla,Corolla 1.8 Hybrid,kombi,Granatowy,hybryda,Toyota Marki,2026-08-15,2026-09-05',
            '3417363,221,,,VOLVO,XC40,XC40 B3 Plus,suv,Czarny,benzyna,Euroservice,2026-08-15,2026-09-05',
            '3417364,272,,,HYUNDAI,Tucson,Tucson 1.6 T-GDI,suv,Czerwony,benzyna,Auto GT,2026-08-15,2026-09-05'
        ].join('\n');

        it('Kryterium 5: import stoku zwraca raport niedopasowań dla 7 specyfikacji bez cennika', async () => {
            const form = new FormData();
            form.append('file', Buffer.from(stockFixtureCSV), {
                filename: 'stock_fixture.csv',
                contentType: 'text/csv'
            });

            const res = await app.inject({
                method: 'POST',
                url: `/api/rental-stock/import?rentalCompanyId=${companyId}`,
                headers: {
                    authorization: `Bearer ${token}`,
                    ...form.getHeaders()
                },
                payload: form.getBuffer()
            });

            expect(res.statusCode).toBe(200);
            const data = JSON.parse(res.body);

            expect(data.totalRows).toBe(8);
            // 3460697 był już dodany w teście wyceny, więc 7 inserted, 1 updated
            expect(data.inserted).toBe(7);
            expect(data.updated).toBe(1);
            expect(data.deactivated).toBe(0);

            // Sprawdzenie 7 niedopasowań
            const unmatchedSpecs = data.unmatched.map((u: any) => u.specNo);
            expect(unmatchedSpecs).toHaveLength(7);
            expect(unmatchedSpecs).toContain('321');
            expect(unmatchedSpecs).toContain('269');
            expect(unmatchedSpecs).toContain('285');
            expect(unmatchedSpecs).toContain('259');
            expect(unmatchedSpecs).toContain('256');
            expect(unmatchedSpecs).toContain('221');
            expect(unmatchedSpecs).toContain('272');
            expect(unmatchedSpecs).not.toContain('294');

            // Wszystkie 8 pozycji są zapisane w bazie
            const unitsInDb = await app.prisma.rentalStockUnit.count({
                where: { rentalCompanyId: companyId }
            });
            expect(unitsInDb).toBe(8);
        });

        it('Kryterium 6: powtórny import tego samego pliku daje inserted: 0, updated: 8, brak duplikatów', async () => {
            const form = new FormData();
            form.append('file', Buffer.from(stockFixtureCSV), {
                filename: 'stock_fixture.csv',
                contentType: 'text/csv'
            });

            const res = await app.inject({
                method: 'POST',
                url: `/api/rental-stock/import?rentalCompanyId=${companyId}`,
                headers: {
                    authorization: `Bearer ${token}`,
                    ...form.getHeaders()
                },
                payload: form.getBuffer()
            });

            expect(res.statusCode).toBe(200);
            const data = JSON.parse(res.body);

            expect(data.totalRows).toBe(8);
            expect(data.inserted).toBe(0);
            expect(data.updated).toBe(8);
            expect(data.deactivated).toBe(0);

            // Brak duplikatów w bazie
            const unitsInDb = await app.prisma.rentalStockUnit.count({
                where: { rentalCompanyId: companyId }
            });
            expect(unitsInDb).toBe(8);
        });

        it('dezaktywuje wyłącznie pozycje danej firmy nieobecne w nowym pliku', async () => {
            // Wgrywamy plik tylko z 1 autem (Polo 3460697)
            const singleCarCSV = [
                'stock_no,spec_no,make,model',
                '3460697,294,VOLKSWAGEN,Polo'
            ].join('\n');

            const form = new FormData();
            form.append('file', Buffer.from(singleCarCSV), {
                filename: 'single.csv',
                contentType: 'text/csv'
            });

            const res = await app.inject({
                method: 'POST',
                url: `/api/rental-stock/import?rentalCompanyId=${companyId}`,
                headers: {
                    authorization: `Bearer ${token}`,
                    ...form.getHeaders()
                },
                payload: form.getBuffer()
            });

            expect(res.statusCode).toBe(200);
            const data = JSON.parse(res.body);
            expect(data.totalRows).toBe(1);
            expect(data.updated).toBe(1);
            expect(data.deactivated).toBe(7); // pozostałe 7 aut zostało dezaktywowanych

            const activeUnits = await app.prisma.rentalStockUnit.count({
                where: { rentalCompanyId: companyId, isActive: true }
            });
            expect(activeUnits).toBe(1);

            const inactiveUnits = await app.prisma.rentalStockUnit.count({
                where: { rentalCompanyId: companyId, isActive: false }
            });
            expect(inactiveUnits).toBe(7);
        });

        it('odrzuca pusty plik CSV (kod 400) i nie dezaktywuje istniejących aut', async () => {
            const emptyCSV = 'stock_no,spec_no,make,model\n';
            const form = new FormData();
            form.append('file', Buffer.from(emptyCSV, 'utf-8'), {
                filename: 'empty-stock.csv',
                contentType: 'text/csv'
            });

            const res = await app.inject({
                method: 'POST',
                url: `/api/rental-stock/import?rentalCompanyId=${companyId}`,
                headers: {
                    ...form.getHeaders(),
                    authorization: `Bearer ${token}`
                },
                payload: form.getBuffer()
            });

            expect(res.statusCode).toBe(400);
            const body = JSON.parse(res.body);
            expect(body.error).toContain('Plik CSV nie zawiera żadnych poprawnych wierszy');

            // Aktywny stan pozostał nienaruszony (1 aktywne z poprzedniego testu)
            const activeUnits = await app.prisma.rentalStockUnit.count({
                where: { rentalCompanyId: companyId, isActive: true }
            });
            expect(activeUnits).toBe(1);
        });
    });

    // ── REGUŁA N ASSIGNMENTÓW: Determinizm i 409 przy rozbieżności ─────
    describe('Reguła wyceny: jedna specyfikacja -> wiele assignmentów', () => {
        let vehicleIdB: string;
        let assignmentIdB: string;

        beforeAll(async () => {
            // Drugi pojazd dla specyfikacji 294
            const vehicleB = await app.prisma.rentalVehicle.create({
                data: {
                    slug: `test-polo-b-${testTimestamp}`,
                    make: 'VOLKSWAGEN',
                    model: 'Polo',
                    version: '1.0 Tsi 95km Dsg 7 Life Plus',
                    color: 'Czarny Deep',
                    productionYear: 2026,
                    isPublished: false,
                    isActive: false,
                    ownerRentalCompanyId: companyId
                }
            });
            vehicleIdB = vehicleB.id;

            const assignmentB = await app.prisma.vehicleRentalAssignment.create({
                data: {
                    vehicleId: vehicleIdB,
                    rentalCompanyId: companyId,
                    externalVehicleId: '294',
                    calculationId: '3047166',
                    isActive: false
                }
            });
            assignmentIdB = assignmentB.id;
        });

        afterAll(async () => {
            if (assignmentIdB) {
                await app.prisma.rentalMatrixEntry.deleteMany({ where: { assignmentId: assignmentIdB } });
                await app.prisma.vehicleRentalAssignment.deleteMany({ where: { id: assignmentIdB } });
            }
            if (vehicleIdB) {
                await app.prisma.rentalVehicle.deleteMany({ where: { id: vehicleIdB } });
            }
        });

        it('wybiera deterministycznie najniższy assignmentId gdy stawki są identyczne', async () => {
            // Dodaj identyczny wpis do assignmentB
            await app.prisma.rentalMatrixEntry.create({
                data: {
                    assignmentId: assignmentIdB,
                    contractMonths: 36,
                    annualMileageKm: 10000,
                    initialPaymentPct: 0,
                    initialPaymentAmountNet: 0,
                    initialPaymentAmountGross: 0,
                    offerType: 'all',
                    monthlyRateNet: 949,
                    monthlyRateGross: 1167.27,
                    insuranceExcess500: 61,
                    insuranceNoLimit: 180,
                    tiresNoLimit: 120,
                    overMileageCost: 0.38,
                    overMileageTiresNoLimit: 0.53,
                    priceVariant: 'base'
                }
            });

            const res = await app.inject({
                method: 'GET',
                url: `/api/rental-stock/3460697/quote?companyId=${companyId}&months=36&annualKm=10000&insurance=1000&tires=false&variant=base`
            });

            expect(res.statusCode).toBe(200);
            const data = JSON.parse(res.body);
            expect(data.monthlyRateNet).toBe(949);
        });

        it('zwraca 409 Conflict gdy stawki między przypisaniami tej samej firmy się różnią', async () => {
            // Zmień stawkę w assignmentB na inną (999 zamiast 949)
            await app.prisma.rentalMatrixEntry.updateMany({
                where: { assignmentId: assignmentIdB, contractMonths: 36, annualMileageKm: 10000, priceVariant: 'base' },
                data: { monthlyRateNet: 999 }
            });

            const res = await app.inject({
                method: 'GET',
                url: `/api/rental-stock/3460697/quote?companyId=${companyId}&months=36&annualKm=10000&insurance=1000&tires=false&variant=base`
            });

            expect(res.statusCode).toBe(409);
            const err = JSON.parse(res.body);
            expect(err.error).toContain('Wykryto niespójne stawki w cenniku');
            expect(err.discrepancies).toHaveLength(2);
        });
    });

    // ── SEARCH ENDPOINT ────────────────────────────────────────────────
    describe('Wyszukiwanie stoku (GET /api/rental-stock/search)', () => {
        it('wyszukuje po fragmencie modelu i zwraca flagę hasPricing', async () => {
            const res = await app.inject({
                method: 'GET',
                url: `/api/rental-stock/search?companyId=${companyId}&q=Polo`
            });

            expect(res.statusCode).toBe(200);
            const data = JSON.parse(res.body);
            expect(data.items.length).toBeGreaterThanOrEqual(1);
            expect(data.items[0].stockNo).toBe('3460697');
            expect(data.items[0].hasPricing).toBe(true);
        });
    });

    // ── MATRIX HEALTH SUMMARY ENDPOINT ─────────────────────────────────
    describe('Matrix Health Summary (GET /api/rental-companies/matrix-health-summary)', () => {
        it('wymaga autoryzacji (401 bez tokenu)', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/api/rental-companies/matrix-health-summary'
            });
            expect(res.statusCode).toBe(401);
        });

        it('zwraca strukturę podsumowania zdrowia matryc dla zalogowanego managera', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/api/rental-companies/matrix-health-summary',
                headers: { authorization: `Bearer ${token}` }
            });
            expect(res.statusCode).toBe(200);
            const data = JSON.parse(res.body);
            expect(data).toHaveProperty('totalCompanies');
            expect(data).toHaveProperty('healthyCompaniesCount');
            expect(data).toHaveProperty('totalEntriesAll');
            expect(data).toHaveProperty('totalMissingAll');
            expect(data).toHaveProperty('unhealthyCompanies');
            expect(data).toHaveProperty('isAllHealthy');
            expect(Array.isArray(data.unhealthyCompanies)).toBe(true);
        });
    });

    // ── BIDIRECTIONAL ALL-IN & INSURANCE MODE VALIDATION ────────────────
    describe('Bidirectional Rental Company Mode Validation (POST & PATCH)', () => {
        let createdCompanyId: string | null = null;

        it('POST: odrzuca All-In (INSURANCE_INCLUDED) bez usługi ubezpieczenia (400)', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/api/rental-companies',
                headers: { authorization: `Bearer ${token}` },
                payload: {
                    name: `Validation Test Company ${Date.now()}`,
                    insuranceAddMode: 'INSURANCE_INCLUDED',
                    includedServices: ['serwis', 'opony']
                }
            });
            expect(res.statusCode).toBe(400);
            const err = JSON.parse(res.body);
            expect(err.error).toContain('Tryb All-In wymaga zaznaczenia usługi Ubezpieczenie');
        });

        it('POST: ostrzega i odrzuca tryb zewnętrzny (INSURANCE_23) przy zaznaczonym ubezpieczeniu bez potwierdzenia (400)', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/api/rental-companies',
                headers: { authorization: `Bearer ${token}` },
                payload: {
                    name: `Conflict Test Company ${Date.now()}`,
                    insuranceAddMode: 'INSURANCE_23',
                    includedServices: ['ubezpieczenie', 'serwis']
                }
            });
            expect(res.statusCode).toBe(400);
            const err = JSON.parse(res.body);
            expect(err.code).toBe('MODE_CONFLICT_CONFIRMATION_REQUIRED');
        });

        it('POST: pozwala zapisać tryb zewnętrzny przy zaznaczonym ubezpieczeniu gdy podano confirmModeConflict: true (201)', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/api/rental-companies',
                headers: { authorization: `Bearer ${token}` },
                payload: {
                    name: `Confirmed Conflict Company ${Date.now()}`,
                    insuranceAddMode: 'INSURANCE_23',
                    includedServices: ['ubezpieczenie', 'serwis'],
                    confirmModeConflict: true
                }
            });
            expect(res.statusCode).toBe(201);
            const data = JSON.parse(res.body);
            expect(data.company.id).toBeDefined();
            createdCompanyId = data.company.id;
        });

        it('PATCH: odrzuca przestawienie na INSURANCE_23 przy zaznaczonym ubezpieczeniu bez potwierdzenia (400)', async () => {
            if (!createdCompanyId) return;
            const res = await app.inject({
                method: 'PATCH',
                url: `/api/rental-companies/${createdCompanyId}`,
                headers: { authorization: `Bearer ${token}` },
                payload: {
                    insuranceAddMode: 'INSURANCE_23',
                    includedServices: ['ubezpieczenie']
                }
            });
            expect(res.statusCode).toBe(400);
            const err = JSON.parse(res.body);
            expect(err.code).toBe('MODE_CONFLICT_CONFIRMATION_REQUIRED');
        });

        it('PATCH: pozwala zapisać po podaniu confirmModeConflict: true (200)', async () => {
            if (!createdCompanyId) return;
            const res = await app.inject({
                method: 'PATCH',
                url: `/api/rental-companies/${createdCompanyId}`,
                headers: { authorization: `Bearer ${token}` },
                payload: {
                    insuranceAddMode: 'INSURANCE_23',
                    includedServices: ['ubezpieczenie'],
                    confirmModeConflict: true
                }
            });
            expect(res.statusCode).toBe(200);

            // Clean up
            await app.prisma.rentalCompany.delete({ where: { id: createdCompanyId } });
        });
    });
});

