import { FastifyInstance } from 'fastify';
import { sendLeadEmail } from '../services/email.js';
import { resolveScope } from '../utils/scope-resolver.js';
import fetch from 'node-fetch';

async function verifyTurnstile(token: string | undefined, ip: string, log: any): Promise<boolean> {
    const secretKey = process.env.TURNSTILE_SECRET_KEY || '1x00000000000000000000000000000000';

    if (!token) {
        if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
            log.warn('Turnstile: Token is missing in production/staging request.');
            return false;
        }
        log.info('Turnstile: Token missing in development, bypassing verification.');
        return true;
    }

    try {
        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                secret: secretKey,
                response: token,
                remoteip: ip
            }).toString()
        });

        const data = await response.json() as { success: boolean; 'error-codes'?: string[] };
        if (!data.success) {
            log.warn({ errorCodes: data['error-codes'] }, 'Turnstile: Verification failed.');
            return false;
        }

        log.info('Turnstile: Token verified successfully.');
        return true;
    } catch (error) {
        log.error(error, 'Turnstile: Error verifying token');
        return true; // Graceful fallback: do not lock out user if Cloudflare service is down
    }
}

const getBaseUrl = (request: any): string | undefined => {
    const referer = request.headers.referer || request.headers.origin;
    if (referer) {
        try {
            return new URL(referer).origin;
        } catch {
            // ignore
        }
    }
    return undefined;
};

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

interface NegotiationLeadPayload {
    listingId: string;
    name: string;
    email: string;
    phone?: string;
    preferredContact?: PreferredContact;
    message?: string;
    proposedPrice: number;
    consentMarketing?: boolean;
    consentPrivacy?: boolean;
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
    rentalInitialPaymentAmountNet?: number;
    rentalInitialPaymentAmountGross?: number;
    rentalMonthlyRate?: number;
}

const generateReference = () => {
    const timestamp = Date.now().toString();
    return `AF-${timestamp.slice(-8)}`;
};

