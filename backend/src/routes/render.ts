import { FastifyInstance, FastifyRequest } from 'fastify';
import { buildCatalogPrefetchScript } from '../utils/catalog-prefetch.js';
import { extractListingIdFromSlug, generateListingSlug } from '../utils/url-utils.js';
import {
    buildBrandMeta,
    buildListingMeta,
    buildModelMeta,
    buildRentalMeta,
    buildStaticMeta,
    catalogSkeletonHtml,
    defaultMeta,
    detailSkeletonHtml,
    hasStaticRoute,
    homeHeroShellHtml,
    injectHead,
    resolveBrandCtx,
    BrandCtx,
    BrandLinkEntry,
    CmsPageContent,
    ListingVariant,
    OrgSettings,
    PageMeta,
    RelatedListing,
    RelatedRentalVehicle,
    StaticPagination,
} from '../services/seo-meta.js';
import { getFinancingArticle } from '../content/financing-content.js';
import {
    BrandCatalogEntry,
    getBrandCatalog,
    getBrandCatalogAllTime,
    getModelCatalog,
    getModelCatalogAllTime,
    ModelCatalogEntry,
} from '../services/brand-pages.service.js';
import { getSeoContentPage } from '../services/seo-content.js';
import { resolveOfferLifecycle } from '../services/offer-lifecycle.service.js';
import { isProductionHost } from '../services/environment.js';
import {
    getSsrCache,
    setSsrCache,
    isSsrFresh,
    markRevalidating,
    clearRevalidating,
    resetSsrCache,
} from '../services/ssr-cache.js';
import { getPublicSettings } from './settings.js';

// Strony kategorii finansowania → filtr financingType dla FAQ z CMS
const FINANCING_FAQ_TYPE: Record<string, string> = {
    '/leasing': 'leasing',
    '/kredyt': 'kredyt',
    '/wynajem-dlugoterminowy': 'wynajem',
};

const TEMPLATE_TTL_MS = 5 * 60 * 1000;

// Strony katalogowe z paginacją SSR (?page=N) — crawlery bez JS widzą kolejne porcje ofert.
// /leasing i /kredyt celowo bez paginacji: oferty są te same co w /samochody (każde auto
// dostępne w obu finansowaniach), więc pełna lista byłaby duplikatem — te strony pracują
// artykułem filarowym + krótką listą z linkiem do pełnego katalogu.
// Trasy statyczne, na których lista ofert w prerenderze jest szumem, a nie treścią
const LISTINGLESS_STATIC_ROUTES = new Set(['/faq', '/kontakt', '/dla-firm', '/dla-ciebie', '/kalkulator-rat']);

const PAGINATED_ROUTES = new Set([
    '/samochody',
    '/search',
    '/nowe',
    '/uzywane',
    '/wynajem-dlugoterminowy',
]);

// Rozmiar strony SSR spójny z frontem: 3 kolumny siatki → 30/stronę, w przeciwnym razie 32.
const SSR_PER_PAGE_TTL_MS = 60 * 1000;
let ssrPerPageCache: { value: number; fetchedAt: number } | null = null;

async function getSsrPerPage(fastify: FastifyInstance): Promise<number> {
    if (ssrPerPageCache && Date.now() - ssrPerPageCache.fetchedAt < SSR_PER_PAGE_TTL_MS) {
        return ssrPerPageCache.value;
    }
    let value = 32;
    try {
        const settings = await fastify.prisma.appSettings.findUnique({ where: { id: 'default' } });
        value = Number(settings?.searchGridColumns) === 3 ? 30 : 32;
    } catch {
        value = 32;
    }
    ssrPerPageCache = { value, fetchedAt: Date.now() };
    return value;
}

// Kolumny gridu skeletonu SSR — ta sama flaga ustawień co getSsrPerPage, ale osobny cache
// (bliźniaczy, mniejszy diff niż zmiana kształtu zwrotki getSsrPerPage w 3 miejscach wywołania).
let gridColumnsCache: { value: 3 | 4; fetchedAt: number } | null = null;

async function getGridColumns(fastify: FastifyInstance): Promise<3 | 4> {
    if (gridColumnsCache && Date.now() - gridColumnsCache.fetchedAt < SSR_PER_PAGE_TTL_MS) {
        return gridColumnsCache.value;
    }
    let value: 3 | 4 = 4;
    try {
        const settings = await fastify.prisma.appSettings.findUnique({ where: { id: 'default' } });
        value = Number(settings?.searchGridColumns) === 3 ? 3 : 4;
    } catch {
        value = 4;
    }
    gridColumnsCache = { value, fetchedAt: Date.now() };
    return value;
}

// Kolejność ofert jak w widocznym SPA: defaultSortCars z ustawień (SearchPage/ConditionPage
// fallback 'price_asc'), mapowanie sortBy->orderBy identyczne z listings.ts (priceField PLN).
// Dzięki temu preload LCP wskazuje te same zdjęcia, które SPA wyrenderuje nad foldem.
const CARS_ORDER_BY: Record<string, object> = {
    cheapest: { brokerPricePln: 'asc' },
    price_asc: { brokerPricePln: 'asc' },
    expensive: { brokerPricePln: 'desc' },
    price_desc: { brokerPricePln: 'desc' },
    year_asc: { productionYear: 'asc' },
    year_desc: { productionYear: 'desc' },
    mileage: { mileageKm: 'asc' },
    mileage_asc: { mileageKm: 'asc' },
    mileage_desc: { mileageKm: 'desc' },
    newest: { createdAt: 'desc' },
};

// /leasing i /kredyt: promocja aut nowych nad używanymi (dotychczas SSR pokazywał najpierw
// najtańsze używane, np. Ford Focus 2008 za 9 900 zł) — najpierw condition NEW (kolejność
// enuma w Postgresie odpowiada deklaracji w schema.prisma: NEW przed USED), w obu grupach
// od najnowszego rocznika.
const FINANCING_LISTINGS_ORDER_BY: object[] = [{ condition: 'asc' }, { productionYear: 'desc' }];

let carsOrderByCache: { value: object; fetchedAt: number } | null = null;

