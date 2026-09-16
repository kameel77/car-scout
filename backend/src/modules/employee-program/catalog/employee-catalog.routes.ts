import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { verifyEmployeeAuth } from '../auth/employee-auth.middleware.js';

// Request Validation Schemas with Zod
const getOffersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(24),
  cursor: z.string().cuid().optional(),
  search: z.string().trim().max(100).optional()
});

const getOfferParamsSchema = z.object({
  offerId: z.string().cuid()
});

export interface CalculatedPricing {
  listPricePln: number;
  employeePricePln: number;
  savingsPln: number;
  discountPct: number;
}

export function calculateOfferPricing(
  listPrice: number,
  customPricePln: number | null | undefined,
  discountPct: number | { toNumber(): number } | null | undefined,
  defaultDiscountPct: number | { toNumber(): number } | null | undefined
): CalculatedPricing {
  const safeListPrice = Math.max(0, listPrice);
  let employeePrice = safeListPrice;

  const customPrice = customPricePln !== null && customPricePln !== undefined ? customPricePln : null;
  const discount = discountPct !== null && discountPct !== undefined
    ? (typeof discountPct === 'number' ? discountPct : discountPct.toNumber())
    : null;
  const defaultDiscount = defaultDiscountPct !== null && defaultDiscountPct !== undefined
    ? (typeof defaultDiscountPct === 'number' ? defaultDiscountPct : defaultDiscountPct.toNumber())
    : null;

  if (customPrice !== null) {
    employeePrice = customPrice;
  } else if (discount !== null) {
    employeePrice = Math.round(safeListPrice * (1 - discount / 100));
  } else if (defaultDiscount !== null) {
    employeePrice = Math.round(safeListPrice * (1 - defaultDiscount / 100));
  } else {
    employeePrice = safeListPrice;
  }

  // Clamping: employeePrice never > listPrice and never < 0
  employeePrice = Math.min(safeListPrice, Math.max(0, employeePrice));
  const savingsPln = Math.max(0, safeListPrice - employeePrice);
  const actualDiscountPct = safeListPrice > 0
    ? parseFloat((((safeListPrice - employeePrice) / safeListPrice) * 100).toFixed(2))
    : 0;

  return {
    listPricePln: safeListPrice,
    employeePricePln: employeePrice,
    savingsPln,
    discountPct: actualDiscountPct
  };
}

export interface FormattedBenefit {
  name: string;
  moyaCardAmount: number | null;
  fuelDiscount: string | null;
  consultantCare: boolean;
  termsText: string | null;
}

export interface FormattedVehicle {
  make: string;
  model: string;
  version: string | null;
  productionYear: number;
  fuelType: string | null;
  transmission: string | null;
  bodyType: string | null;
  primaryImageUrl: string | null;
  imageUrls: string[];
}

export interface FormattedOffer {
  id: string;
  sourceType: string;
  vehicle: FormattedVehicle;
  pricing: CalculatedPricing;
  benefit: FormattedBenefit | null;
}

const LIST_IMAGE_URLS_LIMIT = 5;

