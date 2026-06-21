import { FastifyInstance } from 'fastify';
import { parse } from 'csv-parse/sync';
import {
    detectCSVFormat,
    mapCSVRowToMatrixEntry,
    mapProviderCSVRow,
    type RentalMatrixCSVRow,
    type ProviderCSVRow,
    type RentalMatrixImportResult,
    type MappedMatrixEntry
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
        // Strip UTF-8 BOM and normalize line endings (\r\r\n → \n, \r\n → \n)
        let csvContent = buffer.toString('utf-8');
        if (csvContent.charCodeAt(0) === 0xFEFF) csvContent = csvContent.slice(1);
        csvContent = csvContent.replace(/\r\r\n/g, '\n').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        // Auto-detect delimiter from the header line (pick the one with most occurrences)
        const headerLine = csvContent.split('\n')[0] || '';
        const commaCount = (headerLine.match(/,/g) || []).length;
        const semiCount = (headerLine.match(/;/g) || []).length;
        const tabCount = (headerLine.match(/\t/g) || []).length;
        const detectedDelimiter = tabCount >= commaCount && tabCount >= semiCount ? '\t'
            : semiCount > commaCount ? ';' : ',';

        fastify.log.info(`CSV delimiter detected: "${detectedDelimiter === '\t' ? 'TAB' : detectedDelimiter}" (comma=${commaCount}, semi=${semiCount}, tab=${tabCount})`);

        // Parse CSV
        let records: Record<string, string>[];
        try {
            records = parse(csvContent, {
                columns: true,
                skip_empty_lines: true,
                delimiter: detectedDelimiter,
                relax_column_count: true,
                trim: true,
                bom: true
            }) as Record<string, string>[];
        } catch (err) {
            return reply.code(400).send({
                error: 'CSV parsing failed',
                message: err instanceof Error ? err.message : 'Unknown error'
            });
        }

        if (records.length === 0) {
            return reply.code(400).send({ error: 'CSV file is empty' });
        }

        // Detect format
        const headers = Object.keys(records[0]);
        const formatDetection = detectCSVFormat(headers);

        if (!formatDetection.format) {
            return reply.code(400).send({
                error: 'Unrecognized CSV format. Missing columns.',
                missing: formatDetection.missing,
                hint: 'Supported formats: Internal (vehicle_id, annual_mileage_km, …) or Provider (car_id, term_months, monthly_cost_net, …)'
            });
        }

        fastify.log.info(`CSV format detected: ${formatDetection.format} (${records.length} rows)`);
        fastify.log.info(`CSV headers: ${JSON.stringify(headers)}`);
        if (records.length > 0) {
            fastify.log.info(`CSV first row: ${JSON.stringify(records[0])}`);
        }

        // Process rows based on format
        const result: RentalMatrixImportResult = {
            totalRows: records.length,
            inserted: 0,
            updated: 0,
            skipped: 0,
            errors: []
        };

        // Collect all mapped entries (flattened: one CSV row → possibly multiple entries for multi car_id)
        const allMappedEntries: MappedMatrixEntry[] = [];

        if (formatDetection.format === 'internal') {
            for (let i = 0; i < records.length; i++) {
                const { data: rowData, error } = mapCSVRowToMatrixEntry(records[i] as unknown as RentalMatrixCSVRow, i + 2);
                if (error || !rowData) {
                    result.errors.push({ row: i + 2, error: error || 'Unknown error' });
                    result.skipped++;
                    continue;
                }
                allMappedEntries.push(rowData);
            }
        } else {
            // Provider format
            for (let i = 0; i < records.length; i++) {
                const { entries, error } = mapProviderCSVRow(records[i] as unknown as ProviderCSVRow, i + 2);
                if (error || entries.length === 0) {
                    result.errors.push({ row: i + 2, error: error || 'No entries' });
                    result.skipped++;
                    continue;
                }
                allMappedEntries.push(...entries);
            }
        }

        // Collect unique vehicle IDs from all entries
        const vehicleIds = [...new Set(allMappedEntries.map(e => e.vehicleId))];

        // Get all existing assignments for this company
        const existingAssignments = await fastify.prisma.vehicleRentalAssignment.findMany({
            where: { rentalCompanyId },
            select: { id: true, vehicleId: true, externalVehicleId: true }
        });

        // Build lookup: csvVehicleId → assignmentId(s)
        // Multiple vehicles can share the same externalVehicleId (e.g. same model in different colors)
        const assignmentMap = new Map<string, string[]>();

        for (const csvVehicleId of vehicleIds) {
            // Try matching by externalVehicleId first — collect ALL matches
            const byExternal = existingAssignments.filter(a => a.externalVehicleId === csvVehicleId);
            if (byExternal.length > 0) {
                assignmentMap.set(csvVehicleId, byExternal.map(a => a.id));
                continue;
            }

            // Fallback: try matching by internal vehicle ID (CUID)
            const byInternal = existingAssignments.find(a => a.vehicleId === csvVehicleId);
            if (byInternal) {
                assignmentMap.set(csvVehicleId, [byInternal.id]);
                continue;
            }

            // Last attempt: check if vehicle exists by internal ID and create assignment
            const vehicleExists = await fastify.prisma.rentalVehicle.findUnique({
                where: { id: csvVehicleId },
                select: { id: true }
            });

            if (vehicleExists) {
                const newAssignment = await fastify.prisma.vehicleRentalAssignment.create({
                    data: { vehicleId: csvVehicleId, rentalCompanyId }
                });
                assignmentMap.set(csvVehicleId, [newAssignment.id]);
                continue;
            }

            result.errors.push({
                row: 0,
                error: `Vehicle "${csvVehicleId}" not found. Set this value as External Vehicle ID in the vehicle assignment (Pojazdy najmu → Edytuj → Firmy najmowe).`
            });
        }

        // Delete existing matrix entries for resolved assignments (full replace strategy)
        if (assignmentMap.size > 0) {
            const assignmentIds = [...new Set([...assignmentMap.values()].flat())];
            await fastify.prisma.rentalMatrixEntry.deleteMany({
                where: { assignmentId: { in: assignmentIds } }
            });
        }

        // Batch insert matrix entries
        const batchData: Array<{
            assignmentId: string;
            annualMileageKm: number;
            contractMonths: number;
            initialPaymentPct: number;
            initialPaymentAmountNet: number;
            initialPaymentAmountGross: number;
            offerType: string;
            monthlyRateNet: number;
            monthlyRateGross: number;
            servicesIncluded: string[];
            overMileageCost: number | null;
            insuranceExcess500: number | null;
            insuranceNoLimit: number | null;
            tiresNoLimit: number | null;
            insuranceNet: number | null;
        }> = [];

        // Track vehicle metadata updates (provider format only)
        const vehicleMetaUpdates = new Map<string, {
            carClass?: string | null;
            modelCode?: string | null;
            catalogPrice?: number | null;
            sellingPrice?: number | null;
        }>();

        for (const entry of allMappedEntries) {
            const assignmentIds = assignmentMap.get(entry.vehicleId);
            if (!assignmentIds || assignmentIds.length === 0) {
                result.skipped++;
                continue;
            }

            // Insert matrix entry for EACH resolved assignment (supports multi-vehicle per car_id)
            for (const assignmentId of assignmentIds) {
                // Update calculationId on assignment if provided
                if (entry.calculationId) {
                    await fastify.prisma.vehicleRentalAssignment.update({
                        where: { id: assignmentId },
                        data: { calculationId: entry.calculationId }
                    });
                }

                batchData.push({
                    assignmentId,
                    annualMileageKm: entry.annualMileageKm,
                    contractMonths: entry.contractMonths,
                    initialPaymentPct: entry.initialPaymentPct,
                    initialPaymentAmountNet: entry.initialPaymentAmountNet,
                    initialPaymentAmountGross: entry.initialPaymentAmountGross,
                    offerType: entry.offerType,
                    monthlyRateNet: entry.monthlyRateNet,
                    monthlyRateGross: entry.monthlyRateGross,
                    servicesIncluded: entry.servicesIncluded,
                    overMileageCost: entry.overMileageCost,
                    insuranceExcess500: entry.insuranceExcess500,
                    insuranceNoLimit: entry.insuranceNoLimit,
                    tiresNoLimit: entry.tiresNoLimit,
                    insuranceNet: entry.insuranceNet
                });

                // Collect vehicle metadata updates
                if (entry.vehicleMeta) {
                    const assignment = existingAssignments.find(a => a.id === assignmentId);
                    if (assignment) {
                        const existing = vehicleMetaUpdates.get(assignment.vehicleId) || {};
                        if (entry.vehicleMeta.carClass) existing.carClass = entry.vehicleMeta.carClass;
                        if (entry.vehicleMeta.modelCode) existing.modelCode = entry.vehicleMeta.modelCode;
                        if (entry.vehicleMeta.catalogPriceGross) existing.catalogPrice = entry.vehicleMeta.catalogPriceGross;
                        if (entry.vehicleMeta.investmentNet) existing.sellingPrice = entry.vehicleMeta.investmentNet;
                        vehicleMetaUpdates.set(assignment.vehicleId, existing);
                    }
                }
            }
        }

        // Batch create with chunks (Prisma createMany limit workaround)
        const CHUNK_SIZE = 500;
        for (let i = 0; i < batchData.length; i += CHUNK_SIZE) {
            const chunk = batchData.slice(i, i + CHUNK_SIZE);
            try {
                const created = await fastify.prisma.rentalMatrixEntry.createMany({
                    data: chunk,
                    skipDuplicates: true
                });
                result.inserted += created.count;
            } catch (err) {
                fastify.log.error(err, `Error inserting chunk ${i}-${i + chunk.length}`);
                result.errors.push({
                    row: 0,
                    error: `Batch insert error (rows ${i + 1}-${i + chunk.length}): ${err instanceof Error ? err.message : 'Database error'}`
                });
                result.skipped += chunk.length;
            }
        }

        // Apply vehicle metadata updates (provider format)
        for (const [vehicleId, meta] of vehicleMetaUpdates) {
            const updateData: Record<string, any> = {};
            if (meta.carClass) updateData.carClass = meta.carClass;
            if (meta.modelCode) updateData.modelCode = meta.modelCode;
            if (meta.catalogPrice) updateData.catalogPrice = meta.catalogPrice;
            if (meta.sellingPrice) updateData.sellingPrice = meta.sellingPrice;

            if (Object.keys(updateData).length > 0) {
                try {
                    await fastify.prisma.rentalVehicle.update({
                        where: { id: vehicleId },
                        data: updateData
                    });
                } catch (err) {
                    // Non-fatal — just log
                    fastify.log.warn(err, `Failed to update vehicle metadata for ${vehicleId}`);
                }
            }
        }

        return {
            ...result,
            format: formatDetection.format,
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
