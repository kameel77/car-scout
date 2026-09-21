import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { verifyEmployeeAuth } from '../auth/employee-auth.middleware.js';
import {
  calculateOfferPricing,
  CalculatedPricing,
  FormattedBenefit,
  FormattedVehicle,
  FormattedOffer
} from '../pricing/employee-pricing.utils.js';
import { resolveProgramFinancingConfig } from '../pricing/employee-financing-config.utils.js';

export {
  calculateOfferPricing,
  CalculatedPricing,
  FormattedBenefit,
  FormattedVehicle,
  FormattedOffer
} from '../pricing/employee-pricing.utils.js';

// Request Validation Schemas with Zod - Universal regex accepting CUID and listing-{id}
const getOffersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(24),
  cursor: z.string().regex(/^[a-zA-Z0-9_-]+$/).max(100).optional(),
  search: z.string().trim().max(100).optional()
});

const getOfferParamsSchema = z.object({
  offerId: z.string().regex(/^[a-zA-Z0-9_-]+$/).max(100)
});

const LIST_IMAGE_URLS_LIMIT = 5;

function formatListingOffer(
  listing: any,
  exceptionOffer: any | null | undefined,
  programScopeDiscountPct: number | { toNumber(): number } | null | undefined,
  programDefaultDiscountPct: number | { toNumber(): number } | null | undefined,
  isDetail: boolean = false
): FormattedOffer {
  const listPrice = listing.pricePln ?? 0;
  const rawImages = Array.isArray(listing.imageUrls) ? listing.imageUrls : [];
  const vehicle: FormattedVehicle = {
    id: listing.id,
    make: listing.make,
    model: listing.model,
    version: listing.version ?? null,
    productionYear: listing.productionYear,
    fuelType: listing.fuelType ?? null,
    transmission: listing.transmission ?? null,
    bodyType: listing.bodyType ?? null,
    primaryImageUrl: listing.primaryImageUrl ?? null,
    imageUrls: isDetail ? rawImages : rawImages.slice(0, LIST_IMAGE_URLS_LIMIT),
    powerHp: listing.enginePowerHp ?? null,
    engineCapacityCm3: listing.engineCapacityCm3 ?? null,
    doors: listing.doors ?? null,
    seats: listing.seats ?? null,
    color: listing.color ?? null,
    paintType: listing.paintType ?? null,
    drive: listing.drive ?? null,
    equipmentSafety: Array.isArray(listing.equipmentSafety) ? listing.equipmentSafety : [],
    equipmentComfortExtras: Array.isArray(listing.equipmentComfortExtras) ? listing.equipmentComfortExtras : [],
    equipmentAudioMultimedia: Array.isArray(listing.equipmentAudioMultimedia) ? listing.equipmentAudioMultimedia : [],
    equipmentOther: Array.isArray(listing.equipmentOther) ? listing.equipmentOther : [],
    additionalInfoHeader: listing.additionalInfoHeader ?? null,
    additionalInfoContent: listing.additionalInfoContent ?? null,
    specsJson: listing.specsJson ?? null
  };

  const customPricePln = exceptionOffer?.customPricePln ?? null;
  const discountPct = exceptionOffer?.discountPct ?? null;
  const benefitPolicy = exceptionOffer?.benefitPolicy ?? null;
  const offerId = exceptionOffer?.id ?? `listing-${listing.id}`;

  const pricing = calculateOfferPricing(
    listPrice,
    customPricePln,
    discountPct,
    programDefaultDiscountPct,
    programScopeDiscountPct
  );

  const benefit: FormattedBenefit | null = benefitPolicy
    ? {
        name: benefitPolicy.name,
        moyaCardAmount: benefitPolicy.moyaCardAmount ?? null,
        fuelDiscount: benefitPolicy.fuelDiscount ?? null,
        consultantCare: Boolean(benefitPolicy.consultantCare),
        termsText: benefitPolicy.termsText ?? null
      }
    : null;

  return {
    id: offerId,
    sourceType: 'FINANCING',
    vehicle,
    pricing,
    benefit
  };
}

