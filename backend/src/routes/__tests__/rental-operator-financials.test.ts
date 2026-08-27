import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';
import { sanitizeListing } from '../../constants/dealer.js';

describe('Rental Operator Financials & Public Payload Guard', () => {
    let app: FastifyInstance;
    let platformManagerToken: string;
    let dealerEmployeeToken: string;
    let testCompanyId: string;
    let testVehicleId: string;
    let testAssignmentId: string;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();

        platformManagerToken = app.jwt.sign({
            userId: 'mgr-test',
            email: 'mgr@motolia.pl',
            role: 'manager',
            memberships: [
                { id: 'm1', scopeType: 'PLATFORM', scopeId: 'PLATFORM', role: 'PLATFORM_MANAGER', isDefaultContext: true }
            ],
            activeContext: { scopeType: 'PLATFORM', scopeId: 'PLATFORM' }
        });

        dealerEmployeeToken = app.jwt.sign({
            userId: 'emp-test',
            email: 'emp@dealer.pl',
            role: 'employee',
            memberships: [
                { id: 'm2', scopeType: 'DEALER', scopeId: 'd1', role: 'DEALER_EMPLOYEE', isDefaultContext: true }
            ],
            activeContext: { scopeType: 'DEALER', scopeId: 'd1' }
        });

        // Create test rental company
        const company = await app.prisma.rentalCompany.create({
            data: {
                name: 'Test CFM Company',
                slug: 'test-cfm-company-' + Date.now(),
                isActive: true
            }
        });
        testCompanyId = company.id;

        // Create test rental vehicle
        const vehicle = await app.prisma.rentalVehicle.create({
            data: {
                slug: 'test-rental-car-' + Date.now(),
                make: 'BMW',
                model: '520d',
                productionYear: 2026,
                fuelType: 'diesel',
                transmission: 'automatic',
                bodyType: 'sedan',
                isActive: true,
                isPublished: true
            }
        });
        testVehicleId = vehicle.id;

        // Create assignment & matrix entry with fee_pct = 7.5
        const assignment = await app.prisma.vehicleRentalAssignment.create({
            data: {
                vehicleId: testVehicleId,
                rentalCompanyId: testCompanyId,
                isActive: true
            }
        });
        testAssignmentId = assignment.id;

        await app.prisma.rentalMatrixEntry.create({
            data: {
                assignmentId: testAssignmentId,
                annualMileageKm: 10000,
                contractMonths: 36,
                initialPaymentPct: 0,
                monthlyRateNet: 3000,
                monthlyRateGross: 3690,
                offerType: 'all',
                feePct: 7.5,
                servicesIncluded: ['insurance', 'service']
            }
        });
    });

    afterAll(async () => {
        if (testAssignmentId) {
            await app.prisma.rentalMatrixEntry.deleteMany({ where: { assignmentId: testAssignmentId } });
            await app.prisma.vehicleRentalAssignment.deleteMany({ where: { id: testAssignmentId } });
        }
        if (testVehicleId) {
            await app.prisma.rentalVehicle.deleteMany({ where: { id: testVehicleId } });
        }
        if (testCompanyId) {
            await app.prisma.rentalCompany.deleteMany({ where: { id: testCompanyId } });
        }
        await app.close();
    });

    it('regression guard: GET /api/rental/vehicles/:slug/calculate NEVER exposes feePct or operatorFinancials in public payload', async () => {
        const vehicle = await app.prisma.rentalVehicle.findUnique({ where: { id: testVehicleId } });
        const res = await app.inject({
            method: 'GET',
            url: `/api/rental/vehicles/${vehicle?.slug}/calculate?annualMileageKm=10000&contractMonths=36&initialPaymentPct=0`
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.offers).toBeDefined();
        expect(body.offers.length).toBeGreaterThan(0);

        for (const offer of body.offers) {
            expect(offer.feePct).toBeUndefined();
            expect(offer.fee_pct).toBeUndefined();
            expect(offer.operatorFinancials).toBeUndefined();
        }
        expect(JSON.stringify(body)).not.toContain('7.5');
    });

    it('operator-financials: rejects anonymous requests with 401', async () => {
        const vehicle = await app.prisma.rentalVehicle.findUnique({ where: { id: testVehicleId } });
        const res = await app.inject({
            method: 'GET',
            url: `/api/rental/vehicles/${vehicle?.slug}/operator-financials?annualMileageKm=10000&contractMonths=36&initialPaymentPct=0`
        });
        expect(res.statusCode).toBe(401);
    });

    it('operator-financials: rejects dealer employees (lacking rental:financials:read) with 403', async () => {
        const vehicle = await app.prisma.rentalVehicle.findUnique({ where: { id: testVehicleId } });
        const res = await app.inject({
            method: 'GET',
            url: `/api/rental/vehicles/${vehicle?.slug}/operator-financials?annualMileageKm=10000&contractMonths=36&initialPaymentPct=0`,
            headers: { authorization: `Bearer ${dealerEmployeeToken}` }
        });
        expect(res.statusCode).toBe(403);
    });

    it('regression guard: GET /api/rental/vehicles and GET /api/rental/vehicles/:slug NEVER expose feePct in public payload', async () => {
        const vehicle = await app.prisma.rentalVehicle.findUnique({ where: { id: testVehicleId } });
        
        // List endpoint
        const listRes = await app.inject({
            method: 'GET',
            url: '/api/rental/vehicles'
        });
        expect(listRes.statusCode).toBe(200);
        const listBody = JSON.parse(listRes.body);
        expect(JSON.stringify(listBody)).not.toContain('feePct');
        expect(JSON.stringify(listBody)).not.toContain('fee_pct');

        // Detail endpoint
        const detailRes = await app.inject({
            method: 'GET',
            url: `/api/rental/vehicles/${vehicle?.slug}`
        });
        expect(detailRes.statusCode).toBe(200);
        const detailBody = JSON.parse(detailRes.body);
        expect(JSON.stringify(detailBody)).not.toContain('feePct');
        expect(JSON.stringify(detailBody)).not.toContain('fee_pct');
    });

    it('deterministic selection: /calculate and /operator-financials pick the exact same entry when business and all co-exist', async () => {
        // Add a specific 'business' entry alongside existing 'all' entry
        const businessEntry = await app.prisma.rentalMatrixEntry.create({
            data: {
                assignmentId: testAssignmentId,
                annualMileageKm: 10000,
                contractMonths: 36,
                initialPaymentPct: 0,
                monthlyRateNet: 2800,
                monthlyRateGross: 3444,
                offerType: 'business',
                feePct: 6.5,
                servicesIncluded: ['insurance', 'service']
            }
        });

        const vehicle = await app.prisma.rentalVehicle.findUnique({ where: { id: testVehicleId } });

        // Query calculate with offerType=business
        const calcRes = await app.inject({
            method: 'GET',
            url: `/api/rental/vehicles/${vehicle?.slug}/calculate?annualMileageKm=10000&contractMonths=36&initialPaymentPct=0&offerType=business`
        });
        expect(calcRes.statusCode).toBe(200);
        const calcBody = JSON.parse(calcRes.body);
        expect(calcBody.offers[0].monthlyRateNet).toBe(2800); // Picked business entry, not 3000 from 'all'

        // Query operator-financials with offerType=business
        const opRes = await app.inject({
            method: 'GET',
            url: `/api/rental/vehicles/${vehicle?.slug}/operator-financials?annualMileageKm=10000&contractMonths=36&initialPaymentPct=0&offerType=business`,
            headers: { authorization: `Bearer ${platformManagerToken}` }
        });
        expect(opRes.statusCode).toBe(200);
        const opBody = JSON.parse(opRes.body);
        expect(opBody.offers[0].feePct).toBe(6.5); // Consistently picked business entry fee 6.5%

        // Clean up extra entry
        await app.prisma.rentalMatrixEntry.delete({ where: { id: businessEntry.id } });
    });

    it('operator-financials: returns feePct for PLATFORM_MANAGER', async () => {
        const vehicle = await app.prisma.rentalVehicle.findUnique({ where: { id: testVehicleId } });
        const res = await app.inject({
            method: 'GET',
            url: `/api/rental/vehicles/${vehicle?.slug}/operator-financials?annualMileageKm=10000&contractMonths=36&initialPaymentPct=0`,
            headers: { authorization: `Bearer ${platformManagerToken}` }
        });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.offers).toBeDefined();
        expect(body.offers[0].feePct).toBe(7.5);
        expect(body.financialsByCompanyId[testCompanyId].feePct).toBe(7.5);
    });

    it('operator-info: rejects anonymous requests with 401', async () => {
        const vehicle = await app.prisma.rentalVehicle.findUnique({ where: { id: testVehicleId } });
        const res = await app.inject({
            method: 'GET',
            url: `/api/rental/vehicles/${vehicle?.slug}/operator-info`
        });
        expect(res.statusCode).toBe(401);
    });

    it('operator-info: rejects dealer employees (lacking rental:financials:read) with 403', async () => {
        const vehicle = await app.prisma.rentalVehicle.findUnique({ where: { id: testVehicleId } });
        const res = await app.inject({
            method: 'GET',
            url: `/api/rental/vehicles/${vehicle?.slug}/operator-info`,
            headers: { authorization: `Bearer ${dealerEmployeeToken}` }
        });
        expect(res.statusCode).toBe(403);
    });

    it('operator-info: returns dealer, ownerRentalCompany, availableFrom for PLATFORM_MANAGER', async () => {
        // Set availableFrom and ownerRentalCompanyId on test vehicle
        await app.prisma.rentalVehicle.update({
            where: { id: testVehicleId },
            data: {
                availableFrom: '2026-11-01',
                firstRegistrationDate: '2026-01-15',
                vin: 'WBA1234567890TEST',
                ownerRentalCompanyId: testCompanyId
            }
        });

        const vehicle = await app.prisma.rentalVehicle.findUnique({ where: { id: testVehicleId } });
        const res = await app.inject({
            method: 'GET',
            url: `/api/rental/vehicles/${vehicle?.slug}/operator-info`,
            headers: { authorization: `Bearer ${platformManagerToken}` }
        });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.vehicleId).toBe(testVehicleId);
        expect(body.availableFrom).toBe('2026-11-01');
        expect(body.firstRegistrationDate).toBe('2026-01-15');
        expect(body.vin).toBe('WBA1234567890TEST');
        expect(body.ownerRentalCompany).toBeDefined();
        expect(body.ownerRentalCompany.name).toBe('Test CFM Company');
    });

    it('regression guard: public GET /api/rental/vehicles/:slug NEVER leaks vin, registrationNumber, ownerRentalCompanyId, dealerId, availableFrom, ownerRentalCompany to anonymous or non-operator users', async () => {
        // Set all private fields on test vehicle
        await app.prisma.rentalVehicle.update({
            where: { id: testVehicleId },
            data: {
                vin: 'WBA1234567890TEST',
                registrationNumber: 'WA12345',
                ownerRentalCompanyId: testCompanyId,
                availableFrom: '2026-11-01',
                specsJson: { internalCode: 'SECRET-99' },
                isPublished: true
            }
        });

        const vehicle = await app.prisma.rentalVehicle.findUnique({ where: { id: testVehicleId } });

        // 1. Anonymous request
        const anonRes = await app.inject({
            method: 'GET',
            url: `/api/rental/vehicles/${vehicle?.slug}`
        });
        expect(anonRes.statusCode).toBe(200);
        const anonBody = JSON.parse(anonRes.body);
        expect(anonBody.vehicle).toBeDefined();
        expect(anonBody.vehicle.vin).toBeUndefined();
        expect(anonBody.vehicle.registrationNumber).toBeUndefined();
        expect(anonBody.vehicle.ownerRentalCompanyId).toBeUndefined();
        expect(anonBody.vehicle.ownerRentalCompany).toBeUndefined();
        expect(anonBody.vehicle.availableFrom).toBeUndefined();
        expect(anonBody.vehicle.available_from).toBeUndefined();
        expect(anonBody.vehicle.dealerId).toBeUndefined();
        expect(anonBody.vehicle.specsJson).toBeUndefined();
        expect(anonBody.vehicle.isPublished).toBeUndefined();

        // 2. Dealer employee request (logged in, but lacking rental:financials:read)
        const employeeRes = await app.inject({
            method: 'GET',
            url: `/api/rental/vehicles/${vehicle?.slug}`,
            headers: { authorization: `Bearer ${dealerEmployeeToken}` }
        });
        expect(employeeRes.statusCode).toBe(200);
        const employeeBody = JSON.parse(employeeRes.body);
        expect(employeeBody.vehicle).toBeDefined();
        expect(employeeBody.vehicle.vin).toBeUndefined();
        expect(employeeBody.vehicle.registrationNumber).toBeUndefined();
        expect(employeeBody.vehicle.ownerRentalCompanyId).toBeUndefined();
        expect(employeeBody.vehicle.ownerRentalCompany).toBeUndefined();
        expect(employeeBody.vehicle.availableFrom).toBeUndefined();
    });

    it('rental-vehicles PATCH: validates required non-nullable fields and rejects empty strings with 400', async () => {
        // Empty make -> 400
        const badMakeRes = await app.inject({
            method: 'PATCH',
            url: `/api/rental-vehicles/${testVehicleId}`,
            headers: { authorization: `Bearer ${platformManagerToken}` },
            payload: { make: '' }
        });
        expect(badMakeRes.statusCode).toBe(400);

        // Empty model -> 400
        const badModelRes = await app.inject({
            method: 'PATCH',
            url: `/api/rental-vehicles/${testVehicleId}`,
            headers: { authorization: `Bearer ${platformManagerToken}` },
            payload: { model: '   ' }
        });
        expect(badModelRes.statusCode).toBe(400);

        // Invalid condition -> 400
        const badConditionRes = await app.inject({
            method: 'PATCH',
            url: `/api/rental-vehicles/${testVehicleId}`,
            headers: { authorization: `Bearer ${platformManagerToken}` },
            payload: { condition: 'INVALID_COND' }
        });
        expect(badConditionRes.statusCode).toBe(400);
    });

    it('rental-vehicles PATCH: validates YYYY-MM-DD date format and handles clearing', async () => {
        // Invalid date format
        const badRes = await app.inject({
            method: 'PATCH',
            url: `/api/rental-vehicles/${testVehicleId}`,
            headers: { authorization: `Bearer ${platformManagerToken}` },
            payload: { availableFrom: 'invalid-date' }
        });
        expect(badRes.statusCode).toBe(400);

        // Invalid calendar date (e.g. Feb 30)
        const badFeb30Res = await app.inject({
            method: 'PATCH',
            url: `/api/rental-vehicles/${testVehicleId}`,
            headers: { authorization: `Bearer ${platformManagerToken}` },
            payload: { availableFrom: '2026-02-30' }
        });
        expect(badFeb30Res.statusCode).toBe(400);

        // Valid date format
        const goodRes = await app.inject({
            method: 'PATCH',
            url: `/api/rental-vehicles/${testVehicleId}`,
            headers: { authorization: `Bearer ${platformManagerToken}` },
            payload: { availableFrom: '2026-12-31' }
        });
        expect(goodRes.statusCode).toBe(200);
        const updated = await app.prisma.rentalVehicle.findUnique({ where: { id: testVehicleId } });
        expect(updated?.availableFrom).toBe('2026-12-31');

        // Clear date field by sending empty string or null
        const clearRes = await app.inject({
            method: 'PATCH',
            url: `/api/rental-vehicles/${testVehicleId}`,
            headers: { authorization: `Bearer ${platformManagerToken}` },
            payload: { availableFrom: '' }
        });
        expect(clearRes.statusCode).toBe(200);
        const cleared = await app.prisma.rentalVehicle.findUnique({ where: { id: testVehicleId } });
        expect(cleared?.availableFrom).toBeNull();
    });

    it('sanitizeListing regression guard: preserves vin and registrationNumber when isAuthenticated === true', () => {
        const salesListing = {
            id: 'listing-123',
            make: 'Toyota',
            model: 'Corolla',
            vin: 'JT1234567890TEST',
            registrationNumber: 'WA99999',
            dealer: { id: 'd1', name: 'Salon Toyota' }
        };

        // Authenticated admin / editor must receive full VIN and registrationNumber
        const authed = sanitizeListing(salesListing, true);
        expect(authed?.vin).toBe('JT1234567890TEST');
        expect(authed?.registrationNumber).toBe('WA99999');
        expect(authed?.dealer?.name).toBe('Salon Toyota');

        // Unauthenticated public request strips them and anonymizes dealer
        const publicListing = sanitizeListing(salesListing, false);
        expect(publicListing?.vin).toBeUndefined();
        expect(publicListing?.registrationNumber).toBeUndefined();
        expect(publicListing?.dealer?.name).toBe('Zweryfikowany Partner Motolia');
    });
});
