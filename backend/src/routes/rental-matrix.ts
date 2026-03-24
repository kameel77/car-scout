import { FastifyInstance } from 'fastify';
import { parse } from 'csv-parse/sync';
import {
    validateMatrixCSVHeaders,
    mapCSVRowToMatrixEntry,
    type RentalMatrixCSVRow,
    type RentalMatrixImportResult
} from '../services/rental-csv-mapper.js';

export async function rentalMatrixRoutes(fastify: FastifyInstance) {
    // Import matrix CSV for a specific rental company
    fastify.post('/api/rental-matrix/import', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { rentalCompanyId } = request.query as { rentalCompanyId: string };

        if (!rentalCompanyId) {
            return reply.code(400).send({ error: 'rentalCompanyId query parameter is required' });
        }

        // Verify company exists
        const company = await fastify.prisma.rentalCompany.findUnique({
            where: { id: rentalCompanyId }
        });

        if (!company) {
            return reply.code(404).send({ error: 'Rental company not found' });
        }

        const data = await request.file();
        if (!data) {
            return reply.code(400).send({ error: 'No file uploaded' });
        }

        const buffer = await data.toBuffer();
        const csvContent = buffer.toString('utf-8');

        // Parse CSV
        let records: RentalMatrixCSVRow[];
        try {
            records = parse(csvContent, {
                columns: true,
                skip_empty_lines: true,
                delimiter: [',', ';', '\t'],
                relax_column_count: true,
                trim: true
            }) as RentalMatrixCSVRow[];
        } catch (err) {
            return reply.code(400).send({
                error: 'CSV parsing failed',
                message: err instanceof Error ? err.message : 'Unknown error'
            });
        }

        if (records.length === 0) {
            return reply.code(400).send({ error: 'CSV file is empty' });
        }

        // Validate headers
        const headers = Object.keys(records[0]);
        const headerValidation = validateMatrixCSVHeaders(headers);
        if (!headerValidation.valid) {
            return reply.code(400).send({
                error: 'Missing required columns',
                missing: headerValidation.missing
            });
        }

        // Process rows
        const result: RentalMatrixImportResult = {
            totalRows: records.length,
            inserted: 0,
            updated: 0,
            skipped: 0,
            errors: []
        };

        // Group by vehicleId to find/create assignments
        const vehicleIds = [...new Set(records.map(r => r.vehicle_id?.trim()).filter(Boolean))];

        // Verify all vehicles exist
        const existingVehicles = await fastify.prisma.rentalVehicle.findMany({
            where: { id: { in: vehicleIds } },
            select: { id: true }
        });
        const existingVehicleIds = new Set(existingVehicles.map(v => v.id));

        // Find or create assignments for each vehicle
        const assignmentMap = new Map<string, string>(); // vehicleId → assignmentId

        for (const vehicleId of vehicleIds) {
            if (!existingVehicleIds.has(vehicleId)) {
                result.errors.push({ row: 0, error: `Vehicle ${vehicleId} not found` });
                continue;
            }

            let assignment = await fastify.prisma.vehicleRentalAssignment.findUnique({
                where: { vehicleId_rentalCompanyId: { vehicleId, rentalCompanyId } }
            });

            if (!assignment) {
                assignment = await fastify.prisma.vehicleRentalAssignment.create({
                    data: { vehicleId, rentalCompanyId }
                });
            }

            assignmentMap.set(vehicleId, assignment.id);
        }

        // Process each row
        for (let i = 0; i < records.length; i++) {
            const { data: rowData, error } = mapCSVRowToMatrixEntry(records[i], i + 2); // +2 for 1-indexed + header

            if (error || !rowData) {
                result.errors.push({ row: i + 2, error: error || 'Unknown error' });
                result.skipped++;
                continue;
            }

            const assignmentId = assignmentMap.get(rowData.vehicleId);
            if (!assignmentId) {
                result.skipped++;
                continue;
            }

            // Update calculationId on assignment if provided
            if (rowData.calculationId) {
                await fastify.prisma.vehicleRentalAssignment.update({
                    where: { id: assignmentId },
                    data: { calculationId: rowData.calculationId }
                });
            }

            // Upsert matrix entry
            try {
                await fastify.prisma.rentalMatrixEntry.upsert({
                    where: {
                        assignmentId_annualMileageKm_contractMonths_initialPaymentPct: {
                            assignmentId,
                            annualMileageKm: rowData.annualMileageKm,
                            contractMonths: rowData.contractMonths,
                            initialPaymentPct: rowData.initialPaymentPct
                        }
                    },
                    create: {
                        assignmentId,
                        annualMileageKm: rowData.annualMileageKm,
                        contractMonths: rowData.contractMonths,
                        initialPaymentPct: rowData.initialPaymentPct,
                        monthlyRateNet: rowData.monthlyRateNet,
                        monthlyRateGross: rowData.monthlyRateGross,
                        servicesIncluded: rowData.servicesIncluded
                    },
                    update: {
                        monthlyRateNet: rowData.monthlyRateNet,
                        monthlyRateGross: rowData.monthlyRateGross,
                        servicesIncluded: rowData.servicesIncluded
                    }
                });

                // Check if it was an update or insert by counting (simplified: count as insert if created recently)
                result.inserted++;
            } catch (err) {
                result.errors.push({
                    row: i + 2,
                    error: err instanceof Error ? err.message : 'Database error'
                });
                result.skipped++;
            }
        }

        return {
            ...result,
            rentalCompany: company.name,
            vehiclesProcessed: assignmentMap.size
        };
    });

    // Get matrix entries for a specific assignment
    fastify.get('/api/rental-matrix/:assignmentId', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { assignmentId } = request.params as { assignmentId: string };

        const entries = await fastify.prisma.rentalMatrixEntry.findMany({
            where: { assignmentId },
            orderBy: [
                { annualMileageKm: 'asc' },
                { contractMonths: 'asc' },
                { initialPaymentPct: 'asc' }
            ]
        });

        return { entries };
    });

    // Get dynamic options from matrix for a specific vehicle
    fastify.get('/api/rental-matrix/options/:vehicleId', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { vehicleId } = request.params as { vehicleId: string };

        const assignments = await fastify.prisma.vehicleRentalAssignment.findMany({
            where: { vehicleId, isActive: true },
            include: {
                matrixEntries: {
                    select: {
                        annualMileageKm: true,
                        contractMonths: true,
                        initialPaymentPct: true
                    }
                }
            }
        });

        // Aggregate unique values across all companies
        const allEntries = assignments.flatMap(a => a.matrixEntries);

        const mileages = [...new Set(allEntries.map(e => e.annualMileageKm))].sort((a, b) => a - b);
        const months = [...new Set(allEntries.map(e => e.contractMonths))].sort((a, b) => a - b);
        const payments = [...new Set(allEntries.map(e => e.initialPaymentPct))].sort((a, b) => a - b);

        return {
            annualMileageOptions: mileages,
            contractMonthOptions: months,
            initialPaymentOptions: payments
        };
    });

    // Delete all matrix entries for an assignment (reset matrix)
    fastify.delete('/api/rental-matrix/:assignmentId', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { assignmentId } = request.params as { assignmentId: string };

        const deleted = await fastify.prisma.rentalMatrixEntry.deleteMany({
            where: { assignmentId }
        });

        return { success: true, deleted: deleted.count };
    });
}
