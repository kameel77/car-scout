/**
 * Slug resolver dla stron marek/modeli (/samochody/:marka, /samochody/:marka/:model).
 *
 * Normalizacja: distinct `make`/`model` z aktywnych ofert (isArchived: false) grupowane
 * pod kanoniczną nazwą (normalizeBrand/normalizeModel), następnie slugified. Kolizje slugów
 * (dwie różne kanoniczne nazwy dające ten sam slug) rozstrzyga pierwsze dopasowanie
 * w porządku alfabetycznym — kolejne warianty są nieosiągalne (edge case, w praktyce
 * normalizeBrand/normalizeModel już eliminuje większość kolizji).
 *
 * Slugify jest lokalny (nie reużywa `sanitizeForSlug` z url-utils.ts używanego przez slugi
 * ofert) — marki motoryzacyjne noszą diakrytyki spoza polskiego alfabetu (czeskie Škoda,
 * francuskie Citroën), więc oprócz mapy polskich znaków (ten sam wzorzec co w url-utils.ts)
 * dokładamy ogólną dekompozycję Unicode (NFD) jako fallback. Ł/ł nie da się rozłożyć przez
 * NFD (to odrębna litera, nie znak bazowy + akcent), dlatego zostaje osobną mapą. Celowo
 * nie dotykamy współdzielonego sanitizeForSlug, żeby nie zmieniać istniejących slugów ofert.
 *
 * Znane ograniczenie F1 (bez CMS): katalog istnieje tylko dla marek/modeli z >=1 AKTYWNĄ
 * ofertą (tak jak `/api/listings/options`, na którym się wzorujemy). Marka/model, której
 * ostatnia aktywna oferta zostanie zarchiwizowana, zniknie z tego katalogu i jej strona
 * zwróci 404 zamiast zostać jako 200+noindex ("rotacja stocku" ze spec §1).
 *
 * F2 (częściowa poprawka): `getBrandCatalogAllTime`/`getModelCatalogAllTime` poniżej ignorują
 * isArchived i służą jako fallback w render.ts WYŁĄCZNIE gdy strona ma opublikowaną treść
 * CMS (SeoContentPage) — wtedy trwałość jest zapewniona (200+treść+indeksowalność) mimo
 * 0 aktywnych ofert. Bez treści CMS ograniczenie z F1 pozostaje (404) — pełny rejestr
 * niezależny od ofert (osobne pole nazwy marki/modelu w CMS) to potencjalny zakres F3+.
 */
import { FastifyInstance } from 'fastify';
import { normalizeBrand, normalizeModel } from './brand-normalization.service.js';

const POLISH_CHARS: Record<string, string> = {
    'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n',
    'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
    'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N',
    'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z',
};

// Zakres Unicode combining diacritical marks (U+0300–U+036F) — to, co zostaje po
// normalize('NFD') rozbiciu znaku typu Š/ë na literę bazową + oddzielny znak akcentu.
const COMBINING_MARKS_RE = /[\u0300-\u036f]/g;

