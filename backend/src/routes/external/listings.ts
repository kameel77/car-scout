import { FastifyInstance } from 'fastify';
import { partnerAuth, PartnerRequest } from '../../middleware/partnerAuth.js';
import { generateListingSlug } from '../../utils/url-utils.js';
import { Type } from '@sinclair/typebox';
import { ListingCondition } from '@prisma/client';
import crypto from 'crypto';

// Mapuje różne warianty opisu napędu (np. z Otomoto: "Na przednie koła",
// "Na tylne koła", "4x4 (stały)") na wartości oczekiwane przez formularz
// edycji w panelu (select: "Przedni" | "Tylny" | "4x4"). Nieznane -> null.
function normalizeDrive(raw: unknown): string | null {
    if (!raw) return null;
    const s = String(raw).toLowerCase();
    if (s.includes('4x4') || s.includes('cztery') || s.includes('awd') ||
        s.includes('all-wheel') || s.includes('all wheel') || s.includes('quattro') ||
        s.includes('4matic') || s.includes('4motion') || s.includes('xdrive')) {
        return '4x4';
    }
    if (s.includes('tyl') || s.includes('rwd') || s.includes('rear')) {
        return 'Tylny';
    }
    if (s.includes('przod') || s.includes('przedn') || s.includes('fwd') || s.includes('front')) {
        return 'Przedni';
    }
    return null;
}

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

    // Sprawdzenie, czy ogłoszenie już istnieje — pozwala klientowi zapytać
    // użytkownika o zgodę PRZED nadpisaniem danych.
    fastify.get('/api/v1/external/listings/lookup', {
        schema: {
            description: 'Check whether a listing already exists (by listingId or VIN)',
            tags: ['Listings'],
            security: [{ bearerAuth: [] }],
            querystring: Type.Object({
                listingId: Type.Optional(Type.String()),
                vin: Type.Optional(Type.String())
            })
        }
    }, async (request, reply) => {
        const partnerReq = request as PartnerRequest;
        const partner = partnerReq.partner;
        const { listingId, vin } = request.query as { listingId?: string; vin?: string };

        if (!listingId && !vin) {
            return reply.code(400).send({ error: 'Podaj listingId lub vin.' });
        }

        let found = null;
        if (vin) {
            const trimmed = vin.trim().toUpperCase();
            if (/^[A-HJ-NPR-Z0-9]{17}$/.test(trimmed)) {
                found = await fastify.prisma.listing.findUnique({ where: { vin: trimmed } });
            }
        }
        if (!found && listingId) {
            found = await fastify.prisma.listing.findUnique({ where: { listingId: String(listingId) } });
        }

        if (!found) return { exists: false };

        // Nie ujawniamy danych ogłoszeń spoza zakresu klucza partnera.
        const authorizedDealerIds = (partner.mappings || []).map(m => m.dealerId);
        if (authorizedDealerIds.length > 0 &&
            (!found.dealerId || !authorizedDealerIds.includes(found.dealerId))) {
            return reply.code(403).send({ error: 'Forbidden. Ogłoszenie należy do innego dealera.' });
        }

        return {
            exists: true,
            id: found.id,
            listingId: found.listingId,
            vin: found.vin,
            make: found.make,
            model: found.model,
            pricePln: found.pricePln,
            mileageKm: found.mileageKm,
            isArchived: found.isArchived,
            updatedAt: found.updatedAt
        };
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
        listingId: Type.Optional(Type.String({ description: 'ID ogłoszenia w serwisie źródłowym (Otomoto)' })),
        listingUrl: Type.Optional(Type.String({ description: 'URL ogłoszenia źródłowego' })),
        primaryImageUrl: Type.Optional(Type.String()),
        images: Type.Optional(Type.Array(Type.String({ description: 'Array of image URLs' }))),
        imageUrls: Type.Optional(Type.Array(Type.String())),
        additionalInfoContent: Type.Optional(Type.String({ description: 'Treść opisu dodatkowego' })),
        additionalInfoHeader: Type.Optional(Type.String({ description: 'Nagłówek opisu dodatkowego' }))
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
            const partner = partnerReq.partner;            const body = request.body as any;

            // 1. Weryfikacja dealerId i uprawnień partnera
            const targetDealerId = body.dealerId || body.externalDealerId;
            if (!targetDealerId) {
                return reply.code(400).send({ error: 'Brak identyfikatora dealera (dealerId).' });
            }

            const mappings = partner.mappings || [];

            // Jeśli w panelu administracyjnym przypisano konkretnych dealerów, wymagamy ścisłego dopasowania!
            if (mappings.length > 0) {
                const isAuthorized = mappings.some(m => m.externalId === targetDealerId || m.dealerId === targetDealerId);
                if (!isAuthorized) {
                    return reply.code(403).send({
                        error: `Brak uprawnień. Klucz Partnera API jest przypisany do konkretnych dealerów i nie zezwala na zapis dla dealera '${targetDealerId}'.`
                    });
                }
            }

            const dealerExists = await fastify.prisma.dealer.findUnique({
                where: { id: targetDealerId }
            });

            if (!dealerExists) {
                return reply.code(400).send({ error: `Dealer o ID '${targetDealerId}' nie istnieje w bazie danych.` });
            }

            const internalDealerId = dealerExists.id;

            // 2. Walidacja VIN: Standard ISO (dokładnie 17 znaków alfanumerycznych, wykluczając I, O, Q)
            let cleanVin: string | null = null;
            if (body.vin && typeof body.vin === 'string') {
                const trimmed = body.vin.trim().toUpperCase();
                if (/^[A-HJ-NPR-Z0-9]{17}$/.test(trimmed)) {
                    cleanVin = trimmed;
                }
            }

            // Normalizacja typów liczbowych
            const productionYear = parseInt(body.productionYear, 10) || new Date().getFullYear();
            const mileageKm = parseInt(body.mileageKm, 10) || 0;
            const pricePln = parseInt(body.pricePln, 10) || 0;
            const enginePowerHp = body.enginePowerHp ? parseInt(body.enginePowerHp, 10) : null;
            const engineCapacityCm3 = body.engineCapacityCm3 ? parseInt(body.engineCapacityCm3, 10) : null;
            const doors = body.doors ? parseInt(body.doors, 10) : null;
            const seats = body.seats ? parseInt(body.seats, 10) : null;

            // Szukanie istniejącej oferty. Oba pola (vin, listingId) są @unique,
            // więc sprawdzamy je KASKADOWO, nie rozłącznie. Wcześniejsze `else if`
            // powodowało błąd: pierwszy import bez VIN tworzył rekord z listingId,
            // a ponowny import tego samego ogłoszenia już z VIN-em szukał wyłącznie
            // po VIN, nie znajdował go i wpadał w INSERT łamiący unique na listing_id.
            const externalListingId = body.listingId ? String(body.listingId) : null;

            let existingListing = null;
            if (cleanVin) {
                existingListing = await fastify.prisma.listing.findUnique({ where: { vin: cleanVin } });
            }
            if (!existingListing && externalListingId) {
                existingListing = await fastify.prisma.listing.findUnique({ where: { listingId: externalListingId } });
            }

            if (existingListing && existingListing.dealerId !== internalDealerId) {
                return reply.code(403).send({ error: 'Forbidden. Listing z tym VIN należy do innego dealera.' });
            }

            // Kolizja odwrotna: aktualizujemy rekord znaleziony po listingId, ale
            // podany VIN jest już przypisany do INNEGO ogłoszenia. Bez tego guardu
            // Prisma rzuciłaby surowym unique constraint na `vin` (HTTP 500).
            if (existingListing && cleanVin && existingListing.vin !== cleanVin) {
                const vinOwner = await fastify.prisma.listing.findUnique({
                    where: { vin: cleanVin },
                    select: { id: true, listingId: true }
                });
                if (vinOwner && vinOwner.id !== existingListing.id) {
                    return reply.code(409).send({
                        error: `VIN ${cleanVin} jest już przypisany do innego ogłoszenia` +
                            `${vinOwner.listingId ? ` (listingId: ${vinOwner.listingId})` : ''}. ` +
                            'Popraw VIN albo zarchiwizuj tamto ogłoszenie.'
                    });
                }
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

            const listingData = {
                vin: cleanVin,
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
                drive: normalizeDrive(body.drive),
                bodyType: body.bodyType || null,
                doors,
                seats,
                color: body.color || null,
                paintType: body.paintType || null,
                equipmentAudioMultimedia: body.equipmentAudioMultimedia || [],
                equipmentSafety: body.equipmentSafety || [],
                equipmentComfortExtras: body.equipmentComfortExtras || [],
                equipmentOther: body.equipmentOther || [],
                condition: body.condition === 'NEW' ? ListingCondition.NEW : ListingCondition.USED,
                primaryImageUrl: imageUrls.length > 0 ? imageUrls[0] : (body.primaryImageUrl || null),
                imageUrls: imageUrls,
                imageCount: imageUrls.length,
                isArchived: false,
                archivedAt: null,
                archivedReason: null,
                updatedAt: new Date(),
                entrySource: 'AGENT' as const,
                marketplace: 'motolia',
                dealerId: internalDealerId,
                // Przy aktualizacji nie kasujemy powiązania z ogłoszeniem źródłowym,
                // gdy bieżący payload go nie zawiera.
                listingId: externalListingId ?? existingListing?.listingId ?? null,
                listingUrl: body.listingUrl || null,
                // Opis dodatkowy (backoffice: "Treść/Nagłówek opisu dodatkowego")
                additionalInfoContent: body.additionalInfoContent || null,
                additionalInfoHeader: body.additionalInfoHeader || null
            };

            let listing;
            if (existingListing) {
                listing = await fastify.prisma.listing.update({
                    where: { id: existingListing.id },
                    data: listingData
                });
            } else {
                listing = await fastify.prisma.listing.create({
                    data: {
                        ...listingData,
                        slug
                    }
                });
            }

            return reply.code(201).send({
                id: listing.id,
                vin: listing.vin,
                listingId: listing.listingId,
                // Pozwala klientowi (wtyczka Chrome) rozróżnić import od nadpisania.
                created: !existingListing,
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
