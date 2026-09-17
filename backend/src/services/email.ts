import nodemailer from 'nodemailer';
import { Lead, Listing, FinancingProduct, PrismaClient, RentalVehicle } from '@prisma/client';
import { FastifyInstance } from 'fastify';

export const resolveLeadRecipient = async (prisma: any): Promise<string | null> => {
    const settings = await prisma.appSettings.findFirst({
        where: { id: 'default' }
    });

    if (!settings) {
        return null;
    }

    let recipientEmail = settings.smtpRecipientEmail;

    if (settings.leadRecipientUserId) {
        const designatedUser = await prisma.user.findUnique({
            where: { id: settings.leadRecipientUserId }
        });
        if (designatedUser && designatedUser.email) {
            recipientEmail = designatedUser.email;
        }
    }

    return recipientEmail || null;
};

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

    let recipientEmail = await resolveLeadRecipient(fastify.prisma);

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
        logger: process.env.NODE_ENV !== 'production',
        debug: process.env.NODE_ENV !== 'production'
    });

    const isPriceNegotiation = lead.leadType === 'price_negotiation';
    const isWaitlist = lead.leadType === 'waitlist';
    const isRental = lead.leadType === 'rental' || !!lead.rentalVehicleId;
    const isQuickContact = lead.leadType === 'quick_contact' || (!lead.listingId && !lead.rentalVehicleId && !isPriceNegotiation && !isWaitlist);
    const isFinancingLead = !!lead.financingProductId || !!lead.financingAmount;

    // Name formatting: if empty, placeholder, or not provided, format as literal 'null'
    const rawName = lead.name ? lead.name.trim() : '';
    const isPlaceholderName = !rawName || rawName.toLowerCase() === 'szybki kontakt' || rawName.toLowerCase() === 'null' || rawName.toLowerCase() === 'brak' || rawName.toLowerCase() === 'undefined';
    const formattedName = isPlaceholderName ? 'null' : rawName;
    const safeFormattedName = formattedName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const cleanPhone = (lead.phone || '').replace(/[^0-9]/g, '');

    // Reply-To header: set ONLY if a real customer email address is provided.
    // Do NOT generate synthetic/fake email addresses, as Thulium would attempt to reply to them and bounce.
    let replyTo: string | undefined;
    if (lead.email && lead.email.trim()) {
        replyTo = formattedName !== 'null'
            ? `"${formattedName}" <${lead.email.trim()}>`
            : `<${lead.email.trim()}>`;
    }

    // Unique Subject creation (recommendation: [SiteName] [ReferenceNumber] Title: Entity/Phone)
    let subjectTitle = 'Szybki kontakt';
    let subjectEntity = lead.phone ? lead.phone : (formattedName !== 'null' ? formattedName : 'Nowe zgłoszenie');

    if (isPriceNegotiation) {
        subjectTitle = 'Negocjacja ceny';
        subjectEntity = lead.listing ? `${lead.listing.make} ${lead.listing.model}` : (lead.phone || (formattedName !== 'null' ? formattedName : 'Oferta'));
    } else if (isWaitlist) {
        subjectTitle = 'Lista oczekujących';
        subjectEntity = formattedName !== 'null' ? formattedName : (lead.phone || lead.email || 'Nowe zgłoszenie');
    } else if (isRental) {
        subjectTitle = 'Zapytanie o wynajem';
        subjectEntity = lead.rentalVehicle ? `${lead.rentalVehicle.make} ${lead.rentalVehicle.model}` : (lead.phone || (formattedName !== 'null' ? formattedName : 'Pojazd'));
    } else if (!isQuickContact) {
        if (isFinancingLead) {
            subjectTitle = 'Zgłoszenie finansowania auta';
            subjectEntity = lead.listing ? `${lead.listing.make} ${lead.listing.model}` : (lead.phone || (formattedName !== 'null' ? formattedName : 'Auto'));
        } else {
            subjectTitle = 'Nowe zapytanie o auto';
            subjectEntity = lead.listing ? `${lead.listing.make} ${lead.listing.model}` : (lead.phone || (formattedName !== 'null' ? formattedName : 'Auto'));
        }
    } else {
        subjectTitle = 'Szybki kontakt';
        subjectEntity = lead.phone ? lead.phone : (formattedName !== 'null' ? formattedName : 'Zgłoszenie');
    }

    const subject = `[${siteName}] [${lead.referenceNumber}] ${subjectTitle}: ${subjectEntity}`;

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

    const rentalSlug = lead.rentalVehicle?.slug || [
        lead.rentalVehicle?.make,
        lead.rentalVehicle?.model,
        lead.rentalVehicle?.modelCode,
        lead.rentalVehicle?.productionYear,
        lead.rentalVehicle?.id
    ]
        .filter(Boolean)
        .map(s => String(s).toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-'))
        .join('-');

    let leadTypeDescription = 'Zapytanie ogólne / Szybki kontakt';
    if (isPriceNegotiation) {
        leadTypeDescription = 'Negocjacja ceny pojazdu';
    } else if (isWaitlist) {
        leadTypeDescription = 'Lista oczekujących - powiadomienie o nowej ofercie';
    } else if (isRental) {
        leadTypeDescription = 'Wynajem długoterminowy';
    } else if (isFinancingLead) {
        leadTypeDescription = 'Finansowanie (Kalkulator)';
    } else if (lead.listing) {
        leadTypeDescription = 'Zapytanie o ofertę pojazdu';
    }

    const listingDetails = lead.listing ? `
        <h3>Szczegóły pojazdu</h3>
        <ul>
            <li><strong>Auto:</strong> ${lead.listing.make} ${lead.listing.model} ${lead.listing.version || ''}</li>
            <li><strong>Rocznik:</strong> ${lead.listing.productionYear}</li>
            <li><strong>VIN:</strong> ${lead.listing.vin || 'Brak'}</li>
            <li><strong>Cena (PLN):</strong> ${lead.listing.pricePln ? Number(lead.listing.pricePln).toLocaleString('pl-PL') : 'Brak'} zł</li>
            <li><strong>Przebieg:</strong> ${lead.listing.mileageKm ? Number(lead.listing.mileageKm).toLocaleString('pl-PL') : 0} km</li>
            <li><strong>Dealer:</strong> ID: ${lead.listing.dealerId || 'Brak'}</li>
        </ul>
        <p><a href="${frontendUrl}/oferta/${listingSlug}">Otwórz ofertę na stronie</a></p>
    ` : '';

    const rentalDetails = (lead.rentalVehicle || lead.rentalContractMonths || lead.rentalMonthlyRate) ? `
        <h3>Szczegóły wynajmu długoterminowego</h3>
        <ul>
            ${lead.rentalVehicle ? `<li><strong>Pojazd:</strong> ${lead.rentalVehicle.make} ${lead.rentalVehicle.model} ${lead.rentalVehicle.productionYear ? `(${lead.rentalVehicle.productionYear})` : ''}</li>` : ''}
            ${lead.rentalCompanyName ? `<li><strong>Firma / Nazwa:</strong> ${lead.rentalCompanyName}</li>` : ''}
            ${lead.rentalContractMonths ? `<li><strong>Okres umowy:</strong> ${lead.rentalContractMonths} mies.</li>` : ''}
            ${lead.rentalAnnualMileageKm ? `<li><strong>Roczny limit przebiegu:</strong> ${Number(lead.rentalAnnualMileageKm).toLocaleString('pl-PL')} km</li>` : ''}
            ${lead.rentalInitialPaymentAmountGross ? `<li><strong>Wpłata wstępna (brutto):</strong> ${Number(lead.rentalInitialPaymentAmountGross).toLocaleString('pl-PL')} PLN</li>` : ''}
            ${lead.rentalMonthlyRate ? `<li><strong>Miesięczna rata:</strong> ${Number(lead.rentalMonthlyRate).toLocaleString('pl-PL')} PLN</li>` : ''}
        </ul>
        ${lead.rentalVehicle ? `<p><a href="${frontendUrl}/wynajem/${rentalSlug}">Otwórz ofertę wynajmu na stronie</a></p>` : ''}
    ` : '';

    const financingDetails = (lead.financingProductId || lead.financingAmount) ? `
        <h3>Informacje o finansowaniu wybrane w kalkulatorze</h3>
        <ul>
            ${lead.financingProduct ? `<li><strong>Wybrany produkt:</strong> ${lead.financingProduct.name || lead.financingProduct.category} (Provider: ${lead.financingProduct.provider})</li>` : ''}
            ${lead.financingAmount ? `<li><strong>Kwota finansowania:</strong> ${Number(lead.financingAmount).toLocaleString('pl-PL')} PLN</li>` : ''}
            ${lead.financingPeriod ? `<li><strong>Deklarowany okres:</strong> ${lead.financingPeriod} mies.</li>` : ''}
            ${lead.financingDownPayment !== null && lead.financingDownPayment !== undefined ? `<li><strong>Pierwsza wpłata:</strong> ${Number(lead.financingDownPayment).toLocaleString('pl-PL')} PLN</li>` : ''}
            ${lead.financingInstallment ? `<li><strong>Miesięczna Rata:</strong> ${Number(lead.financingInstallment).toLocaleString('pl-PL')} PLN</li>` : ''}
            ${lead.financingFinalPayment !== null && lead.financingFinalPayment !== undefined ? `<li><strong>Ostatnia Rata (Wykup):</strong> ${Number(lead.financingFinalPayment).toLocaleString('pl-PL')} PLN</li>` : ''}
        </ul>
    ` : '';

    let headingTitle = 'Nowe zapytanie od klienta';
    if (isPriceNegotiation) {
        headingTitle = 'Nowa propozycja negocjacji ceny';
    } else if (isWaitlist) {
        headingTitle = 'Nowe zgłoszenie na listę oczekujących';
    } else if (isRental) {
        headingTitle = 'Nowe zapytanie o wynajem';
    } else if (isQuickContact) {
        headingTitle = 'Nowy szybki kontakt';
    } else if (isFinancingLead) {
        headingTitle = 'Nowe zgłoszenie finansowania';
    }

    const headingSubtitle = formattedName !== 'null'
        ? safeFormattedName
        : (lead.phone || lead.referenceNumber);

    const safeMessage = lead.message
        ? lead.message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')
        : 'Brak wiadomości';

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2>${headingTitle}: ${headingSubtitle}</h2>
            
            <h3>Dane kontaktowe</h3>
            <ul>
                <li><strong>Imię i nazwisko:</strong> ${safeFormattedName}</li>
                <li><strong>Telefon:</strong> ${lead.phone ? `<a href="tel:${cleanPhone}">${lead.phone}</a>` : 'null'}</li>
                <li><strong>E-mail:</strong> ${lead.email && lead.email.trim() ? `<a href="mailto:${lead.email.trim()}">${lead.email.trim()}</a>` : 'null'}</li>
                <li><strong>Preferowany kontakt:</strong> ${lead.preferredContact || (lead.phone ? 'phone' : 'email')}</li>
            </ul>

            <h3>Wiadomość zostawiona przez klienta:</h3>
            <blockquote style="background-color: #f9f9f9; border-left: 4px solid #007bff; padding: 10px; margin: 10px 0;">
                ${safeMessage}
            </blockquote>

            <h3>Kontekst zgłoszenia</h3>
            <ul>
                <li><strong>Typ zgłoszenia:</strong> ${leadTypeDescription}</li>
                <li><strong>Numer referencyjny:</strong> <code>${lead.referenceNumber}</code></li>
                ${lead.trafficSource ? `<li><strong>Źródło ruchu (Source/UTM):</strong> ${lead.trafficSource}</li>` : ''}
                ${lead.landingPageId ? `<li><strong>Landing Page ID:</strong> ${lead.landingPageId}</li>` : ''}
            </ul>

            ${listingDetails}
            ${rentalDetails}
            ${financingDetails}

            <br/>
            <p style="font-size: 12px; color: #999; margin-top: 24px; border-top: 1px solid #eee; padding-top: 12px;">
                Wiadomość wygenerowana automatycznie przez system ${siteName}.<br/>
                Numer referencyjny leada: ${lead.referenceNumber} | ID leada: ${lead.id}
            </p>
        </div>
    `;

    try {
        fastify.log.info({ host: settings.smtpHost, port: settings.smtpPort }, 'Attempting to send mail via SMTP...');
        await transporter.sendMail({
            from: `"${siteName} Powiadomienia" <${settings.smtpFromEmail || settings.smtpUser}>`,
            to: recipientEmail,
            replyTo,
            subject,
            html: htmlContent,
            headers: {
                'Auto-Submitted': 'auto-generated',
                'X-Auto-Response-Suppress': 'All'
            }
        });
        fastify.log.info(`Email notification sent for lead ${lead.id} to ${recipientEmail}`);
    } catch (error) {
        fastify.log.error(error, 'Failed to send email notification in email.ts');
    }
};

export const sendPasswordResetEmail = async (
    fastify: FastifyInstance,
    email: string,
    resetLink: string
) => {
    const settings = await fastify.prisma.appSettings.findFirst({
        where: { id: 'default' }
    });

    if (!settings || !settings.smtpHost || !settings.smtpPort || !settings.smtpUser || !settings.smtpPassword) {
        fastify.log.warn('Email SMTP configuration missing in AppSettings. Cannot send password reset email.');
        return;
    }

    const transporter = nodemailer.createTransport({
        host: settings.smtpHost,
        port: settings.smtpPort,
        secure: settings.smtpPort === 465,
        auth: {
            user: settings.smtpUser,
            pass: settings.smtpPassword
        },
        connectionTimeout: 10000,
        socketTimeout: 15000,
        greetingTimeout: 5000,
        logger: process.env.NODE_ENV !== 'production',
        debug: process.env.NODE_ENV !== 'production'
    });

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2>Resetowanie hasła</h2>
            <p>Otrzymaliśmy prośbę o zresetowanie hasła dla Twojego konta.</p>
            <p>Aby zresetować hasło, kliknij w poniższy link:</p>
            <p><a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: #fff; text-decoration: none; border-radius: 5px;">Zresetuj hasło</a></p>
            <p>Link jest ważny przez 1 godzinę. Jeśli to nie Ty prosiłeś o reset hasła, po prostu zignoruj tę wiadomość.</p>
        </div>
    `;

    try {
        await transporter.sendMail({
            from: `"Powiadomienia" <${settings.smtpFromEmail || settings.smtpUser}>`,
            to: email,
            subject: 'Resetowanie hasła',
            html: htmlContent
        });
        fastify.log.info(`Password reset email sent to ${email}`);
    } catch (error) {
        fastify.log.error(error, 'Failed to send password reset email');
    }
};