async function getCarsOrderBy(fastify: FastifyInstance): Promise<object> {
    if (carsOrderByCache && Date.now() - carsOrderByCache.fetchedAt < SSR_PER_PAGE_TTL_MS) {
        return carsOrderByCache.value;
    }
    let sortKey = 'price_asc';
    try {
        const settings = await fastify.prisma.appSettings.findUnique({
            where: { id: 'default' },
            select: { defaultSortCars: true },
        });
        if (settings?.defaultSortCars) sortKey = settings.defaultSortCars;
    } catch {
        // fallback price_asc
    }
    const value = CARS_ORDER_BY[sortKey] ?? { brokerPricePln: 'asc' };
    carsOrderByCache = { value, fetchedAt: Date.now() };
    return value;
}

// Dane prawne do Organization JSON-LD strony głównej — te same pola co stopka frontendu.
let orgSettingsCache: { value: OrgSettings; fetchedAt: number } | null = null;

async function getOrgSettings(fastify: FastifyInstance): Promise<OrgSettings> {
    if (orgSettingsCache && Date.now() - orgSettingsCache.fetchedAt < SSR_PER_PAGE_TTL_MS) {
        return orgSettingsCache.value;
    }
    let value: OrgSettings = {};
    try {
        const settings = await fastify.prisma.appSettings.findUnique({
            where: { id: 'default' },
            select: {
                legalCompanyName: true,
                legalAddress: true,
                legalVatId: true,
                legalContactEmail: true,
                legalContactPhone: true,
            },
        });
        if (settings) value = settings;
    } catch {
        value = {};
    }
    orgSettingsCache = { value, fetchedAt: Date.now() };
    return value;
}

// Bannery hero strony głównej — ten sam kształt/where/orderBy co /api/hero-banners/public.
// Jedna lista posłuży do preloadu LCP (#1), SSR pierwszego banera do home-shell (#2)
// i window.__HERO_BANNERS__ dla frontu (#3).
interface HomeHeroBanner {
    id: string;
    imageUrlDesktop: string | null;
    imageUrlMobile: string | null;
    altText: string;
    buttonLabel: string;
    buttonUrl: string;
    buttonPositionYPct: number;
    buttonAlign: string;
}

let heroBannersCache: { value: HomeHeroBanner[]; fetchedAt: number } | null = null;

async function getHomeHeroBanners(fastify: FastifyInstance): Promise<HomeHeroBanner[]> {
    if (heroBannersCache && Date.now() - heroBannersCache.fetchedAt < SSR_PER_PAGE_TTL_MS) {
        return heroBannersCache.value;
    }
    let value: HomeHeroBanner[] = [];
    try {
        value = await fastify.prisma.heroBanner.findMany({
            where: { isActive: true },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            select: {
                id: true,
                imageUrlDesktop: true,
                imageUrlMobile: true,
                altText: true,
                buttonLabel: true,
                buttonUrl: true,
                buttonPositionYPct: true,
                buttonAlign: true,
            },
        });
    } catch {
        value = [];
    }
    heroBannersCache = { value, fetchedAt: Date.now() };
    return value;
}

// Zróżnicowanie list kategorii — jak filtry w SPA (ConditionPage)
const CONDITION_BY_PATH: Record<string, 'NEW' | 'USED'> = {
    '/nowe': 'NEW',
    '/uzywane': 'USED',
};
const FINANCING_LIST_TAKE = 12; // krótka lista na /leasing i /kredyt

// Klucze cache nie zawierają brandu — każdy proces backendu obsługuje jeden brand (env BRAND).
let templateCache: { html: string; fetchedAt: number } | null = null;

export function __resetComponentCaches() {
    gridColumnsCache = null;
    heroBannersCache = null;
    ssrPerPageCache = null;
}

export async function __resetRenderCache() {
    templateCache = null;
    carsOrderByCache = null;
    manifestCache = null;
    __resetComponentCaches();
    await resetSsrCache().catch(() => {});
}

// Kolejność źródeł szablonu wynika z dwóch osobnych awarii produkcyjnych:
//  - `http://frontend:80` to alias współdzielony przez środowiska: na produkcji rozwiązywał się
//    na kontener frontendu STAGINGU, więc szablon pochodził z zupełnie innego builda;
//  - `SERVICE_URL_FRONTEND` to domena publiczna, więc szablon leciał przez CDN, a `index.html`
//    ma `max-age=14400`. Po deployu backend przez wiele godzin renderował strony wskazujące na
//    chunki, których już nie ma — strona wyglądała poprawnie, ale JS się nie uruchamiał.
// Alias `<COOLIFY_RESOURCE_UUID>-frontend` wskazuje na frontend TEGO zasobu, omija CDN i jest
// poprawny w każdym środowisku bez dodatkowej konfiguracji.
function frontendBase(): string {
    const explicit = process.env.INTERNAL_FRONTEND_URL;
    if (explicit && explicit !== 'http://frontend:80') {
        return explicit.replace(/\/$/, '');
    }

    const resourceUuid = process.env.COOLIFY_RESOURCE_UUID;
    if (resourceUuid) {
        return `http://${resourceUuid}-frontend`;
    }

    const base = process.env.SERVICE_URL_FRONTEND || explicit || 'http://frontend:80';
    return base.replace(/\/$/, '');
}

async function getTemplate(): Promise<string | null> {
    if (templateCache && Date.now() - templateCache.fetchedAt < TEMPLATE_TTL_MS) {
        return templateCache.html;
    }
    try {
        const res = await fetch(`${frontendBase()}/index.html`);
        if (!res.ok) throw new Error(`template fetch status ${res.status}`);
        const html = await res.text();
        templateCache = { html, fetchedAt: Date.now() };
        return html;
    } catch (e) {
        // stale-if-error: Use stale cache ONLY for a few seconds during brief network blips
        // to prevent serving an old index.html (which points to missing chunks) for a long time.
        // If frontend is down longer, returning null will cause a 503, triggering Nginx @spa_fallback
        if (templateCache && Date.now() - templateCache.fetchedAt < 10 * 1000) {
            return templateCache.html;
        }
        return null;
    }
}

const LISTING_RE = /^\/(oferta|leasing|kredyt)\/([^/]+)$/;
const RENTAL_RE = /^\/wynajem-dlugoterminowy\/([^/]+)$/;
const PROMO_RE = /^\/promo\/([^/]+)$/;
const NOINDEX_RE = /^\/(admin|login|embed|listing|dla-firmy)(\/|$)|\/(lead|negotiate|zapytanie)$/;
const BRAND_RE = /^\/samochody\/([^/]+)$/;
const BRAND_MODEL_RE = /^\/samochody\/([^/]+)\/([^/]+)$/;

