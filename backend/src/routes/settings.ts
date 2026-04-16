import { FastifyInstance } from 'fastify';
import { authorizeRoles } from '../middleware/authorize.js';
import path from 'path';
import fs from 'fs/promises';

const LEGAL_LANGUAGES = ['pl', 'en', 'de'] as const;
const LEGAL_DOC_KEYS = ['imprint', 'privacyPolicy', 'terms', 'cookies'] as const;
type LegalDocKey = typeof LEGAL_DOC_KEYS[number];
type LegalDocumentsPayload = Partial<Record<LegalDocKey, Partial<Record<string, string>>>>;

type SettingsPayload = {
    enabledLanguages?: string[];
    displayCurrency?: string;
    eurExRate?: number | string;
    brokerFeePctPln?: number | string;
    brokerFeePctEur?: number | string;
    autoRefreshImages?: boolean;
    legalDocuments?: LegalDocumentsPayload;
    legalCompanyName?: string | null;
    legalAddress?: string | null;
    legalContactEmail?: string | null;
    legalContactPhone?: string | null;
    legalVatId?: string | null;
    legalRegisterNumber?: string | null;
    legalRepresentative?: string | null;
    headerLogoUrl?: string | null;
    headerLogoTextPl?: string | null;
    headerLogoTextEn?: string | null;
    headerLogoTextDe?: string | null;
    footerLogoUrl?: string | null;
    legalSloganPl?: string | null;
    legalSloganEn?: string | null;
    legalSloganDe?: string | null;

    siteNamePl?: string | null;
    siteNameEn?: string | null;
    siteNameDe?: string | null;

    financingCalculatorEnabled?: boolean;
    financingCalculatorLocation?: string;

    defaultOgTitle?: string | null;
    defaultOgDescription?: string | null;
    defaultOgImage?: string | null;

    smtpHost?: string | null;
    smtpPort?: number | string | null;
    smtpUser?: string | null;
    smtpPassword?: string | null;
    smtpFromEmail?: string | null;
    smtpRecipientEmail?: string | null;
    navItemsVisibility?: string[];
    negotiatePriceEnabled?: boolean;
};

const toNumberOrFallback = (value: unknown, fallback: number) => {
    const parsed = typeof value === 'string' ? parseFloat(value) : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const LOGO_DIR = path.resolve(process.cwd(), 'uploads', 'logos');
const ALLOWED_LOGO_EXT = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];

function normalizeLegalDocuments(raw: any): Record<LegalDocKey, Record<string, string>> {
    const safeDocs: Record<LegalDocKey, Record<string, string>> = {
        imprint: {},
        privacyPolicy: {},
        terms: {},
        cookies: {}
    };

    if (!raw || typeof raw !== 'object') {
        return safeDocs;
    }

    LEGAL_DOC_KEYS.forEach((key) => {
        const docEntry = (raw as LegalDocumentsPayload)?.[key] || {};
        const result: Record<string, string> = {};

        LEGAL_LANGUAGES.forEach((lang) => {
            const value = typeof (docEntry as Record<string, unknown>)?.[lang] === 'string'
                ? (docEntry as Record<string, string>)[lang].trim()
                : '';
            if (value) {
                result[lang] = value;
            }
        });

        safeDocs[key] = result;
    });

    return safeDocs;
}

async function recalculateAllPrices(fastify: FastifyInstance) {
    const settings = await fastify.prisma.appSettings.findUnique({
        where: { id: 'default' }
    });

    if (!settings) return 0;

    // Single SQL UPDATE for all non-archived listings — O(1) round-trip instead of N queries
    const result = await fastify.prisma.$executeRaw`
        UPDATE "Listing"
        SET
            "dealer_price_net_pln" = "price_pln" / 1.23,
            "dealer_price_net_eur" = "price_pln" / 1.23 / ${settings.eurExRate}::float,
            "broker_price_pln"     = ROUND(
                ("price_pln" / 1.23 * (1 + ${settings.brokerFeePctPln}::float / 100) * 1.23) / 10
            ) * 10,
            "broker_price_eur"     = CEIL(
                ("price_pln" / 1.23 / ${settings.eurExRate}::float * (1 + ${settings.brokerFeePctEur}::float / 100) * 1.23) / 10
            ) * 10
        WHERE "is_archived" = false
    `;

    return result;
}

