import { FastifyInstance } from 'fastify';
import { generateListingSlug } from '../utils/url-utils.js';
import { randomBytes } from 'crypto';

export async function otomotoEmulatorRoutes(fastify: FastifyInstance) {
    // Middleware for basic API Key authentication
    fastify.addHook('preHandler', async (request, reply) => {
        const authHeader = request.headers.authorization;
        const expectedToken = process.env.OTOMOTO_EMULATOR_API_KEY;
        
        if (!expectedToken) {
            fastify.log.warn('OTOMOTO_EMULATOR_API_KEY is not set in environment. Emulator is disabled.');
            return reply.code(401).send({ error: 'Emulator API Key not configured on the server.' });
        }

        if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
            return reply.code(401).send({ error: 'Unauthorized. Invalid or missing Bearer token.' });
        }
    });

    // Create or update advert (Upsert by VIN or ID)
    fastify.post('/api/otomoto/open/account/adverts', async (request, reply) => {
        const body = request.body as any;
        
        // Extract standard Otomoto format parameters
        const params = body.parameters || body.params || body || {};
        const vin = params.vin || body.vin;
        
        if (!vin) {
            return reply.code(400).send({ error: 'Validation failed', constraints: { vin: 'VIN is required' } });
        }

        const make = params.make || body.make || "Unknown Make";
        const model = params.model || body.model || "Unknown Model";
        const productionYear = parseInt(params.year || params.production_year || body.year || body.production_year) || new Date().getFullYear();
        const mileageKm = parseInt(params.mileage || body.mileage) || 0;
        
        // Handle price
        let pricePln = 0;
        if (body.price && typeof body.price === 'object') {
            pricePln = parseInt(body.price.value) || 0;
        } else if (params.price && typeof params.price === 'object') {
            pricePln = parseInt(params.price.value) || 0;
        } else {
            pricePln = parseInt(body.price || params.price) || 0;
        }

        const version = params.version || body.version;
        const fuelType = params.fuel_type || body.fuel_type;
        const transmission = params.gearbox || body.gearbox || params.transmission || body.transmission;
        const enginePowerHp = parseInt(params.engine_power || body.engine_power) || null;
        const engineCapacityCm3 = parseInt(params.engine_capacity || body.engine_capacity) || null;
        const bodyType = params.body_type || body.body_type;
        const color = params.color || body.color;
        
        const equipmentAudioMultimedia: string[] = [];
        const equipmentSafety: string[] = [];
        const equipmentComfortExtras: string[] = [];
        const equipmentOther: string[] = [];

        // Known boolean features
        const knownFeatures = ['bluetooth', 'apple_carplay', 'android_auto', 'antilock_brake_system', 'isofix', 'cruise_control'];
        knownFeatures.forEach(feat => {
            if (params[feat] || body[feat]) {
                equipmentOther.push(feat);
            }
        });

        // Try applying images if exist
        let primaryImageUrl: string | null = null;
        let imageUrls: string[] = [];
        
        if (body.images && Array.isArray(body.images)) {
            // Depending on format, it might be array of strings or objects { "url": "..." }
            imageUrls = body.images.map((img: any) => typeof img === 'string' ? img : img.url).filter(Boolean);
            if (imageUrls.length > 0) {
                primaryImageUrl = imageUrls[0];
            }
        }

        // Try to find existing listing first to reuse the CUID or generate new random ID for slug
        let existingListing = await fastify.prisma.listing.findUnique({
            where: { vin: vin }
        });

        const tempListingId = existingListing?.id || randomBytes(12).toString('hex');
        const slug = generateListingSlug(make, model, version, productionYear, bodyType, fuelType, tempListingId);

        try {
            const listing = await fastify.prisma.listing.upsert({
                where: { vin: vin },
                update: {
                    make,
                    model,
                    version,
                    productionYear,
                    mileageKm,
                    pricePln,
                    priceDisplay: pricePln.toLocaleString('pl-PL') + ' PLN',
                    fuelType,
                    transmission,
                    enginePowerHp,
                    engineCapacityCm3,
                    bodyType,
                    color,
                    isArchived: false,
                    archivedAt: null,
                    archivedReason: null,
                    updatedAt: new Date(),
                    equipmentOther,
                    primaryImageUrl: primaryImageUrl || existingListing?.primaryImageUrl || null,
                    imageUrls: imageUrls.length > 0 ? imageUrls : existingListing?.imageUrls || [],
                    imageCount: imageUrls.length > 0 ? imageUrls.length : existingListing?.imageCount || 0,
                    specsJson: body
                },
                create: {
                    vin,
                    make,
                    model,
                    version,
                    productionYear,
                    mileageKm,
                    pricePln,
                    priceDisplay: pricePln.toLocaleString('pl-PL') + ' PLN',
                    fuelType,
                    transmission,
                    enginePowerHp,
                    engineCapacityCm3,
                    bodyType,
                    color,
                    isArchived: false,
                    equipmentOther,
                    slug,
                    marketplace: 'otomoto_emulator',
                    primaryImageUrl: primaryImageUrl || null,
                    imageUrls: imageUrls,
                    imageCount: imageUrls.length,
                    specsJson: body
                }
            });

            // Return Otomoto-like response
            return reply.code(201).send({
                id: listing.vin, // Partner might refer to it via VIN in future calls
                otomoto_id: listing.id,
                url: `https://example.com/ad/${listing.slug}`, // Or actual frontend URL
                status: "active"
            });
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: "Internal Server Error", details: error instanceof Error ? error.message : "Database save failed" });
        }
    });

    // Archive / Status update advert
    fastify.put('/api/otomoto/open/account/adverts/:id/status', async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = request.body as any;
        const status = body.status; // expected e.g., 'active', 'inactive', 'finished', 'archived'

        try {
            const isArchived = (status === 'inactive' || status === 'finished' || status === 'archived');
            
            // Allow looking up by our CUID or the provided VIN
            let listing = await fastify.prisma.listing.findFirst({
                where: {
                    OR: [
                        { id: id },
                        { vin: id }
                    ]
                }
            });

            if (!listing) {
                return reply.code(404).send({ error: 'Advert not found' });
            }

            listing = await fastify.prisma.listing.update({
                where: { id: listing.id },
                data: {
                    isArchived: isArchived,
                    archivedAt: isArchived ? new Date() : null,
                    archivedReason: isArchived ? 'Otomoto emulator status update' : null
                }
            });

            return reply.send({
                id: listing.vin,
                otomoto_id: listing.id,
                status: isArchived ? 'finished' : 'active'
            });
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: "Internal Server Error" });
        }
    });
}
