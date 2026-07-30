import { FastifyInstance } from 'fastify';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { authorizeRoles } from '../middleware/authorize.js';
import { optimizeAndSaveImage } from '../services/image-optimizer.js';
import { sanitizeListing } from '../constants/dealer.js';
import { calculateRatesWithInsurance } from './rental-public.js';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const LANDING_PAGES_DIR = path.join(UPLOADS_DIR, 'landing-pages');
const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;

const RESERVED_SLUGS = new Set([
  'admin', 'api', 'embed', 'login', 'samochody', 'wynajem-dlugoterminowy',
  'leasing', 'kredyt', 'oferta', 'dla-firmy', 'lead', 'negotiate', 'zapytanie', 'nowe', 'uzywane'
]);

function normalizeTheme(value: unknown): 'dark' | 'light' {
  return value === 'light' ? 'light' : 'dark';
}

function normalizeHeroPosition(value: unknown): 'before' | 'after' {
  return value === 'after' ? 'after' : 'before';
}

function normalizePhone(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 32);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((i: any) => typeof i === 'string' && i.trim()) : [];
}

function isValidSlug(slug: unknown): slug is string {
  if (typeof slug !== 'string') return false;
  const s = slug.trim().toLowerCase();
  if (!/^[a-z0-9-]{3,48}$/.test(s)) return false;
  if (RESERVED_SLUGS.has(s)) return false;
  return true;
}

const TERMS_DIR = path.join(LANDING_PAGES_DIR, 'terms');

function normalizeTermsLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 120);
}

export type LpSections = {
  callback?: { enabled: boolean; title?: string; description?: string };
  listings?: {
    enabled: boolean;
    title?: string;
    ctaEnabled?: boolean;
    ctaLabel?: string;
    ctaUrl?: string;
  };
  trustBar?: { enabled: boolean; items?: string[] };
  howItWorks?: { enabled: boolean; steps?: { title: string; text: string }[] };
  faq?: { enabled: boolean; items?: { q: string; a: string }[] };
  urgency?: { enabled: boolean; text?: string };
};

function sanitizeSections(input: any): LpSections | null {
  if (!input || typeof input !== 'object') return null;
  const allowedKeys = new Set(['callback', 'listings', 'trustBar', 'howItWorks', 'faq', 'urgency']);
  const cleaned: LpSections = {};

  for (const [key, val] of Object.entries(input)) {
    if (!allowedKeys.has(key) || !val || typeof val !== 'object') continue;
    const item = val as any;
    const enabled = Boolean(item.enabled);

    if (key === 'callback') {
      cleaned.callback = {
        enabled,
        title: typeof item.title === 'string' ? item.title.trim().slice(0, 200) : undefined,
        description: typeof item.description === 'string' ? item.description.trim().slice(0, 500) : undefined,
      };
    } else if (key === 'listings') {
      const rawCtaUrl = typeof item.ctaUrl === 'string' ? item.ctaUrl.trim() : undefined;
      let ctaUrl: string | undefined = undefined;
      if (rawCtaUrl) {
        if (/^\/[a-zA-Z0-9/_-]*$/.test(rawCtaUrl)) {
          ctaUrl = rawCtaUrl.slice(0, 200);
        } else {
          ctaUrl = '/samochody';
        }
      }
      cleaned.listings = {
        enabled,
        title: typeof item.title === 'string' ? item.title.trim().slice(0, 200) : undefined,
        ctaEnabled: typeof item.ctaEnabled === 'boolean' ? item.ctaEnabled : true,
        ctaLabel: typeof item.ctaLabel === 'string' ? item.ctaLabel.trim().slice(0, 100) : 'Sprawdź całą ofertę',
        ctaUrl: ctaUrl ?? '/samochody',
      };
    } else if (key === 'trustBar') {
      const items = Array.isArray(item.items)
        ? item.items
            .filter((i: any) => typeof i === 'string' && i.trim())
            .map((i: string) => i.trim().slice(0, 100))
            .slice(0, 4)
        : [];
      cleaned.trustBar = { enabled, items };
    } else if (key === 'howItWorks') {
      const steps = Array.isArray(item.steps)
        ? item.steps
            // Pusty tytuł = krok nieuzupełniony w panelu; nie może trafić na landing.
            .filter((s: any) => s && typeof s.title === 'string' && s.title.trim())
            .map((s: any) => ({
              title: String(s.title).trim().slice(0, 100),
              text: typeof s.text === 'string' ? s.text.trim().slice(0, 300) : '',
            }))
            .slice(0, 4)
        : [];
      cleaned.howItWorks = { enabled, steps };
    } else if (key === 'faq') {
      const items = Array.isArray(item.items)
        ? item.items
            // Panel pozwala dodać pusty wiersz FAQ — nie zapisujemy go.
            .filter((f: any) => f && typeof f.q === 'string' && f.q.trim() && typeof f.a === 'string' && f.a.trim())
            .map((f: any) => ({
              q: String(f.q).trim().slice(0, 200),
              a: String(f.a).trim().slice(0, 1000),
            }))
            .slice(0, 6)
        : [];
      cleaned.faq = { enabled, items };
    } else if (key === 'urgency') {
      cleaned.urgency = {
        enabled,
        text: typeof item.text === 'string' ? item.text.trim().slice(0, 300) : undefined,
      };
    }
  }

  return cleaned;
}