function formatOfferPayload(
  offer: any,
  programDefaultDiscountPct: number | { toNumber(): number } | null | undefined
): FormattedOffer | null {
  let listPrice = 0;
  let vehicle: FormattedVehicle;

  if (offer.sourceType === 'FINANCING') {
    const listing = offer.listing;
    if (!listing) return null;

    listPrice = listing.pricePln ?? 0;
    const rawImages = Array.isArray(listing.imageUrls) ? listing.imageUrls : [];
    vehicle = {
      make: listing.make,
      model: listing.model,
      version: listing.version ?? null,
      productionYear: listing.productionYear,
      fuelType: listing.fuelType ?? null,
      transmission: listing.transmission ?? null,
      bodyType: listing.bodyType ?? null,
      primaryImageUrl: listing.primaryImageUrl ?? null,
      imageUrls: rawImages.slice(0, LIST_IMAGE_URLS_LIMIT)
    };
  } else if (offer.sourceType === 'RENTAL') {
    const rentalVehicle = offer.assignment?.vehicle;
    if (!rentalVehicle) return null;

    listPrice = rentalVehicle.catalogPrice ?? rentalVehicle.sellingPrice ?? 0;
    const rawImages = Array.isArray(rentalVehicle.imageUrls) ? rentalVehicle.imageUrls : [];
    vehicle = {
      make: rentalVehicle.make,
      model: rentalVehicle.model,
      version: rentalVehicle.version ?? null,
      productionYear: rentalVehicle.productionYear ?? new Date().getFullYear(),
      fuelType: rentalVehicle.fuelType ?? null,
      transmission: rentalVehicle.transmission ?? null,
      bodyType: rentalVehicle.bodyType ?? null,
      primaryImageUrl: rentalVehicle.primaryImageUrl ?? null,
      imageUrls: rawImages.slice(0, LIST_IMAGE_URLS_LIMIT)
    };
  } else {
    return null;
  }

  const pricing = calculateOfferPricing(
    listPrice,
    offer.customPricePln,
    offer.discountPct,
    programDefaultDiscountPct
  );

  const benefit: FormattedBenefit | null = offer.benefitPolicy
    ? {
        name: offer.benefitPolicy.name,
        moyaCardAmount: offer.benefitPolicy.moyaCardAmount ?? null,
        fuelDiscount: offer.benefitPolicy.fuelDiscount ?? null,
        consultantCare: Boolean(offer.benefitPolicy.consultantCare),
        termsText: offer.benefitPolicy.termsText ?? null
      }
    : null;

  return {
    id: offer.id,
    sourceType: offer.sourceType,
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
        max: 60,
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    const employee = (request as any).employee;
    const programId = employee.programId;

    const query = getOffersQuerySchema.parse(request.query);
    const { limit, cursor, search } = query;

    // Pobierz program raz dla defaultDiscountPct (nie dociągamy programu per wiersz)
    const program = await fastify.prisma.employeeProgram.findUnique({
      where: { id: programId },
      select: { defaultDiscountPct: true }
    });

    const programDefaultDiscountPct = program?.defaultDiscountPct;

    const searchFilter = search && search.length > 0 ? {
      OR: [
        { make: { contains: search, mode: 'insensitive' as const } },
        { model: { contains: search, mode: 'insensitive' as const } },
        { version: { contains: search, mode: 'insensitive' as const } }
      ]
    } : {};

    // Zapytanie Prisma uwzględniające pułapkę 2 (listingId: null):
    // Rekordy niespójne z listingId: null nie są ucinane przez JOIN w bazie,
    // lecz pobierane do pamięci aplikacji, gdzie są logowane z warn i pomijane.
    const rawOffers = await fastify.prisma.employeeProgramOffer.findMany({
      where: {
        programId,
        isActive: true,
        OR: [
          {
            sourceType: 'FINANCING',
            OR: [
              { listingId: null },
              {
                listing: {
                  isArchived: false,
                  ...searchFilter
                }
              }
            ]
          },
          {
            sourceType: 'RENTAL',
            // TODO (Etap P3c - Rental): Dodać warunek sprawdzający stan publikacji matrycy:
            // matrixVersion: { status: 'PUBLISHED' } (zgodnie z docs/employee-program/next-steps.md §2),
            // aby wersje robocze (DRAFT) nie były widoczne dla pracowników.
            ...(search && search.length > 0 ? {
              assignment: {
                vehicle: {
                  ...searchFilter
                }
              }
            } : {})
          }
        ]
      },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' }
      ],
      include: {
        listing: {
          select: {
            id: true,
            make: true,
            model: true,
            version: true,
            productionYear: true,
            fuelType: true,
            transmission: true,
            bodyType: true,
            pricePln: true,
            primaryImageUrl: true,
            imageUrls: true,
            isArchived: true
          }
        },
        assignment: {
          include: {
            vehicle: true
          }
        },
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

    const hasMore = rawOffers.length > limit;
    const sliced = hasMore ? rawOffers.slice(0, limit) : rawOffers;
    const nextCursor = hasMore && sliced.length > 0 ? sliced[sliced.length - 1].id : null;

    const offers: FormattedOffer[] = [];

    for (const rawOffer of sliced) {
      if (rawOffer.sourceType === 'FINANCING') {
        if (!rawOffer.listingId || !rawOffer.listing) {
          fastify.log.warn({ offerId: rawOffer.id, programId }, 'FINANCING offer has null listingId or missing listing; skipping');
          continue;
        }
        if (rawOffer.listing.isArchived) {
          continue;
        }
      }

      const formatted = formatOfferPayload(rawOffer, programDefaultDiscountPct);
      if (formatted) {
        offers.push(formatted);
      }
    }

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
        max: 60,
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    const employee = (request as any).employee;
    const programId = employee.programId;

    const { offerId } = getOfferParamsSchema.parse(request.params);

    const rawOffer = await fastify.prisma.employeeProgramOffer.findUnique({
      where: { id: offerId },
      include: {
        listing: {
          select: {
            id: true,
            make: true,
            model: true,
            version: true,
            productionYear: true,
            fuelType: true,
            transmission: true,
            bodyType: true,
            pricePln: true,
            primaryImageUrl: true,
            imageUrls: true,
            isArchived: true
          }
        },
        assignment: {
          include: {
            vehicle: true
          }
        },
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

    // 404 gdy oferta nie istnieje, nie należy do programu pracownika lub jest nieaktywna (nigdy 403)
    if (!rawOffer || rawOffer.programId !== programId || !rawOffer.isActive) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Oferta nie została znaleziona'
      });
    }

    if (rawOffer.sourceType === 'FINANCING') {
      if (!rawOffer.listingId || !rawOffer.listing) {
        fastify.log.warn({ offerId: rawOffer.id, programId }, 'FINANCING offer has null listingId or missing listing; returning 404');
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Oferta nie została znaleziona'
        });
      }
      if (rawOffer.listing.isArchived) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Oferta nie została znaleziona'
        });
      }
    } else if (rawOffer.sourceType === 'RENTAL') {
      // TODO (Etap P3c - Rental): Zweryfikować status publikacji powiązanej matrycy:
      // if (rawOffer.matrixVersion?.status !== 'PUBLISHED') return 404
    }

    const program = await fastify.prisma.employeeProgram.findUnique({
      where: { id: programId },
      select: { defaultDiscountPct: true }
    });

    const formatted = formatOfferPayload(rawOffer, program?.defaultDiscountPct);
    if (!formatted) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Oferta nie została znaleziona'
      });
    }

    return reply.send(formatted);
  });
}