export async function employeeCatalogRoutes(fastify: FastifyInstance) {
  // Scoped no-store hook for all employee catalog responses
  fastify.addHook('onSend', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    reply.header('Pragma', 'no-cache');
  });

  // Scoped error handler to ensure unknown route exceptions return generic 500 without leaking db details
  fastify.setErrorHandler((error: any, _request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Nieprawidłowe parametry zapytania'
      });
    }

    if (error?.code === 'P2025') {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Nieprawidłowy kursor paginacji'
      });
    }

    const statusCode = typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 600
      ? error.statusCode
      : 500;

    if (statusCode === 429) {
      return reply.code(429).send({
        statusCode: 429,
        error: 'Too Many Requests',
        message: error.message || 'Zbyt wiele żądań, spróbuj ponownie później'
      });
    }

    if (statusCode < 500) {
      return reply.code(statusCode).send({
        error: error.name || (statusCode === 400 ? 'Bad Request' : statusCode === 401 ? 'Unauthorized' : statusCode === 403 ? 'Forbidden' : statusCode === 404 ? 'Not Found' : 'Error'),
        message: error.message || 'Wystąpił błąd żądania'
      });
    }

    fastify.log.error(error, 'Employee catalog route internal error occurred');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Wystąpił wewnętrzny błąd serwera'
    });
  });

  // 1. GET /api/employee/offers - Lista ofert programu zalogowanego pracownika
  fastify.get('/api/employee/offers', {
    preHandler: [verifyEmployeeAuth],
    config: {
      rateLimit: {
        max: 600,
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    const employee = (request as any).employee;
    const programId = employee.programId;

    const query = getOffersQuerySchema.parse(request.query);
    const { limit, cursor, search } = query;

    // Pobierz program raz dla reguł zasięgu i domyślnych rabatów
    const program = await fastify.prisma.employeeProgram.findUnique({
      where: { id: programId },
      select: {
        id: true,
        scopeIncludeNew: true,
        scopeDiscountPct: true,
        defaultDiscountPct: true
      }
    });

    if (!program) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Program pracowniczy nie został znaleziony'
      });
    }


    // Normalizacja kursora — usunięcie ewentualnego przedrostka listing-
    const listingCursor = cursor ? cursor.replace(/^listing-/, '') : undefined;

    // Zapytanie do Listing:
    // 1. Reguła zasięgu (gdy scopeIncludeNew = true): condition = NEW, isReserved = false, brak aktywnego wykluczenia (isExcluded: true, isActive: true).
    // 2. Wyjątki ofertowe: wpis w employee_program_offers z isActive: true i isExcluded: false.
    //
    // UWAGA dot. RENTAL (Etap E1 vs E3):
    // Zapytanie katalogu w E1 jest zakorzenione bezpośrednio w tabeli Listing (pojazdy na sprzedaż/finansowanie z ceną zakupu pricePln).
    // Rekordy EmployeeProgramOffer o sourceType: 'RENTAL' (najem długoterminowy) mają listingId = null i nie posiadają ceny gotówkowej.
    // W etapie E1 oferty RENTAL są celowo pomijane w wynikach listy - ich obsługa wraz z kalkulatorem matryc (scopeIncludeRental) nastąpi w Etapie E3.
    // TODO(E3): Dedykowane zapytanie lub unia dla ofert RENTAL powiązanych z matrycami stawek najmu.
    const rawListings = await fastify.prisma.listing.findMany({
      where: {
        isArchived: false,
        pricePln: { gt: 0 },
        AND: [
          ...(search && search.length > 0 ? [{
            OR: [
              { make: { contains: search, mode: 'insensitive' as const } },
              { model: { contains: search, mode: 'insensitive' as const } },
              { version: { contains: search, mode: 'insensitive' as const } }
            ]
          }] : []),
          {
            OR: [
              ...(program.scopeIncludeNew ? [{
                condition: 'NEW' as const,
                isReserved: false,
                employeeProgramOffers: {
                  none: {
                    programId,
                    isExcluded: true,
                    isActive: true
                  }
                }
              }] : []),
              {
                employeeProgramOffers: {
                  some: {
                    programId,
                    isActive: true,
                    isExcluded: false
                  }
                }
              }
            ]
          }
        ]
      },
      take: limit + 1,
      ...(listingCursor ? { cursor: { id: listingCursor }, skip: 1 } : {}),
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' }
      ],
      include: {
        employeeProgramOffers: {
          where: {
            programId,
            isActive: true,
            isExcluded: false
          },
          include: {
            benefitPolicy: {
              select: {
                name: true,
                moyaCardAmount: true,
                fuelDiscount: true,
                consultantCare: true,
                termsText: true
              }
            }
          },
          take: 1
        }
      }
    });

    const hasMore = rawListings.length > limit;
    const sliced = hasMore ? rawListings.slice(0, limit) : rawListings;
    // nextCursor jest zawsze czystym Listing.id (niezależnym od id oferty w payloadzie)
    const nextCursor = hasMore && sliced.length > 0 ? sliced[sliced.length - 1].id : null;

    const offers: FormattedOffer[] = sliced.map((listing) => {
      const exceptionOffer = listing.employeeProgramOffers?.[0] || null;
      return formatListingOffer(
        listing,
        exceptionOffer,
        program.scopeDiscountPct,
        program.defaultDiscountPct
      );
    });

    return reply.send({
      offers,
      nextCursor
    });
  });

  // 2. GET /api/employee/offers/:offerId - Szczegóły pojedynczej oferty
  fastify.get('/api/employee/offers/:offerId', {
    preHandler: [verifyEmployeeAuth],
    config: {
      rateLimit: {
        max: 600,
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    const employee = (request as any).employee;
    const programId = employee.programId;

    const { offerId } = getOfferParamsSchema.parse(request.params);

    const program = await fastify.prisma.employeeProgram.findUnique({
      where: { id: programId },
      select: {
        id: true,
        scopeIncludeNew: true,
        scopeDiscountPct: true,
        defaultDiscountPct: true
      }
    });

    if (!program) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Oferta nie została znaleziona'
      });
    }

    // Jedno wywołanie na żądanie — konfiguracja finansowania współdzielona przez oba scenariusze (A i B)
    const financing = await resolveProgramFinancingConfig(fastify.prisma, programId);

    // Scenariusz A: Wirtualne ID ze stoku (np. listing-clw12345)
    if (offerId.startsWith('listing-')) {
      const listingId = offerId.replace(/^listing-/, '');

      if (!program.scopeIncludeNew) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Oferta nie została znaleziona'
        });
      }

      const listing = await fastify.prisma.listing.findUnique({
        where: { id: listingId },
        include: {
          employeeProgramOffers: {
            where: {
              programId,
              isExcluded: true,
              isActive: true
            },
            take: 1
          }
        }
      });

      if (
        !listing ||
        listing.isArchived ||
        listing.condition !== 'NEW' ||
        (listing.pricePln ?? 0) <= 0 ||
        listing.isReserved ||
        (listing.employeeProgramOffers && listing.employeeProgramOffers.length > 0)
      ) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Oferta nie została znaleziona'
        });
      }

      const formatted = formatListingOffer(
        listing,
        null,
        program.scopeDiscountPct,
        program.defaultDiscountPct,
        true
      );

      return reply.send({ ...formatted, financing });
    }

    // Scenariusz B: Dedykowany rekord w EmployeeProgramOffer
    const rawOffer = await fastify.prisma.employeeProgramOffer.findUnique({
      where: { id: offerId },
      include: {
        listing: true,
        benefitPolicy: {
          select: {
            name: true,
            moyaCardAmount: true,
            fuelDiscount: true,
            consultantCare: true,
            termsText: true
          }
        }
      }
    });

    // 404 gdy oferta nie istnieje, nie należy do programu pracownika, jest nieaktywna lub jest wykluczeniem
    if (!rawOffer || rawOffer.programId !== programId || !rawOffer.isActive || rawOffer.isExcluded) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Oferta nie została znaleziona'
      });
    }

    // W E1 katalog obsługuje wyłącznie FINANCING powiązany z Listing
    if (rawOffer.sourceType !== 'FINANCING' || !rawOffer.listingId || !rawOffer.listing) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Oferta nie została znaleziona'
      });
    }

    if (rawOffer.listing.isArchived || (rawOffer.listing.pricePln ?? 0) <= 0) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Oferta nie została znaleziona'
      });
    }

    const formatted = formatListingOffer(
      rawOffer.listing,
      rawOffer,
      program.scopeDiscountPct,
      program.defaultDiscountPct,
      true
    );

    return reply.send({ ...formatted, financing });
  });
}
