import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  ClientType,
  FinancingType,
  LeadSourceChannel,
  OpportunityStatus,
  PipelineActorType,
  PipelinePhase,
  ScopeType,
} from '@prisma/client';
import { requirePermission } from '../../../middleware/permissions.js';
import { getPipelineScope, getActorFromRequest } from './scope-helper.js';
import {
  validatePeselChecksum,
  maskPesel,
  encryptPesel,
  decryptPesel,
} from '../../../services/pesel-crypto.js';
import { calculateRentalQuote } from '../../../services/rental-quote.service.js';
import {
  sendRentalApplicationEmail,
  RentalApplicationEmailParams,
} from '../../../services/rental-application-email.js';
import { findCustomerMatch, findOrCreateCustomer } from '../services/customer.service.js';
import { createOpportunity } from '../services/opportunity.service.js';
import { addVehicleCandidate } from '../services/vehicle.service.js';
import { createOrUpdateOffer } from '../services/offer.service.js';
import { createApplication, submitApplication } from '../services/application.service.js';
import { recordEvent } from '../events/record-event.js';

// Schema for POST /api/pipeline/rental-applications
const createRentalApplicationSchema = z.object({
  // Customer data
  clientType: z.nativeEnum(ClientType),
  fullName: z.string().min(1, 'Imię i nazwisko jest wymagane').optional(),
  email: z.string().email('Nieprawidłowy adres email').optional().nullable(),
  phone: z.string().min(1, 'Telefon jest wymagany'),
  companyName: z.string().optional().nullable(),
  nip: z.string().optional().nullable(),
  pesel: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || /^\d{11}$/.test(val), {
      message: 'PESEL musi składać się dokładnie z 11 cyfr',
    }),

  // Vehicle & quote params
  stockNo: z.string().min(1, 'Numer stokowy jest wymagany'),
  months: z.number().int().positive('Okres musi być liczbą dodatnią'),
  annualMileageKm: z.number().int().positive('Przebieg roczny musi być liczbą dodatnią'),
  priceVariant: z.string().min(1, 'Wariant cenowy jest wymagany'),
  insuranceVariant: z.enum(['FULL_INSURANCE_1000', 'FULL_INSURANCE_500', 'NONE']),
  tiresIncluded: z.boolean(),

  // Optional financier override (defaults to "AYVENS")
  financierCode: z.string().default('AYVENS'),
});

