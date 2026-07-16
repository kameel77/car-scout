import { FastifyInstance } from 'fastify';
import { partnerAuth, PartnerRequest } from '../../middleware/partnerAuth.js';
import { generateListingSlug } from '../../utils/url-utils.js';
import { Type } from '@sinclair/typebox';
import crypto from 'crypto';

export async function externalListingsRoutes(fastify: FastifyInstance) {
    fastify.addHook('preHandler', partnerAuth);

    const ListingSchema = Type.Object({
        externalDealerId: Type.String(),
        vin: Type.String(),
        make: Type.String(),
        model: Type.String(),
        version: Type.Optional(Type.String()),
        productionYear: Type.Integer(),
        mileageKm: Type.Integer(),
        pricePln: Type.Integer(),
        fuelType: Type.Optional(Type.String()),
        transmission: Type.Optional(Type.String()),
        enginePowerHp: Type.Optional(Type.Integer()),
        engineCapacityCm3: Type.Optional(Type.Integer()),
        drive: Type.Optional(Type.String({ description: 'e.g. 4x4, FWD, RWD' })),
        bodyType: Type.Optional(Type.String()),
        doors: Type.Optional(Type.Integer()),
        seats: Type.Optional(Type.Integer()),
        color: Type.Optional(Type.String()),
        paintType: Type.Optional(Type.String({ description: 'e.g. Metalik, Perłowy' })),
        equipmentAudioMultimedia: Type.Optional(Type.Array(Type.String())),
        equipmentSafety: Type.Optional(Type.Array(Type.String())),
        equipmentComfortExtras: Type.Optional(Type.Array(Type.String())),
        equipmentOther: Type.Optional(Type.Array(Type.String())),
        condition: Type.Optional(Type.String({ description: 'e.g. USED, NEW' })),
        images: Type.Optional(Type.Array(Type.String({ description: 'Array of image URLs' })))
    });

    fastify.post('/api/v1/external/listings', {
        schema: {
            description: 'Create or update a listing',
            tags: ['Listings'],
            security: [{ bearerAuth: [] }],
            body: ListingSchema,
            response: {
                201: Type.Object({
                    id: Type.String(),
                    vin: Type.String(),
                    status: Type.String()
                }),
                403: Type.Object({
                    error: Type.String()
                })
            }
        }
    }, async (request, reply) => {
        const partnerReq = request as PartnerRequest;
        const partner = partnerReq.partner;
        const body = request.body as any;

        const mapping = partner.mappings.find(m => m.externalId === body.externalDealerId);
        if (!mapping) {
            return reply.code(403).send({ error: `Forbidden. externalDealerId '${body.externalDealerId}' is not authorized for this API key.` });
        }

        const internalDealerId = mapping.dealerId;

        const existingListing = await fastify.prisma.listing.findUnique({
            where: { vin: body.vin }
        });

        if (existingListing && existingListing.dealerId !== internalDealerId) {
            return reply.code(403).send({ error: 'Forbidden. Listing with this VIN belongs to another dealer.' });
        }

        const tempListingId = existingListing?.id || crypto.randomBytes(12).toString('hex');
        const slug = generateListingSlug(
            body.make,
            body.model,
            body.version,
            body.productionYear,
            body.bodyType,
            body.fuelType,
            tempListingId
        );

        const imageUrls = body.images || [];

        const listing = await fastify.prisma.listing.upsert({
            where: { vin: body.vin },
            update: {
                make: body.make,
                model: body.model,
                version: body.version,
                productionYear: body.productionYear,
                mileageKm: body.mileageKm,
                pricePln: body.pricePln,
                priceDisplay: body.pricePln.toLocaleString('pl-PL') + ' PLN',
                fuelType: body.fuelType,
                transmission: body.transmission,
                enginePowerHp: body.enginePowerHp,
                engineCapacityCm3: body.engineCapacityCm3,
                drive: body.drive,
                bodyType: body.bodyType,
                doors: body.doors,
                seats: body.seats,
                color: body.color,
                paintType: body.paintType,
                equipmentAudioMultimedia: body.equipmentAudioMultimedia || [],
                equipmentSafety: body.equipmentSafety || [],
                equipmentComfortExtras: body.equipmentComfortExtras || [],
                equipmentOther: body.equipmentOther || [],
                condition: body.condition === 'NEW' ? 'NEW' : 'USED',
                primaryImageUrl: imageUrls.length > 0 ? imageUrls[0] : null,
                imageUrls: imageUrls,
                imageCount: imageUrls.length,
                isArchived: false,
                archivedAt: null,
                archivedReason: null,
                updatedAt: new Date(),
                entrySource: 'AGENT'
            },
            create: {
                vin: body.vin,
                make: body.make,
                model: body.model,
                version: body.version,
                productionYear: body.productionYear,
                mileageKm: body.mileageKm,
                pricePln: body.pricePln,
                priceDisplay: body.pricePln.toLocaleString('pl-PL') + ' PLN',
                fuelType: body.fuelType,
                transmission: body.transmission,
                enginePowerHp: body.enginePowerHp,
                engineCapacityCm3: body.engineCapacityCm3,
                drive: body.drive,
                bodyType: body.bodyType,
                doors: body.doors,
                seats: body.seats,
                color: body.color,
                paintType: body.paintType,
                equipmentAudioMultimedia: body.equipmentAudioMultimedia || [],
                equipmentSafety: body.equipmentSafety || [],
                equipmentComfortExtras: body.equipmentComfortExtras || [],
                equipmentOther: body.equipmentOther || [],
                condition: body.condition === 'NEW' ? 'NEW' : 'USED',
                primaryImageUrl: imageUrls.length > 0 ? imageUrls[0] : null,
                imageUrls: imageUrls,
                imageCount: imageUrls.length,
                slug,
                marketplace: 'partner_api',
                dealerId: internalDealerId,
                isArchived: false,
                entrySource: 'AGENT'
            }
        });

        return reply.code(201).send({
            id: listing.id,
            vin: listing.vin,
            status: 'active'
        });
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
