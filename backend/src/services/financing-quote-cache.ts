import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { getJsonFromCache, setJsonInCache } from './api-cache.js';

/** Ważność wyniku partnera (TTL w Redisie i wiek wpisu w bazie). 36 h > odstęp nocnego crona (24 h). */
export const QUOTE_TTL_SECONDS = 36 * 3600;

interface QuoteParams {
    price: number;
    downPaymentAmount: number;
    period: number;
    initialFeePercent?: number;
    finalPaymentPercent?: number;
    manufacturingYear?: number;
    mileageKm?: number;
}

/**
 * Klucz wyniku kalkulacji partnera. updatedAt produktu/połączenia w kluczu — edycja w panelu
 * omija stare wpisy bez osobnej inwalidacji. Bez prefiksu namespace (dokleja go api-cache dla Redisa).
 */
export function buildFinancingQuoteKey(
    product: { id: string; updatedAt: Date },
    connection: { updatedAt: Date },
    params: QuoteParams
): string {
    const paramsHash = createHash('sha1').update(JSON.stringify({
        price: params.price,
        downPaymentAmount: params.downPaymentAmount,
        period: params.period,
        initialFeePercent: params.initialFeePercent ?? null,
        finalPaymentPercent: params.finalPaymentPercent ?? null,
        manufacturingYear: params.manufacturingYear ?? null,
        mileageKm: params.mileageKm ?? null,
    })).digest('hex');
    return `financing:calc:v1:${product.id}:${product.updatedAt.getTime()}:${connection.updatedAt.getTime()}:${paramsHash}`;
}

/** Redis, a przy braku — tabela financing_quotes (trafienie z bazy dogrzewa Redis). */
export async function getFinancingQuote(prisma: PrismaClient, key: string): Promise<unknown | null> {
    const cached = await getJsonFromCache<unknown>(key);
    if (cached) return cached;

    const row = await prisma.financingQuote.findUnique({ where: { cacheKey: key } });
    if (!row || row.computedAt.getTime() < Date.now() - QUOTE_TTL_SECONDS * 1000) return null;

    await setJsonInCache(key, row.response, QUOTE_TTL_SECONDS);
    return row.response;
}

/** Zapis do Redisa i bazy. Błąd zapisu do bazy jest tylko logowany — cache nie może psuć odpowiedzi. */
export async function saveFinancingQuote(prisma: PrismaClient, key: string, productId: string, response: unknown): Promise<void> {
    await setJsonInCache(key, response, QUOTE_TTL_SECONDS);
    try {
        const json = response as any;
        const now = new Date();
        await prisma.financingQuote.upsert({
            where: { cacheKey: key },
            create: { cacheKey: key, productId, response: json, computedAt: now },
            update: { productId, response: json, computedAt: now },
        });
    } catch (err: any) {
        console.warn(`[FinancingQuote] Błąd zapisu wyniku "${key}":`, err?.message);
    }
}
