import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { verifyEmployeeAuth, verifyEmployeeCsrf } from '../auth/employee-auth.middleware.js';
import { generateReference } from '../../../utils/reference-generator.js';
import { calculateOfferPricing } from '../pricing/employee-pricing.utils.js';

export interface InquiryCalculationSnapshot {
  offerId: string;
  sourceType: string;
  vehicle: {
    make: string;
    model: string;
    version: string | null;
    productionYear: number;
    primaryImageUrl: string | null;
  };
  pricing: {
    listPricePln: number;
    employeePricePln: number;
    savingsPln: number;
    discountPct: number;
  };
}

export const createInquirySchema = z.object({
  offerId: z.string().cuid('Nieprawidłowy identyfikator oferty'),
  idempotencyKey: z.string().uuid('Nieprawidłowy klucz idempotencji (wymagany UUID v4)'),
  contractParty: z.enum(['CONSUMER', 'EMPLOYEE_B2B', 'EMPLOYER_COMPANY'], {
    errorMap: () => ({ message: 'Nieprawidłowa strona umowy' })
  }),
  contactName: z.string().trim().min(1, 'Imię i nazwisko jest wymagane').max(150),
  contactEmail: z.string().trim().email('Nieprawidłowy format adresu email').max(254),
  contactPhone: z.string().trim().min(1, 'Numer telefonu jest wymagany').max(30),
  nip: z.string().trim().optional(),
  notes: z.string().trim().max(2000, 'Uwagi mogą mieć maksymalnie 2000 znaków').optional(),
  consentPrivacy: z.boolean({
    required_error: 'Wymagana jest zgoda na przetwarzanie danych osobowych',
    invalid_type_error: 'Zgoda na przetwarzanie danych osobowych musi być wartością logiczną'
  }).refine((val) => val === true, {
    message: 'Wymagana jest zgoda na przetwarzanie danych osobowych'
  })
}).strip().superRefine((data, ctx) => {
  if (data.contractParty === 'EMPLOYEE_B2B' || data.contractParty === 'EMPLOYER_COMPANY') {
    if (!data.nip || data.nip.length < 10 || data.nip.length > 15) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nip'],
        message: 'NIP firmy (10-15 znaków) jest wymagany dla działalności gospodarczej i firmy pracodawcy'
      });
    }
  }
});

export const getInquiriesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().cuid().optional()
});