// --- Modulepreload chunków tras (manifest Vite) ---
// Lazy-loadowane strony (App.tsx) tworzą łańcuch: index.js -> chunk trasy -> render.
// SSR zna trasę z góry, więc wstrzykuje modulepreload chunka — przeglądarka pobiera go
// równolegle z index.js zamiast czekać na jego wykonanie. Klucze = ścieżki źródeł w manifeście.
const ROUTE_MODULES: Array<{ match: (p: string) => boolean; module: string }> = [
    { match: p => LISTING_RE.test(p), module: 'src/pages/ListingDetailPage.tsx' },
    { match: p => RENTAL_RE.test(p), module: 'src/pages/RentalDetailPage.tsx' },
    { match: p => PROMO_RE.test(p), module: 'src/pages/CampaignLandingPage.tsx' },
    { match: p => p === '/nowe' || p === '/uzywane', module: 'src/pages/ConditionPage.tsx' },
    {
        match: p =>
            p === '/samochody' || p === '/search' || p === '/leasing' || p === '/kredyt' ||
            BRAND_RE.test(p) || BRAND_MODEL_RE.test(p),
        module: 'src/pages/SearchPage.tsx',
    },
    { match: p => p === '/wynajem-dlugoterminowy', module: 'src/pages/RentalSearchPage.tsx' },
    { match: p => p === '/faq', module: 'src/pages/PublicFaqPage.tsx' },
];

interface ViteManifestEntry {
    file: string;
    css?: string[];
    imports?: string[];
    isEntry?: boolean;
}
type ViteManifest = Record<string, ViteManifestEntry>;

// null też jest cache'owane (stary deploy frontendu bez manifestu) — bez młócenia 404
let manifestCache: { value: ViteManifest | null; fetchedAt: number } | null = null;

async function getViteManifest(): Promise<ViteManifest | null> {
    if (manifestCache && Date.now() - manifestCache.fetchedAt < TEMPLATE_TTL_MS) {
        return manifestCache.value;
    }
    let value: ViteManifest | null = null;
    try {
        const res = await fetch(`${frontendBase()}/.vite/manifest.json`);
        if (res.ok) value = (await res.json()) as ViteManifest;
    } catch {
        value = null;
    }
    manifestCache = { value, fetchedAt: Date.now() };
    return value;
}

function routeChunkLinks(path: string, manifest: ViteManifest): string[] {
    const route = ROUTE_MODULES.find(r => r.match(path));
    if (!route) return [];
    const links: string[] = [];
    const seen = new Set<string>();
    const walk = (key: string) => {
        if (seen.has(key)) return;
        seen.add(key);
        const entry = manifest[key];
        // Główny bundle jest już w <script type="module"> szablonu — nie dublujemy
        if (!entry || entry.isEntry) return;
        links.push(`<link rel="modulepreload" href="/${entry.file}" />`);
        for (const css of entry.css ?? []) {
            links.push(`<link rel="preload" as="style" href="/${css}" />`);
        }
        for (const imp of entry.imports ?? []) walk(imp);
    };
    walk(route.module);
    return links;
}

// Strony marek/modeli mają dynamiczne segmenty w ścieżce więc nie mieszczą się
// w statycznym PAGINATED_ROUTES — dopisujemy je tu, żeby ?page=N nie było ignorowane.
function isPaginatedPath(path: string): boolean {
    return PAGINATED_ROUTES.has(path) || BRAND_RE.test(path) || BRAND_MODEL_RE.test(path);
}

