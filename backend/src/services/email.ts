import nodemailer from 'nodemailer';
import { Lead, Listing, FinancingProduct, PrismaClient } from '@prisma/client';
import { FastifyInstance } from 'fastify';

export const sendLeadEmail = async (
    fastify: FastifyInstance,
    lead: Lead & { listing?: Listing | null, financingProduct?: FinancingProduct | null }
) => {
    // Get settings from database
    const settings = await fastify.prisma.appSettings.findFirst({
        where: { id: 'default' }
    });

    if (!settings?.smtpHost || !settings?.smtpPort || !settings?.smtpUser || !settings?.smtpPassword || !settings?.smtpRecipientEmail) {
        fastify.log.warn('Email configuration missing in AppSettings. Skipping email notification.');
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

    const isQuickContact = !lead.listingId;
    const isFinancingLead = !!lead.financingProductId;

    let subjectTitle = 'Nowy szybki kontakt';
    if (!isQuickContact) {
        subjectTitle = isFinancingLead ? 'Zgłoszenie finansowania auta' : 'Nowe zapytanie o auto';
    }

    const subject = isQuickContact
        ? `[CarSalon] ${subjectTitle} (Tel): ${lead.name}`
        : `[CarSalon] ${subjectTitle}: ${lead.listing?.make} ${lead.listing?.model}`;

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
        <p><a href="https://carsalon.pl/o/${lead.listing.slug || lead.listing.id}">Link do ogłoszenia (orientacyjny)</a></p>
    ` : '<p><strong>Typ zgłoszenia:</strong> Zapytanie ogólne / Szybki kontakt ze strony głównej</p>';

    const financingDetails = lead.financingProductId ? `
        <h3>Informacje o finansowaniu wybrane w kalkulatorze</h3>
        <ul>
            ${lead.financingProduct ? `<li><strong>Wybrany produkt:</strong> ${lead.financingProduct.name || lead.financingProduct.category} (Provider: ${lead.financingProduct.provider})</li>` : ''}
            <li><strong>Kwota finansowania:</strong> ${lead.financingAmount} PLN</li>
            <li><strong>Wpłata własna:</strong> ${lead.financingDownPayment} PLN</li>
            <li><strong>Miesięczna Rata:</strong> ${lead.financingInstallment} PLN</li>
            <li><strong>Deklarowany okres:</strong> ${lead.financingPeriod} mies.</li>
        </ul>
    ` : '';

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2>Nowe zapytanie od klienta: ${lead.name}</h2>
            
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
                Wiadomość wygenerowana automatycznie przez system CarSalon.<br/>
                Numer referencyjny leada: ${lead.referenceNumber}
            </p>
        </div>
    `;

    try {
        fastify.log.info({ host: settings.smtpHost, port: settings.smtpPort }, 'Attempting to send mail via SMTP...');
        await transporter.sendMail({
            from: `"CarSalon Powiadomienia" <${settings.smtpFromEmail || settings.smtpUser}>`,
            to: settings.smtpRecipientEmail,
            subject,
            html: htmlContent
        });
        fastify.log.info(`Email notification sent for lead ${lead.id} to ${settings.smtpRecipientEmail}`);
    } catch (error) {
        fastify.log.error(error, 'Failed to send email notification in email.ts');
    }
};
