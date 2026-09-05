import { FastifyInstance } from 'fastify';
import { requirePermission } from '../middleware/permissions.js';
import { parseRentalStockCSV } from '../services/rental-stock-parser.js';
import { calculateRentalQuote, RentalQuoteError } from '../services/rental-quote.service.js';

export async function rentalStockRoutes(fastify: FastifyInstance) {
    // ── 1. Import rental stock CSV ────────────────────────────────────
    fastify.post('/api/rental-stock/import', {
        preHandler: [fastify.authenticate, requirePermission('rental:config:write')]
    }, async (request, reply) => {
        const { rentalCompanyId } = request.query as { rentalCompanyId: string };

        if (!rentalCompanyId) {
            return reply.code(400).send({ error: 'Parametr rentalCompanyId jest wymagany' });
        }

        const company = await fastify.prisma.rentalCompany.findUnique({
            where: { id: rentalCompanyId }
        });

        if (!company) {
            return reply.code(404).send({ error: 'Firma wynajmu nie została znaleziona' });
        }

        const data = await request.file();
        if (!data) {
            return reply.code(400).send({ error: 'Brak przesłanego pliku CSV' });
        }

        const buffer = await data.toBuffer();
        const csvContent = buffer.toString('utf-8');

        const parseResult = parseRentalStockCSV(csvContent);
        if (parseResult.rows.length === 0) {
            return reply.code(400).send({
                error: 'Plik CSV nie zawiera żadnych poprawnych wierszy danych stoku',
                errors: parseResult.errors
            });
        }

        // Fetch existing assignments for company to validate specNo matches
        const existingAssignments = await fastify.prisma.vehicleRentalAssignment.findMany({
            where: { rentalCompanyId },
            select: { id: true, externalVehicleId: true }
        });

        const validSpecs = new Set<string>();
        for (const a of existingAssignments) {
            if (a.externalVehicleId) {
                // Support comma-separated car_ids
                const parts = a.externalVehicleId.split(/[,;]/).map(s => s.trim()).filter(Boolean);
                for (const p of parts) validSpecs.add(p);
            }
        }

        // Fetch all currently existing stock units for this rentalCompanyId
        const existingUnits = await fastify.prisma.rentalStockUnit.findMany({
            where: { rentalCompanyId },
            select: { id: true, stockNo: true, isActive: true }
        });
        const existingStockNos = new Set(existingUnits.map(u => u.stockNo));

        const unmatched: Array<{
            row: number;
            stockNo: string;
            specNoRaw: string;
            specNo: string | null;
            reason: string;
        }> = [];

        let inserted = 0;
        let updated = 0;
        const fileStockNos = new Set<string>();

        for (const row of parseResult.rows) {
            fileStockNos.add(row.stockNo);

            const hasMatch = row.specNo !== null && validSpecs.has(row.specNo);
            if (!hasMatch) {
                unmatched.push({
                    row: row.rowIndex,
                    stockNo: row.stockNo,
                    specNoRaw: row.specNoRaw,
                    specNo: row.specNo,
                    reason: `Brak specyfikacji ${row.specNo ?? row.specNoRaw} w cenniku firmy ${company.name}`
                });
            }

            const isExisting = existingStockNos.has(row.stockNo);

            await fastify.prisma.rentalStockUnit.upsert({
                where: {
                    rentalCompanyId_stockNo: {
                        rentalCompanyId,
                        stockNo: row.stockNo
                    }
                },
                create: {
                    rentalCompanyId,
                    stockNo: row.stockNo,
                    specNoRaw: row.specNoRaw,
                    specNo: row.specNo,
                    specNoNote: row.specNoNote,
                    vin: row.vin,
                    registrationNumber: row.registrationNumber,
                    make: row.make,
                    model: row.model,
                    modelDescription: row.modelDescription,
                    bodyType: row.bodyType,
                    color: row.color,
                    fuelType: row.fuelType,
                    dealerName: row.dealerName,
                    docsDeliveryDate: row.docsDeliveryDate,
                    vehicleDeliveryDate: row.vehicleDeliveryDate,
                    isActive: true,
                    sourceFile: data.filename || null
                },
                update: {
                    specNoRaw: row.specNoRaw,
                    specNo: row.specNo,
                    specNoNote: row.specNoNote,
                    vin: row.vin,
                    registrationNumber: row.registrationNumber,
                    make: row.make,
                    model: row.model,
                    modelDescription: row.modelDescription,
                    bodyType: row.bodyType,
                    color: row.color,
                    fuelType: row.fuelType,
                    dealerName: row.dealerName,
                    docsDeliveryDate: row.docsDeliveryDate,
                    vehicleDeliveryDate: row.vehicleDeliveryDate,
                    isActive: true,
                    sourceFile: data.filename || null
                }
            });

            if (isExisting) {
                updated++;
            } else {
                inserted++;
                existingStockNos.add(row.stockNo);
            }
        }

        // Deactivate units belonging strictly to this rentalCompanyId that were missing from the file
        const toDeactivate = existingUnits
            .filter(u => u.isActive && !fileStockNos.has(u.stockNo))
            .map(u => u.id);

        let deactivated = 0;
        if (toDeactivate.length > 0) {
            const deactResult = await fastify.prisma.rentalStockUnit.updateMany({
                where: { id: { in: toDeactivate } },
                data: { isActive: false }
            });
            deactivated = deactResult.count;
        }

        return reply.code(200).send({
            totalRows: parseResult.rows.length,
            inserted,
            updated,
            deactivated,
            unmatched,
            errors: parseResult.errors
        });
    });

    // ── 2. Search rental stock units ──────────────────────────────────
    fastify.get('/api/rental-stock/search', async (request, reply) => {
        const { companyId, q, limit: limitRaw } = request.query as {
            companyId?: string;
            q?: string;
            limit?: string;
        };

        const limit = Math.min(Math.max(parseInt(limitRaw || '20', 10) || 20, 1), 100);

        const where: Record<string, any> = {
            isActive: true
        };

        if (companyId) {
            where.rentalCompanyId = companyId;
        }

        if (q && q.trim()) {
            const term = q.trim();
            where.OR = [
                { stockNo: { contains: term, mode: 'insensitive' } },
                { make: { contains: term, mode: 'insensitive' } },
                { model: { contains: term, mode: 'insensitive' } },
                { modelDescription: { contains: term, mode: 'insensitive' } },
                { vin: { contains: term, mode: 'insensitive' } },
                { specNo: { contains: term, mode: 'insensitive' } }
            ];
        }

        const [total, units] = await Promise.all([
            fastify.prisma.rentalStockUnit.count({ where }),
            fastify.prisma.rentalStockUnit.findMany({
                where,
                orderBy: [
                    { vehicleDeliveryDate: 'asc' },
                    { stockNo: 'asc' }
                ]
            })
        ]);

        // Determine which (companyId, specNo) pairs have active pricing matrix entries
        const uniqueSpecs = Array.from(
            new Set(units.map(u => u.specNo).filter((s): s is string => s !== null))
        );

        const assignmentsWithPricing = await fastify.prisma.vehicleRentalAssignment.findMany({
            where: {
                ...(companyId ? { rentalCompanyId: companyId } : {}),
                externalVehicleId: { in: uniqueSpecs },
                matrixEntries: { some: {} }
            },
            select: { rentalCompanyId: true, externalVehicleId: true }
        });

        const pricingKeySet = new Set<string>();
        for (const a of assignmentsWithPricing) {
            if (a.externalVehicleId) {
                const parts = a.externalVehicleId.split(/[,;]/).map(s => s.trim()).filter(Boolean);
                for (const p of parts) {
                    pricingKeySet.add(`${a.rentalCompanyId}:${p}`);
                }
            }
        }

        const enriched = units.map(u => {
            const hasPricing = u.specNo !== null && pricingKeySet.has(`${u.rentalCompanyId}:${u.specNo}`);
            return {
                id: u.id,
                rentalCompanyId: u.rentalCompanyId,
                stockNo: u.stockNo,
                specNo: u.specNo,
                specNoNote: u.specNoNote,
                vin: u.vin,
                registrationNumber: u.registrationNumber,
                make: u.make,
                model: u.model,
                modelDescription: u.modelDescription,
                bodyType: u.bodyType,
                color: u.color,
                fuelType: u.fuelType,
                dealerName: u.dealerName,
                vehicleDeliveryDate: u.vehicleDeliveryDate ? u.vehicleDeliveryDate.toISOString().split('T')[0] : null,
                docsDeliveryDate: u.docsDeliveryDate ? u.docsDeliveryDate.toISOString().split('T')[0] : null,
                hasPricing
            };
        });

        // Sort: hasPricing desc, then vehicleDeliveryDate asc (nulls last)
        enriched.sort((a, b) => {
            if (a.hasPricing !== b.hasPricing) {
                return a.hasPricing ? -1 : 1;
            }
            if (a.vehicleDeliveryDate && b.vehicleDeliveryDate) {
                return a.vehicleDeliveryDate.localeCompare(b.vehicleDeliveryDate);
            }
            if (a.vehicleDeliveryDate && !b.vehicleDeliveryDate) return -1;
            if (!a.vehicleDeliveryDate && b.vehicleDeliveryDate) return 1;
            return a.stockNo.localeCompare(b.stockNo);
        });

        return reply.code(200).send({
            items: enriched.slice(0, limit),
            total
        });
    });

    // ── 3. Quote rental stock unit ─────────────────────────────────────
    fastify.get('/api/rental-stock/:id/quote', async (request, reply) => {
        const { id } = request.params as { id: string };
        const {
            months: monthsRaw,
            annualKm: annualKmRaw,
            insurance: insuranceRaw,
            tires: tiresRaw,
            variant: variantRaw,
            companyId
        } = request.query as {
            months?: string;
            annualKm?: string;
            insurance?: string;
            tires?: string;
            variant?: string;
            companyId?: string;
        };

        const months = parseInt(monthsRaw || '', 10);
        const annualKm = parseInt(annualKmRaw || '', 10);
        const insurance = (insuranceRaw ? insuranceRaw.trim() : '1000') as '1000' | '500' | '0';
        const tires = tiresRaw === 'true' || tiresRaw === '1';
        const variant = variantRaw ? variantRaw.trim() : 'base';

        try {
            const quote = await calculateRentalQuote(fastify.prisma, {
                unitIdentifier: id,
                months,
                annualKm,
                insurance,
                tires,
                variant,
                companyId
            });

            return reply.code(200).send({
                stockNo: quote.unit.stockNo,
                specNo: quote.unit.specNo,
                vehicle: {
                    make: quote.unit.make,
                    model: quote.unit.model,
                    modelDescription: quote.unit.modelDescription,
                    color: quote.unit.color
                },
                vehicleDeliveryDate: quote.vehicleDeliveryDate,
                variant: quote.variant,
                breakdown: quote.breakdown,
                monthlyRateNet: quote.monthlyRateNet,
                monthlyRateGross: quote.monthlyRateGross,
                overMileageNet: quote.overMileageNet,
                ...(quote.overMileageUnavailable ? { overMileageUnavailable: true } : {})
            });
        } catch (err: any) {
            if (err instanceof RentalQuoteError) {
                return reply.code(err.statusCode).send({
                    error: err.message,
                    ...(err.details || {})
                });
            }
            throw err;
        }
    });
}
