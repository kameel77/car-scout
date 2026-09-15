import nodemailer from 'nodemailer';
import { PrismaClient, ClientType } from '@prisma/client';

export interface RentalApplicationEmailParams {
  financierCode: string;
  recipients: string[];
  ccRecipients?: string[];
  clientType: ClientType;
  fullName?: string | null;
  companyName?: string | null;
  nip?: string | null;
  peselDecrypted?: string | null;
  email?: string | null;
  months: number;
  annualMileageKm: number;
  insuranceVariant: string;
  tiresIncluded: boolean;
  monthlyRateNet: number;
  stockNo: string;
  deliveryDateStr?: string | null;
  priceVariant: string;
}

export function buildRentalApplicationSubject(params: RentalApplicationEmailParams): string {
  if (params.clientType === ClientType.B2B && params.companyName) {
    const nipStr = params.nip ? ` NIP ${params.nip}` : '';
    return `FW: ${params.companyName}${nipStr}`;
  }
  const name = params.fullName || 'Klient';
  const peselStr = params.peselDecrypted ? ` Pesel ${params.peselDecrypted}` : '';
  return `FW: ${name}${peselStr}`;
}

export function buildRentalApplicationHtml(params: RentalApplicationEmailParams): string {
  const insuranceText =
    params.insuranceVariant === 'FULL_INSURANCE_1000'
      ? 'Pełne (udział 1000 PLN)'
      : params.insuranceVariant === 'FULL_INSURANCE_500'
      ? 'Pełne (udział 500 PLN)'
      : 'Brak / standard';

  const tiresText = params.tiresIncluded ? 'Tak (w cenie)' : 'Nie';
  const deliveryText = params.deliveryDateStr || 'Do potwierdzenia';
  const rateFormatted = `${params.monthlyRateNet.toFixed(2)} PLN`;
  const nipPeselLabel = params.clientType === ClientType.B2B ? 'NIP' : 'PESEL';
  const nipPeselValue =
    params.clientType === ClientType.B2B
      ? params.nip || '-'
      : params.peselDecrypted || '-';

  const variantLabel =
    params.priceVariant === 'COMFORT'
      ? 'Comfort (marża standardowa)'
      : params.priceVariant === 'BUSINESS'
      ? 'Business (marża standardowa)'
      : params.priceVariant;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #333; }
    table { width: 100%; max-width: 600px; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 10px 14px; text-align: left; border: 1px solid #e2e8f0; font-size: 14px; }
    th { background-color: #f8fafc; font-weight: 600; width: 40%; }
    td { background-color: #ffffff; }
    .header { font-size: 16px; font-weight: bold; margin-bottom: 12px; }
  </style>
</head>
<body>
  <div class="header">Wniosek o wynajem pojazdu - ${params.stockNo}</div>
  <p>Dzień dobry,</p>
  <p>Przesyłamy zgłoszenie wniosku o wynajem dla wskazanego pojazdu:</p>
  <table>
    <tr><th>Okres (miesiące)</th><td>${params.months}</td></tr>
    <tr><th>Przebieg roczny</th><td>${params.annualMileageKm.toLocaleString('pl-PL')} km</td></tr>
    <tr><th>Ubezpieczenie</th><td>${insuranceText}</td></tr>
    <tr><th>Opony</th><td>${tiresText}</td></tr>
    <tr><th>Rata całkowita netto</th><td><strong>${rateFormatted}</strong></td></tr>
    <tr><th>Numer stokowy</th><td>${params.stockNo}</td></tr>
    <tr><th>Termin dostawy pojazdu</th><td>${deliveryText}</td></tr>
    <tr><th>${nipPeselLabel}</th><td>${nipPeselValue}</td></tr>
    <tr><th>Adres mailowy</th><td>${params.email || '-'}</td></tr>
    <tr><th>Prowizja / Wariant</th><td>${variantLabel}</td></tr>
  </table>
  <p style="font-size: 12px; color: #64748b; margin-top: 8px;">* Wszystkie kwoty są kwotami netto, zgodnie z cennikiem partnera.</p>
  <p>Pozdrawiamy,<br>Zespół Car-Scout</p>
</body>
</html>
  `.trim();
}

export async function sendRentalApplicationEmail(
  prisma: PrismaClient,
  params: RentalApplicationEmailParams
): Promise<{ status: 'SENT' | 'FAILED'; error?: string }> {
  try {
    const settings = await prisma.appSettings.findFirst({
      where: { id: 'default' },
    });

    if (
      !settings ||
      !settings.smtpHost ||
      !settings.smtpPort ||
      !settings.smtpUser ||
      !settings.smtpPassword
    ) {
      return {
        status: 'FAILED',
        error: 'Brak konfiguracji SMTP w AppSettings',
      };
    }

    if (!params.recipients || params.recipients.length === 0) {
      return {
        status: 'FAILED',
        error: 'Brak odbiorców (applicationEmailTo) dla wskazanego finansującego',
      };
    }

    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpPort === 465,
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPassword,
      },
      connectionTimeout: 10000,
      socketTimeout: 15000,
    });

    const subject = buildRentalApplicationSubject(params);
    const html = buildRentalApplicationHtml(params);

    const fromAddress = settings.smtpFromEmail || settings.smtpUser;

    await transporter.sendMail({
      from: `"Car-Scout" <${fromAddress}>`,
      to: params.recipients.join(', '),
      cc: params.ccRecipients && params.ccRecipients.length > 0 ? params.ccRecipients.join(', ') : undefined,
      replyTo: params.email ? params.email.trim() : undefined,
      subject,
      html,
    });

    return { status: 'SENT' };
  } catch (err: any) {
    return {
      status: 'FAILED',
      error: err?.message || String(err),
    };
  }
}