export const sendEmployeePasswordResetEmail = async (
    fastify: FastifyInstance,
    email: string,
    resetLink: string,
    brandName?: string
) => {
    const settings = await fastify.prisma.appSettings.findFirst({
        where: { id: 'default' }
    });

    if (!settings || !settings.smtpHost || !settings.smtpPort || !settings.smtpUser || !settings.smtpPassword) {
        fastify.log.warn('Email SMTP configuration missing in AppSettings. Cannot send employee password reset email.');
        return;
    }

    const brand = brandName || process.env.PORTAL_BRAND_NAME || 'Program Samochodowy by Motolia';

    const transporter = nodemailer.createTransport({
        host: settings.smtpHost,
        port: settings.smtpPort,
        secure: settings.smtpPort === 465,
        auth: {
            user: settings.smtpUser,
            pass: settings.smtpPassword
        },
        connectionTimeout: 10000,
        socketTimeout: 15000,
        greetingTimeout: 5000,
        logger: process.env.NODE_ENV !== 'production',
        debug: process.env.NODE_ENV !== 'production'
    });

    const safeBrand = brand.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeLink = resetLink.replace(/"/g, '&quot;');

    const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
            <div style="margin-bottom: 24px; border-bottom: 1px solid #f1f5f9; padding-bottom: 16px;">
                <h3 style="margin: 0; color: #0f172a; font-size: 18px; font-weight: 700;">${safeBrand}</h3>
            </div>
            <h2 style="color: #0f172a; font-size: 20px; font-weight: 700; margin-top: 0;">Resetowanie hasła do konta</h2>
            <p style="margin: 16px 0; color: #334155; font-size: 15px;">Otrzymaliśmy prośbę o zresetowanie hasła dla Twojego konta pracowniczego.</p>
            <p style="margin: 20px 0;">
                <a href="${safeLink}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">Ustaw nowe hasło</a>
            </p>
            <p style="margin: 16px 0; color: #475569; font-size: 14px;">
                Link jest ważny przez <strong>30 minut</strong>. Po zmianie hasła wszystkie aktywne sesje na innych urządzeniach zostaną automatycznie wylogowane.
            </p>
            <p style="margin: 16px 0; color: #64748b; font-size: 13px;">Jeśli to nie Ty prosiłeś o zmianę hasła, możesz zignorować tę wiadomość — Twoje dotychczasowe hasło pozostanie niezmienione.</p>
            <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8;">
                Ta wiadomość została wygenerowana automatycznie. Prosimy na nią nie odpowiadać.
            </div>
        </div>
    `;

    try {
        await transporter.sendMail({
            from: `"${safeBrand}" <${settings.smtpFromEmail || settings.smtpUser}>`,
            to: email,
            subject: `Resetowanie hasła - ${brand}`,
            html: htmlContent,
            headers: {
                'Auto-Submitted': 'auto-generated',
                'X-Auto-Response-Suppress': 'All'
            }
        });
        fastify.log.info('Employee password reset email sent successfully');
    } catch (error) {
        fastify.log.error(error, 'Failed to send employee password reset email');
    }
};

function escapeHtml(str: unknown): string {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatContractParty(party: string): string {
    switch (party) {
        case 'CONSUMER':
            return 'Osoba prywatna (Konsument)';
        case 'EMPLOYEE_B2B':
            return 'Działalność gospodarcza (B2B pracownika)';
        case 'EMPLOYER_COMPANY':
            return 'Firma pracodawcy (Finansowanie przez firmę)';
        default:
            return party;
    }
}

export const sendEmployeeInquiryNotificationEmail = async (
    fastify: FastifyInstance,
    inquiry: any,
    company: { id: string; name: string; accountManagerEmail?: string | null },
    recipientEmail: string,
    brandName?: string
): Promise<void> => {
    const settings = await fastify.prisma.appSettings.findFirst({
        where: { id: 'default' }
    });

    if (!settings || !settings.smtpHost || !settings.smtpPort || !settings.smtpUser || !settings.smtpPassword || !recipientEmail) {
        fastify.log.warn('Email SMTP or recipient configuration missing in AppSettings. Cannot send employee inquiry notification email.');
        return;
    }

    const brand = brandName || process.env.PORTAL_BRAND_NAME || 'Program Samochodowy by Motolia';
    const safeBrand = escapeHtml(brand);

    const transporter = nodemailer.createTransport({
        host: settings.smtpHost,
        port: settings.smtpPort,
        secure: settings.smtpPort === 465,
        auth: {
            user: settings.smtpUser,
            pass: settings.smtpPassword
        },
        connectionTimeout: 10000,
        socketTimeout: 15000,
        greetingTimeout: 5000,
        logger: process.env.NODE_ENV !== 'production',
        debug: process.env.NODE_ENV !== 'production'
    });

    const snap = inquiry.calculationSnapshot || {};
    const vehicle = snap.vehicle || {};
    const carTitle = [vehicle.make, vehicle.model, vehicle.version].filter(Boolean).join(' ') || 'Pojazd';
    const refNo = inquiry.lead?.referenceNumber || inquiry.id;

    const partyLabel = formatContractParty(inquiry.contractParty);

    let conditionsHtml = '';
    if (snap.sourceType === 'RENTAL') {
        const rate = snap.rental?.monthlyRateGross != null
            ? `${snap.rental.monthlyRateGross} zł brutto`
            : `${snap.rental?.monthlyRateNet ?? '-'} zł netto`;
        conditionsHtml = `
            <p style="margin: 0 0 4px 0;"><strong>Rata miesięczna:</strong> ${escapeHtml(rate)}</p>
            <p style="margin: 0 0 4px 0;"><strong>Okres umowy:</strong> ${escapeHtml(snap.rental?.periodMonths ?? '-')} msc</p>
            <p style="margin: 0 0 4px 0;"><strong>Roczny limit przebiegu:</strong> ${escapeHtml(snap.rental?.annualMileageKm ?? '-')} km</p>
            <p style="margin: 0 0 4px 0;"><strong>Opłata wstępna:</strong> ${escapeHtml(snap.rental?.initialPaymentAmountNet ?? 0)} zł netto</p>
        `;
    } else {
        conditionsHtml = `
            <p style="margin: 0 0 4px 0;"><strong>Cena katalogowa:</strong> ${escapeHtml(snap.pricing?.listPrice ?? '-')} zł</p>
            <p style="margin: 0 0 4px 0;"><strong>Cena dla pracownika:</strong> ${escapeHtml(snap.pricing?.finalPrice ?? '-')} zł (rabat: ${escapeHtml(snap.pricing?.discountPct ?? 0)}%)</p>
        `;
    }

    let benefitHtml = '';
    const benefit = inquiry.benefitSnapshot;
    if (benefit) {
        benefitHtml = `
            <div style="margin-top: 16px; padding: 12px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h4 style="margin: 0 0 8px 0; color: #0f172a; font-size: 14px;">Przyznane benefity pracownicze:</h4>
                <p style="margin: 0; font-size: 13px; color: #334155;">${escapeHtml(benefit.name)}</p>
                ${benefit.moyaCardAmount ? `<p style="margin: 4px 0 0 0; font-size: 13px; color: #334155;">Karta paliwowa Moya: <strong>${escapeHtml(benefit.moyaCardAmount)} zł</strong></p>` : ''}
                ${benefit.fuelDiscount ? `<p style="margin: 4px 0 0 0; font-size: 13px; color: #334155;">Rabat paliwowy: <strong>${escapeHtml(benefit.fuelDiscount)}</strong></p>` : ''}
            </div>
        `;
    }

    const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
            <div style="margin-bottom: 20px; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px;">
                <h3 style="margin: 0; color: #0f172a; font-size: 18px; font-weight: 700;">${safeBrand}</h3>
                <span style="font-size: 12px; color: #64748b;">Nowe zapytanie o pojazd - ${escapeHtml(company.name)}</span>
            </div>
            <h2 style="color: #0f172a; font-size: 18px; font-weight: 700; margin-top: 0;">Zapytanie nr ${escapeHtml(refNo)}</h2>
            
            <div style="margin: 16px 0; padding: 14px; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;">
                <p style="margin: 0 0 6px 0;"><strong>Organizacja:</strong> ${escapeHtml(company.name)}</p>
                <p style="margin: 0 0 6px 0;"><strong>Program:</strong> ${escapeHtml(inquiry.program?.name || 'Program Pracowniczy')}</p>
                <p style="margin: 0;"><strong>Strona umowy:</strong> ${escapeHtml(partyLabel)}</p>
                ${inquiry.nip ? `<p style="margin: 6px 0 0 0;"><strong>NIP firmy:</strong> ${escapeHtml(inquiry.nip)}</p>` : ''}
            </div>

            <div style="margin: 16px 0;">
                <h4 style="margin: 0 0 8px 0; color: #0f172a; font-size: 15px;">Wybrany pojazd i warunki:</h4>
                <p style="margin: 0 0 6px 0; font-size: 16px; font-weight: 600; color: #1e3a8a;">${escapeHtml(carTitle)} (${escapeHtml(vehicle.productionYear ?? '-')})</p>
                ${conditionsHtml}
                ${benefitHtml}
            </div>

            <div style="margin: 16px 0; padding: 14px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h4 style="margin: 0 0 8px 0; color: #0f172a; font-size: 14px;">Dane kontaktowe pracownika:</h4>
                <p style="margin: 0 0 4px 0;"><strong>Imię i nazwisko:</strong> ${escapeHtml(inquiry.contactName)}</p>
                <p style="margin: 0 0 4px 0;"><strong>E-mail:</strong> <a href="mailto:${escapeHtml(inquiry.contactEmail)}" style="color: #2563eb;">${escapeHtml(inquiry.contactEmail)}</a></p>
                <p style="margin: 0;"><strong>Telefon:</strong> <a href="tel:${escapeHtml(inquiry.contactPhone)}" style="color: #2563eb;">${escapeHtml(inquiry.contactPhone)}</a></p>
            </div>

            ${inquiry.notes ? `
                <div style="margin: 16px 0; padding: 12px; background-color: #f1f5f9; border-radius: 8px; font-size: 13px;">
                    <strong>Uwagi pracownika:</strong><br />
                    ${escapeHtml(inquiry.notes)}
                </div>
            ` : ''}

            <div style="margin-top: 24px; padding-top: 12px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8;">
                Wiadomość wygenerowana automatycznie przez platformę ${safeBrand}.
            </div>
        </div>
    `;

    try {
        await transporter.sendMail({
            from: `"${safeBrand}" <${settings.smtpFromEmail || settings.smtpUser}>`,
            to: recipientEmail,
            subject: `[Program Pracowniczy] Nowe zapytanie ${refNo} - ${company.name} - ${carTitle}`,
            html: htmlContent,
            headers: {
                'Auto-Submitted': 'auto-generated',
                'X-Auto-Response-Suppress': 'All'
            }
        });
        fastify.log.info({ refNo, recipientEmail }, 'Employee inquiry notification email sent successfully');
    } catch (error) {
        fastify.log.error(error, 'Failed to send employee inquiry notification email');
    }
};

export const sendEmployeeInquiryConfirmationEmail = async (
    fastify: FastifyInstance,
    inquiry: any,
    recipientEmail: string,
    brandName?: string
): Promise<void> => {
    const settings = await fastify.prisma.appSettings.findFirst({
        where: { id: 'default' }
    });

    if (!settings || !settings.smtpHost || !settings.smtpPort || !settings.smtpUser || !settings.smtpPassword || !recipientEmail) {
        fastify.log.warn('Email SMTP or recipient configuration missing in AppSettings. Cannot send employee inquiry confirmation email.');
        return;
    }

    const brand = brandName || process.env.PORTAL_BRAND_NAME || 'Program Samochodowy by Motolia';
    const safeBrand = escapeHtml(brand);

    const transporter = nodemailer.createTransport({
        host: settings.smtpHost,
        port: settings.smtpPort,
        secure: settings.smtpPort === 465,
        auth: {
            user: settings.smtpUser,
            pass: settings.smtpPassword
        },
        connectionTimeout: 10000,
        socketTimeout: 15000,
        greetingTimeout: 5000,
        logger: process.env.NODE_ENV !== 'production',
        debug: process.env.NODE_ENV !== 'production'
    });

    const snap = inquiry.calculationSnapshot || {};
    const vehicle = snap.vehicle || {};
    const carTitle = [vehicle.make, vehicle.model, vehicle.version].filter(Boolean).join(' ') || 'Pojazd';
    const refNo = inquiry.lead?.referenceNumber || inquiry.id;

    let priceSummary = '';
    if (snap.sourceType === 'RENTAL') {
        const rate = snap.rental?.monthlyRateGross != null
            ? `${snap.rental.monthlyRateGross} zł brutto`
            : `${snap.rental?.monthlyRateNet ?? '-'} zł netto`;
        priceSummary = `Szacowana rata: <strong>${escapeHtml(rate)}/mc</strong>`;
    } else if (snap.pricing?.finalPrice != null) {
        priceSummary = `Cena po rabacie pracowniczym: <strong>${escapeHtml(snap.pricing.finalPrice)} zł</strong>`;
    }

    const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
            <div style="margin-bottom: 20px; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px;">
                <h3 style="margin: 0; color: #0f172a; font-size: 18px; font-weight: 700;">${safeBrand}</h3>
            </div>
            <h2 style="color: #0f172a; font-size: 18px; font-weight: 700; margin-top: 0;">Potwierdzenie przyjęcia zapytania</h2>
            
            <p style="color: #334155; font-size: 14px;">
                Dziękujemy za złożenie zapytania w ramach Twojego firmowego programu samochodowego. Zgłoszenie zostało zarejestrowane pod numerem:
            </p>

            <div style="margin: 16px 0; padding: 14px; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; text-align: center;">
                <span style="font-size: 13px; color: #1e40af; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Numer zgłoszenia</span>
                <div style="font-size: 20px; font-weight: 800; color: #1d4ed8; margin-top: 4px;">${escapeHtml(refNo)}</div>
            </div>

            <div style="margin: 16px 0; padding: 14px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h4 style="margin: 0 0 6px 0; color: #0f172a; font-size: 14px;">Wybrany samochód:</h4>
                <p style="margin: 0 0 4px 0; font-size: 15px; font-weight: 600; color: #0f172a;">${escapeHtml(carTitle)}</p>
                ${priceSummary ? `<p style="margin: 0; font-size: 13px; color: #475569;">${priceSummary}</p>` : ''}
            </div>

            <div style="margin: 20px 0; font-size: 14px; color: #334155;">
                <h4 style="margin: 0 0 6px 0; color: #0f172a; font-size: 14px;">Co dalej?</h4>
                <p style="margin: 0;">
                    Dedykowany doradca programu skontaktuje się z Tobą telefonicznie lub mailowo w ciągu najbliższego dnia roboczego, aby przedstawić szczegółową kalkulację, odpowiedzieć na ewentualne pytania oraz przeprowadzić Cię przez proces zamówienia.
                </p>
            </div>

            <div style="margin-top: 28px; padding-top: 14px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8;">
                Wiadomość wygenerowana automatycznie. W razie pytań prosimy powoływać się na numer zgłoszenia: <strong>${escapeHtml(refNo)}</strong>.
            </div>
        </div>
    `;

    try {
        await transporter.sendMail({
            from: `"${safeBrand}" <${settings.smtpFromEmail || settings.smtpUser}>`,
            to: recipientEmail,
            subject: `Potwierdzenie zapytania ${refNo} - ${carTitle}`,
            html: htmlContent,
            headers: {
                'Auto-Submitted': 'auto-generated',
                'X-Auto-Response-Suppress': 'All'
            }
        });
        fastify.log.info({ refNo, recipientEmail }, 'Employee inquiry confirmation email sent successfully');
    } catch (error) {
        fastify.log.error(error, 'Failed to send employee inquiry confirmation email');
    }
};