async function resolveMeta(
    fastify: FastifyInstance,
    path: string,
    ctx: BrandCtx,
    page: number = 1,
    queryParams?: URLSearchParams
): Promise<PageMeta> {
    if (NOINDEX_RE.test(path)) {
        return defaultMeta(ctx, { noindex: true, status: 200 });
    }

    const pm = path.match(PROMO_RE);
    if (pm) {
        const slug = pm[1];
        const lp = await fastify.prisma.landingPage.findUnique({
            where: { slug },
            select: {
                name: true,
                heroTitle: true,
                heroSubtitle: true,
                metaTitle: true,
                metaDescription: true,
                isIndexable: true,
                isActive: true,
                validTo: true,
            },
        });
        if (!lp || !lp.isActive) {
            return defaultMeta(ctx, { noindex: true, status: 404 });
        }
        if (lp.validTo && lp.validTo < new Date()) {
            return defaultMeta(ctx, { noindex: true, status: 410 });
        }
        const title = lp.metaTitle || lp.heroTitle || lp.name;
        const description = lp.metaDescription || lp.heroSubtitle || `${title} - oferta specjalna na ${ctx.brandName}`;
        return {
            title,
            description,
            canonical: `${ctx.baseUrl}${path}`,
            noindex: !lp.isIndexable,
            status: 200,
        };
    }

    const lm = path.match(LISTING_RE);
    if (lm) {
        const lifecycle = await resolveOfferLifecycle(fastify, lm[2]);

        if (lifecycle.state === 'NOT_FOUND') {
            return defaultMeta(ctx, { noindex: true, status: 404 });
        }

        if (lifecycle.state === 'LONG_GONE') {
            if (lifecycle.redirectUrl) {
                return {
                    ...defaultMeta(ctx, { noindex: true, status: 301 }),
                    redirectUrl: lifecycle.redirectUrl,
                    status: 301,
                };
            }
            return defaultMeta(ctx, { noindex: true, status: 410 });
        }

        const listing = lifecycle.listing;
        const variant = lm[1] as ListingVariant;
        const isRecentlySold = lifecycle.state === 'RECENTLY_SOLD';

        // Fetch related listings (if active)
        let related: RelatedListing[] = [];
        if (!isRecentlySold) {
            const relatedRaw = await fastify.prisma.listing.findMany({
                where: { isArchived: false, NOT: { id: listing.id } },
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    make: true,
                    model: true,
                    version: true,
                    productionYear: true,
                    pricePln: true,
                    bodyType: true,
                    fuelType: true,
                },
            });

            related = relatedRaw.map(r => ({
                ...r,
                slug: generateListingSlug(r.make, r.model, r.version, r.productionYear, r.bodyType, r.fuelType, r.id),
            }));
        }

        // FAQ jak na froncie: page=offers; dla wariantów finansowych dodatkowo filtr financingType
        const variantFaq = await fastify.prisma.faqEntry.findMany({
            where: {
                isPublished: true,
                page: 'offers',
                pageContext: { in: ['all', 'offers'] },
                ...(variant !== 'oferta'
                    ? { OR: [{ financingType: variant }, { financingType: null }, { financingType: 'all' }] }
                    : {}),
            },
            orderBy: { sortOrder: 'asc' },
            select: { questionPl: true, answerPl: true },
        });

        // Slug z URL bywa zmanipulowany — canonical liczymy z danych, nie z requestu
        const canonicalSlug = lifecycle.canonicalSlug || generateListingSlug(
            listing.make,
            listing.model,
            listing.version,
            listing.productionYear,
            listing.bodyType,
            listing.fuelType,
            listing.id
        );

        const similarListings: RelatedListing[] = lifecycle.similarListings.map(s => ({
            id: s.id,
            make: s.make,
            model: s.model,
            version: s.version,
            productionYear: s.productionYear,
            pricePln: s.pricePln,
            bodyType: s.bodyType,
            fuelType: s.fuelType,
            slug: s.slug,
        }));

        return buildListingMeta(listing, canonicalSlug, variant, ctx, related, variantFaq, {
            isRecentlySold,
            similarListings: isRecentlySold ? similarListings : undefined,
        });
    }

    const rm = path.match(RENTAL_RE);
    if (rm) {
        const rental = await fastify.prisma.rentalVehicle.findFirst({
            where: { slug: rm[1], isActive: true },
            select: {
                id: true,
                make: true,
                model: true,
                version: true,
                productionYear: true,
                sellingPrice: true,
                primaryImageUrl: true,
                bodyType: true,
                fuelType: true,
                transmission: true,
                enginePowerHp: true,
                doors: true,
                seats: true,
                color: true,
                mileageKm: true,
                condition: true,
                equipmentSafety: true,
                equipmentAudioMultimedia: true,
                equipmentComfortExtras: true,
                equipmentOther: true,
            },
        });
        if (!rental) return defaultMeta(ctx, { noindex: true, status: 404 });

        // FAQ najmu — ten sam filtr co frontend (page=rental, pageContext=rental)
        const rentalFaq = await fastify.prisma.faqEntry.findMany({
            where: {
                isPublished: true,
                page: 'rental',
                pageContext: { in: ['all', 'rental'] },
            },
            orderBy: { sortOrder: 'asc' },
            select: { questionPl: true, answerPl: true },
        });

        // Najniższa rata brutto z matrycy najmu (aktywne przypisania pojazdu)
        const rateAgg = await fastify.prisma.rentalMatrixEntry.aggregate({
            _min: { monthlyRateGross: true },
            where: { assignment: { vehicleId: rental.id, isActive: true } },
        });

        // Podobne auta najmu do linkowania: najpierw ta sama marka, dobite tym samym nadwoziem — max 5
        let relatedRentalsRaw = await fastify.prisma.rentalVehicle.findMany({
            where: { isActive: true, slug: { not: null }, NOT: { id: rental.id }, make: rental.make },
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: { id: true, make: true, model: true, productionYear: true, slug: true },
        });
        if (relatedRentalsRaw.length < 5 && rental.bodyType) {
            const excludeIds = [rental.id, ...relatedRentalsRaw.map(v => v.id)];
            const sameBodyRentals = await fastify.prisma.rentalVehicle.findMany({
                where: { isActive: true, slug: { not: null }, NOT: { id: { in: excludeIds } }, bodyType: rental.bodyType },
                take: 5 - relatedRentalsRaw.length,
                orderBy: { createdAt: 'desc' },
                select: { id: true, make: true, model: true, productionYear: true, slug: true },
            });
            relatedRentalsRaw = [...relatedRentalsRaw, ...sameBodyRentals];
        }
        const relatedRentalRates = await Promise.all(
            relatedRentalsRaw.map(v =>
                fastify.prisma.rentalMatrixEntry.aggregate({
                    _min: { monthlyRateGross: true },
                    where: { assignment: { vehicleId: v.id, isActive: true } },
                })
            )
        );
        const relatedRentals: RelatedRentalVehicle[] = relatedRentalsRaw.map((v, i) => ({
            slug: v.slug as string,
            make: v.make,
            model: v.model,
            productionYear: v.productionYear,
            monthlyRateFrom: relatedRentalRates[i]._min.monthlyRateGross ?? null,
        }));

        return buildRentalMeta(rental, rm[1], ctx, rentalFaq, rateAgg._min.monthlyRateGross ?? null, relatedRentals);
    }

    // Strona modelu (/samochody/:marka/:model) — sprawdzana przed marką, bo ma więcej segmentów
    const bm = path.match(BRAND_MODEL_RE);
    if (bm) {
        const cmsUrlPath = `/samochody/${bm[1]}/${bm[2]}`;
        const [brandCatalog, cmsContentRow] = await Promise.all([
            getBrandCatalog(fastify),
            getSeoContentPage(fastify, cmsUrlPath),
        ]);
        let brandEntry: BrandCatalogEntry | undefined = brandCatalog.find(b => b.slug === bm[1]);
        let modelCatalog: ModelCatalogEntry[] = brandEntry ? await getModelCatalog(fastify, brandEntry.rawMakes) : [];
        let modelEntry: ModelCatalogEntry | undefined = modelCatalog.find(m => m.slug === bm[2]);

        if (!modelEntry) {
            // Model (lub cała marka) bez aktywnych ofert — trwałość strony (200+treść+indeksowalność)
            // tylko przy opublikowanej treści CMS (spec §1, poprawka F2 pkt 4e); bez CMS zostaje
            // 404 ze znanego ograniczenia F1 (patrz komentarz w brand-pages.service.ts).
            if (!cmsContentRow) return defaultMeta(ctx, { noindex: true, status: 404 });
            if (!brandEntry) {
                brandEntry = (await getBrandCatalogAllTime(fastify)).find(b => b.slug === bm[1]);
                if (!brandEntry) return defaultMeta(ctx, { noindex: true, status: 404 });
                modelCatalog = await getModelCatalogAllTime(fastify, brandEntry.rawMakes);
                modelEntry = modelCatalog.find(m => m.slug === bm[2]);
            } else {
                modelEntry = (await getModelCatalogAllTime(fastify, brandEntry.rawMakes)).find(m => m.slug === bm[2]);
            }
            if (!modelEntry) return defaultMeta(ctx, { noindex: true, status: 404 });
            modelEntry = { ...modelEntry, count: 0 }; // trafiliśmy tu właśnie dlatego, że aktywnych ofert jest 0
        }
        // modelEntry znaleziony implikuje brandEntry znaleziony na każdej ścieżce powyżej —
        // jawny guard tylko dla zawężenia typów przez TS (nieosiągalne w praktyce).
        if (!brandEntry) return defaultMeta(ctx, { noindex: true, status: 404 });

        const cms: CmsPageContent | undefined = cmsContentRow
            ? { html: cmsContentRow.html, faq: cmsContentRow.faq, metaTitle: cmsContentRow.metaTitle, metaDescription: cmsContentRow.metaDescription }
            : undefined;

        const modelWhere = {
            isArchived: false,
            make: { in: brandEntry.rawMakes, mode: 'insensitive' as const },
            model: { in: modelEntry.rawModels, mode: 'insensitive' as const },
        };

        const ssrPerPage = await getSsrPerPage(fastify);
        const totalPages = Math.max(1, Math.ceil(modelEntry.count / ssrPerPage));
        if (page > totalPages) return defaultMeta(ctx, { noindex: true, status: 404 });
        const pagination: StaticPagination = { page, totalPages };
        const skip = (page - 1) * ssrPerPage;

        const [listingsRaw, priceAgg] = await Promise.all([
            fastify.prisma.listing.findMany({
                where: modelWhere,
                skip,
                take: ssrPerPage,
                orderBy: await getCarsOrderBy(fastify),
                select: {
                    id: true, make: true, model: true, version: true,
                    productionYear: true, pricePln: true, bodyType: true, fuelType: true,
                    primaryImageUrl: true,
                },
            }),
            fastify.prisma.listing.aggregate({
                _min: { pricePln: true },
                _max: { pricePln: true },
                where: { ...modelWhere, pricePln: { gt: 0 } },
            }),
        ]);

        const listings: RelatedListing[] = listingsRaw.map(l => ({
            ...l,
            slug: generateListingSlug(l.make, l.model, l.version, l.productionYear, l.bodyType, l.fuelType, l.id),
        }));
        const siblingModels: BrandLinkEntry[] = modelCatalog
            .filter(m => m.slug !== modelEntry.slug)
            .map(m => ({ name: m.model, slug: m.slug, count: m.count }));

        return buildModelMeta(
            brandEntry.make,
            modelEntry.model,
            brandEntry.slug,
            modelEntry.slug,
            modelEntry.count,
            { min: priceAgg._min.pricePln, max: priceAgg._max.pricePln },
            siblingModels,
            listings,
            ctx,
            pagination,
            cms
        );
    }

    // Strona marki (/samochody/:marka)
    const bOnly = path.match(BRAND_RE);
    if (bOnly) {
        const cmsUrlPath = `/samochody/${bOnly[1]}`;
        const [brandCatalog, cmsContentRow] = await Promise.all([
            getBrandCatalog(fastify),
            getSeoContentPage(fastify, cmsUrlPath),
        ]);
        let brandEntry: BrandCatalogEntry | undefined = brandCatalog.find(b => b.slug === bOnly[1]);
        if (!brandEntry) {
            // Marka bez aktywnych ofert — trwałość strony (spec §1/F2 pkt 4e) tylko przy
            // opublikowanej treści CMS; bez CMS zostaje 404 ze znanego ograniczenia F1.
            if (!cmsContentRow) return defaultMeta(ctx, { noindex: true, status: 404 });
            brandEntry = (await getBrandCatalogAllTime(fastify)).find(b => b.slug === bOnly[1]);
            if (!brandEntry) return defaultMeta(ctx, { noindex: true, status: 404 });
            brandEntry = { ...brandEntry, count: 0 };
        }
        const cms: CmsPageContent | undefined = cmsContentRow
            ? { html: cmsContentRow.html, faq: cmsContentRow.faq, metaTitle: cmsContentRow.metaTitle, metaDescription: cmsContentRow.metaDescription }
            : undefined;

        const brandWhere = { isArchived: false, make: { in: brandEntry.rawMakes, mode: 'insensitive' as const } };

        const ssrPerPage = await getSsrPerPage(fastify);
        const totalPages = Math.max(1, Math.ceil(brandEntry.count / ssrPerPage));
        if (page > totalPages) return defaultMeta(ctx, { noindex: true, status: 404 });
        const pagination: StaticPagination = { page, totalPages };
        const skip = (page - 1) * ssrPerPage;

        const [listingsRaw, priceAgg, modelCatalog] = await Promise.all([
            fastify.prisma.listing.findMany({
                where: brandWhere,
                skip,
                take: ssrPerPage,
                orderBy: await getCarsOrderBy(fastify),
                select: {
                    id: true, make: true, model: true, version: true,
                    productionYear: true, pricePln: true, bodyType: true, fuelType: true,
                    primaryImageUrl: true,
                },
            }),
            fastify.prisma.listing.aggregate({
                _min: { pricePln: true },
                _max: { pricePln: true },
                where: { ...brandWhere, pricePln: { gt: 0 } },
            }),
            getModelCatalog(fastify, brandEntry.rawMakes),
        ]);

        const listings: RelatedListing[] = listingsRaw.map(l => ({
            ...l,
            slug: generateListingSlug(l.make, l.model, l.version, l.productionYear, l.bodyType, l.fuelType, l.id),
        }));
        const models: BrandLinkEntry[] = modelCatalog.map(m => ({ name: m.model, slug: m.slug, count: m.count }));
        const otherBrands: BrandLinkEntry[] = brandCatalog
            .filter(b => b.slug !== brandEntry.slug)
            .sort((a, b) => b.count - a.count)
            .slice(0, 20)
            .map(b => ({ name: b.make, slug: b.slug, count: b.count }));

        return buildBrandMeta(
            brandEntry.make,
            brandEntry.slug,
            brandEntry.count,
            { min: priceAgg._min.pricePln, max: priceAgg._max.pricePln },
            models,
            otherBrands,
            listings,
            ctx,
            pagination,
            cms
        );
    }

    // Nieznane ścieżki (m.in. probe'y skanerów) odrzucamy przed zapytaniami do bazy
    if (!hasStaticRoute(path)) {
        return defaultMeta(ctx, { noindex: true, status: 404 });
    }

    // Kategoria najmu listuje pojazdy najmu (linki do self-canonical stron), nie auta sprzedażowe
    let listings: RelatedListing[];
    let listingsBasePath = '/oferta';
    let pagination: StaticPagination | undefined;
    const paginated = PAGINATED_ROUTES.has(path);
    const isFinancingList = path === '/leasing' || path === '/kredyt';
    const ssrPerPage = paginated ? await getSsrPerPage(fastify) : 0;
    const take = paginated ? ssrPerPage : isFinancingList ? FINANCING_LIST_TAKE : 20;
    const skip = paginated ? (page - 1) * ssrPerPage : 0;

    // Strony bez listy aut: doklejanie 20 losowych ofert do prerenderu rozmywało ich temat
    // (na /faq crawler przed pytaniami o kredyt widział listę Fordów) i kosztowało zbędne
    // zapytanie do bazy. Lista zostaje tam, gdzie jest treścią strony.
    if (LISTINGLESS_STATIC_ROUTES.has(path)) {
        listings = [];
    } else if (path === '/wynajem-dlugoterminowy') {
        const where = { isActive: true, slug: { not: null } };
        if (paginated) {
            const total = await fastify.prisma.rentalVehicle.count({ where });
            const totalPages = Math.max(1, Math.ceil(total / ssrPerPage));
            if (page > totalPages) return defaultMeta(ctx, { noindex: true, status: 404 });
            pagination = { page, totalPages };
        }
        const rentalsRaw = await fastify.prisma.rentalVehicle.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                make: true,
                model: true,
                version: true,
                productionYear: true,
                slug: true,
            },
        });
        listings = rentalsRaw.map(r => ({ ...r, pricePln: null, slug: r.slug as string }));
        listingsBasePath = '/wynajem-dlugoterminowy';
    } else {
        const where = {
            isArchived: false,
            ...(CONDITION_BY_PATH[path] ? { condition: CONDITION_BY_PATH[path] } : {}),
        };
        if (paginated) {
            const total = await fastify.prisma.listing.count({ where });
            const totalPages = Math.max(1, Math.ceil(total / ssrPerPage));
            if (page > totalPages) return defaultMeta(ctx, { noindex: true, status: 404 });
            pagination = { page, totalPages };
        }
        const listingsRaw = await fastify.prisma.listing.findMany({
            where,
            skip,
            take,
            orderBy: isFinancingList ? FINANCING_LISTINGS_ORDER_BY : await getCarsOrderBy(fastify),
            select: {
                id: true,
                make: true,
                model: true,
                version: true,
                productionYear: true,
                pricePln: true,
                bodyType: true,
                fuelType: true,
                primaryImageUrl: true,
            },
        });
        listings = listingsRaw.map(l => ({
            ...l,
            slug: generateListingSlug(l.make, l.model, l.version, l.productionYear, l.bodyType, l.fuelType, l.id)
        }));
    }

    let faq: any[] = [];
    if (path === '/faq') {
        faq = await fastify.prisma.faqEntry.findMany({
            where: { isPublished: true },
            orderBy: { sortOrder: 'asc' },
        });
    } else if (path === '/') {
        faq = await fastify.prisma.faqEntry.findMany({
            where: { page: 'home', isPublished: true },
            orderBy: { sortOrder: 'asc' },
        });
    } else if (FINANCING_FAQ_TYPE[path]) {
        faq = await fastify.prisma.faqEntry.findMany({
            where: {
                page: 'financing',
                isPublished: true,
                OR: [
                    { financingType: FINANCING_FAQ_TYPE[path] },
                    { financingType: 'all' },
                    { financingType: null },
                ],
            },
            orderBy: { sortOrder: 'asc' },
        });
    }

    const orgSettings = path === '/' ? await getOrgSettings(fastify) : undefined;
    const heroBanners = path === '/' ? await getHomeHeroBanners(fastify) : [];
    // "Popularne marki" — linkowanie wewnętrzne do stron marek, tylko na katalogu głównym
    const popularBrands: BrandLinkEntry[] = path === '/samochody'
        ? (await getBrandCatalog(fastify))
            .slice()
            .sort((a, b) => b.count - a.count)
            .slice(0, 20)
            .map(b => ({ name: b.make, slug: b.slug, count: b.count }))
        : [];

    const meta = buildStaticMeta(
        path, ctx, listings, faq, listingsBasePath, getFinancingArticle(ctx.brand, path), pagination, orgSettings, popularBrands,
        heroBanners[0] ? { desktop: heroBanners[0].imageUrlDesktop, mobile: heroBanners[0].imageUrlMobile } : undefined
    ) ?? defaultMeta(ctx, { noindex: true, status: 404 });

    // Canonical filtrów: /samochody?make=X (pojedyncza marka, opcjonalnie +model) → strona marki/modelu.
    // Wiele marek lub brak dopasowania: canonical zostaje na /samochody (bez zmian).
    if (path === '/samochody' && queryParams) {
        const canonicalOverride = await resolveSamochodyQueryCanonical(fastify, queryParams);
        if (canonicalOverride) meta.canonical = `${ctx.baseUrl}${canonicalOverride}`;
    }

    return meta;
}

