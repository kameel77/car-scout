import { FastifyInstance } from 'fastify';
import { resolveScope } from '../utils/scope-resolver.js';

function generateSlug(make: string, model: string, version: string | null, productionYear: number | null | undefined, bodyType: string | null, fuelType: string | null, id: string): string {
    const translitMap: Record<string, string> = {
        'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n',
        'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
        'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss'
    };

    const transliterate = (str: string) =>
        // eslint-disable-next-line no-control-regex
        str.toLowerCase().replace(/[^\x00-\x7F]/g, char => translitMap[char] || char);

    const parts = [make, model, version, productionYear != null ? String(productionYear) : null, bodyType, fuelType, id]
        .filter(Boolean)
        .map(p => transliterate(p!))
        .map(p => p.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));

    return parts.join('-').replace(/-{2,}/g, '-');
}

export async function rentalVehicleRoutes(fastify: FastifyInstance) {
    // List rental vehicles (admin)
    fastify.get('/api/rental-vehicles', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const {
            page = '1',
            limit = '20',
            dealerId,
            make,
            model,
            isActive,
            search
        } = request.query as Record<string, string | undefined>;

        const pageNum = Math.max(1, parseInt(page || '1'));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit || '20')));
        const skip = (pageNum - 1) * limitNum;

        // Resolve scope for data isolation
        const scope = await resolveScope(fastify, request);

        const where: any = {
            ...scope.dealerFilter  // Apply scope filter
        };

        // Additional filters from query params
        if (dealerId && scope.isPlatform) where.dealerId = dealerId; // only platform can override dealer filter
        if (make) where.make = { contains: make, mode: 'insensitive' };
        if (model) where.model = { contains: model, mode: 'insensitive' };
        if (isActive !== undefined) where.isActive = isActive === 'true';

        if (search) {
            where.OR = [
                { make: { contains: search, mode: 'insensitive' } },
                { model: { contains: search, mode: 'insensitive' } },
                { version: { contains: search, mode: 'insensitive' } },
                { rentalAssignments: { some: { rentalCompany: { name: { contains: search, mode: 'insensitive' } } } } },
                { ownerRentalCompany: { name: { contains: search, mode: 'insensitive' } } }
            ];
        }

        const [vehicles, total] = await Promise.all([
            fastify.prisma.rentalVehicle.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { createdAt: 'desc' },
                include: {
                    dealer: {
                        select: { id: true, name: true, addressLine1: true, city: true }
                    },
                    ownerRentalCompany: {
                        select: { id: true, name: true }
                    },
                    rentalAssignments: {
                        include: {
                            rentalCompany: {
                                select: { id: true, name: true, slug: true }
                            },
                            _count: { select: { matrixEntries: true } }
                        }
                    }
                }
            }),
            fastify.prisma.rentalVehicle.count({ where })
        ]);

        return {
            vehicles,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            }
        };
    });

    // Get single rental vehicle (admin)
    fastify.get('/api/rental-vehicles/:id', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };

        const vehicle = await fastify.prisma.rentalVehicle.findUnique({
            where: { id },
            include: {
                dealer: true,
                ownerRentalCompany: true,
                rentalAssignments: {
                    include: {
                        rentalCompany: true,
                        matrixEntries: {
                            orderBy: [
                                { annualMileageKm: 'asc' },
                                { contractMonths: 'asc' },
                                { initialPaymentPct: 'asc' }
                            ]
                        }
                    }
                }
            }
        });

        if (!vehicle) {
            return reply.code(404).send({ error: 'Rental vehicle not found' });
        }

        return { vehicle };
    });

    // Create rental vehicle
    fastify.post('/api/rental-vehicles', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const body = request.body as any;

        // Validate required fields
        if (!body.make || !body.model) {
            return reply.code(400).send({
                error: 'Missing required fields: make, model'
            });
        }

        // Resolve scope for dealer assignment
        const scope = await resolveScope(fastify, request);

        // Determine dealerId: from body, or from context
        let dealerId = body.dealerId;
        if (!dealerId && scope.activeContext.scopeType === 'DEALER') {
            dealerId = scope.activeContext.scopeId;
        }
        
        const ownerRentalCompanyId = body.ownerRentalCompanyId;
        
        if (!dealerId && !ownerRentalCompanyId) {
            return reply.code(400).send({ error: 'dealerId or ownerRentalCompanyId is required' });
        }

        // Verify dealer/company exists
        if (dealerId) {
            const dealer = await fastify.prisma.dealer.findUnique({
                where: { id: dealerId }
            });
            if (!dealer) {
                return reply.code(400).send({ error: 'Dealer not found' });
            }
        }

        if (ownerRentalCompanyId) {
            const company = await fastify.prisma.rentalCompany.findUnique({
                where: { id: ownerRentalCompanyId }
            });
            if (!company) {
                return reply.code(400).send({ error: 'Rental company not found' });
            }
        }

        // Non-platform users can only create for their own dealers
        if (!scope.isPlatform && dealerId) {
            const allowed = scope.dealerFilter.dealerId;
            if (typeof allowed === 'string' && dealerId !== allowed) return reply.code(403).send({ error: 'Forbidden' });
            if (typeof allowed === 'object' && 'in' in allowed && !allowed.in.includes(dealerId)) return reply.code(403).send({ error: 'Forbidden' });
        }

        const vehicle = await fastify.prisma.rentalVehicle.create({
            data: {
                dealerId: dealerId || null,
                ownerRentalCompanyId: ownerRentalCompanyId || null,
                make: body.make,
                model: body.model,
                version: body.version || null,
                bodyType: body.bodyType || null,
                fuelType: body.fuelType || null,
                transmission: body.transmission || null,
                enginePowerHp: body.enginePowerHp ? parseInt(body.enginePowerHp) : null,
                engineCapacityCm3: body.engineCapacityCm3 ? parseInt(body.engineCapacityCm3) : null,
                productionYear: body.productionYear ? parseInt(body.productionYear) : null,
                color: body.color || null,
                paintType: body.paintType || null,
                doors: body.doors ? parseInt(body.doors) : null,
                seats: body.seats ? parseInt(body.seats) : null,
                drive: body.drive || null,
                catalogPrice: body.catalogPrice ? parseInt(body.catalogPrice) : null,
                sellingPrice: body.sellingPrice ? parseInt(body.sellingPrice) : null,
                primaryImageUrl: body.primaryImageUrl || null,
                imageUrls: body.imageUrls || [],
                equipmentAudioMultimedia: body.equipmentAudioMultimedia || [],
                equipmentSafety: body.equipmentSafety || [],
                equipmentComfortExtras: body.equipmentComfortExtras || [],
                equipmentOther: body.equipmentOther || [],
                additionalInfoHeader: body.additionalInfoHeader || null,
                additionalInfoContent: body.additionalInfoContent || null,
                specsJson: body.specsJson || null,
                specificationUrl: body.specificationUrl || null,
                condition: body.condition || 'NEW',
                vin: body.vin || null,
                mileageKm: body.mileageKm != null ? parseInt(body.mileageKm) : null,
                firstRegistrationDate: body.firstRegistrationDate || null,
                registrationNumber: body.registrationNumber || null
            }
        });

        // Generate and set slug
        const slug = generateSlug(
            vehicle.make,
            vehicle.model,
            vehicle.version,
            vehicle.productionYear,
            vehicle.bodyType,
            vehicle.fuelType,
            vehicle.id
        );

        const updatedVehicle = await fastify.prisma.rentalVehicle.update({
            where: { id: vehicle.id },
            data: { slug }
        });

        return reply.code(201).send({ vehicle: updatedVehicle });
    });

    // Update rental vehicle
    fastify.patch('/api/rental-vehicles/:id', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = request.body as any;

        const existing = await fastify.prisma.rentalVehicle.findUnique({ where: { id } });
        if (!existing) {
            return reply.code(404).send({ error: 'Rental vehicle not found' });
        }

        // Scope isolation: verify caller can modify this vehicle
        const scope = await resolveScope(fastify, request);
        if (!scope.isPlatform && existing.dealerId) {
            const allowed = scope.dealerFilter.dealerId;
            if (typeof allowed === 'string' && existing.dealerId !== allowed) return reply.code(403).send({ error: 'Forbidden' });
            if (typeof allowed === 'object' && 'in' in allowed && !allowed.in.includes(existing.dealerId)) return reply.code(403).send({ error: 'Forbidden' });
        }

        // Build update data — only include provided fields
        const updateData: any = {};
        const stringFields = ['make', 'model', 'version', 'bodyType', 'fuelType', 'transmission',
            'color', 'paintType', 'drive', 'primaryImageUrl', 'additionalInfoHeader', 'additionalInfoContent', 'specificationUrl',
            'condition', 'vin', 'firstRegistrationDate', 'registrationNumber'];
        const intFields = ['enginePowerHp', 'engineCapacityCm3', 'productionYear', 'catalogPrice',
            'sellingPrice', 'doors', 'seats', 'mileageKm'];
        const arrayFields = ['imageUrls', 'equipmentAudioMultimedia', 'equipmentSafety',
            'equipmentComfortExtras', 'equipmentOther'];

        for (const field of stringFields) {
            if (body[field] !== undefined) updateData[field] = body[field];
        }
        for (const field of intFields) {
            if (body[field] !== undefined) updateData[field] = body[field] !== null ? parseInt(body[field]) : null;
        }
        for (const field of arrayFields) {
            if (body[field] !== undefined) updateData[field] = body[field];
        }
        if (body.specsJson !== undefined) updateData.specsJson = body.specsJson;
        if (body.isActive !== undefined) updateData.isActive = body.isActive;
        if (body.isPublished !== undefined) updateData.isPublished = body.isPublished;
        if (body.dealerId !== undefined) updateData.dealerId = body.dealerId;
        if (body.ownerRentalCompanyId !== undefined) updateData.ownerRentalCompanyId = body.ownerRentalCompanyId;

        // Regenerate slug if make/model/version changed
        const needSlugUpdate = body.make || body.model || body.version || body.productionYear || body.bodyType || body.fuelType;
        if (needSlugUpdate) {
            const merged = { ...existing, ...updateData };
            updateData.slug = generateSlug(
                merged.make, merged.model, merged.version,
                merged.productionYear, merged.bodyType, merged.fuelType, id
            );
        }

        const vehicle = await fastify.prisma.rentalVehicle.update({
            where: { id },
            data: updateData
        });

        return { vehicle };
    });

    // Archive (soft delete) rental vehicle
    fastify.post('/api/rental-vehicles/:id/archive', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };

        const vehicle = await fastify.prisma.rentalVehicle.findUnique({ where: { id } });
        if (!vehicle) {
            return reply.code(404).send({ error: 'Rental vehicle not found' });
        }

        // Scope isolation
        const scope = await resolveScope(fastify, request);
        if (!scope.isPlatform && vehicle.dealerId) {
            const allowed = scope.dealerFilter.dealerId;
            if (typeof allowed === 'string' && vehicle.dealerId !== allowed) return reply.code(403).send({ error: 'Forbidden' });
            if (typeof allowed === 'object' && 'in' in allowed && !allowed.in.includes(vehicle.dealerId)) return reply.code(403).send({ error: 'Forbidden' });
        }

        await fastify.prisma.rentalVehicle.update({
            where: { id },
            data: { isActive: false }
        });

        return { success: true };
    });

    // Restore rental vehicle
    fastify.post('/api/rental-vehicles/:id/restore', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };

        const vehicle = await fastify.prisma.rentalVehicle.findUnique({ where: { id } });
        if (!vehicle) {
            return reply.code(404).send({ error: 'Rental vehicle not found' });
        }

        // Scope isolation
        const scope = await resolveScope(fastify, request);
        if (!scope.isPlatform && vehicle.dealerId) {
            const allowed = scope.dealerFilter.dealerId;
            if (typeof allowed === 'string' && vehicle.dealerId !== allowed) return reply.code(403).send({ error: 'Forbidden' });
            if (typeof allowed === 'object' && 'in' in allowed && !allowed.in.includes(vehicle.dealerId)) return reply.code(403).send({ error: 'Forbidden' });
        }

        await fastify.prisma.rentalVehicle.update({
            where: { id },
            data: { isActive: true }
        });

        return { success: true };
    });

    // Delete rental vehicle permanently
    fastify.delete('/api/rental-vehicles/:id', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };

        const vehicle = await fastify.prisma.rentalVehicle.findUnique({ where: { id } });
        if (!vehicle) {
            return reply.code(404).send({ error: 'Rental vehicle not found' });
        }

        // Scope isolation
        const scope = await resolveScope(fastify, request);
        if (!scope.isPlatform && vehicle.dealerId) {
            const allowed = scope.dealerFilter.dealerId;
            if (typeof allowed === 'string' && vehicle.dealerId !== allowed) return reply.code(403).send({ error: 'Forbidden' });
            if (typeof allowed === 'object' && 'in' in allowed && !allowed.in.includes(vehicle.dealerId)) return reply.code(403).send({ error: 'Forbidden' });
        }

        await fastify.prisma.rentalVehicle.delete({ where: { id } });

        return { success: true };
    });

    // Assign rental company to vehicle
    fastify.post('/api/rental-vehicles/:id/assignments', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { rentalCompanyId, externalVehicleId, calculationId } = request.body as {
            rentalCompanyId: string;
            externalVehicleId?: string;
            calculationId?: string;
        };

        if (!rentalCompanyId) {
            return reply.code(400).send({ error: 'rentalCompanyId is required' });
        }

        // Verify both exist
        const [vehicle, company] = await Promise.all([
            fastify.prisma.rentalVehicle.findUnique({ where: { id } }),
            fastify.prisma.rentalCompany.findUnique({ where: { id: rentalCompanyId } })
        ]);

        if (!vehicle) return reply.code(404).send({ error: 'Rental vehicle not found' });
        if (!company) return reply.code(404).send({ error: 'Rental company not found' });

        // Scope isolation: verify caller can modify this vehicle
        const scope = await resolveScope(fastify, request);
        if (!scope.isPlatform && vehicle.dealerId) {
            const allowed = scope.dealerFilter.dealerId;
            if (typeof allowed === 'string' && vehicle.dealerId !== allowed) return reply.code(403).send({ error: 'Forbidden' });
            if (typeof allowed === 'object' && 'in' in allowed && !allowed.in.includes(vehicle.dealerId)) return reply.code(403).send({ error: 'Forbidden' });
        }

        // Check if assignment already exists
        const existing = await fastify.prisma.vehicleRentalAssignment.findUnique({
            where: { vehicleId_rentalCompanyId: { vehicleId: id, rentalCompanyId } }
        });

        if (existing) {
            return reply.code(409).send({ error: 'Assignment already exists' });
        }

        const assignment = await fastify.prisma.vehicleRentalAssignment.create({
            data: {
                vehicleId: id,
                rentalCompanyId,
                externalVehicleId: externalVehicleId || null,
                calculationId: calculationId || null
            },
            include: {
                rentalCompany: { select: { id: true, name: true } }
            }
        });

        return reply.code(201).send({ assignment });
    });

    // Update assignment
    fastify.patch('/api/rental-vehicles/:id/assignments/:assignmentId', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { assignmentId } = request.params as { id: string; assignmentId: string };
        const body = request.body as {
            externalVehicleId?: string;
            calculationId?: string;
            isActive?: boolean;
        };

        const assignment = await fastify.prisma.vehicleRentalAssignment.findUnique({
            where: { id: assignmentId }
        });

        if (!assignment) {
            return reply.code(404).send({ error: 'Assignment not found' });
        }

        const updated = await fastify.prisma.vehicleRentalAssignment.update({
            where: { id: assignmentId },
            data: {
                ...(body.externalVehicleId !== undefined && { externalVehicleId: body.externalVehicleId }),
                ...(body.calculationId !== undefined && { calculationId: body.calculationId }),
                ...(body.isActive !== undefined && { isActive: body.isActive })
            },
            include: {
                rentalCompany: { select: { id: true, name: true } }
            }
        });

        return { assignment: updated };
    });

    // Delete assignment
    fastify.delete('/api/rental-vehicles/:id/assignments/:assignmentId', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { assignmentId } = request.params as { id: string; assignmentId: string };

        const assignment = await fastify.prisma.vehicleRentalAssignment.findUnique({
            where: { id: assignmentId }
        });

        if (!assignment) {
            return reply.code(404).send({ error: 'Assignment not found' });
        }

        await fastify.prisma.vehicleRentalAssignment.delete({
            where: { id: assignmentId }
        });

        return { success: true };
    });
    // Import JSON of vehicles
    fastify.post('/api/rental-vehicles/import-json', {
        preHandler: async (request: any, reply: any) => {
            const authHeader = request.headers.authorization;
            const staticKey = process.env.IMPORT_API_KEY;
            
            // Allow if valid static key is provided
            if (staticKey && authHeader === `Bearer ${staticKey}`) {
                return;
            }
            
            // Otherwise fallback to standard JWT auth
            try {
                await request.jwtVerify();
            } catch (err) {
                reply.code(401).send({ error: 'Unauthorized' });
            }
        }
    }, async (request, reply) => {
        const body = request.body as any;
        
        if (!body.vehicles || !Array.isArray(body.vehicles)) {
            return reply.code(400).send({ error: 'Missing or invalid "vehicles" array in payload' });
        }

        const isStaticKey = process.env.IMPORT_API_KEY && request.headers.authorization === `Bearer ${process.env.IMPORT_API_KEY}`;

        // Resolve scope for dealer assignment (if needed)
        let scope;
        if (!isStaticKey) {
            scope = await resolveScope(fastify, request);
        } else {
            // Static key gets platform-level privileges
            scope = {
                activeContext: { scopeType: 'PLATFORM', scopeId: 'PLATFORM' },
                isPlatform: true,
                dealerFilter: {}
            };
        }

        // Can optionally provide dealerId or ownerRentalCompanyId to assign to all imported vehicles
        let dealerId = body.dealerId;
        if (!dealerId && scope.activeContext.scopeType === 'DEALER') {
            dealerId = scope.activeContext.scopeId;
        }
        const ownerRentalCompanyId = body.ownerRentalCompanyId;

        // Verify dealer/company exists if provided
        if (dealerId) {
            const dealer = await fastify.prisma.dealer.findUnique({ where: { id: dealerId } });
            if (!dealer) return reply.code(400).send({ error: 'Dealer not found' });
        }

        if (ownerRentalCompanyId) {
            const company = await fastify.prisma.rentalCompany.findUnique({ where: { id: ownerRentalCompanyId } });
            if (!company) return reply.code(400).send({ error: 'Rental company not found' });
        }

        // Non-platform users can only import for their own dealers
        if (!scope.isPlatform && dealerId) {
            const allowed = scope.dealerFilter.dealerId;
            if (typeof allowed === 'string' && dealerId !== allowed) return reply.code(403).send({ error: 'Forbidden' });
            if (typeof allowed === 'object' && 'in' in allowed && !allowed.in.includes(dealerId)) return reply.code(403).send({ error: 'Forbidden' });
        }

        const stats = {
            total: body.vehicles.length,
            imported: 0,
            failed: 0,
            errors: [] as string[]
        };

        for (const [index, item] of body.vehicles.entries()) {
            try {
                if (!item.make || !item.model) {
                    throw new Error(`Row ${index + 1}: Missing required fields make/model`);
                }

                // Prepare parsed data
                const vehicleData = {
                    dealerId: dealerId || null,
                    ownerRentalCompanyId: ownerRentalCompanyId || null,
                    make: item.make,
                    model: item.model,
                    version: item.version || null,
                    bodyType: item.bodyType || null,
                    fuelType: item.fuelType || null,
                    transmission: item.transmission || null,
                    enginePowerHp: item.enginePowerHp ? parseInt(item.enginePowerHp) : null,
                    engineCapacityCm3: item.engineCapacityCm3 ? parseInt(item.engineCapacityCm3) : null,
                    productionYear: item.productionYear ? parseInt(item.productionYear) : null,
                    color: item.color || null,
                    paintType: item.paintType || null,
                    doors: item.doors ? parseInt(item.doors) : null,
                    seats: item.seats ? parseInt(item.seats) : null,
                    drive: item.drive || null,
                    catalogPrice: item.catalogPrice ? parseInt(item.catalogPrice) : null,
                    sellingPrice: item.sellingPrice ? parseInt(item.sellingPrice) : null,
                    primaryImageUrl: item.primaryImageUrl || null,
                    imageUrls: item.imageUrls || [],
                    equipmentAudioMultimedia: item.equipmentAudioMultimedia || [],
                    equipmentSafety: item.equipmentSafety || [],
                    equipmentComfortExtras: item.equipmentComfortExtras || [],
                    equipmentOther: item.equipmentOther || [],
                    additionalInfoHeader: item.additionalInfoHeader || null,
                    additionalInfoContent: item.additionalInfoContent || null,
                    specsJson: item.specsJson || null,
                    specificationUrl: item.specificationUrl || null,
                    isActive: true
                };

                const createdVehicle = await fastify.prisma.rentalVehicle.create({
                    data: vehicleData
                });

                // Generate slug
                const slug = generateSlug(
                    createdVehicle.make,
                    createdVehicle.model,
                    createdVehicle.version,
                    createdVehicle.productionYear,
                    createdVehicle.bodyType,
                    createdVehicle.fuelType,
                    createdVehicle.id
                );

                await fastify.prisma.rentalVehicle.update({
                    where: { id: createdVehicle.id },
                    data: { slug }
                });

                stats.imported++;
            } catch (err: any) {
                stats.failed++;
                stats.errors.push(`Row ${index + 1} (${item.make} ${item.model}): ${err.message}`);
            }
        }

        return reply.code(201).send({
            message: `Import completed. ${stats.imported} imported, ${stats.failed} failed.`,
            stats
        });
    });

    // Duplicate model (technical specs only)
    fastify.post('/api/rental-vehicles/:id/duplicate-model', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const vehicle = await fastify.prisma.rentalVehicle.findUnique({ where: { id } });
        
        if (!vehicle) {
            return reply.code(404).send({ error: 'Rental vehicle not found' });
        }

        // Scope isolation
        const scope = await resolveScope(fastify, request);
        if (!scope.isPlatform && vehicle.dealerId) {
            const allowed = scope.dealerFilter.dealerId;
            if (typeof allowed === 'string' && vehicle.dealerId !== allowed) return reply.code(403).send({ error: 'Forbidden' });
            if (typeof allowed === 'object' && 'in' in allowed && !allowed.in.includes(vehicle.dealerId)) return reply.code(403).send({ error: 'Forbidden' });
        }

        const newVehicle = await fastify.prisma.rentalVehicle.create({
            data: {
                dealerId: vehicle.dealerId,
                ownerRentalCompanyId: vehicle.ownerRentalCompanyId,
                make: vehicle.make,
                model: vehicle.model,
                version: vehicle.version,
                bodyType: vehicle.bodyType,
                fuelType: vehicle.fuelType,
                transmission: vehicle.transmission,
                enginePowerHp: vehicle.enginePowerHp,
                engineCapacityCm3: vehicle.engineCapacityCm3,
                productionYear: vehicle.productionYear,
                doors: vehicle.doors,
                seats: vehicle.seats,
                drive: vehicle.drive,
                // Do not copy colors, prices, equipment, images, specsJson
                color: null,
                paintType: null,
                catalogPrice: null,
                sellingPrice: null,
                primaryImageUrl: null,
                imageUrls: [],
                equipmentAudioMultimedia: [],
                equipmentSafety: [],
                equipmentComfortExtras: [],
                equipmentOther: [],
                additionalInfoHeader: null,
                additionalInfoContent: null,
                specsJson: null as any,
                specificationUrl: null,
                carClass: vehicle.carClass,
                modelCode: vehicle.modelCode
            }
        });

        const slug = generateSlug(
            newVehicle.make, newVehicle.model, newVehicle.version,
            newVehicle.productionYear, newVehicle.bodyType, newVehicle.fuelType, newVehicle.id
        );

        const updated = await fastify.prisma.rentalVehicle.update({
            where: { id: newVehicle.id },
            data: { slug }
        });

        return reply.code(201).send({ vehicle: updated });
    });

    // Duplicate offer (full copy without assignments)
    fastify.post('/api/rental-vehicles/:id/duplicate-offer', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const vehicle = await fastify.prisma.rentalVehicle.findUnique({ where: { id } });
        
        if (!vehicle) {
            return reply.code(404).send({ error: 'Rental vehicle not found' });
        }

        // Copy everything except id, slug, isFeatured, isActive, assignments
        const { id: _id, slug: _slug, isFeatured: _isFeatured, isActive: _isActive, ...dataToCopy } = vehicle;

        const newVehicle = await fastify.prisma.rentalVehicle.create({
            data: dataToCopy as any
        });

        const slug = generateSlug(
            newVehicle.make, newVehicle.model, newVehicle.version,
            newVehicle.productionYear, newVehicle.bodyType, newVehicle.fuelType, newVehicle.id
        );

        const updated = await fastify.prisma.rentalVehicle.update({
            where: { id: newVehicle.id },
            data: { slug }
        });

        return reply.code(201).send({ vehicle: updated });
    });
}
