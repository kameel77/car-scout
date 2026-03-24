import { FastifyInstance } from 'fastify';
import { sendLeadEmail } from '../services/email.js';

type PreferredContact = 'email' | 'phone';

interface LeadPayload {
    listingId: string;
    name: string;
    email: string;
    phone?: string;
    preferredContact?: PreferredContact;
    message: string;
    consentMarketing?: boolean;
    consentPrivacy?: boolean;
    // Financing fields
    financingProductId?: string;
    financingAmount?: number;
    financingPeriod?: number;
    financingDownPayment?: number;
    financingInstallment?: number;
    financingFinalPayment?: number;
}

interface RentalLeadPayload {
    rentalVehicleId: string;
    name: string;
    email: string;
    phone?: string;
    preferredContact?: PreferredContact;
    message: string;
    consentMarketing?: boolean;
    consentPrivacy?: boolean;
    // Rental config from calculator
    rentalCompanyName?: string;
    rentalAnnualMileageKm?: number;
    rentalContractMonths?: number;
    rentalInitialPaymentPct?: number;
    rentalMonthlyRate?: number;
}

const generateReference = () => {
    const timestamp = Date.now().toString();
    return `AF-${timestamp.slice(-8)}`;
};

export async function leadRoutes(fastify: FastifyInstance) {
    // Create new lead from public form (sale)
    fastify.post('/api/leads', async (request, reply) => {
        const data = request.body as LeadPayload;

        if (!data.listingId || !data.name || !data.email || !data.message) {
            return reply.code(400).send({ error: 'listingId, name, email and message are required' });
        }

        const listing = await fastify.prisma.listing.findUnique({
            where: { id: data.listingId },
            include: { dealer: true }
        });

        if (!listing) {
            return reply.code(404).send({ error: 'Listing not found' });
        }

        const lead = await fastify.prisma.lead.create({
            data: {
                leadType: 'sale',
                listingId: data.listingId,
                name: data.name,
                email: data.email,
                phone: data.phone,
                preferredContact: data.preferredContact || 'email',
                message: data.message,
                status: 'new',
                referenceNumber: generateReference(),
                consentMarketingAt: data.consentMarketing ? new Date() : null,
                consentPrivacyAt: data.consentPrivacy ? new Date() : null,
                // Financing data
                financingProductId: data.financingProductId,
                financingAmount: data.financingAmount,
                financingPeriod: data.financingPeriod,
                financingDownPayment: data.financingDownPayment,
                financingInstallment: data.financingInstallment,
                financingFinalPayment: data.financingFinalPayment,
            },
            include: {
                listing: {
                    include: { dealer: true }
                },
                financingProduct: true
            }
        });

        // Wyślij powiadomienie email (nie blokując odpowiedzi API)
        sendLeadEmail(fastify, lead as any).catch((err: any) => {
            fastify.log.error(err, 'Error sending lead notification email');
        });

        return { lead };
    });

    // Create new rental lead from calculator page
    fastify.post('/api/leads/rental', async (request, reply) => {
        const data = request.body as RentalLeadPayload;

        if (!data.rentalVehicleId || !data.name || !data.email || !data.message) {
            return reply.code(400).send({ error: 'rentalVehicleId, name, email and message are required' });
        }

        const rentalVehicle = await fastify.prisma.rentalVehicle.findUnique({
            where: { id: data.rentalVehicleId },
            include: { dealer: true }
        });

        if (!rentalVehicle) {
            return reply.code(404).send({ error: 'Rental vehicle not found' });
        }

        const lead = await fastify.prisma.lead.create({
            data: {
                leadType: 'rental',
                rentalVehicleId: data.rentalVehicleId,
                name: data.name,
                email: data.email,
                phone: data.phone,
                preferredContact: data.preferredContact || 'email',
                message: data.message,
                status: 'new',
                referenceNumber: generateReference(),
                consentMarketingAt: data.consentMarketing ? new Date() : null,
                consentPrivacyAt: data.consentPrivacy ? new Date() : null,
                // Rental config
                rentalCompanyName: data.rentalCompanyName,
                rentalAnnualMileageKm: data.rentalAnnualMileageKm,
                rentalContractMonths: data.rentalContractMonths,
                rentalInitialPaymentPct: data.rentalInitialPaymentPct,
                rentalMonthlyRate: data.rentalMonthlyRate,
            },
            include: {
                rentalVehicle: {
                    include: { dealer: true }
                }
            }
        });

        // Wyślij powiadomienie email
        sendLeadEmail(fastify, lead as any).catch((err: any) => {
            fastify.log.error(err, 'Error sending rental lead notification email');
        });

        return { lead };
    });

    // Create new quick contact lead from CTA
    fastify.post('/api/leads/quick', async (request, reply) => {
        const body = request.body as any;
        const phone = body.phone;
        const name = body.name || 'Szybki Kontakt';

        if (!phone) {
            return reply.code(400).send({ error: 'phone is required' });
        }

        const lead = await fastify.prisma.lead.create({
            data: {
                leadType: 'quick_contact',
                name: name,
                email: 'brak@email.pl',
                phone: phone,
                preferredContact: 'phone',
                message: 'Prośba o szybki kontakt telefoniczny.',
                status: 'quick_contact',
                referenceNumber: generateReference(),
            }
        });

        // Wyślij powiadomienie email (nie blokując odpowiedzi API)
        sendLeadEmail(fastify, lead as any).catch((err: any) => {
            fastify.log.error(err, 'Error sending quick lead notification email');
        });

        return { success: true, lead };
    });

    // Get leads for backoffice (requires auth)
    fastify.get('/api/leads', {
        preHandler: [fastify.authenticate]
    }, async (request) => {
        const { leadType } = request.query as { leadType?: string };

        const where: any = {};
        if (leadType) where.leadType = leadType;

        const leads = await fastify.prisma.lead.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                listing: {
                    include: { dealer: true }
                },
                rentalVehicle: {
                    select: {
                        id: true,
                        make: true,
                        model: true,
                        version: true,
                        primaryImageUrl: true,
                        dealer: { select: { name: true, city: true } }
                    }
                }
            }
        });

        return { leads };
    });
}
