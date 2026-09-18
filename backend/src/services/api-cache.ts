import type { Redis } from 'ioredis';
import { gzip, gunzip } from 'node:zlib';
import { promisify } from 'node:util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

let redisClient: Redis | null = null;

export function initApiCache(redis: Redis): void {
    redisClient = redis;
}

export function getApiRedisClient(): Redis | null {
    return redisClient;
}

export function getApiNamespace(): string {
    const brand = (process.env.BRAND || 'motolia').toLowerCase();
    const env = (process.env.APP_ENV || process.env.NODE_ENV || 'development').toLowerCase();
    let host = '';
    try {
        if (process.env.FRONTEND_URL) {
            const parsed = new URL(process.env.FRONTEND_URL).hostname.replace(/\./g, '_');
            if (parsed) host = `:${parsed}`;
        }
    } catch (_err) {
        host = '';
    }
    return `${brand}:${env}${host}`;
}

export function getApiCacheKey(key: string): string {
    return `${getApiNamespace()}:api:v1:${key}`;
}

export async function getJsonFromCache<T>(key: string): Promise<T | null> {
    if (!redisClient) return null;
    try {
        const fullKey = getApiCacheKey(key);
        const buffer = await redisClient.getBuffer(fullKey);
        if (!buffer) return null;
        // Check gzip magic bytes 0x1f, 0x8b
        if (buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
            const decompressed = await gunzipAsync(buffer);
            return JSON.parse(decompressed.toString('utf-8')) as T;
        }
        return JSON.parse(buffer.toString('utf-8')) as T;
    } catch (err: any) {
        console.warn(`[ApiCache] Error reading key "${key}":`, err?.message);
        return null;
    }
}

export async function setJsonInCache<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
    if (!redisClient || data === null || data === undefined) return;
    try {
        const fullKey = getApiCacheKey(key);
        const jsonStr = JSON.stringify(data);
        if (jsonStr.length > 512) {
            const compressed = await gzipAsync(Buffer.from(jsonStr, 'utf-8'));
            await redisClient.set(fullKey, compressed, 'EX', ttlSeconds);
        } else {
            await redisClient.set(fullKey, jsonStr, 'EX', ttlSeconds);
        }
    } catch (err: any) {
        console.warn(`[ApiCache] Error setting key "${key}":`, err?.message);
    }
}

const inFlightRequests = new Map<string, Promise<any>>();

export async function getOrSetJson<T>(
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>
): Promise<T> {
    const cached = await getJsonFromCache<T>(key);
    if (cached !== null) {
        return cached;
    }

    const existingPromise = inFlightRequests.get(key);
    if (existingPromise) {
        return existingPromise as Promise<T>;
    }

    const fetchPromise = (async () => {
        try {
            const fresh = await fetcher();
            if (fresh !== null && fresh !== undefined) {
                await setJsonInCache(key, fresh, ttlSeconds);
            }
            return fresh;
        } finally {
            inFlightRequests.delete(key);
        }
    })();

    inFlightRequests.set(key, fetchPromise);
    return fetchPromise;
}

export async function evictApiCacheKeys(patternsOrUrls: string[]): Promise<void> {
    if (!redisClient || patternsOrUrls.length === 0) return;
    try {
        let cursor = '0';
        const prefix = `${getApiNamespace()}:api:v1:`;
        const matchPattern = `${prefix}*`;
        const keysToDelete: string[] = [];
        do {
            const [nextCursor, keys] = await redisClient.scan(cursor, 'MATCH', matchPattern, 'COUNT', 200);
            cursor = nextCursor;
            for (const redisKey of keys) {
                const subKey = redisKey.slice(prefix.length);
                for (const target of patternsOrUrls) {
                    if (target.endsWith('*')) {
                        const targetPrefix = target.slice(0, -1);
                        if (subKey.startsWith(targetPrefix)) {
                            keysToDelete.push(redisKey);
                            break;
                        }
                    }

                    // Extract slug if target is a path like /oferta/slug or /samochody/marka/model/slug
                    const segments = target.split('/').filter(Boolean);
                    const lastSegment = segments[segments.length - 1] || '';

                    const isListingTarget = target.includes('/oferta/') || target.includes('/samochody') || target === 'listings:list:*';
                    const isRentalTarget = target.includes('/wynajem-dlugoterminowy') || target === 'rental:vehicles:list:*';

                    if (
                        subKey === target ||
                        subKey.startsWith(`${target}:`) ||
                        subKey.startsWith(`${target}?`) ||
                        (lastSegment && subKey === `listings:by-slug:${lastSegment}`) ||
                        (lastSegment && subKey === `rental:vehicles:${lastSegment}`) ||
                        (isListingTarget && subKey.startsWith('listings:list:')) ||
                        (isRentalTarget && subKey.startsWith('rental:vehicles:list:'))
                    ) {
                        keysToDelete.push(redisKey);
                        break;
                    }
                }
            }
        } while (cursor !== '0');

        if (keysToDelete.length > 0) {
            for (let i = 0; i < keysToDelete.length; i += 100) {
                const batch = keysToDelete.slice(i, i + 100);
                await redisClient.del(...batch);
            }
        }
    } catch (err: any) {
        console.warn('[ApiCache] Error evicting API cache keys:', err?.message);
    }
}

