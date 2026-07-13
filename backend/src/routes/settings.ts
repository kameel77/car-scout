import { FastifyInstance } from 'fastify';
import { authorizeRoles } from '../middleware/authorize.js';
import path from 'path';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import crypto from 'crypto';
import sharp from 'sharp';

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
    salesContactPhone?: string | null;
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

    pdfParserLlmModel?: string | null;
    pdfParserSystemPrompt?: string | null;

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
    leadRecipientUserId?: string | null;
    navItemsVisibility?: string[];
    featuredModulesVisibility?: string[];
    negotiatePriceEnabled?: boolean;
    csflowEnabled?: boolean;
    defaultSortCars?: string;
    defaultSortRental?: string;
    searchGridColumns?: number | string;
    splitNewUsed?: boolean;
    rentalCardsFirst?: boolean;
};

const toNumberOrFallback = (value: unknown, fallback: number) => {
    const parsed = typeof value === 'string' ? parseFloat(value) : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const LOGO_DIR = path.resolve(process.cwd(), 'uploads', 'logos');
const ALLOWED_LOGO_EXT = ['.png', '.jpg', '.jpeg', '.webp'];

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const LEGAL_URL_SLUGS: Record<LegalDocKey, string> = {
    imprint: 'impressum',
    privacyPolicy: 'polityka-prywatnosci',
    terms: 'regulamin',
    cookies: 'polityka-cookies',
};
const LEGAL_SLUG_SET = new Set(Object.values(LEGAL_URL_SLUGS));
const ALLOWED_PDF_MIME = ['application/pdf'];
const MAX_LEGAL_PDF_SIZE = 10 * 1024 * 1024;

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
        UPDATE "listings"
        SET
            "dealer_price_net_pln" = CASE WHEN "vat_margin" = true THEN "price_pln" ELSE "price_pln" / 1.23 END,
            "dealer_price_net_eur" = CASE WHEN "vat_margin" = true THEN "price_pln" / ${settings.eurExRate}::float ELSE "price_pln" / 1.23 / ${settings.eurExRate}::float END,
            "broker_price_pln"     = ROUND(
                ("price_pln" * (1 + ${settings.brokerFeePctPln}::float / 100)) / 10
            ) * 10,
            "broker_price_eur"     = CEIL(
                ("price_pln" / ${settings.eurExRate}::float * (1 + ${settings.brokerFeePctEur}::float / 100)) / 10
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
                smtpPassword: settings.smtpPassword ? '••••••••' : null,
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
            const oldSettings = await fastify.prisma.appSettings.findUnique({
                where: { id: 'default' }
            });

            const update: any = {};

            if (data.enabledLanguages !== undefined) {
                update.enabledLanguages = (data.enabledLanguages && data.enabledLanguages.length > 0)
                    ? data.enabledLanguages
                    : ['pl'];
            }
            if (data.displayCurrency !== undefined) {
                update.displayCurrency = data.displayCurrency || 'PLN';
            }
            if (data.eurExRate !== undefined) {
                update.eurExRate = toNumberOrFallback(data.eurExRate, 4.30);
            }
            if (data.brokerFeePctPln !== undefined) {
                update.brokerFeePctPln = toNumberOrFallback(data.brokerFeePctPln, 3.5);
            }
            if (data.brokerFeePctEur !== undefined) {
                update.brokerFeePctEur = toNumberOrFallback(data.brokerFeePctEur, 3.5);
            }
            if (data.autoRefreshImages !== undefined) {
                update.autoRefreshImages = Boolean(data.autoRefreshImages);
            }
            if (data.legalDocuments !== undefined || (data as any).legal_documents !== undefined) {
                update.legalDocuments = normalizeLegalDocuments(data.legalDocuments || (data as any).legal_documents);
            }
            if (data.legalCompanyName !== undefined) update.legalCompanyName = data.legalCompanyName || null;
            if (data.legalAddress !== undefined) update.legalAddress = data.legalAddress || null;
            if (data.legalContactEmail !== undefined) update.legalContactEmail = data.legalContactEmail || null;
            if (data.legalContactPhone !== undefined) update.legalContactPhone = data.legalContactPhone || null;
            if (data.salesContactPhone !== undefined) update.salesContactPhone = data.salesContactPhone || null;
            if (data.legalVatId !== undefined) update.legalVatId = data.legalVatId || null;
            if (data.legalRegisterNumber !== undefined) update.legalRegisterNumber = data.legalRegisterNumber || null;
            if (data.legalRepresentative !== undefined) update.legalRepresentative = data.legalRepresentative || null;
            if (data.headerLogoUrl !== undefined) update.headerLogoUrl = data.headerLogoUrl || null;
            if (data.headerLogoTextPl !== undefined) update.headerLogoTextPl = data.headerLogoTextPl || null;
            if (data.headerLogoTextEn !== undefined) update.headerLogoTextEn = data.headerLogoTextEn || null;
            if (data.headerLogoTextDe !== undefined) update.headerLogoTextDe = data.headerLogoTextDe || null;
            if (data.footerLogoUrl !== undefined) update.footerLogoUrl = data.footerLogoUrl || null;
            if (data.legalSloganPl !== undefined) update.legalSloganPl = data.legalSloganPl || null;
            if (data.legalSloganEn !== undefined) update.legalSloganEn = data.legalSloganEn || null;
            if (data.legalSloganDe !== undefined) update.legalSloganDe = data.legalSloganDe || null;
            if (data.siteNamePl !== undefined) update.siteNamePl = data.siteNamePl || null;
            if (data.siteNameEn !== undefined) update.siteNameEn = data.siteNameEn || null;
            if (data.siteNameDe !== undefined) update.siteNameDe = data.siteNameDe || null;

            if (data.financingCalculatorEnabled !== undefined) {
                update.financingCalculatorEnabled = Boolean(data.financingCalculatorEnabled);
            }
            if (data.financingCalculatorLocation !== undefined) {
                update.financingCalculatorLocation = data.financingCalculatorLocation;
            }
            if (data.defaultOgTitle !== undefined) update.defaultOgTitle = data.defaultOgTitle || null;
            if (data.defaultOgDescription !== undefined) update.defaultOgDescription = data.defaultOgDescription || null;
            if (data.defaultOgImage !== undefined) update.defaultOgImage = data.defaultOgImage || null;

            if (data.smtpHost !== undefined) update.smtpHost = data.smtpHost || null;
            if (data.smtpPort !== undefined) {
                update.smtpPort = data.smtpPort ? toNumberOrFallback(data.smtpPort, 465) : null;
            }
            if (data.smtpUser !== undefined) update.smtpUser = data.smtpUser || null;

            if (data.smtpPassword !== undefined) {
                let smtpPassword = oldSettings?.smtpPassword || null;
                if (data.smtpPassword === '') {
                    smtpPassword = null;
                } else if (data.smtpPassword && data.smtpPassword !== '••••••••') {
                    smtpPassword = data.smtpPassword;
                }
                update.smtpPassword = smtpPassword;
            }

            if (data.smtpFromEmail !== undefined) update.smtpFromEmail = data.smtpFromEmail || null;
            if (data.smtpRecipientEmail !== undefined) update.smtpRecipientEmail = data.smtpRecipientEmail || null;
            if (data.leadRecipientUserId !== undefined) update.leadRecipientUserId = data.leadRecipientUserId || null;

            if (data.navItemsVisibility !== undefined) {
                update.navItemsVisibility = Array.isArray(data.navItemsVisibility)
                    ? data.navItemsVisibility
                    : ['samochody', 'wynajem'];
            }
            if (data.featuredModulesVisibility !== undefined) {
                update.featuredModulesVisibility = Array.isArray(data.featuredModulesVisibility)
                    ? data.featuredModulesVisibility
                    : ['nowe', 'uzywane', 'wynajem'];
            }
            if (data.negotiatePriceEnabled !== undefined) {
                update.negotiatePriceEnabled = Boolean(data.negotiatePriceEnabled);
            }
            if (data.csflowEnabled !== undefined) {
                update.csflowEnabled = Boolean(data.csflowEnabled);
            }
            if (data.defaultSortCars !== undefined) {
                update.defaultSortCars = data.defaultSortCars || 'price_asc';
            }
            if (data.defaultSortRental !== undefined) {
                update.defaultSortRental = data.defaultSortRental || 'minMonthlyRateNet_asc';
            }
            if (data.searchGridColumns !== undefined) {
                update.searchGridColumns = toNumberOrFallback(data.searchGridColumns, 4);
            }
            if (data.splitNewUsed !== undefined) {
                update.splitNewUsed = Boolean(data.splitNewUsed);
            }
            if (data.rentalCardsFirst !== undefined) {
                update.rentalCardsFirst = Boolean(data.rentalCardsFirst);
            }
            if (data.pdfParserLlmModel !== undefined) {
                update.pdfParserLlmModel = data.pdfParserLlmModel || null;
            }
            if (data.pdfParserSystemPrompt !== undefined) {
                update.pdfParserSystemPrompt = data.pdfParserSystemPrompt || null;
            }

            // Fallback parsing for create block (standard upsert syntax)
            const legalDocuments = normalizeLegalDocuments(data.legalDocuments || (data as any).legal_documents);
            const enabledLanguages = (data.enabledLanguages && data.enabledLanguages.length > 0)
                ? data.enabledLanguages
                : ['pl'];
            const eurExRate = toNumberOrFallback(data.eurExRate, 4.30);
            const brokerFeePctPln = toNumberOrFallback(data.brokerFeePctPln, 3.5);
            const brokerFeePctEur = toNumberOrFallback(data.brokerFeePctEur, 3.5);
            let smtpPasswordCreate = oldSettings?.smtpPassword || null;
            if (data.smtpPassword === '') {
                smtpPasswordCreate = null;
            } else if (data.smtpPassword && data.smtpPassword !== '••••••••') {
                smtpPasswordCreate = data.smtpPassword;
            }

            const settings = await fastify.prisma.appSettings.upsert({
                where: { id: 'default' },
                update,
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
                    salesContactPhone: data.salesContactPhone || null,
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
                    pdfParserLlmModel: data.pdfParserLlmModel || undefined,
                    pdfParserSystemPrompt: data.pdfParserSystemPrompt || null,

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
                    smtpPassword: smtpPasswordCreate,
                    smtpFromEmail: data.smtpFromEmail || null,
                    smtpRecipientEmail: data.smtpRecipientEmail || null,
                    leadRecipientUserId: data.leadRecipientUserId || null,
                    navItemsVisibility: Array.isArray(data.navItemsVisibility)
                        ? data.navItemsVisibility
                        : ['samochody', 'wynajem'],
                    featuredModulesVisibility: Array.isArray(data.featuredModulesVisibility)
                        ? data.featuredModulesVisibility
                        : ['nowe', 'uzywane', 'wynajem'],
                    negotiatePriceEnabled: data.negotiatePriceEnabled !== undefined
                        ? Boolean(data.negotiatePriceEnabled)
                        : true,
                    csflowEnabled: data.csflowEnabled !== undefined
                        ? Boolean(data.csflowEnabled)
                        : true,
                    defaultSortCars: data.defaultSortCars || 'price_asc',
                    defaultSortRental: data.defaultSortRental || 'minMonthlyRateNet_asc',
                    searchGridColumns: data.searchGridColumns
                        ? toNumberOrFallback(data.searchGridColumns, 4)
                        : 4,
                    splitNewUsed: data.splitNewUsed !== undefined
                        ? Boolean(data.splitNewUsed)
                        : false,
                    rentalCardsFirst: data.rentalCardsFirst !== undefined
                        ? Boolean(data.rentalCardsFirst)
                        : true,
                }
            });

            if (oldSettings?.csflowEnabled === true && data.csflowEnabled === false) {
                fastify.log.info('CSFlow synchronization disabled automatically archiving existing CSFlow vehicles...');
                const archivedCount = await fastify.prisma.listing.updateMany({
                    where: { entrySource: 'CSFLOW', isArchived: false },
                    data: { isArchived: true, archivedAt: new Date(), archivedReason: 'csflow_disabled' }
                });
                fastify.log.info({ count: archivedCount.count }, 'Archived CSFlow vehicles because integration was disabled');
            }

            // AUTOMATIC RECALCULATION
            const updatedCount = await recalculateAllPrices(fastify);
            fastify.log.info({ updatedCount }, 'Automatic price recalculation triggered by settings change');

            return {
                ...settings,
                smtpPassword: settings.smtpPassword ? '••••••••' : null,
                recalculatedCount: updatedCount
            };
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
            return reply.code(400).send({ error: 'Invalid file type. Use png/jpg/webp.' });
        }

        const mimeType = 'image/webp';

        const buffer = await sharp(await file.toBuffer())
            .resize({ width: 800, withoutEnlargement: true }) // ograniczenie wielkości logotypu
            .webp({ quality: 90 }) // konwersja do lekkiego formatu
            .toBuffer();

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

    // Upload legal document PDF (imprint / privacyPolicy / terms / cookies × pl/en/de)
    fastify.post('/api/settings/legal-doc', {
        preHandler: [fastify.authenticate, authorizeRoles(['admin'])]
    }, async (request, reply) => {
        const parts = request.parts();
        let key: string | undefined;
        let lang: string | undefined;
        let savedPath: string | null = null;
        let savedFilename: string | null = null;
        let savedMime: string | null = null;

        // Buffer non-file parts so we can validate key/lang regardless of order,
        // and stream the file straight to disk under a temp name we rename once
        // we know where it should live.
        const tmpDir = path.join(UPLOADS_DIR, '_tmp_legal');
        await fs.mkdir(tmpDir, { recursive: true });

        for await (const part of parts) {
            if (part.type === 'file') {
                if (savedPath) {
                    // Only one file expected; drain extras
                    await part.file.resume?.();
                    continue;
                }
                savedMime = part.mimetype;
                const tmpName = `upload-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.pdf`;
                savedPath = path.join(tmpDir, tmpName);
                savedFilename = tmpName;
                await pipeline(part.file, createWriteStream(savedPath));
            } else {
                if (part.fieldname === 'key' && typeof part.value === 'string') key = part.value;
                if (part.fieldname === 'lang' && typeof part.value === 'string') lang = part.value;
            }
        }

        const cleanup = async () => {
            if (savedPath) {
                try { await fs.unlink(savedPath); } catch { /* ignore */ }
            }
        };

        if (!savedPath || !savedFilename) {
            return reply.code(400).send({ error: 'File is required' });
        }
        if (!key || !LEGAL_DOC_KEYS.includes(key as LegalDocKey)) {
            await cleanup();
            return reply.code(400).send({ error: `Invalid key. Use one of: ${LEGAL_DOC_KEYS.join(', ')}` });
        }
        if (!lang || !LEGAL_LANGUAGES.includes(lang as any)) {
            await cleanup();
            return reply.code(400).send({ error: `Invalid lang. Use one of: ${LEGAL_LANGUAGES.join(', ')}` });
        }
        if (!savedMime || !ALLOWED_PDF_MIME.includes(savedMime)) {
            await cleanup();
            return reply.code(400).send({ error: `Unsupported MIME: ${savedMime}. Only PDF allowed.` });
        }

        const stats = await fs.stat(savedPath);
        if (stats.size > MAX_LEGAL_PDF_SIZE) {
            await cleanup();
            return reply.code(413).send({ error: 'File too large (max 10MB)' });
        }

        const slug = LEGAL_URL_SLUGS[key as LegalDocKey];
        const docDir = path.join(UPLOADS_DIR, slug);
        await fs.mkdir(docDir, { recursive: true });
        const finalName = `${lang}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.pdf`;
        const finalPath = path.join(docDir, finalName);
        await fs.rename(savedPath, finalPath);

        const url = `/uploads/${slug}/${finalName}`;

        const current = await fastify.prisma.appSettings.findUnique({ where: { id: 'default' } });
        const currentDocs = normalizeLegalDocuments((current as any)?.legalDocuments);
        const previousUrl = currentDocs[key as LegalDocKey]?.[lang];

        currentDocs[key as LegalDocKey] = { ...currentDocs[key as LegalDocKey], [lang]: url };

        await fastify.prisma.appSettings.upsert({
            where: { id: 'default' },
            update: { legalDocuments: currentDocs },
            create: {
                id: 'default',
                enabledLanguages: ['pl'],
                displayCurrency: 'PLN',
                eurExRate: 4.3,
                brokerFeePctPln: 3.5,
                brokerFeePctEur: 3.5,
                autoRefreshImages: false,
                legalDocuments: currentDocs
            }
        });

        // Delete previous platform-hosted file (handles both legacy /uploads/legal/...
        // paths and new /uploads/<slug>/... paths). External URLs are skipped because
        // they don't start with "/uploads/".
        if (previousUrl && previousUrl.startsWith('/uploads/')) {
            const oldPath = path.join(process.cwd(), previousUrl.replace(/^\//, ''));
            try { await fs.unlink(oldPath); } catch { /* ignore */ }
        }

        return { url };
    });
}
