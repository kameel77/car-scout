import { FastifyInstance } from 'fastify';
import { partnerAuth, PartnerRequest } from '../../middleware/partnerAuth.js';
import { generateListingSlug } from '../../utils/url-utils.js';
import { Type } from '@sinclair/typebox';
import crypto from 'crypto';

export async function externalListingsRoutes(fastify: FastifyInstance) {
    fastify.addHook('preHandler', partnerAuth);

    fastify.get('/api/v1/external/dealers', async (request, reply) => {
        const partnerReq = request as PartnerRequest;
        const partner = partnerReq.partner;
        
        const dealerIds = partner.mappings.map(m => m.dealerId);
        const dealers = await fastify.prisma.dealer.findMany({
            where: { id: { in: dealerIds } },
            select: { id: true, name: true, city: true, addressLine1: true },
            orderBy: { name: 'asc' }
        });
        
        return { dealers };
    });

    const ListingSchema = Type.Object({
        externalDealerId: Type.Optional(Type.String()),
        dealerId: Type.Optional(Type.String()),
        vin: Type.Optional(Type.String()),
        make: Type.String(),
        model: Type.String(),
        version: Type.Optional(Type.String()),
        productionYear: Type.Any(),
        mileageKm: Type.Any(),
        pricePln: Type.Any(),
        fuelType: Type.Optional(Type.String()),
        transmission: Type.Optional(Type.String()),
        enginePowerHp: Type.Optional(Type.Any()),
        engineCapacityCm3: Type.Optional(Type.Any()),
        drive: Type.Optional(Type.String({ description: 'e.g. 4x4, FWD, RWD' })),
        bodyType: Type.Optional(Type.String()),
        doors: Type.Optional(Type.Any()),
        seats: Type.Optional(Type.Any()),
        color: Type.Optional(Type.String()),
        paintType: Type.Optional(Type.String({ description: 'e.g. Metalik, Perłowy' })),
        equipmentAudioMultimedia: Type.Optional(Type.Array(Type.String())),
        equipmentSafety: Type.Optional(Type.Array(Type.String())),
        equipmentComfortExtras: Type.Optional(Type.Array(Type.String())),
        equipmentOther: Type.Optional(Type.Array(Type.String())),
        condition: Type.Optional(Type.String({ description: 'e.g. USED, NEW' })),
        images: Type.Optional(Type.Array(Type.String({ description: 'Array of image URLs' }))),
        imageUrls: Type.Optional(Type.Array(Type.String()))
    });

    fastify.post('/api/v1/external/listings', {
        schema: {
            description: 'Create or update a listing',
            tags: ['Listings'],
            security: [{ bearerAuth: [] }],
            body: ListingSchema
        }
    }, async (request, reply) => {
        try {
            const partnerReq = request as PartnerRequest;
            const partner = partnerReq.partner;
            const body = request.body as any;

            const targetDealerId = body.dealerId || body.externalDealerId;
            const mappings = partner.mappings || [];
            
            let mapping = mappings.find(m => m.externalId === targetDealerId || m.dealerId === targetDealerId);
            if (!mapping && mappings.length > 0) {
                mapping = mappings[0];
            }

            const internalDealerId = mapping ? mapping.dealerId : targetDealerId;

            if (!internalDealerId) {
                return reply.code(400).send({ error: 'Nie wskazano identyfikatora dealera (dealerId lub externalDealerId).' });
            }

            // Normalizacja liczbowych wartości
            const productionYear = parseInt(body.productionYear, 10) || new Date().getFullYear();
            const mileageKm = parseInt(body.mileageKm, 10) || 0;
            const pricePln = parseInt(body.pricePln, 10) || 0;
            const enginePowerHp = body.enginePowerHp ? parseInt(body.enginePowerHp, 10) : null;
            const engineCapacityCm3 = body.engineCapacityCm3 ? parseInt(body.engineCapacityCm3, 10) : null;
            const doors = body.doors ? parseInt(body.doors, 10) : null;
            const seats = body.seats ? parseInt(body.seats, 10) : null;

            // Przygotowanie bezpiecznego VIN (max 30 znaków, unikalne ID jeśli brak)
            let safeVin = body.vin ? String(body.vin).trim() : null;
            if (safeVin && safeVin.length > 30) {
                safeVin = safeVin.substring(0, 30);
            }
            if (!safeVin) {
                safeVin = `OTM_${body.listingId || crypto.randomBytes(6).toString('hex')}`;
            }

            const existingListing = await fastify.prisma.listing.findUnique({
                where: { vin: safeVin }
            });

            if (existingListing && existingListing.dealerId !== internalDealerId) {
                return reply.code(403).send({ error: 'Forbidden. Listing with this VIN belongs to another dealer.' });
            }

            const tempListingId = existingListing?.id || crypto.randomBytes(12).toString('hex');
            const slug = generateListingSlug(
                body.make,
                body.model,
                body.version,
                productionYear,
                body.bodyType,
                body.fuelType,
                tempListingId
            );

            const imageUrls = body.imageUrls || body.images || [];

            const listing = await fastify.prisma.listing.upsert({
                where: { vin: safeVin },
                update: {
                    make: body.make,
                    model: body.model,
                    version: body.version || null,
                    productionYear,
                    mileageKm,
                    pricePln,
                    priceDisplay: pricePln > 0 ? pricePln.toLocaleString('pl-PL') + ' PLN' : 'Zapytaj o cenę',
                    fuelType: body.fuelType || null,
                    transmission: body.transmission || null,
                    enginePowerHp,
                    engineCapacityCm3,
                    drive: body.drive || null,
                    bodyType: body.bodyType || null,
                    doors,
                    seats,
                    color: body.color || null,
                    paintType: body.paintType || null,
                    equipmentAudioMultimedia: body.equipmentAudioMultimedia || [],
                    equipmentSafety: body.equipmentSafety || [],
                    equipmentComfortExtras: body.equipmentComfortExtras || [],
                    equipmentOther: body.equipmentOther || [],
                    condition: body.condition === 'NEW' ? 'NEW' : 'USED',
                    primaryImageUrl: imageUrls.length > 0 ? imageUrls[0] : (body.primaryImageUrl || null),
                    imageUrls: imageUrls,
                    imageCount: imageUrls.length,
                    isArchived: false,
                    archivedAt: null,
                    archivedReason: null,
                    updatedAt: new Date(),
                    entrySource: 'AGENT',
                    marketplace: 'motolia',
                    dealerId: internalDealerId,
                    listingId: body.listingId ? String(body.listingId) : null,
                    listingUrl: body.listingUrl || null
                },
                create: {
                    vin: safeVin,
                    make: body.make,
                    model: body.model,
                    version: body.version || null,
                    productionYear,
                    mileageKm,
                    pricePln,
                    priceDisplay: pricePln > 0 ? pricePln.toLocaleString('pl-PL') + ' PLN' : 'Zapytaj o cenę',
                    fuelType: body.fuelType || null,
                    transmission: body.transmission || null,
                    enginePowerHp,
                    engineCapacityCm3,
                    drive: body.drive || null,
                    bodyType: body.bodyType || null,
                    doors,
                    seats,
                    color: body.color || null,
                    paintType: body.paintType || null,
                    equipmentAudioMultimedia: body.equipmentAudioMultimedia || [],
                    equipmentSafety: body.equipmentSafety || [],
                    equipmentComfortExtras: body.equipmentComfortExtras || [],
                    equipmentOther: body.equipmentOther || [],
                    condition: body.condition === 'NEW' ? 'NEW' : 'USED',
                    primaryImageUrl: imageUrls.length > 0 ? imageUrls[0] : (body.primaryImageUrl || null),
                    imageUrls: imageUrls,
                    imageCount: imageUrls.length,
                    slug,
                    marketplace: 'motolia',
                    dealerId: internalDealerId,
                    isArchived: false,
                    entrySource: 'AGENT',
                    listingId: body.listingId ? String(body.listingId) : null,
                    listingUrl: body.listingUrl || null
                }
            });

            return reply.code(201).send({
                id: listing.id,
                vin: listing.vin,
                status: 'active'
            });

        } catch (err: any) {
            fastify.log.error(err);
            return reply.code(500).send({ error: 'Błąd zapisu w bazie danych: ' + (err.message || String(err)) });
        }
    });

    fastify.delete('/api/v1/external/listings/:vin', {
        schema: {
            description: 'Archive a listing',
            tags: ['Listings'],
            security: [{ bearerAuth: [] }],
            params: Type.Object({
                vin: Type.String()
            }),
            response: {
                200: Type.Object({
                    vin: Type.String(),
                    status: Type.String()
                }),
                403: Type.Object({
                    error: Type.String()
                }),
                404: Type.Object({
                    error: Type.String()
                })
            }
        }
    }, async (request, reply) => {
        const partnerReq = request as PartnerRequest;
        const partner = partnerReq.partner;
        const { vin } = request.params as { vin: string };

        const listing = await fastify.prisma.listing.findUnique({
            where: { vin }
        });

        if (!listing) {
            return reply.code(404).send({ error: 'Listing not found' });
        }

        const authorizedDealerIds = partner.mappings.map(m => m.dealerId);
        if (!listing.dealerId || !authorizedDealerIds.includes(listing.dealerId)) {
            return reply.code(403).send({ error: 'Forbidden. You do not own this listing.' });
        }

        await fastify.prisma.listing.update({
            where: { id: listing.id },
            data: {
                isArchived: true,
                archivedAt: new Date(),
                archivedReason: 'Archived via Partner API'
            }
        });

        return { vin, status: 'archived' };
    });
}