export async function clearApiCache(): Promise<void> {
    if (!redisClient) return;
    try {
        let cursor = '0';
        const matchPattern = `${getApiNamespace()}:api:v1:*`;
        do {
            const [nextCursor, keys] = await redisClient.scan(cursor, 'MATCH', matchPattern, 'COUNT', 200);
            cursor = nextCursor;
            if (keys.length > 0) {
                for (let i = 0; i < keys.length; i += 100) {
                    const batch = keys.slice(i, i + 100);
                    await redisClient.del(...batch);
                }
            }
        } while (cursor !== '0');
    } catch (err: any) {
        console.warn('[ApiCache] Error clearing API cache:', err?.message);
    }
}

export function parseIntOrUndefined(val: unknown): number | undefined {
    if (val === undefined || val === null || val === '') return undefined;
    const parsed = parseInt(String(val), 10);
    return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseStringList(val: unknown): string[] | undefined {
    if (!val) return undefined;
    const arr = (Array.isArray(val) ? val : String(val).split(','))
        .map(s => String(s).trim())
        .filter(Boolean);
    return arr.length > 0 ? [...new Set(arr)] : undefined;
}

export interface ParsedListingsQuery {
    page: number;
    perPage: number;
    q?: string;
    make?: string[];
    model?: string[];
    priceMin?: number;
    priceMax?: number;
    yearMin?: number;
    yearMax?: number;
    mileageMin?: number;
    mileageMax?: number;
    powerMin?: number;
    powerMax?: number;
    capacityMin?: number;
    capacityMax?: number;
    fuelType?: string[];
    transmission?: string[];
    bodyType?: string[];
    drive?: string[];
    status?: ('NEW' | 'USED')[];
    sortBy?: string;
    currency: string;
    city?: string[];
    rateType: string;
    rateBasis: string;
    rateMin?: number;
    rateMax?: number;
    includeArchived: boolean;
    lastManualEditBefore?: string;
    entrySource?: string;
}

function parseBoundedInt(val: any, min: number, max: number): number | undefined {
    const num = parseIntOrUndefined(val);
    if (num === undefined) return undefined;
    return Math.min(max, Math.max(min, num));
}

export function parseListingsQuery(query: Record<string, any>): ParsedListingsQuery {
    const rawPage = parseIntOrUndefined(query.page);
    const page = Math.min(10000, Math.max(1, rawPage ?? 1));

    const rawPerPage = parseIntOrUndefined(query.perPage);
    const perPage = rawPerPage === 60 ? 60 : 30;

    const rawQ = typeof query.q === 'string' ? query.q.trim().slice(0, 100) : undefined;
    const q = rawQ || undefined;

    const make = parseStringList(query.make);
    const model = parseStringList(query.model);
    const fuelType = parseStringList(query.fuelType);
    const transmission = parseStringList(query.transmission);
    const bodyType = parseStringList(query.bodyType);
    const drive = parseStringList(query.drive);
    const city = parseStringList(query.city);

    const rawStatus = parseStringList(query.status);
    const status = rawStatus
        ?.map(s => s.toUpperCase())
        .filter((s): s is 'NEW' | 'USED' => s === 'NEW' || s === 'USED');

    const sortBy = typeof query.sortBy === 'string' && query.sortBy.trim() ? query.sortBy.trim() : undefined;
    const currency = typeof query.currency === 'string' ? query.currency.trim().toUpperCase() : 'PLN';

    const rateType = typeof query.rateType === 'string' ? query.rateType.trim().toLowerCase() : 'lease';
    const rateBasis = typeof query.rateBasis === 'string' ? query.rateBasis.trim().toLowerCase() : 'gross';

    const includeArchived = String(query.includeArchived || '').trim().toLowerCase() === 'true';

    const allowedSources = new Set(['MANUAL', 'CSV', 'CSFLOW', 'PEWNEAUTO', 'AGENT']);
    let entrySource: string | undefined;
    if (typeof query.entrySource === 'string') {
        const upper = query.entrySource.trim().toUpperCase();
        if (allowedSources.has(upper)) entrySource = upper;
    }

    return {
        page,
        perPage,
        q,
        make,
        model,
        priceMin: parseBoundedInt(query.priceMin, 0, 100_000_000),
        priceMax: parseBoundedInt(query.priceMax, 0, 100_000_000),
        yearMin: parseBoundedInt(query.yearMin, 1900, 2100),
        yearMax: parseBoundedInt(query.yearMax, 1900, 2100),
        mileageMin: parseBoundedInt(query.mileageMin, 0, 2_000_000),
        mileageMax: parseBoundedInt(query.mileageMax, 0, 2_000_000),
        powerMin: parseBoundedInt(query.powerMin, 0, 5_000),
        powerMax: parseBoundedInt(query.powerMax, 0, 5_000),
        capacityMin: parseBoundedInt(query.capacityMin, 0, 20_000),
        capacityMax: parseBoundedInt(query.capacityMax, 0, 20_000),
        fuelType,
        transmission,
        bodyType,
        drive,
        status: status && status.length > 0 ? status : undefined,
        sortBy,
        currency,
        city,
        rateType,
        rateBasis,
        rateMin: parseBoundedInt(query.rateMin, 0, 1_000_000),
        rateMax: parseBoundedInt(query.rateMax, 0, 1_000_000),
        includeArchived,
        lastManualEditBefore: typeof query.lastManualEditBefore === 'string' ? query.lastManualEditBefore.trim() : undefined,
        entrySource,
    };
}

export function buildListingsQueryCacheKey(query: Record<string, any>): string {
    const parsed = parseListingsQuery(query);
    const params: [string, string][] = [];

    const append = (key: string, val: string | number | boolean | undefined) => {
        if (val !== undefined && val !== null && val !== '') params.push([key, String(val)]);
    };

    const appendList = (key: string, list: string[] | undefined) => {
        if (list && list.length > 0) {
            params.push([key, list.map(s => s.toLowerCase()).sort().join(',')]);
        }
    };

    append('page', parsed.page);
    append('perpage', parsed.perPage);
    if (parsed.q) append('q', parsed.q.toLowerCase());
    appendList('make', parsed.make);
    appendList('model', parsed.model);
    append('pricemin', parsed.priceMin);
    append('pricemax', parsed.priceMax);
    append('yearmin', parsed.yearMin);
    append('yearmax', parsed.yearMax);
    append('mileagemin', parsed.mileageMin);
    append('mileagemax', parsed.mileageMax);
    append('powermin', parsed.powerMin);
    append('powermax', parsed.powerMax);
    append('capacitymin', parsed.capacityMin);
    append('capacitymax', parsed.capacityMax);
    appendList('fueltype', parsed.fuelType);
    appendList('transmission', parsed.transmission);
    appendList('bodytype', parsed.bodyType);
    appendList('drive', parsed.drive);
    appendList('status', parsed.status);
    if (parsed.sortBy) append('sortby', parsed.sortBy.toLowerCase());
    if (parsed.currency === 'EUR') append('currency', 'EUR');
    appendList('city', parsed.city);
    append('ratetype', parsed.rateType);
    append('ratebasis', parsed.rateBasis);
    append('ratemin', parsed.rateMin);
    append('ratemax', parsed.rateMax);
    if (parsed.includeArchived) append('includearchived', 'true');
    append('lastmanualeditbefore', parsed.lastManualEditBefore);
    append('entrysource', parsed.entrySource);

    params.sort((a, b) => a[0].localeCompare(b[0]));
    const queryString = params.map(([k, v]) => `${k}=${v}`).join('&');

    return `listings:list:${queryString}`;
}

const VALID_RENTAL_SORT_FIELDS = [
    'createdAt',
    'sellingPrice',
    'make',
    'productionYear',
    'catalogPrice',
    'minMonthlyRateNet',
    'minMonthlyRateGross'
];

export interface ParsedRentalVehiclesQuery {
    page: number;
    limit: number;
    search?: string;
    make?: string[];
    model?: string[];
    bodyType?: string[];
    fuelType?: string[];
    transmission?: string[];
    drive?: string[];
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    offerType?: 'business' | 'consumer';
    yearFrom?: number;
    yearTo?: number;
    priceFrom?: number;
    priceTo?: number;
    priceBasis: 'net' | 'gross';
    mileageFrom?: number;
    mileageTo?: number;
    powerFrom?: number;
    powerTo?: number;
    capacityFrom?: number;
    capacityTo?: number;
    condition?: ('NEW' | 'USED')[];
}

export function parseRentalVehiclesQuery(query: Record<string, any>): ParsedRentalVehiclesQuery {
    const rawPage = parseIntOrUndefined(query.page);
    const page = Math.min(10000, Math.max(1, rawPage ?? 1));

    const rawLimit = parseIntOrUndefined(query.limit);
    const limit = Math.min(50, Math.max(1, rawLimit ?? 12));

    const rawSearch = typeof query.search === 'string' ? query.search.trim().slice(0, 100) : undefined;
    const search = rawSearch || undefined;

    const make = parseStringList(query.make);
    const model = parseStringList(query.model);
    const bodyType = parseStringList(query.bodyType);
    const fuelType = parseStringList(query.fuelType);
    const transmission = parseStringList(query.transmission);
    const drive = parseStringList(query.drive);

    const rawSortBy = typeof query.sortBy === 'string' ? query.sortBy.trim() : 'createdAt';
    const sortBy = VALID_RENTAL_SORT_FIELDS.includes(rawSortBy) ? rawSortBy : 'createdAt';

    const rawSortOrder = typeof query.sortOrder === 'string' ? query.sortOrder.trim().toLowerCase() : 'desc';
    const sortOrder: 'asc' | 'desc' = rawSortOrder === 'asc' ? 'asc' : 'desc';

    const rawOfferType = typeof query.offerType === 'string' ? query.offerType.trim().toLowerCase() : undefined;
    let offerType: 'business' | 'consumer' | undefined = undefined;
    if (rawOfferType) {
        if (['b2b', 'firma', 'business'].includes(rawOfferType)) offerType = 'business';
        else if (['b2c', 'prywatnie', 'prywatny', 'consumer'].includes(rawOfferType)) offerType = 'consumer';
    }

    const rawPriceBasis = typeof query.priceBasis === 'string' ? query.priceBasis.trim().toLowerCase() : 'gross';
    const priceBasis: 'net' | 'gross' = rawPriceBasis === 'net' ? 'net' : 'gross';

    const rawCondition = parseStringList(query.condition);
    const condition = rawCondition
        ?.map(s => s.toUpperCase())
        .filter((s): s is 'NEW' | 'USED' => s === 'NEW' || s === 'USED');

    return {
        page,
        limit,
        search,
        make,
        model,
        bodyType,
        fuelType,
        transmission,
        drive,
        sortBy,
        sortOrder,
        offerType,
        yearFrom: parseBoundedInt(query.yearFrom, 1900, 2100),
        yearTo: parseBoundedInt(query.yearTo, 1900, 2100),
        priceFrom: parseBoundedInt(query.priceFrom, 0, 100_000_000),
        priceTo: parseBoundedInt(query.priceTo, 0, 100_000_000),
        priceBasis,
        mileageFrom: parseBoundedInt(query.mileageFrom, 0, 2_000_000),
        mileageTo: parseBoundedInt(query.mileageTo, 0, 2_000_000),
        powerFrom: parseBoundedInt(query.powerFrom, 0, 5_000),
        powerTo: parseBoundedInt(query.powerTo, 0, 5_000),
        capacityFrom: parseBoundedInt(query.capacityFrom, 0, 20_000),
        capacityTo: parseBoundedInt(query.capacityTo, 0, 20_000),
        condition: condition && condition.length > 0 ? condition : undefined,
    };
}

export function buildRentalVehiclesQueryCacheKey(query: Record<string, any>): string {
    const parsed = parseRentalVehiclesQuery(query);
    const params: [string, string][] = [];

    const append = (key: string, val: string | number | boolean | undefined) => {
        if (val !== undefined && val !== null && val !== '') params.push([key, String(val)]);
    };

    const appendList = (key: string, list: string[] | undefined) => {
        if (list && list.length > 0) {
            params.push([key, list.map(s => s.toLowerCase()).sort().join(',')]);
        }
    };

    append('page', parsed.page);
    append('limit', parsed.limit);
    if (parsed.search) append('search', parsed.search.toLowerCase());
    appendList('make', parsed.make);
    appendList('model', parsed.model);
    appendList('bodytype', parsed.bodyType);
    appendList('fueltype', parsed.fuelType);
    appendList('transmission', parsed.transmission);
    appendList('drive', parsed.drive);
    append('sortby', parsed.sortBy);
    append('sortorder', parsed.sortOrder);
    append('offertype', parsed.offerType);
    append('yearfrom', parsed.yearFrom);
    append('yearto', parsed.yearTo);
    append('pricefrom', parsed.priceFrom);
    append('priceto', parsed.priceTo);
    append('pricebasis', parsed.priceBasis);
    append('mileagefrom', parsed.mileageFrom);
    append('mileageto', parsed.mileageTo);
    append('powerfrom', parsed.powerFrom);
    append('powerto', parsed.powerTo);
    append('capacityfrom', parsed.capacityFrom);
    append('capacityto', parsed.capacityTo);
    appendList('condition', parsed.condition);

    params.sort((a, b) => a[0].localeCompare(b[0]));
    const queryString = params.map(([k, v]) => `${k}=${v}`).join('&');

    return `rental:vehicles:list:${queryString}`;
}

export function buildListingSlugCacheKey(slug: string): string {
    return `listings:by-slug:${slug.trim()}`;
}

export function buildRentalVehicleSlugCacheKey(slug: string): string {
    return `rental:vehicles:${slug.trim()}`;
}
