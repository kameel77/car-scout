import { FastifyInstance } from 'fastify';
import { partnerAuth, PartnerRequest } from '../../middleware/partnerAuth.js';
import { generateListingSlug } from '../../utils/url-utils.js';
import { Type } from '@sinclair/typebox';
import crypto from 'crypto';

export async function externalListingsRoutes(fastify: FastifyInstance) {
    fastify.addHook('preHandler', partnerAuth);

    const ListingSchema = Type.Object({
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
        bodyType: Type.Optional(Type.String()),
        color: Type.Optional(Type.String()),
        equipment: Type.Optional(Type.Array(Type.String())),
        images: Type.Optional(Type.Array(Type.String()))
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
                })
            }
        }
    }, async (request, reply) => {
        const partnerReq = request as PartnerRequest;
        const partner = partnerReq.partner;
        const body = request.body as any;

        const existingListing = await fastify.prisma.listing.findUnique({
            where: { vin: body.vin }
        });

        if (existingListing && existingListing.dealerId !== partner.dealerId) {
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
                bodyType: body.bodyType,
                color: body.color,
                equipmentOther: body.equipment || [],
                primaryImageUrl: imageUrls.length > 0 ? imageUrls[0] : null,
                imageUrls: imageUrls,
                imageCount: imageUrls.length,
                isArchived: false,
                archivedAt: null,
                archivedReason: null,
                updatedAt: new Date()
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
                bodyType: body.bodyType,
                color: body.color,
                equipmentOther: body.equipment || [],
                primaryImageUrl: imageUrls.length > 0 ? imageUrls[0] : null,
                imageUrls: imageUrls,
                imageCount: imageUrls.length,
                slug,
                marketplace: 'partner_api',
                dealerId: partner.dealerId,
                isArchived: false
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

        if (listing.dealerId !== partner.dealerId) {
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