async function resolveSamochodyQueryCanonical(fastify: FastifyInstance, queryParams: URLSearchParams): Promise<string | null> {
    const makeParam = queryParams.get('make');
    if (!makeParam) return null;
    const makes = makeParam.split(',').map(s => s.trim()).filter(Boolean);
    if (makes.length !== 1) return null;

    const brandCatalog = await getBrandCatalog(fastify);
    const brandEntry = brandCatalog.find(
        b => b.make.toLowerCase() === makes[0].toLowerCase() || b.rawMakes.some(r => r.toLowerCase() === makes[0].toLowerCase())
    );
    if (!brandEntry) return null;

    const modelParam = queryParams.get('model');
    const models = modelParam ? modelParam.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (models.length === 1) {
        const modelCatalog = await getModelCatalog(fastify, brandEntry.rawMakes);
        const modelEntry = modelCatalog.find(
            m => m.model.toLowerCase() === models[0].toLowerCase() || m.rawModels.some(r => r.toLowerCase() === models[0].toLowerCase())
        );
        if (modelEntry) return `/samochody/${brandEntry.slug}/${modelEntry.slug}`;
    }

    return `/samochody/${brandEntry.slug}`;
}

// Nie ma tu sprawdzania ciasteczek: ta aplikacja nie ma autoryzacji opartej na cookies —
// JWT jest czytany z nagłówka Authorization (request.jwtVerify() w app.ts,
// request.headers.authorization w middleware/partnerAuth.ts), nie ma rejestracji
// @fastify/cookie ani reply.setCookie w backend/src. Wcześniejszy regex dopasowywał się do
// całego nagłówka Cookie (wartości też), więc ciasteczko analityczne z "sid"/"token" w
// wartości fałszywie oznaczało anonimowego odwiedzającego jako sesję i wyłączało cache.
// Jeśli kiedyś pojawi się autoryzacja przez cookies, ta funkcja musi dostać z powrotem
// bramkę na cookie — inaczej strony z sesją zaczną wyciekać do publicznego cache'a.
function getCacheControlHeader(
    request: FastifyRequest,
    status: number,
    path: string,
    noindex?: boolean
): string {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        return 'private, no-store';
    }
    if (status !== 200) {
        return 'private, no-store';
    }
    if (path.startsWith('/admin') || NOINDEX_RE.test(path) || noindex) {
        return 'private, no-store';
    }
    if (request.headers.authorization) {
        return 'private, no-store';
    }
    return 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';
}