// Eksportowana też do seo-meta.ts (breadcrumb ofert) — jedno źródło prawdy dla slugów
// marki/modelu, żeby linki na kartach ofert zawsze trafiały w prawdziwą stronę marki/modelu.
export function slugifyBrandName(text: string): string {
    const polishMapped = text.split('').map(ch => POLISH_CHARS[ch] || ch).join('');
    const asciiish = polishMapped.normalize('NFD').replace(COMBINING_MARKS_RE, '');
    return asciiish
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export interface BrandCatalogEntry {
    make: string; // kanoniczna nazwa marki (do wyświetlania)
    slug: string;
    count: number; // aktywne oferty (suma po wariantach zapisu)
    rawMakes: string[]; // surowe wartości `make` w bazie mapujące się na tę markę
    lastmod: Date | null; // max(updatedAt) po aktywnych ofertach marki — do sitemapy
}

export interface ModelCatalogEntry {
    model: string; // kanoniczna nazwa modelu
    slug: string;
    count: number;
    rawModels: string[];
    lastmod: Date | null;
}

function buildCatalog<T>(
    rows: { raw: string; key: string; count: number; lastmod: Date | null }[],
    makeEntry: (name: string, slug: string, count: number, raws: string[], lastmod: Date | null) => T
): T[] {
    const byCanonical = new Map<string, { count: number; raws: string[]; lastmod: Date | null }>();
    for (const r of rows) {
        const entry = byCanonical.get(r.key) ?? { count: 0, raws: [], lastmod: null };
        entry.count += r.count;
        entry.raws.push(r.raw);
        if (r.lastmod && (!entry.lastmod || r.lastmod > entry.lastmod)) entry.lastmod = r.lastmod;
        byCanonical.set(r.key, entry);
    }
    const names = [...byCanonical.keys()].sort((a, b) => a.localeCompare(b, 'pl'));
    const usedSlugs = new Set<string>();
    const result: T[] = [];
    for (const name of names) {
        const slug = slugifyBrandName(name);
        if (!slug || usedSlugs.has(slug)) continue;
        usedSlugs.add(slug);
        const e = byCanonical.get(name)!;
        result.push(makeEntry(name, slug, e.count, e.raws, e.lastmod));
    }
    return result;
}

// Pure — testowalne bez bazy danych. `rows` to surowe (make, count, lastmod) z groupBy.
export function buildBrandCatalog(rows: { make: string; count: number; lastmod?: Date | null }[]): BrandCatalogEntry[] {
    const canonicalRows = rows.map(r => ({ raw: r.make, key: normalizeBrand(r.make), count: r.count, lastmod: r.lastmod ?? null }));
    return buildCatalog(canonicalRows, (make, slug, count, rawMakes, lastmod) => ({ make, slug, count, rawMakes, lastmod }));
}

// Pure — jak wyżej, dla modeli w obrębie jednej marki.
export function buildModelCatalog(rows: { model: string; count: number; lastmod?: Date | null }[]): ModelCatalogEntry[] {
    const canonicalRows = rows.map(r => ({ raw: r.model, key: normalizeModel(r.model), count: r.count, lastmod: r.lastmod ?? null }));
    return buildCatalog(canonicalRows, (model, slug, count, rawModels, lastmod) => ({ model, slug, count, rawModels, lastmod }));
}

const CATALOG_TTL_MS = 60 * 1000;
let brandCatalogCache: { value: BrandCatalogEntry[]; at: number } | null = null;
const modelCatalogCache = new Map<string, { value: ModelCatalogEntry[]; at: number }>();

export async function getBrandCatalog(fastify: FastifyInstance): Promise<BrandCatalogEntry[]> {
    if (brandCatalogCache && Date.now() - brandCatalogCache.at < CATALOG_TTL_MS) {
        return brandCatalogCache.value;
    }
    const rows = await fastify.prisma.listing.groupBy({
        by: ['make'],
        where: { isArchived: false },
        _count: { _all: true },
        _max: { updatedAt: true },
    });
    const value = buildBrandCatalog(rows.map(r => ({ make: r.make, count: r._count._all, lastmod: r._max.updatedAt })));
    brandCatalogCache = { value, at: Date.now() };
    return value;
}

export async function getModelCatalog(fastify: FastifyInstance, rawMakes: string[]): Promise<ModelCatalogEntry[]> {
    if (rawMakes.length === 0) return [];
    const cacheKey = rawMakes.slice().sort().join(',').toLowerCase();
    const cached = modelCatalogCache.get(cacheKey);
    if (cached && Date.now() - cached.at < CATALOG_TTL_MS) {
        return cached.value;
    }
    const rows = await fastify.prisma.listing.groupBy({
        by: ['model'],
        where: { isArchived: false, make: { in: rawMakes, mode: 'insensitive' } },
        _count: { _all: true },
        _max: { updatedAt: true },
    });
    const value = buildModelCatalog(rows.map(r => ({ model: r.model, count: r._count._all, lastmod: r._max.updatedAt })));
    modelCatalogCache.set(cacheKey, { value, at: Date.now() });
    return value;
}

export function __resetBrandCatalogCache() {
    brandCatalogCache = null;
    modelCatalogCache.clear();
}

// Fallback dla trwałości stron marek/modeli z opublikowaną treścią CMS (F2, spec §1 pkt 4e):
// katalog aktywnych ofert (getBrandCatalog/getModelCatalog) nie zwraca marek/modeli bez
// choćby jednej aktywnej oferty, więc taka strona 404uje mimo opublikowanej treści CMS.
// Te warianty ignorują isArchived — służą wyłącznie do odtworzenia kanonicznej nazwy
// marki/modelu po slugu, nigdy do liczenia widocznych ofert. Bez cache (wywoływane tylko
// jako fallback, gdy aktywny katalog nie znalazł dopasowania).
export async function getBrandCatalogAllTime(fastify: FastifyInstance): Promise<BrandCatalogEntry[]> {
    const rows = await fastify.prisma.listing.groupBy({
        by: ['make'],
        _count: { _all: true },
        _max: { updatedAt: true },
    });
    return buildBrandCatalog(rows.map(r => ({ make: r.make, count: r._count._all, lastmod: r._max.updatedAt })));
}

export async function getModelCatalogAllTime(fastify: FastifyInstance, rawMakes: string[]): Promise<ModelCatalogEntry[]> {
    if (rawMakes.length === 0) return [];
    const rows = await fastify.prisma.listing.groupBy({
        by: ['model'],
        where: { make: { in: rawMakes, mode: 'insensitive' } },
        _count: { _all: true },
        _max: { updatedAt: true },
    });
    return buildModelCatalog(rows.map(r => ({ model: r.model, count: r._count._all, lastmod: r._max.updatedAt })));
}