export async function settingsRoutes(fastify: FastifyInstance) {
    // Get current settings
    fastify.get('/api/settings', async (request, reply) => {
        try {
            let settings = await fastify.prisma.appSettings.findUnique({
                where: { id: 'default' }
            });

            // If no settings exist yet, create default entry
            if (!settings) {
                fastify.log.info('Settings not found, creating default...');
                settings = await fastify.prisma.appSettings.create({
                    data: {
                        id: 'default',
                        legalDocuments: normalizeLegalDocuments({})
                    }
                });
            }

            return {
                ...settings,
                legalDocuments: normalizeLegalDocuments(settings.legalDocuments)
            };
        } catch (error) {
            fastify.log.error(error, 'Failed to get settings');
            return reply.code(500).send({
                error: 'Failed to fetch settings',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // Update settings
    fastify.post('/api/settings', {
        preHandler: [fastify.authenticate, authorizeRoles(['admin'])]
    }, async (request, reply) => {
        const data = request.body as SettingsPayload;

        try {
            const legalDocuments = normalizeLegalDocuments(data.legalDocuments || (data as any).legal_documents);
            const enabledLanguages = (data.enabledLanguages && data.enabledLanguages.length > 0)
                ? data.enabledLanguages
                : ['pl'];

            const eurExRate = toNumberOrFallback(data.eurExRate, 4.30);
            const brokerFeePctPln = toNumberOrFallback(data.brokerFeePctPln, 3.5);
            const brokerFeePctEur = toNumberOrFallback(data.brokerFeePctEur, 3.5);

            const settings = await fastify.prisma.appSettings.upsert({
                where: { id: 'default' },
                update: {
                    enabledLanguages,
                    displayCurrency: data.displayCurrency || 'PLN',
                    eurExRate,
                    brokerFeePctPln,
                    brokerFeePctEur,
                    autoRefreshImages: Boolean(data.autoRefreshImages),
                    legalDocuments,
                    legalCompanyName: data.legalCompanyName || null,
                    legalAddress: data.legalAddress || null,
                    legalContactEmail: data.legalContactEmail || null,
                    legalContactPhone: data.legalContactPhone || null,
                    legalVatId: data.legalVatId || null,
                    legalRegisterNumber: data.legalRegisterNumber || null,
                    legalRepresentative: data.legalRepresentative || null,
                    headerLogoUrl: data.headerLogoUrl || null,
                    headerLogoTextPl: data.headerLogoTextPl || null,
                    headerLogoTextEn: data.headerLogoTextEn || null,
                    headerLogoTextDe: data.headerLogoTextDe || null,
                    footerLogoUrl: data.footerLogoUrl || null,
                    legalSloganPl: data.legalSloganPl || null,
                    legalSloganEn: data.legalSloganEn || null,
                    legalSloganDe: data.legalSloganDe || null,
                    siteNamePl: data.siteNamePl || null,
                    siteNameEn: data.siteNameEn || null,
                    siteNameDe: data.siteNameDe || null,

                    financingCalculatorEnabled: data.financingCalculatorEnabled !== undefined
                        ? Boolean(data.financingCalculatorEnabled)
                        : undefined,
                    financingCalculatorLocation: data.financingCalculatorLocation,
                    defaultOgTitle: data.defaultOgTitle || null,
                    defaultOgDescription: data.defaultOgDescription || null,
                    defaultOgImage: data.defaultOgImage || null,

                    smtpHost: data.smtpHost || null,
                    smtpPort: data.smtpPort ? toNumberOrFallback(data.smtpPort, 465) : null,
                    smtpUser: data.smtpUser || null,
                    smtpPassword: data.smtpPassword || null,
                    smtpFromEmail: data.smtpFromEmail || null,
                    smtpRecipientEmail: data.smtpRecipientEmail || null,
                    navItemsVisibility: Array.isArray(data.navItemsVisibility)
                        ? data.navItemsVisibility
                        : ['samochody', 'wynajem'],
                    negotiatePriceEnabled: data.negotiatePriceEnabled !== undefined
                        ? Boolean(data.negotiatePriceEnabled)
                        : undefined,
                },
                create: {
                    id: 'default',
                    enabledLanguages,
                    displayCurrency: data.displayCurrency || 'PLN',
                    eurExRate,
                    brokerFeePctPln,
                    brokerFeePctEur,
                    autoRefreshImages: Boolean(data.autoRefreshImages),
                    legalDocuments,
                    legalCompanyName: data.legalCompanyName || null,
                    legalAddress: data.legalAddress || null,
                    legalContactEmail: data.legalContactEmail || null,
                    legalContactPhone: data.legalContactPhone || null,
                    legalVatId: data.legalVatId || null,
                    legalRegisterNumber: data.legalRegisterNumber || null,
                    legalRepresentative: data.legalRepresentative || null,
                    headerLogoUrl: data.headerLogoUrl || null,
                    headerLogoTextPl: data.headerLogoTextPl || null,
                    headerLogoTextEn: data.headerLogoTextEn || null,
                    headerLogoTextDe: data.headerLogoTextDe || null,
                    footerLogoUrl: data.footerLogoUrl || null,
                    legalSloganPl: data.legalSloganPl || null,
                    legalSloganEn: data.legalSloganEn || null,
                    legalSloganDe: data.legalSloganDe || null,
                    siteNamePl: data.siteNamePl || null,
                    siteNameEn: data.siteNameEn || null,
                    siteNameDe: data.siteNameDe || null,

                    financingCalculatorEnabled: data.financingCalculatorEnabled !== undefined
                        ? Boolean(data.financingCalculatorEnabled)
                        : true,
                    financingCalculatorLocation: data.financingCalculatorLocation || 'main',
                    defaultOgTitle: data.defaultOgTitle || null,
                    defaultOgDescription: data.defaultOgDescription || null,
                    defaultOgImage: data.defaultOgImage || null,

                    smtpHost: data.smtpHost || null,
                    smtpPort: data.smtpPort ? toNumberOrFallback(data.smtpPort, 465) : null,
                    smtpUser: data.smtpUser || null,
                    smtpPassword: data.smtpPassword || null,
                    smtpFromEmail: data.smtpFromEmail || null,
                    smtpRecipientEmail: data.smtpRecipientEmail || null,
                    navItemsVisibility: Array.isArray(data.navItemsVisibility)
                        ? data.navItemsVisibility
                        : ['samochody', 'wynajem'],
                    negotiatePriceEnabled: data.negotiatePriceEnabled !== undefined
                        ? Boolean(data.negotiatePriceEnabled)
                        : true,
                }
            });

            // AUTOMATIC RECALCULATION
            const updatedCount = await recalculateAllPrices(fastify);
            fastify.log.info({ updatedCount }, 'Automatic price recalculation triggered by settings change');

            return { ...settings, recalculatedCount: updatedCount };
        } catch (error) {
            fastify.log.error({ err: error }, 'Failed to update settings');
            return reply.code(500).send({ error: 'Failed to update settings', message: (error as Error).message });
        }
    });

    // Recalculate all listing prices based on current settings (Manual Trigger)
    fastify.post('/api/settings/recalculate', {
        preHandler: [fastify.authenticate, authorizeRoles(['admin'])]
    }, async (request, reply) => {
        const updatedCount = await recalculateAllPrices(fastify);

        return {
            success: true,
            updatedCount
        };
    });

    // Upload logo (header/footer)
    fastify.post('/api/settings/logo', {
        preHandler: [fastify.authenticate, authorizeRoles(['admin'])]
    }, async (request, reply) => {
        const file = await request.file();
        if (!file) {
            return reply.code(400).send({ error: 'File is required' });
        }

        const targetFieldRaw =
            typeof (file.fields as any)?.target === 'string'
                ? (file.fields as any).target
                : Array.isArray((file.fields as any)?.target)
                    ? (file.fields as any).target[0]
                    : (request.query as any)?.target;
        const target = targetFieldRaw === 'footer' ? 'footer' : 'header';

        const ext = path.extname(file.filename).toLowerCase();
        if (!ALLOWED_LOGO_EXT.includes(ext)) {
            return reply.code(400).send({ error: 'Invalid file type. Use png/jpg/svg/webp.' });
        }

        const buffer = await file.toBuffer();
        const mimeType = ext === '.svg' ? 'image/svg+xml'
            : ext === '.png' ? 'image/png'
                : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
                    : ext === '.webp' ? 'image/webp'
                        : 'image/png'; // fallback

        const base64 = buffer.toString('base64');
        const url = `data:${mimeType};base64,${base64}`;

        await fastify.prisma.appSettings.upsert({
            where: { id: 'default' },
            update: {
                [target === 'header' ? 'headerLogoUrl' : 'footerLogoUrl']: url
            },
            create: {
                id: 'default',
                enabledLanguages: ['pl'],
                displayCurrency: 'PLN',
                eurExRate: 4.3,
                brokerFeePctPln: 3.5,
                brokerFeePctEur: 3.5,
                autoRefreshImages: false,
                legalDocuments: normalizeLegalDocuments({}),
                headerLogoUrl: target === 'header' ? url : null,
                footerLogoUrl: target === 'footer' ? url : null
            }
        });

        return { url };
    });
}