interface RenderResult {
    html: string;
    status: number;
    noindex?: boolean;
    redirectUrl?: string;
}

async function renderPage(
    fastify: FastifyInstance,
    path: string,
    page: number,
    searchParams: URLSearchParams | undefined,
    isProd: boolean,
    modulepreloadEnabled: boolean
): Promise<RenderResult | null> {
    let template = await getTemplate();
    if (!template) {
        return null;
    }

    // Preload /api/rental/vehicles?limit=1 (index.html) jest oznaczony jako "globalny", ale
    // realnie czyta go tylko strona główna i /wynajem-dlugoterminowy* — na resztę tras (w tym
    // /oferta/*) kradnie pasmo bez żadnego zysku, więc wycinamy go tam.
    const usesRentalPreload = path === '/' || path === '/wynajem-dlugoterminowy' || path.startsWith('/wynajem-dlugoterminowy/');
    if (!usesRentalPreload) {
        template = template.replace(/\s*<link rel="preload" href="\/api\/rental\/vehicles\?limit=1"[^>]*\/>/, () => '');
    }

    // Mini-wyszukiwarka hero na / pobiera opcje zawężone do stanu (?status=new), więc globalny
    // preload bez parametru trafiłby w próżnię. Na pozostałych trasach (/samochody, /nowe,
    // /uzywane) wołany jest wariant bez parametru, więc podmieniamy tylko dla /.
    if (path === '/') {
        template = template.replace(
            /<link rel="preload" href="\/api\/listings\/options"([^>]*)\/>/,
            (_m, rest) => `<link rel="preload" href="/api/listings/options?status=new"${rest}/>`,
        );
    }

    const ctx = resolveBrandCtx();
    const heroBanners = path === '/' ? await getHomeHeroBanners(fastify) : [];

    // Statyczny shell hero (vite.config, znaczniki home-shell) jest tylko dla
    // strony głównej — na innych trasach usuwamy go, żeby hero nie migało
    // przed zamontowaniem SPA. Strony katalogowe (isPaginatedPath) dostają w zamian
    // statyczny skeleton (nagłówek + placeholdery kart) zamiast białego ekranu do
    // montażu Reacta. Na / z aktywnym bannerem CMS podmieniamy tekstowy shell na SSR
    // pierwszego banera (ten sam obrazek co preload/LCP) — bez banerów zostaje bez zmian.
    // Podmiana funkcyjna — markup skeletonu/banera może zawierać `$`.
    if (path !== '/') {
        // Home-only preloady API (hero-banners/feature-tiles/faq-home/widgets-HOME) są
        // nieużywane poza / i na dławionym mobile kradną pasmo entry JS + obrazkowi LCP.
        template = template.replace(/<!--home-preload-->[\s\S]*?<!--\/home-preload-->/, () => '');
        // Strony katalogowe → skeleton siatki kart; strony detalu (oferta/najem) → skeleton
        // galerii + sidebara; reszta (formularze, noindex) → pusto do montażu React.
        const skeleton = isPaginatedPath(path)
            ? catalogSkeletonHtml(await getGridColumns(fastify))
            : (LISTING_RE.test(path) || RENTAL_RE.test(path))
                ? detailSkeletonHtml()
                : '';
        template = template.replace(/<!--home-shell-->[\s\S]*?<!--\/home-shell-->/, () => skeleton);
    } else if (heroBanners.length > 0) {
        const heroShell = homeHeroShellHtml(
            heroBanners[0],
            ctx.baseUrl,
            ctx.homeH1
        );
        template = template.replace(/<!--home-shell-->[\s\S]*?<!--\/home-shell-->/, () => heroShell);
    }

    const meta = await resolveMeta(fastify, path, ctx, page, searchParams);
    if (!isProd) {
        meta.noindex = true;
    }

    if (meta.status === 301 && meta.redirectUrl) {
        return {
            html: '',
            status: 301,
            redirectUrl: meta.redirectUrl,
            noindex: true,
        };
    }

    let html = injectHead(template, meta);

    // Modulepreload chunka trasy — domyślnie wyłączony po eksperymencie (docs/BRIEF_AG_MODULEPRELOAD_EXPERIMENT.md),
    // w którym wykazano, że emisja tagów modulepreload na trasach katalogowych opóźniała FCP o ponad 1 s.
    // Wyjście awaryjne: SSR_MODULEPRELOAD=on.
    if (modulepreloadEnabled) {
        const manifest = await getViteManifest();
        if (manifest) {
            const chunkLinks = routeChunkLinks(path, manifest);
            if (chunkLinks.length) {
                html = html.replace('</head>', () => `${chunkLinks.join('\n')}\n</head>`);
            }
        }
    }

    // window.__APP_SETTINGS__ — SSR-inject settings for all routes, exactly like __HERO_BANNERS__,
    // to eliminate the client-side /api/settings request hop before /api/listings.
    let publicSettings: Record<string, unknown> | null = null;
    try {
        publicSettings = await getPublicSettings(fastify);
        const appSettingsJson = JSON.stringify(publicSettings).replace(/</g, '\\u003c');
        html = html.replace('</head>', () => `<script>window.__APP_SETTINGS__=${appSettingsJson};</script>\n</head>`);
    } catch (err) {
        fastify.log.error(err, 'Failed to inject __APP_SETTINGS__');
    }

    // window.__CATALOG_PREFETCH__ — fetch-ahead of the default catalog query (#Task 3)
    if (['/nowe', '/uzywane', '/samochody'].includes(path) && page === 1) {
        const ssrPerPage = await getSsrPerPage(fastify);
        const sortKey = (publicSettings as any)?.defaultSortCars || 'price_asc';
        const currency = (publicSettings as any)?.displayCurrency || 'PLN';

        const prefetchScript = buildCatalogPrefetchScript(path, ssrPerPage, sortKey, currency);
        html = html.replace('</head>', () => `${prefetchScript}</head>`);
    }

    // window.__HERO_BANNERS__ — initialData React Query dla frontu (#3), tylko na /,
    // żeby hasHeroBanners/carousel nie czekały na rundę do API na krytycznej ścieżce.
    if (path === '/' && heroBanners.length > 0) {
        const heroBannersJson = JSON.stringify(heroBanners).replace(/</g, '\\u003c');
        html = html.replace('</head>', () => `<script>window.__HERO_BANNERS__=${heroBannersJson};</script>\n</head>`);
    }

    return {
        html,
        status: meta.status,
        noindex: meta.noindex,
    };
}