export async function employeeInquiriesRoutes(fastify: FastifyInstance) {
  // Nagłówki wyłączające cache odpowiedzi dla strefy pracowniczej
  fastify.addHook('onSend', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    reply.header('Pragma', 'no-cache');
  });

  // Izolowana obsługa błędów nieujawniająca wnętrzności bazy klientowi
  fastify.setErrorHandler((error: any, request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: error.errors[0]?.message || 'Nieprawidłowe parametry zapytania'
      });
    }

    if (error?.code === 'P2025') {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Nieprawidłowy kursor paginacji'
      });
    }

    const statusCode = error.statusCode || error.status;
    if (statusCode && statusCode < 500) {
      return reply.code(statusCode).send({
        error: error.name || (statusCode === 400 ? 'Bad Request' : statusCode === 401 ? 'Unauthorized' : statusCode === 403 ? 'Forbidden' : statusCode === 404 ? 'Not Found' : statusCode === 409 ? 'Conflict' : 'Error'),
        message: error.message || 'Wystąpił błąd żądania'
      });
    }

    fastify.log.error(error, 'Employee inquiries route internal error occurred');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Wystąpił wewnętrzny błąd serwera'
    });
  });

  // 1. POST /api/employee/inquiries - Złożenie nowego zgłoszenia o ofertę (idempotentne)
  fastify.post('/api/employee/inquiries', {
    preHandler: [verifyEmployeeAuth, verifyEmployeeCsrf],
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    const employee = (request as any).employee;
    const body = createInquirySchema.parse(request.body);

    // Krok 1: Weryfikacja idempotencji przed transakcją
    const existing = await fastify.prisma.employeeInquiry.findUnique({
      where: { idempotencyKey: body.idempotencyKey },
      include: {
        lead: {
          select: { referenceNumber: true }
        }
      }
    });

    if (existing) {
      if (existing.accountId === employee.accountId) {
        const snap = existing.calculationSnapshot as any;
        return reply.code(200).send({
          inquiry: {
            id: existing.id,
            status: existing.status,
            referenceNumber: existing.lead?.referenceNumber || null,
            createdAt: existing.createdAt.toISOString(),
            vehicle: snap?.vehicle ?? null,
            pricing: snap?.pricing ?? null
          }
        });
      } else {
        return reply.code(409).send({
          error: 'Conflict',
          message: 'Klucz idempotencji został już wykorzystany przez inne konto'
        });
      }
    }

    // Krok 2: Transakcja utworzenia zgłoszenia i powiązanego Leada z pętlą ponowień w razie kolizji reference_number
    const MAX_REF_RETRIES = 3;
    let createdInquiry: any = null;

    for (let attempt = 0; attempt < MAX_REF_RETRIES; attempt++) {
      try {
        createdInquiry = await fastify.prisma.$transaction(async (tx) => {
          // 1. Weryfikacja oferty
          const offer = await tx.employeeProgramOffer.findUnique({
            where: { id: body.offerId },
            include: {
              listing: true,
              benefitPolicy: true,
              program: {
                select: {
                  id: true,
                  name: true,
                  defaultDiscountPct: true,
                  company: { select: { id: true, name: true } }
                }
              }
            }
          });

          if (!offer || offer.programId !== employee.programId || !offer.isActive) {
            const notFoundErr: any = new Error('Oferta nie została znaleziona');
            notFoundErr.statusCode = 404;
            throw notFoundErr;
          }

          if (offer.sourceType === 'FINANCING') {
            if (!offer.listingId || !offer.listing) {
              const notFoundErr: any = new Error('Oferta nie została znaleziona');
              notFoundErr.statusCode = 404;
              throw notFoundErr;
            }
            if (offer.listing.isArchived) {
              const conflictErr: any = new Error('Ta oferta nie jest już dostępna');
              conflictErr.statusCode = 409;
              throw conflictErr;
            }
          }

          // 2. Weryfikacja dopuszczalnych stron umowy (Semantyka ANY / Suma z §3.4)
          const overrides = await tx.employeeProductOverride.findMany({
            where: { programId: employee.programId, isEnabled: true },
            select: { allowedContractParties: true }
          });

          if (overrides.length > 0) {
            const allowedParties = new Set(overrides.flatMap(o => o.allowedContractParties));
            if (!allowedParties.has(body.contractParty)) {
              const badRequestErr: any = new Error('Wybrana strona umowy nie jest dozwolona w tym programie');
              badRequestErr.statusCode = 400;
              throw badRequestErr;
            }
          }

          // 3. Obliczenie niezmiennego snapshotu na serwerze
          const listPrice = offer.sourceType === 'FINANCING' && offer.listing
            ? (offer.listing.pricePln ?? 0)
            : 0;

          const pricing = calculateOfferPricing(
            listPrice,
            offer.customPricePln,
            offer.discountPct,
            offer.program?.defaultDiscountPct
          );

          const vehicleSnapshot = offer.sourceType === 'FINANCING' && offer.listing ? {
            make: offer.listing.make,
            model: offer.listing.model,
            version: offer.listing.version ?? null,
            productionYear: offer.listing.productionYear,
            primaryImageUrl: offer.listing.primaryImageUrl ?? null
          } : {
            make: 'Nieznana marka',
            model: 'Nieznany model',
            version: null,
            productionYear: new Date().getFullYear(),
            primaryImageUrl: null
          };

          const calculationSnapshot: InquiryCalculationSnapshot = {
            offerId: offer.id,
            sourceType: offer.sourceType,
            vehicle: vehicleSnapshot,
            pricing
          };

          const benefitSnapshot = offer.benefitPolicy ? {
            name: offer.benefitPolicy.name,
            moyaCardAmount: offer.benefitPolicy.moyaCardAmount,
            fuelDiscount: offer.benefitPolicy.fuelDiscount,
            consultantCare: offer.benefitPolicy.consultantCare,
            termsText: offer.benefitPolicy.termsText
          } : null;

          // 4. Przygotowanie leada do CRM
          const referenceNumber = generateReference();
          const partyLabels: Record<string, string> = {
            CONSUMER: 'Osoba prywatna (Konsument)',
            EMPLOYEE_B2B: 'Działalność gospodarcza (B2B)',
            EMPLOYER_COMPANY: 'Firma pracodawcy'
          };
          const partyLabel = partyLabels[body.contractParty] || body.contractParty;
          const companyName = offer.program?.company?.name || 'Firma';
          const programName = offer.program?.name || 'Program pracowniczy';
          const nipText = body.contractParty !== 'CONSUMER' && body.nip ? `, NIP: ${body.nip}` : '';
          const notesText = body.notes ? ` Uwagi: ${body.notes}` : '';
          const leadMessage = `[Program: ${companyName} / ${programName}] Zapytanie o: ${vehicleSnapshot.make} ${vehicleSnapshot.model}${vehicleSnapshot.version ? ` ${vehicleSnapshot.version}` : ''} (${vehicleSnapshot.productionYear}). Strona umowy: ${partyLabel}${nipText}. Cena pracownicza: ${pricing.employeePricePln} zł (katalogowa: ${pricing.listPricePln} zł, rabat: ${pricing.discountPct}%).${notesText}`;

          const lead = await tx.lead.create({
            data: {
              name: body.contactName,
              email: body.contactEmail,
              phone: body.contactPhone,
              listingId: offer.listingId,
              leadType: 'employee',
              status: 'new',
              referenceNumber,
              message: leadMessage,
              consentPrivacyAt: new Date(),
              consentMarketingAt: null
            }
          });

          // 5. Utworzenie zgłoszenia pracownika
          const inquiry = await tx.employeeInquiry.create({
            data: {
              accountId: employee.accountId,
              companyId: employee.companyId,
              programId: employee.programId,
              contractParty: body.contractParty,
              productAvailabilityStatus: 'REQUIRES_CONFIRMATION',
              contactName: body.contactName,
              contactEmail: body.contactEmail,
              contactPhone: body.contactPhone,
              nip: body.contractParty !== 'CONSUMER' ? (body.nip || null) : null,
              notes: body.notes || null,
              calculationSnapshot: calculationSnapshot as any,
              benefitSnapshot: benefitSnapshot as any,
              idempotencyKey: body.idempotencyKey,
              leadId: lead.id,
              status: 'NEW'
            },
            include: {
              lead: {
                select: { referenceNumber: true }
              }
            }
          });

          return inquiry;
        });

        // Sukces transakcji
        break;
      } catch (err: any) {
        if (err?.code === 'P2002') {
          const target = Array.isArray(err.meta?.target)
            ? err.meta.target.join(',')
            : String(err.meta?.target || '');

          // Wyścig na kluczu idempotencji
          if (target.includes('idempotency_key') || target.includes('idempotencyKey')) {
            const raceInquiry = await fastify.prisma.employeeInquiry.findUnique({
              where: { idempotencyKey: body.idempotencyKey },
              include: {
                lead: { select: { referenceNumber: true } }
              }
            });

            if (raceInquiry) {
              if (raceInquiry.accountId === employee.accountId) {
                const snap = raceInquiry.calculationSnapshot as any;
                return reply.code(200).send({
                  inquiry: {
                    id: raceInquiry.id,
                    status: raceInquiry.status,
                    referenceNumber: raceInquiry.lead?.referenceNumber || null,
                    createdAt: raceInquiry.createdAt.toISOString(),
                    vehicle: snap?.vehicle ?? null,
                    pricing: snap?.pricing ?? null
                  }
                });
              } else {
                return reply.code(409).send({
                  error: 'Conflict',
                  message: 'Klucz idempotencji został już wykorzystany przez inne konto'
                });
              }
            }
          }

          // Kolizja znacznika czasu w reference_number
          if (target.includes('reference_number') || target.includes('referenceNumber')) {
            if (attempt < MAX_REF_RETRIES - 1) {
              await new Promise((resolve) => setTimeout(resolve, 2));
              continue;
            }
          }
        }

        throw err;
      }
    }

    if (!createdInquiry) {
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Nie udało się przetworzyć zgłoszenia'
      });
    }

    const snap = createdInquiry.calculationSnapshot as any;
    return reply.code(201).send({
      inquiry: {
        id: createdInquiry.id,
        status: createdInquiry.status,
        referenceNumber: createdInquiry.lead?.referenceNumber || null,
        createdAt: createdInquiry.createdAt.toISOString(),
        vehicle: snap?.vehicle ?? null,
        pricing: snap?.pricing ?? null
      }
    });
  });

  // 2. GET /api/employee/inquiries - Pobranie historii zgłoszeń zalogowanego pracownika
  fastify.get('/api/employee/inquiries', {
    preHandler: [verifyEmployeeAuth],
    config: {
      rateLimit: {
        max: 60,
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    const employee = (request as any).employee;
    const { limit, cursor } = getInquiriesQuerySchema.parse(request.query);

    const rawInquiries = await fastify.prisma.employeeInquiry.findMany({
      where: {
        accountId: employee.accountId
      },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' }
      ],
      include: {
        lead: {
          select: {
            referenceNumber: true
          }
        }
      }
    });

    const hasMore = rawInquiries.length > limit;
    const items = hasMore ? rawInquiries.slice(0, limit) : rawInquiries;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    const inquiries = items.map((inq) => {
      const snap = inq.calculationSnapshot as any;
      return {
        id: inq.id,
        status: inq.status,
        referenceNumber: inq.lead?.referenceNumber || null,
        contractParty: inq.contractParty,
        createdAt: inq.createdAt.toISOString(),
        contactName: inq.contactName,
        contactEmail: inq.contactEmail,
        contactPhone: inq.contactPhone,
        nip: inq.nip,
        notes: inq.notes,
        vehicle: snap?.vehicle ?? null,
        pricing: snap?.pricing ?? null,
        benefit: inq.benefitSnapshot
      };
    });

    return reply.send({
      inquiries,
      nextCursor
    });
  });
}