export async function registerRentalApplicationRoutes(app: FastifyInstance) {
  // 1. POST /api/pipeline/rental-applications
  app.post(
    '/api/pipeline/rental-applications',
    {
      preHandler: [app.authenticate, requirePermission('pipeline:write')],
    },
    async (request, reply) => {
      const scope = getPipelineScope(request);
      const actor = getActorFromRequest(request);

      const body = createRentalApplicationSchema.parse(request.body);

      // Validate B2C vs B2B specific requirements
      if (body.clientType === ClientType.B2C) {
        if (!body.fullName) {
          return reply.code(400).send({
            error: 'Bad Request',
            message: 'Imię i nazwisko jest wymagane dla klienta indywidualnego (B2C)',
          });
        }
        if (!body.pesel) {
          return reply.code(400).send({
            error: 'Bad Request',
            message: 'PESEL jest wymagany dla klienta indywidualnego (B2C)',
          });
        }
      } else if (body.clientType === ClientType.B2B) {
        if (!body.companyName && !body.fullName) {
          return reply.code(400).send({
            error: 'Bad Request',
            message: 'Nazwa firmy lub imię i nazwisko osoby kontaktowej jest wymagane dla B2B',
          });
        }
        if (!body.nip) {
          return reply.code(400).send({
            error: 'Bad Request',
            message: 'NIP jest wymagany dla klienta biznesowego (B2B)',
          });
        }
      }

      // Checksum validation for PESEL (HTTP 422, never echo PESEL in error)
      let peselEnc: string | null = null;
      let peselMasked: string | null = null;
      let peselDecryptedForEmail: string | null = null;

      if (body.pesel) {
        if (!validatePeselChecksum(body.pesel)) {
          return reply.code(422).send({
            error: 'Unprocessable Entity',
            message: 'Nieprawidłowa suma kontrolna numeru PESEL',
          });
        }

        // Encryption check (Fail-closed: 503)
        try {
          peselEnc = encryptPesel(body.pesel);
          peselMasked = maskPesel(body.pesel);
          peselDecryptedForEmail = body.pesel;
        } catch (err: any) {
          request.log.error({ err }, 'PESEL encryption failure');
          return reply.code(503).send({
            error: 'Service Unavailable',
            message: 'Usługa szyfrowania danych wrażliwych jest chwilowo niedostępna',
          });
        }
      }

      // Check ambiguous customer match before transaction (HTTP 409)
      const matchPrecheck = await findCustomerMatch(app.prisma, {
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        nip: body.nip || undefined,
        email: body.email || undefined,
        phone: body.phone,
      });

      if (matchPrecheck.isAmbiguous) {
        return reply.code(409).send({
          error: 'Conflict',
          message: 'Znaleziono wielu klientów pasujących do podanych danych identyfikacyjnych',
          candidates: (matchPrecheck.candidates || []).map((c) => ({
            id: c.id,
            fullName: c.fullName,
            companyName: c.companyName,
            clientType: c.clientType,
          })),
        });
      }

      // DB Transaction
      let txResult: {
        opportunityId: string;
        opportunityNumber: string;
        applicationId: string;
        offerId: string;
        stockNo: string;
        monthlyRateNet: number;
        financierCode: string;
        recipients: string[];
        ccRecipients: string[];
        clientType: ClientType;
        fullName?: string | null;
        companyName?: string | null;
        nip?: string | null;
        email?: string | null;
        months: number;
        annualMileageKm: number;
        insuranceVariant: string;
        tiresIncluded: boolean;
        deliveryDateStr?: string | null;
        priceVariant: string;
      };

      try {
        txResult = await app.prisma.$transaction(async (tx) => {
          // 1. Resolve financier
          const financier = await tx.pipelineFinancier.findFirst({
            where: {
              code: body.financierCode,
              OR: [
                { scopeType: scope.scopeType, scopeId: scope.scopeId },
                { scopeType: ScopeType.PLATFORM, scopeId: 'PLATFORM' },
              ],
              isActive: true,
            },
          });

          if (!financier) {
            throw new Error(`Finansujący o kodzie ${body.financierCode} nie został znaleziony lub jest nieaktywny`);
          }

          // 2. Find or create customer
          const customerResult = await findOrCreateCustomer(tx, {
            scopeType: scope.scopeType,
            scopeId: scope.scopeId,
            clientType: body.clientType,
            fullName: body.fullName || (body.companyName ? body.companyName : 'Klient'),
            email: body.email || undefined,
            phone: body.phone,
            companyName: body.companyName || undefined,
            companyNip: body.nip || undefined,
            peselEnc: peselEnc || undefined,
            peselMasked: peselMasked || undefined,
          });

          if (customerResult.isAmbiguous) {
            throw new Error('AMBIGUOUS_CUSTOMER');
          }

          const customer = customerResult.customer;

          // 3. Create opportunity (in QUALIFICATION phase)
          const opportunity = await createOpportunity(tx, {
            scopeType: scope.scopeType,
            scopeId: scope.scopeId,
            customerId: customer.id,
            customerName: customer.fullName,
            customerPhone: customer.phone,
            customerEmail: customer.email,
            companyName: customer.companyName,
            companyNip: customer.companyNip,
            clientType: body.clientType,
            financingType: FinancingType.RENTAL,
            leadSource: LeadSourceChannel.OTHER,
            leadSourceDetail: 'Wniosek najmu (doradca)',
            initialPhase: PipelinePhase.QUALIFICATION,
            actor,
          });

          // 4. Quote valuation
          const insuranceMapped: '1000' | '500' | '0' =
            body.insuranceVariant === 'FULL_INSURANCE_1000'
              ? '1000'
              : body.insuranceVariant === 'FULL_INSURANCE_500'
              ? '500'
              : '0';

          const quote = await calculateRentalQuote(tx, {
            unitIdentifier: body.stockNo,
            months: body.months,
            annualKm: body.annualMileageKm,
            insurance: insuranceMapped,
            tires: body.tiresIncluded,
            variant: body.priceVariant,
          });

          const monthlyRateNet = quote.monthlyRateNet;
          const monthlyRateGrosze = Math.round(monthlyRateNet * 100);

          // 5. Add vehicle candidate
          const vehicleCandidate = await addVehicleCandidate(
            tx,
            scope,
            opportunity.id,
            {
              rentalVehicleId: quote.rentalVehicleId || undefined,
              rentalStockUnitId: quote.unit.id,
              customMake: quote.unit.make || undefined,
              customModel: quote.unit.model || undefined,
              customVersion: quote.unit.specNoNote || undefined,
              priceSnapshotGrosze: Math.round((quote.rentalVehicle?.catalogPrice || 0) * 100),
              selectionStatus: 'SELECTED',
            },
            actor
          );

          // 6. Create offer snapshot (frozen)
          const insuranceVariantInt =
            body.insuranceVariant === 'FULL_INSURANCE_1000'
              ? 1000
              : body.insuranceVariant === 'FULL_INSURANCE_500'
              ? 500
              : 0;

          const offer = await createOrUpdateOffer(
            tx,
            scope,
            opportunity.id,
            {
              financingType: FinancingType.RENTAL,
              priceGrosze: Math.round((quote.rentalVehicle?.catalogPrice || 0) * 100),
              monthlyRateGrosze,
              periodMonths: body.months,
              annualMileageKm: body.annualMileageKm,
              downPaymentGrosze: 0,
              rentalPriceVariant: body.priceVariant,
              rentalInsuranceVariant: insuranceVariantInt,
              rentalTiresIncluded: body.tiresIncluded,
            },
            actor
          );

          // 7. Create application in DRAFT
          const application = await createApplication(
            tx,
            scope,
            opportunity.id,
            {
              financierId: financier.id,
              offerId: offer.id,
            },
            actor
          );

          // 8. Submit application to PRECHECK_SUBMITTED
          const submittedApplication = await submitApplication(
            tx,
            scope,
            application.id,
            {
              stage: 'PRECHECK',
            },
            actor
          );

          return {
            opportunityId: opportunity.id,
            opportunityNumber: opportunity.number,
            applicationId: submittedApplication.id,
            offerId: offer.id,
            stockNo: quote.unit.stockNo,
            monthlyRateNet,
            financierCode: financier.code,
            recipients: financier.applicationEmailTo,
            ccRecipients: [
              ...(financier.applicationEmailCc || []),
              ...((request.user as any)?.email && !financier.applicationEmailCc?.includes((request.user as any)?.email)
                ? [(request.user as any).email]
                : []),
            ],
            clientType: body.clientType,
            fullName: customer.fullName,
            companyName: customer.companyName,
            nip: customer.companyNip,
            email: customer.email,
            months: body.months,
            annualMileageKm: body.annualMileageKm,
            insuranceVariant: body.insuranceVariant,
            tiresIncluded: body.tiresIncluded,
            deliveryDateStr: quote.unit.vehicleDeliveryDate
              ? quote.unit.vehicleDeliveryDate.toISOString().slice(0, 10)
              : null,
            priceVariant: body.priceVariant,
          };
        });
      } catch (txErr: any) {
        if (txErr.message === 'AMBIGUOUS_CUSTOMER') {
          return reply.code(409).send({
            error: 'Conflict',
            message: 'Znaleziono wielu klientów pasujących do podanych danych identyfikacyjnych',
          });
        }
        if (txErr.statusCode) {
          return reply.code(txErr.statusCode).send({
            error: txErr.name || 'RentalQuoteError',
            message: txErr.message,
            ...(txErr.details ? { details: txErr.details } : {}),
          });
        }
        if (txErr.message?.includes('nie został znaleziony')) {
          return reply.code(404).send({
            error: 'Not Found',
            message: txErr.message,
          });
        }
        request.log.error({ txErr }, 'Rental application transaction failed');
        return reply.code(400).send({
          error: 'Bad Request',
          message: txErr.message || 'Nie udało się złożyć wniosku o wynajem',
        });
      }

      // OUTSIDE DB TRANSACTION: Send email to partner
      let emailStatus: 'SENT' | 'FAILED' = 'FAILED';
      let emailError: string | undefined;

      try {
        const emailResult = await sendRentalApplicationEmail(app.prisma, {
          financierCode: txResult.financierCode,
          recipients: txResult.recipients,
          ccRecipients: txResult.ccRecipients,
          clientType: txResult.clientType,
          fullName: txResult.fullName,
          companyName: txResult.companyName,
          nip: txResult.nip,
          peselDecrypted: peselDecryptedForEmail,
          email: txResult.email,
          months: txResult.months,
          annualMileageKm: txResult.annualMileageKm,
          insuranceVariant: txResult.insuranceVariant,
          tiresIncluded: txResult.tiresIncluded,
          monthlyRateNet: txResult.monthlyRateNet,
          stockNo: txResult.stockNo,
          deliveryDateStr: txResult.deliveryDateStr,
          priceVariant: txResult.priceVariant,
        });

        emailStatus = emailResult.status;
        emailError = emailResult.error;
      } catch (sendErr: any) {
        request.log.error({ sendErr }, 'Failed to send rental application email');
        emailStatus = 'FAILED';
        emailError = sendErr?.message || String(sendErr);
      }

      // Log RENTAL_APPLICATION_EMAILED event in DB
      try {
        await app.prisma.$transaction(async (tx) => {
          await recordEvent(tx, {
            scopeType: scope.scopeType,
            scopeId: scope.scopeId,
            type: 'RENTAL_APPLICATION_EMAILED',
            aggregateType: 'APPLICATION',
            aggregateId: txResult.applicationId,
            opportunityId: txResult.opportunityId,
            actor,
            payload: {
              applicationId: txResult.applicationId,
              financierCode: txResult.financierCode,
              stockNo: txResult.stockNo,
              variant: txResult.priceVariant,
              monthlyRateNet: txResult.monthlyRateNet,
              recipients: txResult.recipients,
              status: emailStatus,
              error: emailError,
            },
          });
        });
      } catch (evtErr) {
        request.log.warn({ evtErr }, 'Failed to record RENTAL_APPLICATION_EMAILED event');
      }

      // Return HTTP 201 (email failure never changes HTTP 201 status or rolls back DB)
      return reply.code(201).send({
        opportunityId: txResult.opportunityId,
        opportunityNumber: txResult.opportunityNumber,
        applicationId: txResult.applicationId,
        offerId: txResult.offerId,
        stockNo: txResult.stockNo,
        monthlyRateNet: txResult.monthlyRateNet,
        emailStatus,
        caseUrl: `/admin/pipeline?opp=${txResult.opportunityId}`,
      });
    }
  );

  // 2. POST /api/pipeline/applications/:id/resend-email
  app.post(
    '/api/pipeline/applications/:id/resend-email',
    {
      preHandler: [app.authenticate, requirePermission('pipeline:write')],
    },
    async (request, reply) => {
      const scope = getPipelineScope(request);
      const actor = getActorFromRequest(request);
      const { id } = request.params as { id: string };

      const application = await app.prisma.pipelineApplication.findFirst({
        where: {
          id,
          opportunity: {
            scopeType: scope.scopeType,
            scopeId: scope.scopeId,
          },
        },
        include: {
          opportunity: {
            include: {
              customer: true,
              vehicleCandidates: {
                where: { selectionStatus: 'SELECTED' },
                include: { rentalStockUnit: true },
                take: 1,
              },
            },
          },
          offer: true,
          financier: true,
        },
      });

      if (!application) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Wniosek o podanym ID nie istnieje w Twoim kontekście',
        });
      }

      const offer = application.offer;
      if (!offer) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Wniosek nie posiada powiązanej oferty',
        });
      }

      const candidate = application.opportunity.vehicleCandidates[0];
      const stockNo = candidate?.rentalStockUnit?.stockNo || 'BRAK_STOKU';
      const deliveryDateStr = candidate?.rentalStockUnit?.vehicleDeliveryDate
        ? candidate.rentalStockUnit.vehicleDeliveryDate.toISOString().slice(0, 10)
        : null;

      const customer = application.opportunity.customer;
      let peselDecrypted: string | null = null;
      if (customer?.peselEnc) {
        try {
          peselDecrypted = decryptPesel(customer.peselEnc);
        } catch (err) {
          request.log.error({ err }, 'Failed to decrypt PESEL for email resend');
        }
      }

      const operatorEmail = (request.user as any)?.email;
      const ccRecipients = [
        ...(application.financier.applicationEmailCc || []),
        ...(operatorEmail && !application.financier.applicationEmailCc?.includes(operatorEmail)
          ? [operatorEmail]
          : []),
      ];

      const emailResult = await sendRentalApplicationEmail(app.prisma, {
        financierCode: application.financier.code,
        recipients: application.financier.applicationEmailTo,
        ccRecipients,
        clientType: application.opportunity.clientType,
        fullName: customer?.fullName,
        companyName: customer?.companyName,
        nip: customer?.companyNip,
        peselDecrypted,
        email: customer?.email,
        months: offer.periodMonths,
        annualMileageKm: offer.annualMileageKm || 20000,
        insuranceVariant:
          offer.rentalInsuranceVariant === 1000
            ? 'FULL_INSURANCE_1000'
            : offer.rentalInsuranceVariant === 500
            ? 'FULL_INSURANCE_500'
            : 'NONE',
        tiresIncluded: !!offer.rentalTiresIncluded,
        monthlyRateNet: offer.monthlyRateGrosze / 100,
        stockNo,
        deliveryDateStr,
        priceVariant: offer.rentalPriceVariant || 'COMFORT',
      });

      // Record event
      await app.prisma.$transaction(async (tx) => {
        await recordEvent(tx, {
          scopeType: scope.scopeType,
          scopeId: scope.scopeId,
          type: 'RENTAL_APPLICATION_EMAILED',
          aggregateType: 'APPLICATION',
          aggregateId: application.id,
          opportunityId: application.opportunityId,
          actor,
          payload: {
            applicationId: application.id,
            financierCode: application.financier.code,
            stockNo,
            variant: offer.rentalPriceVariant || 'COMFORT',
            monthlyRateNet: offer.monthlyRateGrosze / 100,
            recipients: application.financier.applicationEmailTo,
            status: emailResult.status,
            error: emailResult.error,
          },
        });
      });

      return reply.send({
        applicationId: application.id,
        emailStatus: emailResult.status,
        error: emailResult.error,
      });
    }
  );

  // 3. GET /api/pipeline/customers/:id/pii
  app.get(
    '/api/pipeline/customers/:id/pii',
    {
      preHandler: [app.authenticate, requirePermission('pipeline:pii:read')],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const customer = await app.prisma.pipelineCustomer.findUnique({
        where: { id },
      });

      if (!customer) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Klient nie został znaleziony',
        });
      }

      let peselDecrypted: string | null = null;
      if (customer.peselEnc) {
        try {
          peselDecrypted = decryptPesel(customer.peselEnc);
        } catch (err: any) {
          if (err?.statusCode === 503) {
            return reply.code(503).send({
              error: 'Service Unavailable',
              message: 'Brak klucza deszyfrowania danych wrażliwych',
            });
          }
          return reply.code(500).send({
            error: 'Internal Server Error',
            message: 'Błąd deszyfrowania danych',
          });
        }
      }

      return reply.send({
        customerId: customer.id,
        fullName: customer.fullName,
        pesel: peselDecrypted,
        peselMasked: customer.peselMasked,
      });
    }
  );
}