async function renderAndCache(
    fastify: FastifyInstance,
    path: string,
    page: number,
    searchParams: URLSearchParams | undefined,
    cacheKey: string,
    isProd: boolean,
    modulepreloadEnabled: boolean
): Promise<RenderResult | null> {
    const result = await renderPage(fastify, path, page, searchParams, isProd, modulepreloadEnabled);
    if (result) {
        await setSsrCache(cacheKey, result);
    }
    return result;
}

export async function renderRoutes(fastify: FastifyInstance) {
    fastify.get('/api/render', async (request, reply) => {
        const q = (request.query as { path?: unknown }).path;
        const rawPath = typeof q === 'string' && q ? q : '/';
        const [rawPathname, rawQuery] = rawPath.split('?');
        let path = rawPathname;
        if (path.length > 1 && path.endsWith('/')) path = path.replace(/\/+$/, '') || '/';

        const searchParams = rawQuery ? new URLSearchParams(rawQuery) : undefined;

        // ?page=N tylko dla stron katalogowych (w tym dynamicznych /samochody/:marka[/:model]);
        // clamp chroni cache przed spamem parametrów. Nginx przekazuje pełne $request_uri
        // w ?path=, ale surowe `&` w URI klienta rozbija parametry na najwyższy poziom
        // query — czytamy page z obu miejsc.
        let page = 1;
        if (isPaginatedPath(path)) {
            const topLevelPage = (request.query as { page?: unknown }).page;
            const pageStr =
                searchParams?.get('page') ??
                (typeof topLevelPage === 'string' ? topLevelPage : null);
            const parsed = parseInt(pageStr ?? '1', 10);
            if (Number.isFinite(parsed)) page = Math.min(Math.max(parsed, 1), 10000);
        }

        const isProd = isProductionHost(request);
        // Modulepreload domyślnie wyłączony (docs/BRIEF_AG_MODULEPRELOAD_EXPERIMENT.md).
        // Wyjście awaryjne przez SSR_MODULEPRELOAD=on.
        const modulepreloadEnabled = process.env.SSR_MODULEPRELOAD === 'on';

        // Na /samochody make/model wpływają na canonical tylko jeśli pasują do katalogu (resolveSamochodyQueryCanonical).
        // Włączamy canonical do klucza tylko gdy się rozwiązuje, chroniąc Redis przed losowymi parametrami ?make=...
        let cacheKey = (isProd ? '' : 'nonprod:') + (modulepreloadEnabled ? 'preload:' : '') + (page > 1 ? `${path}?page=${page}` : path);
        if (path === '/samochody' && searchParams) {
            const canonicalResolved = await resolveSamochodyQueryCanonical(fastify, searchParams);
            if (canonicalResolved) {
                cacheKey += `${cacheKey.includes('?') ? '&' : '?'}canonical=${canonicalResolved}`;
            }
        }

        const cached = await getSsrCache(cacheKey);
        if (cached) {
            if (!isSsrFresh(cached)) {
                if (markRevalidating(cacheKey)) {
                    (async () => {
                        try {
                            await renderAndCache(fastify, path, page, searchParams, cacheKey, isProd, modulepreloadEnabled);
                        } catch (err: any) {
                            fastify.log.warn({ err: err?.message, cacheKey }, '[SsrCache] Background revalidation failed');
                        } finally {
                            clearRevalidating(cacheKey);
                        }
                    })();
                }
            }

            if (cached.status === 301 && cached.redirectUrl) {
                return reply
                    .code(301)
                    .header('Location', cached.redirectUrl)
                    .header('Cache-Control', 'public, max-age=86400')
                    .send();
            }
            const cacheControl = getCacheControlHeader(request, cached.status, path, cached.noindex);
            return reply
                .code(cached.status)
                .header('Content-Type', 'text/html; charset=utf-8')
                .header('Cache-Control', cacheControl)
                // Global @fastify/cors (app.ts) sets `Vary: Origin` on every response via an
                // onRequest hook, which runs before this handler. /api/render is never called
                // cross-origin (nginx proxies to it server-side), and Cloudflare only honours
                // `Vary: Accept-Encoding` — any other Vary value makes edge caching unreliable.
                // Overwrite it here, scoped to this route only.
                .header('Vary', 'Accept-Encoding')
                .send(cached.html);
        }

        const result = await renderAndCache(fastify, path, page, searchParams, cacheKey, isProd, modulepreloadEnabled);
        if (!result) {
            return reply.code(503).send({ error: 'template unavailable' });
        }

        if (result.status === 301 && result.redirectUrl) {
            return reply
                .code(301)
                .header('Location', result.redirectUrl)
                .header('Cache-Control', 'public, max-age=86400')
                .send();
        }

        const cacheControl = getCacheControlHeader(request, result.status, path, result.noindex);

        return reply
            .code(result.status)
            .header('Content-Type', 'text/html; charset=utf-8')
            .header('Cache-Control', cacheControl)
            // See comment on the pageCache-hit send above: overwrite CORS's `Vary: Origin`
            // with `Vary: Accept-Encoding` for Cloudflare edge-cache compatibility.
            .header('Vary', 'Accept-Encoding')
            .send(result.html);
    });
}