/**
 * Kopiuje wgrany plik obok oryginału i zwraca nowy URL. Zwraca null, gdy nie ma czego kopiować
 * lub gdy plik zniknął z dysku — duplikat ma powstać nawet bez grafiki.
 */
async function copyUploadedFile(
  sourceUrl: string | null,
  targetDir: string,
  urlPrefix: string
): Promise<string | null> {
  if (!sourceUrl?.startsWith(`${urlPrefix}/`)) return null;

  const sourcePath = path.join(process.cwd(), sourceUrl.replace(/^\//, ''));
  const extension = path.extname(sourceUrl) || '.bin';
  const filename = `copy-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${extension}`;

  try {
    await fs.mkdir(targetDir, { recursive: true });
    await fs.copyFile(sourcePath, path.join(targetDir, filename));
    return `${urlPrefix}/${filename}`;
  } catch {
    return null;
  }
}

async function unlinkLandingPageHeroImage(imageUrl: string | null) {
  if (!imageUrl?.startsWith('/uploads/landing-pages/')) return;
  const oldPath = path.join(process.cwd(), imageUrl.replace(/^\//, ''));
  const mediumPath = oldPath.replace('.webp', '-md.webp');
  const thumbPath = oldPath.replace('.webp', '-thumb.webp');
  try {
    await fs.unlink(oldPath);
    await fs.unlink(mediumPath).catch(() => {});
    await fs.unlink(thumbPath).catch(() => {});
  } catch { /* ignore */ }
}

async function unlinkLandingPageTermsFile(fileUrl: string | null) {
  if (!fileUrl?.startsWith('/uploads/landing-pages/terms/')) return;
  const oldPath = path.join(process.cwd(), fileUrl.replace(/^\//, ''));
  try {
    await fs.unlink(oldPath);
  } catch { /* ignore */ }
}

/**
 * Pojazdy wynajmu wybrane ręcznie dla landingu. Kształt odpowiedzi odpowiada
 * `/api/rental/vehicles`, żeby front mógł użyć istniejącego RentalListingCard.
 */
async function resolveRentalVehiclesForLandingPage(fastify: FastifyInstance, rentalVehicleIds: string[]) {
  if (!rentalVehicleIds || rentalVehicleIds.length === 0) return [];

  const vehicles = await fastify.prisma.rentalVehicle.findMany({
    where: { id: { in: rentalVehicleIds.slice(0, 50) }, isActive: true, isPublished: true },
    include: {
      rentalAssignments: {
        where: { isActive: true },
        include: {
          rentalCompany: {
            select: { id: true, name: true, slug: true, includedServices: true, insuranceAddMode: true },
          },
          matrixEntries: true,
        },
      },
    },
  });

  const mapped = vehicles.map((v: any) => {
    const rates = v.rentalAssignments.flatMap((a: any) =>
      a.matrixEntries.map((e: any) => ({
        ...calculateRatesWithInsurance(e, a),
        companyName: a.rentalCompany.name,
      }))
    );

    const minRate = rates.length > 0
      ? rates.reduce((best: any, current: any) =>
          current.monthlyRateGross < best.monthlyRateGross ? current : best
        )
      : null;

    return {
      ...v,
      minMonthlyRateGross: minRate ? Math.ceil(minRate.monthlyRateGross) : null,
      minMonthlyRateNet: minRate ? Math.ceil(minRate.monthlyRateNet) : null,
      minRateCompany: minRate?.companyName || null,
      minRateConfig: minRate
        ? {
            contractMonths: minRate.contractMonths,
            annualMileageKm: minRate.annualMileageKm,
            servicesIncluded: minRate.servicesIncluded,
          }
        : null,
      rentalCompanyCount: v.rentalAssignments.length,
      rentalAssignments: undefined,
    };
  });

  // Kolejność jak w panelu
  const map = new Map(mapped.map((v: any) => [v.id, v]));
  return rentalVehicleIds.map(id => map.get(id)).filter(Boolean);
}

async function resolveCarsForLandingPage(fastify: FastifyInstance, lp: {
  selectionMode: 'MANUAL' | 'FILTERED';
  listingIds: string[];
  filterParams: any;
  maxListings: number;
}) {
  if (lp.selectionMode === 'MANUAL') {
    if (!lp.listingIds || lp.listingIds.length === 0) return [];
    const limitedIds = lp.listingIds.slice(0, 50);
    const rawListings = await fastify.prisma.listing.findMany({
      where: { id: { in: limitedIds }, isArchived: false },
      include: { dealer: true, specification: true },
    });
    const map = new Map(rawListings.map(l => [l.id, l]));
    const ordered = lp.listingIds.map(id => map.get(id)).filter(Boolean) as typeof rawListings;
    return ordered.map(l => sanitizeListing(l, false));
  } else {
    const params = lp.filterParams || {};
    const where: any = { isArchived: false, pricePln: { gt: 0 } };

    if (params.bodyType && Array.isArray(params.bodyType) && params.bodyType.length > 0) {
      where.bodyType = { in: params.bodyType };
    } else if (typeof params.bodyType === 'string' && params.bodyType) {
      where.bodyType = params.bodyType;
    }

    if (params.brand && Array.isArray(params.brand) && params.brand.length > 0) {
      where.make = { in: params.brand, mode: 'insensitive' };
    } else if (typeof params.brand === 'string' && params.brand) {
      where.make = { equals: params.brand, mode: 'insensitive' };
    }

    if (params.model && Array.isArray(params.model) && params.model.length > 0) {
      where.model = { in: params.model, mode: 'insensitive' };
    } else if (typeof params.model === 'string' && params.model) {
      where.model = { equals: params.model, mode: 'insensitive' };
    }

    if (params.minPrice) where.pricePln.gte = Math.max(1, Number(params.minPrice));
    if (params.maxPrice) where.pricePln.lte = Number(params.maxPrice);
    if (params.minYear) where.productionYear = { gte: Number(params.minYear) };
    if (params.condition && (params.condition === 'NEW' || params.condition === 'USED')) {
      where.condition = params.condition;
    }
    if (params.fuelType && Array.isArray(params.fuelType) && params.fuelType.length > 0) {
      where.fuelType = { in: params.fuelType };
    }

    const limit = Math.min(48, Math.max(1, lp.maxListings || 12));
    const rawListings = await fastify.prisma.listing.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { dealer: true, specification: true },
    });
    return rawListings.map(l => sanitizeListing(l, false));
  }
}

export async function landingPageRoutes(fastify: FastifyInstance) {
  // Public Endpoint: GET /api/landing-pages/public/:slug
  fastify.get('/api/landing-pages/public/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const lp = await fastify.prisma.landingPage.findUnique({
      where: { slug },
    });

    if (!lp || !lp.isActive) {
      return reply.code(404).send({ error: 'Landing page not found' });
    }

    if (lp.validTo && lp.validTo < new Date()) {
      return reply.code(410).send({ error: 'Landing page expired' });
    }

    const listings = await resolveCarsForLandingPage(fastify, {
      selectionMode: lp.selectionMode as 'MANUAL' | 'FILTERED',
      listingIds: lp.listingIds,
      filterParams: lp.filterParams,
      maxListings: lp.maxListings,
    });

    const rentalVehicles = lp.selectionMode === 'MANUAL'
      ? await resolveRentalVehiclesForLandingPage(fastify, lp.rentalVehicleIds)
      : [];

    return {
      landingPage: {
        id: lp.id,
        slug: lp.slug,
        name: lp.name,
        audience: lp.audience,
        isActive: lp.isActive,
        isIndexable: lp.isIndexable,
        validFrom: lp.validFrom,
        validTo: lp.validTo,
        heroTitle: lp.heroTitle,
        heroSubtitle: lp.heroSubtitle,
        heroBadge: lp.heroBadge,
        heroImageUrl: lp.heroImageUrl,
        ctaLabel: lp.ctaLabel,
        theme: lp.theme,
        heroPosition: lp.heroPosition,
        contactPhone: lp.contactPhone,
        discount: lp.discount,
        initialPayment: lp.initialPayment,
        selectionMode: lp.selectionMode,
        sections: lp.sections,
        metaTitle: lp.metaTitle,
        metaDescription: lp.metaDescription,
        termsFileUrl: lp.termsFileUrl,
        termsLabel: lp.termsLabel,
        listings,
        rentalVehicles,
      },
    };
  });

  // Admin Endpoint: GET /api/landing-pages (list all LPs with 30-day leads count)
  fastify.get('/api/landing-pages', {
    preHandler: [fastify.authenticate, authorizeRoles(['admin'])],
  }, async () => {
    const pages = await fastify.prisma.landingPage.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            leads: true,
          },
        },
      },
    });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const leads30dCounts = await fastify.prisma.lead.groupBy({
      by: ['landingPageId'],
      where: {
        landingPageId: { in: pages.map(p => p.id) },
        createdAt: { gte: thirtyDaysAgo },
      },
      _count: { id: true },
    });

    const leads30dMap = new Map(leads30dCounts.map(c => [c.landingPageId, c._count.id]));

    return {
      landingPages: pages.map(p => ({
        ...p,
        leadsTotal: p._count.leads,
        leads30d: leads30dMap.get(p.id) || 0,
      })),
    };
  });

  // Admin Endpoint: GET /api/landing-pages/:id
  fastify.get('/api/landing-pages/:id', {
    preHandler: [fastify.authenticate, authorizeRoles(['admin'])],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const lp = await fastify.prisma.landingPage.findUnique({ where: { id } });
    if (!lp) return reply.code(404).send({ error: 'Landing page not found' });
    return { landingPage: lp };
  });

  // Admin Endpoint: POST /api/landing-pages
  fastify.post('/api/landing-pages', {
    preHandler: [fastify.authenticate, authorizeRoles(['admin'])],
  }, async (request, reply) => {
    const body = request.body as any;

    if (!isValidSlug(body.slug)) {
      return reply.code(400).send({ error: 'Invalid or reserved slug' });
    }
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return reply.code(400).send({ error: 'name is required' });
    }
    if (!body.heroTitle || typeof body.heroTitle !== 'string' || !body.heroTitle.trim()) {
      return reply.code(400).send({ error: 'heroTitle is required' });
    }

    const existing = await fastify.prisma.landingPage.findUnique({ where: { slug: body.slug.trim().toLowerCase() } });
    if (existing) {
      return reply.code(400).send({ error: 'Slug is already taken' });
    }

    const selectionMode = body.selectionMode === 'MANUAL' ? 'MANUAL' : 'FILTERED';
    const sanitizedSections = sanitizeSections(body.sections);

    const lp = await fastify.prisma.landingPage.create({
      data: {
        slug: body.slug.trim().toLowerCase(),
        name: body.name.trim(),
        audience: body.audience ? String(body.audience).trim() : null,
        isActive: body.isActive ?? true,
        isIndexable: body.isIndexable ?? false,
        validFrom: body.validFrom ? new Date(body.validFrom) : null,
        validTo: body.validTo ? new Date(body.validTo) : null,
        heroTitle: body.heroTitle.trim(),
        heroSubtitle: body.heroSubtitle ? String(body.heroSubtitle).trim() : null,
        heroBadge: body.heroBadge ? String(body.heroBadge).trim() : null,
        heroImageUrl: body.heroImageUrl ? String(body.heroImageUrl).trim() : null,
        ctaLabel: body.ctaLabel ? String(body.ctaLabel).trim() : 'Oddzwońcie do mnie',
        theme: normalizeTheme(body.theme),
        heroPosition: normalizeHeroPosition(body.heroPosition),
        contactPhone: normalizePhone(body.contactPhone),
        discount: typeof body.discount === 'number' ? Math.max(0, Math.round(body.discount)) : null,
        initialPayment: typeof body.initialPayment === 'number' ? Math.max(0, Math.round(body.initialPayment)) : null,
        selectionMode,
        listingIds: stringArray(body.listingIds),
        rentalVehicleIds: stringArray(body.rentalVehicleIds),
        filterParams: body.filterParams && typeof body.filterParams === 'object' ? body.filterParams : null,
        maxListings: typeof body.maxListings === 'number' ? Math.max(1, Math.min(48, body.maxListings)) : 12,
        sections: sanitizedSections ? (sanitizedSections as any) : undefined,
        metaTitle: body.metaTitle ? String(body.metaTitle).trim() : null,
        metaDescription: body.metaDescription ? String(body.metaDescription).trim() : null,
        termsLabel: normalizeTermsLabel(body.termsLabel),
      },
    });

    return { landingPage: lp };
  });

  // Admin Endpoint: PUT /api/landing-pages/:id
  fastify.put('/api/landing-pages/:id', {
    preHandler: [fastify.authenticate, authorizeRoles(['admin'])],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const existing = await fastify.prisma.landingPage.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'Landing page not found' });

    if (body.slug !== undefined && body.slug !== existing.slug) {
      if (!isValidSlug(body.slug)) {
        return reply.code(400).send({ error: 'Invalid or reserved slug' });
      }
      const slugTaken = await fastify.prisma.landingPage.findUnique({ where: { slug: body.slug.trim().toLowerCase() } });
      if (slugTaken) {
        return reply.code(400).send({ error: 'Slug is already taken' });
      }
    }

    const selectionMode = body.selectionMode ? (body.selectionMode === 'MANUAL' ? 'MANUAL' : 'FILTERED') : undefined;
    const sanitizedSections = body.sections !== undefined ? sanitizeSections(body.sections) : undefined;

    const updated = await fastify.prisma.landingPage.update({
      where: { id },
      data: {
        ...(body.slug !== undefined ? { slug: body.slug.trim().toLowerCase() } : {}),
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.audience !== undefined ? { audience: body.audience ? String(body.audience).trim() : null } : {}),
        ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
        ...(body.isIndexable !== undefined ? { isIndexable: Boolean(body.isIndexable) } : {}),
        ...(body.validFrom !== undefined ? { validFrom: body.validFrom ? new Date(body.validFrom) : null } : {}),
        ...(body.validTo !== undefined ? { validTo: body.validTo ? new Date(body.validTo) : null } : {}),
        ...(body.heroTitle !== undefined ? { heroTitle: body.heroTitle.trim() } : {}),
        ...(body.heroSubtitle !== undefined ? { heroSubtitle: body.heroSubtitle ? String(body.heroSubtitle).trim() : null } : {}),
        ...(body.heroBadge !== undefined ? { heroBadge: body.heroBadge ? String(body.heroBadge).trim() : null } : {}),
        ...(body.heroImageUrl !== undefined ? { heroImageUrl: body.heroImageUrl ? String(body.heroImageUrl).trim() : null } : {}),
        ...(body.ctaLabel !== undefined ? { ctaLabel: body.ctaLabel ? String(body.ctaLabel).trim() : 'Oddzwońcie do mnie' } : {}),
        ...(body.theme !== undefined ? { theme: normalizeTheme(body.theme) } : {}),
        ...(body.heroPosition !== undefined ? { heroPosition: normalizeHeroPosition(body.heroPosition) } : {}),
        ...(body.contactPhone !== undefined ? { contactPhone: normalizePhone(body.contactPhone) } : {}),
        ...(body.discount !== undefined ? { discount: typeof body.discount === 'number' ? Math.max(0, Math.round(body.discount)) : null } : {}),
        ...(body.initialPayment !== undefined ? { initialPayment: typeof body.initialPayment === 'number' ? Math.max(0, Math.round(body.initialPayment)) : null } : {}),
        ...(selectionMode ? { selectionMode } : {}),
        ...(Array.isArray(body.listingIds) ? { listingIds: stringArray(body.listingIds) } : {}),
        ...(Array.isArray(body.rentalVehicleIds) ? { rentalVehicleIds: stringArray(body.rentalVehicleIds) } : {}),
        ...(body.filterParams !== undefined ? { filterParams: body.filterParams } : {}),
        ...(typeof body.maxListings === 'number' ? { maxListings: Math.max(1, Math.min(48, body.maxListings)) } : {}),
        ...(sanitizedSections !== undefined ? { sections: sanitizedSections as any } : {}),
        ...(body.metaTitle !== undefined ? { metaTitle: body.metaTitle ? String(body.metaTitle).trim() : null } : {}),
        ...(body.metaDescription !== undefined ? { metaDescription: body.metaDescription ? String(body.metaDescription).trim() : null } : {}),
        ...(body.termsLabel !== undefined ? { termsLabel: normalizeTermsLabel(body.termsLabel) } : {}),
      },
    });

    return { landingPage: updated };
  });

  // Admin Endpoint: DELETE /api/landing-pages/:id
  fastify.delete('/api/landing-pages/:id', {
    preHandler: [fastify.authenticate, authorizeRoles(['admin'])],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const lp = await fastify.prisma.landingPage.findUnique({ where: { id } });
    if (!lp) return reply.code(404).send({ error: 'Landing page not found' });
    await unlinkLandingPageHeroImage(lp.heroImageUrl);
    await unlinkLandingPageTermsFile(lp.termsFileUrl);
    await fastify.prisma.landingPage.delete({ where: { id } });
    return { success: true };
  });

  // Admin Endpoint: POST /api/landing-pages/:id/duplicate
  // Kopiuje też pliki na dysku — inaczej usunięcie oryginału zabrałoby kopii obraz i regulamin.
  fastify.post('/api/landing-pages/:id/duplicate', {
    preHandler: [fastify.authenticate, authorizeRoles(['admin'])],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const source = await fastify.prisma.landingPage.findUnique({ where: { id } });
    if (!source) return reply.code(404).send({ error: 'Landing page nie istnieje' });

    // Wolny slug: <slug>-kopia, -kopia-2, -kopia-3...
    let slug = `${source.slug}-kopia`.slice(0, 48);
    for (let i = 2; await fastify.prisma.landingPage.findUnique({ where: { slug } }); i++) {
      slug = `${source.slug}-kopia-${i}`.slice(0, 48);
      if (i > 50) return reply.code(409).send({ error: 'Nie udało się wygenerować wolnego slug-a' });
    }

    const heroImageUrl = await copyUploadedFile(source.heroImageUrl, LANDING_PAGES_DIR, '/uploads/landing-pages');
    const termsFileUrl = await copyUploadedFile(source.termsFileUrl, TERMS_DIR, '/uploads/landing-pages/terms');

    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = source;

    const duplicate = await fastify.prisma.landingPage.create({
      data: {
        ...rest,
        slug,
        name: `${source.name} (kopia)`.slice(0, 200),
        // Kopia startuje wyłączona, żeby publiczny URL nie ożył przed sprawdzeniem treści.
        isActive: false,
        heroImageUrl,
        termsFileUrl,
        sections: (source.sections ?? undefined) as any,
        filterParams: (source.filterParams ?? undefined) as any,
      },
    });

    return { landingPage: duplicate };
  });

  // Admin Endpoint: DELETE /api/landing-pages/:id/hero-image
  fastify.delete('/api/landing-pages/:id/hero-image', {
    preHandler: [fastify.authenticate, authorizeRoles(['admin'])],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const lp = await fastify.prisma.landingPage.findUnique({ where: { id } });
    if (!lp) return reply.code(404).send({ error: 'Landing page nie istnieje' });

    if (lp.heroImageUrl) {
      await unlinkLandingPageHeroImage(lp.heroImageUrl);
      await fastify.prisma.landingPage.update({
        where: { id },
        data: { heroImageUrl: null },
      });
    }

    return { success: true, heroImageUrl: null };
  });

  // Admin Endpoint: POST /api/landing-pages/:id/hero-image
  fastify.post('/api/landing-pages/:id/hero-image', {
    preHandler: [fastify.authenticate, authorizeRoles(['admin'])],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const lp = await fastify.prisma.landingPage.findUnique({ where: { id } });
    if (!lp) return reply.code(404).send({ error: 'Landing page not found' });

    const file = await request.file();
    if (!file) return reply.code(400).send({ error: 'File is required' });
    if (!ALLOWED_IMAGE_MIME.includes(file.mimetype)) {
      return reply.code(400).send({ error: `Unsupported MIME: ${file.mimetype}` });
    }

    await fs.mkdir(LANDING_PAGES_DIR, { recursive: true });
    const buffer = await file.toBuffer();
    if (buffer.length > MAX_IMAGE_SIZE) {
      return reply.code(413).send({ error: 'File too large (max 8MB)' });
    }

    const baseFilename = `${id}-hero-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const { largeFilename } = await optimizeAndSaveImage(buffer, { targetDir: LANDING_PAGES_DIR, baseFilename });
    const url = `/uploads/landing-pages/${largeFilename}`;

    await unlinkLandingPageHeroImage(lp.heroImageUrl);

    const updated = await fastify.prisma.landingPage.update({
      where: { id },
      data: { heroImageUrl: url },
    });

    return { landingPage: updated, url };
  });

  // Admin Endpoint: POST /api/landing-pages/:id/terms-file
  fastify.post('/api/landing-pages/:id/terms-file', {
    preHandler: [fastify.authenticate, authorizeRoles(['admin'])],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const lp = await fastify.prisma.landingPage.findUnique({ where: { id } });
    if (!lp) return reply.code(404).send({ error: 'Landing page nie istnieje' });

    const file = await request.file();
    if (!file) return reply.code(400).send({ error: 'Brak pliku PDF' });
    if (file.mimetype !== 'application/pdf') {
      return reply.code(400).send({ error: 'Dozwolony jest wyłącznie plik PDF' });
    }

    const buffer = await file.toBuffer();
    if (buffer.length > 8 * 1024 * 1024) {
      return reply.code(400).send({ error: 'Maksymalny rozmiar pliku wynosi 8MB' });
    }

    if (buffer.toString('utf8', 0, 4) !== '%PDF') {
      return reply.code(400).send({ error: 'Nieprawidłowy plik PDF' });
    }

    await fs.mkdir(TERMS_DIR, { recursive: true });

    if (lp.termsFileUrl) {
      await unlinkLandingPageTermsFile(lp.termsFileUrl);
    }

    const filename = `${id}-terms-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.pdf`;
    const filePath = path.join(TERMS_DIR, filename);
    await fs.writeFile(filePath, buffer);
    const termsFileUrl = `/uploads/landing-pages/terms/${filename}`;

    const updated = await fastify.prisma.landingPage.update({
      where: { id },
      data: { termsFileUrl },
    });

    return { success: true, termsFileUrl: updated.termsFileUrl };
  });

  // Admin Endpoint: DELETE /api/landing-pages/:id/terms-file
  fastify.delete('/api/landing-pages/:id/terms-file', {
    preHandler: [fastify.authenticate, authorizeRoles(['admin'])],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const lp = await fastify.prisma.landingPage.findUnique({ where: { id } });
    if (!lp) return reply.code(404).send({ error: 'Landing page nie istnieje' });

    if (lp.termsFileUrl) {
      await unlinkLandingPageTermsFile(lp.termsFileUrl);
      await fastify.prisma.landingPage.update({
        where: { id },
        data: { termsFileUrl: null },
      });
    }

    return { success: true, termsFileUrl: null };
  });

  // Admin Endpoint: GET /api/landing-pages/:id/preview-listings
  fastify.get('/api/landing-pages/:id/preview-listings', {
    preHandler: [fastify.authenticate, authorizeRoles(['admin'])],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const lp = await fastify.prisma.landingPage.findUnique({ where: { id } });
    if (!lp) return reply.code(404).send({ error: 'Landing page not found' });

    const listings = await resolveCarsForLandingPage(fastify, {
      selectionMode: lp.selectionMode as 'MANUAL' | 'FILTERED',
      listingIds: lp.listingIds,
      filterParams: lp.filterParams,
      maxListings: lp.maxListings,
    });

    const rentalVehicles = lp.selectionMode === 'MANUAL'
      ? await resolveRentalVehiclesForLandingPage(fastify, lp.rentalVehicleIds)
      : [];

    return { listings, rentalVehicles, count: listings.length + rentalVehicles.length };
  });
}
