import nodemailer from 'nodemailer';
import { Lead, Listing, FinancingProduct, PrismaClient, RentalVehicle } from '@prisma/client';
import { FastifyInstance } from 'fastify';

export const sendLeadEmail = async (
    fastify: FastifyInstance,
    lead: Lead & { listing?: Listing | null, financingProduct?: FinancingProduct | null, rentalVehicle?: RentalVehicle | null },
    baseUrl?: string
) => {
    // Determine frontend URL dynamically
    let frontendUrl = baseUrl;
    if (!frontendUrl) {
        frontendUrl = process.env.FRONTEND_URL || 'https://carsalon.pl';
    }
    frontendUrl = frontendUrl.replace(/\/$/, '');

    // Derive site name for branding
    const domainName = frontendUrl.replace(/^https?:\/\/(www\.)?/, '');
    const siteName = domainName.toLowerCase().includes('motolia') ? 'Motolia' : 'CarSalon';

    // Get settings from database
    const settings = await fastify.prisma.appSettings.findFirst({
        where: { id: 'default' }
    });

    if (!settings) {
        fastify.log.warn('AppSettings not found. Skipping email notification.');
        return;
    }

    let recipientEmail = settings.smtpRecipientEmail;

    if (settings.leadRecipientUserId) {
        const designatedUser = await fastify.prisma.user.findUnique({
            where: { id: settings.leadRecipientUserId }
        });
        if (designatedUser && designatedUser.email) {
            recipientEmail = designatedUser.email;
            fastify.log.info({ leadRecipientUserId: settings.leadRecipientUserId, email: recipientEmail }, 'Using designated platform user for lead email notification');
        } else {
            fastify.log.warn({ leadRecipientUserId: settings.leadRecipientUserId }, 'Designated lead recipient user not found or has no email. Falling back to default SMTP recipient.');
        }
    }

    // Lead routing logic (Motolia vs Dealer)
    const dealerId = lead.listing?.dealerId || lead.rentalVehicle?.dealerId;
    if (dealerId) {
        const dealerSettings = await fastify.prisma.dealerSettings.findUnique({
            where: { dealerId }
        });
        
        if (dealerSettings?.leadRouting === 'DEALER') {
            const dealer = await fastify.prisma.dealer.findUnique({
                where: { id: dealerId },
                select: { contactEmail: true, contactEmailService: true }
            });
            
            const targetDealerEmail = dealerSettings.smtpRecipientEmail || dealer?.contactEmailService || dealer?.contactEmail;
            
            if (targetDealerEmail) {
                recipientEmail = targetDealerEmail;
                fastify.log.info({ dealerId, email: recipientEmail }, 'Lead routing set to DEALER. Routing lead to dealer email.');
            } else {
                fastify.log.warn({ dealerId }, 'Lead routing set to DEALER, but dealer has no contact email. Falling back to default.');
            }
        }
    }

    if (!settings.smtpHost || !settings.smtpPort || !settings.smtpUser || !settings.smtpPassword || !recipientEmail) {
        fastify.log.warn('Email SMTP or recipient configuration missing in AppSettings. Skipping email notification.');
        return;
    }

    const transporter = nodemailer.createTransport({
        host: settings.smtpHost,
        port: settings.smtpPort,
        secure: settings.smtpPort === 465, // true for 465, false for other ports
        auth: {
            user: settings.smtpUser,
            pass: settings.smtpPassword
        },
        connectionTimeout: 10000, // 10s
        socketTimeout: 15000,     // 15s
        greetingTimeout: 5000,    // 5s
        logger: true,
        debug: true
    });

    const isPriceNegotiation = lead.leadType === 'price_negotiation';
    const isQuickContact = !lead.listingId && !isPriceNegotiation;
    const isFinancingLead = !!lead.financingProductId;

    let subjectTitle = 'Nowy szybki kontakt';
    if (isPriceNegotiation) {
        subjectTitle = 'Negocjacja ceny pojazdu';
    } else if (!isQuickContact) {
        subjectTitle = isFinancingLead ? 'Zgłoszenie finansowania auta' : 'Nowe zapytanie o auto';
    }

    const subject = isQuickContact
        ? `[${siteName}] ${subjectTitle} (Tel): ${lead.name}`
        : `[${siteName}] ${subjectTitle}: ${lead.listing?.make} ${lead.listing?.model}`;

    const listingSlug = lead.listing?.slug || [
        lead.listing?.make,
        lead.listing?.model,
        lead.listing?.version,
        lead.listing?.productionYear,
        lead.listing?.bodyType,
        lead.listing?.fuelType,
        lead.listing?.listingId || lead.listing?.id
    ]
        .filter(Boolean)
        .map(s => String(s).toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-'))
        .join('-');

    const listingDetails = lead.listing ? `
        <h3>Szczegóły pojazdu</h3>
        <ul>
            <li><strong>Auto:</strong> ${lead.listing.make} ${lead.listing.model} ${lead.listing.version || ''}</li>
            <li><strong>Rocznik:</strong> ${lead.listing.productionYear}</li>
            <li><strong>VIN:</strong> ${lead.listing.vin || 'Brak'}</li>
            <li><strong>Cena (PLN):</strong> ${lead.listing.pricePln}</li>
            <li><strong>Przebieg:</strong> ${lead.listing.mileageKm} km</li>
            <li><strong>Dealer:</strong> ID: ${lead.listing.dealerId || 'Brak'}</li>
        </ul>
        <p><a href="${frontendUrl}/oferta/${listingSlug}">Link do ogłoszenia</a></p>
    ` : '<p><strong>Typ zgłoszenia:</strong> Zapytanie ogólne / Szybki kontakt ze strony głównej</p>';

    const financingDetails = lead.financingProductId ? `
        <h3>Informacje o finansowaniu wybrane w kalkulatorze</h3>
        <ul>
            ${lead.financingProduct ? `<li><strong>Wybrany produkt:</strong> ${lead.financingProduct.name || lead.financingProduct.category} (Provider: ${lead.financingProduct.provider})</li>` : ''}
            <li><strong>Kwota finansowania:</strong> ${lead.financingAmount} PLN</li>
            <li><strong>Deklarowany okres:</strong> ${lead.financingPeriod} mies.</li>
            <li><strong>Pierwsza wpłata:</strong> ${lead.financingDownPayment} PLN</li>
            <li><strong>Miesięczna Rata:</strong> ${lead.financingInstallment} PLN</li>
            <li><strong>Ostatnia Rata (Wykup):</strong> ${lead.financingFinalPayment} PLN</li>
        </ul>
    ` : '';

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2>${isPriceNegotiation ? 'Nowa propozycja negocjacji ceny' : 'Nowe zapytanie od klienta'}: ${lead.name}</h2>
            
            <h3>Dane kontaktowe</h3>
            <ul>
                <li><strong>Imię i nazwisko:</strong> ${lead.name}</li>
                <li><strong>Telefon:</strong> ${lead.phone || 'Brak'}</li>
                <li><strong>E-mail:</strong> ${lead.email || 'Brak'}</li>
                <li><strong>Preferowany kontakt:</strong> ${lead.preferredContact}</li>
            </ul>

            <h3>Wiadomość zostawiona przez klienta:</h3>
            <blockquote style="background-color: #f9f9f9; border-left: 4px solid #ccc; padding: 10px; margin: 10px 0;">
                ${lead.message || 'Brak wiadomości'}
            </blockquote>

            ${listingDetails}
            ${financingDetails}

            <br/>
            <p style="font-size: 12px; color: #999;">
                Wiadomość wygenerowana automatycznie przez system ${siteName}.<br/>
                Numer referencyjny leada: ${lead.referenceNumber}
            </p>
        </div>
    `;

    try {
        fastify.log.info({ host: settings.smtpHost, port: settings.smtpPort }, 'Attempting to send mail via SMTP...');
        await transporter.sendMail({
            from: `"${siteName} Powiadomienia" <${settings.smtpFromEmail || settings.smtpUser}>`,
            to: recipientEmail,
            replyTo: lead.email ? `"${lead.name}" <${lead.email}>` : undefined,
            subject,
            html: htmlContent
        });
        fastify.log.info(`Email notification sent for lead ${lead.id} to ${recipientEmail}`);
    } catch (error) {
        fastify.log.error(error, 'Failed to send email notification in email.ts');
    }
};
