import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';

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
});