export async function leadRoutes(fastify: FastifyInstance) {
    // Create new lead from public form (sale)
    fastify.post('/api/leads', async (request, reply) => {
        const data = request.body as LeadPayload & { turnstileToken?: string };

        const isTokenValid = await verifyTurnstile(data.turnstileToken, request.ip, fastify.log);
        if (!isTokenValid) {
            return reply.code(400).send({ error: 'Niezgodność zabezpieczenia antyspamowego. Spróbuj ponownie.' });
        }

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
        sendLeadEmail(fastify, lead as any, getBaseUrl(request)).catch((err: any) => {
            fastify.log.error(err, 'Error sending lead notification email');
        });

        return { lead };
    });

    // Create new negotiation lead from listing page
    fastify.post('/api/leads/negotiation', async (request, reply) => {
        const data = request.body as NegotiationLeadPayload & { turnstileToken?: string };

        const isTokenValid = await verifyTurnstile(data.turnstileToken, request.ip, fastify.log);
        if (!isTokenValid) {
            return reply.code(400).send({ error: 'Niezgodność zabezpieczenia antyspamowego. Spróbuj ponownie.' });
        }

        if (!data.listingId || !data.name || !data.email || !data.proposedPrice) {
            return reply.code(400).send({ error: 'listingId, name, email and proposedPrice are required' });
        }

        const listing = await fastify.prisma.listing.findUnique({
            where: { id: data.listingId },
            include: { dealer: true }
        });

        if (!listing) {
            return reply.code(404).send({ error: 'Listing not found' });
        }

        const listedPrice = listing.brokerPricePln || listing.pricePln || 0;
        
        let partnerGrossPrice = listedPrice; // Fallback, brak obu

        if (listing.pricePln && listing.dealerPriceNetPln) {
            // Dynamiczne wyliczenie VAT (w tym obsługa VAT Marża gdzie stosunek to ~1)
            const vatMultiplier = listing.pricePln / listing.dealerPriceNetPln;
            partnerGrossPrice = Math.round(listing.dealerPriceNetPln * vatMultiplier);
        } else if (listing.dealerPriceNetPln) {
            // Fallback: mamy tylko netto, zakładamy standardowe 23%
            partnerGrossPrice = Math.round(listing.dealerPriceNetPln * 1.23);
        } else if (listing.pricePln) {
            // Fallback: mamy tylko brutto dealera
            partnerGrossPrice = listing.pricePln;
        }
        const negotiationRoom = Math.max(0, listedPrice - partnerGrossPrice);
        const minSuggestedPrice = Math.round(listedPrice - (negotiationRoom * 0.8));
        const stretchPrice = Math.round(listedPrice - (negotiationRoom * 0.45));

        const proposedPrice = Math.round(data.proposedPrice);
        const normalizedMessage = (data.message || '').trim() || `Negocjacja ceny: ${proposedPrice} PLN`;
        const negotiationSummary = [
            `PROCES:NEGOCJACJA_CENY`,
            `CENA_OFERTOWA:${listedPrice}`,
            `CENA_PARTNER:${partnerGrossPrice}`,
            `CENA_ZAPROPONOWANA:${proposedPrice}`,
            `MARGINES_NEGOCJACJI:${negotiationRoom}`,
            normalizedMessage
        ].join('\n');

        const lead = await fastify.prisma.lead.create({
            data: {
                leadType: 'price_negotiation',
                listingId: data.listingId,
                name: data.name,
                email: data.email,
                phone: data.phone,
                preferredContact: data.preferredContact || 'email',
                message: negotiationSummary,
                status: 'negotiation_pending',
                referenceNumber: generateReference(),
                consentMarketingAt: data.consentMarketing ? new Date() : null,
                consentPrivacyAt: data.consentPrivacy ? new Date() : null,
            },
            include: {
                listing: {
                    include: { dealer: true }
                }
            }
        });

        sendLeadEmail(fastify, lead as any, getBaseUrl(request)).catch((err: any) => {
            fastify.log.error(err, 'Error sending negotiation lead notification email');
        });

        const autoReply = proposedPrice >= stretchPrice
            ? 'great_match'
            : proposedPrice >= minSuggestedPrice
                ? 'review_zone'
                : 'too_low';

        return {
            lead,
            negotiation: {
                listedPrice,
                partnerGrossPrice,
                proposedPrice,
                minSuggestedPrice,
                stretchPrice,
                autoReply
            }
        };
    });

    // Create new rental lead from calculator page
    fastify.post('/api/leads/rental', async (request, reply) => {
        const data = request.body as RentalLeadPayload & { turnstileToken?: string };

        const isTokenValid = await verifyTurnstile(data.turnstileToken, request.ip, fastify.log);
        if (!isTokenValid) {
            return reply.code(400).send({ error: 'Niezgodność zabezpieczenia antyspamowego. Spróbuj ponownie.' });
        }

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
                rentalInitialPaymentAmountNet: data.rentalInitialPaymentAmountNet,
                rentalInitialPaymentAmountGross: data.rentalInitialPaymentAmountGross,
                rentalMonthlyRate: data.rentalMonthlyRate,
            },
            include: {
                rentalVehicle: {
                    include: { dealer: true }
                }
            }
        });

        // Wyślij powiadomienie email
        sendLeadEmail(fastify, lead as any, getBaseUrl(request)).catch((err: any) => {
            fastify.log.error(err, 'Error sending rental lead notification email');
        });

        return { lead };
    });

    // Create new quick contact lead from CTA
    fastify.post('/api/leads/quick', async (request, reply) => {
        const body = request.body as any;
        const phone = body.phone;
        const name = body.name || 'Szybki Kontakt';

        const isTokenValid = await verifyTurnstile(body.turnstileToken, request.ip, fastify.log);
        if (!isTokenValid) {
            return reply.code(400).send({ error: 'Niezgodność zabezpieczenia antyspamowego. Spróbuj ponownie.' });
        }

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
        sendLeadEmail(fastify, lead as any, getBaseUrl(request)).catch((err: any) => {
            fastify.log.error(err, 'Error sending quick lead notification email');
        });

        return { success: true, lead };
    });

    // Get leads for backoffice (requires auth, scope-aware)
    fastify.get('/api/leads', {
        preHandler: [fastify.authenticate]
    }, async (request) => {
        const { leadType } = request.query as { leadType?: string };
        const scope = await resolveScope(fastify, request);

        const where: any = {};
        if (leadType) where.leadType = leadType;

        // Apply scope filtering via related listing/rentalVehicle dealerId
        if (!scope.isPlatform && scope.dealerFilter.dealerId) {
            const df = scope.dealerFilter.dealerId;
            where.OR = [
                { listing: { dealerId: df } },
                { rentalVehicle: { dealerId: df } },
                // quick_contact leads have no listing/rentalVehicle — only platform sees these
            ];
        }

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
