import { PrismaClient, FinancingProduct, FinancingProviderConnection } from '@prisma/client';
import cron from 'node-cron';

// ---------------------------------------------------------------------------
// Shared partner-API plumbing (moved from routes/financing.ts so it can be
// reused by both the live /api/financing/calculate endpoint and the
// reference-installment engine below — behavior/format is unchanged).
// ---------------------------------------------------------------------------

const vehisTokenCache = new Map<string, { token: string; expiresAt: number }>();
const VEHIS_TOKEN_TTL_MS = 50 * 60 * 1000;

export const fetchWithTimeout = async (url: string, options: any, timeoutMs = 15000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
};

export const getVehisToken = async (connection: { apiBaseUrl: string; apiKey: string; apiSecret?: string | null }) => {
    const baseUrl = connection.apiBaseUrl.replace(/\/$/, '');
    const cacheKey = `${baseUrl}:${connection.apiKey}`;
    const cached = vehisTokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.token;
    }

    if (!connection.apiKey || !connection.apiSecret) {
        throw new Error('Missing Vehis credentials');
    }

    const loginUrl = `${baseUrl}/login`;
    const body = new URLSearchParams({
        email: connection.apiKey || process.env.VEHIS_LOGIN || '',
        password: connection.apiSecret || process.env.VEHIS_PASSWORD || ''
    });

    const response = await fetchWithTimeout(loginUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(errorData?.message || 'Vehis authentication failed');
    }

    const result = await response.json().catch(() => ({})) as { token?: string };
    if (!result.token) {
        throw new Error('Vehis authentication failed');
    }

    vehisTokenCache.set(cacheKey, { token: result.token, expiresAt: Date.now() + VEHIS_TOKEN_TTL_MS });
    return result.token;
};

/** Thrown by calc*Installment helpers to signal the exact HTTP status/body the route should reply with. */
export class FinancingCalcError extends Error {
    statusCode: number;
    body: Record<string, any>;
    constructor(statusCode: number, body: Record<string, any>) {
        super(typeof body?.error === 'string' ? body.error : 'FinancingCalcError');
        this.statusCode = statusCode;
        this.body = body;
    }
}

type ConnectionLike = Pick<FinancingProviderConnection, 'apiBaseUrl' | 'apiKey' | 'apiSecret' | 'shopUuid'>;

export interface CalcParams {
    price: number;
    downPaymentAmount: number;
    period: number;
    initialFeePercent?: number;
    finalPaymentPercent?: number;
    manufacturingYear?: number;
    mileageKm?: number;
}

type SimpleLogger = { error: (...args: any[]) => void };

/** Calls INBANK partner API. Extracted verbatim from routes/financing.ts — same payload/response mapping. */
export async function calcInbankInstallment(
    product: FinancingProduct,
    connection: ConnectionLike,
    params: CalcParams,
    log: SimpleLogger
) {
    const config = (product.providerConfig || {}) as Record<string, any>;
    if (!config.productCode || !config.paymentDay) {
        throw new FinancingCalcError(422, { error: 'Missing provider configuration' });
    }

    const payload: Record<string, any> = {
        product_code: config.productCode,
        amount: params.price - params.downPaymentAmount,
        period: params.period,
        payment_day: config.paymentDay
    };
    payload.response_level = config.responseLevel || 'advanced';

    const rawBaseUrl = (process.env.INBANK_BASE_URL || connection.apiBaseUrl).replace(/\/$/, '');
    const baseUrl = rawBaseUrl.replace(/\/partner(\/v2)?$/, '');
    const apiKey = config.apiKey || connection.apiKey;
    const shopUuid = config.shopUuid || connection.shopUuid;

    const url = `${baseUrl}/partner/v2/shops/${shopUuid}/calculations`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    if (!response.ok) {
        log.error({
            provider: 'INBANK',
            status: response.status,
            body: responseText?.slice(0, 800),
            request: { product_code: payload.product_code, amount: payload.amount, period: payload.period, payment_day: payload.payment_day, response_level: payload.response_level }
        }, 'INBANK provider error');
        throw new FinancingCalcError(502, { error: 'Provider request failed' });
    }

    let result: any = {};
    try { result = JSON.parse(responseText); } catch { /* non-JSON response */ }

    // Inbank documentation says payment_amount_monthly or installment_amount
    const monthlyInstallment = Number(
        result?.payment_amount_monthly
        ?? result?.paymentAmountMonthly
        ?? result?.installment_amount
        ?? result?.installmentAmount
        ?? result?.monthly_payment
        ?? result?.monthlyPayment
    );

    if (!Number.isFinite(monthlyInstallment)) {
        log.error({ provider: 'INBANK', resultKeys: Object.keys(result) }, 'INBANK invalid response format');
        throw new FinancingCalcError(502, { error: 'Invalid provider response' });
    }

    // Parse additional fields for RRSO and representative example calculation
    const creditCostRateAnnual = Number(result?.credit_cost_rate_annual ?? result?.creditCostRateAnnual);
    const interestRateAnnual = Number(result?.interest_rate_annual ?? result?.interestRateAnnual);

    // repaymentsAmountTotal maps to total_cost in Inbank v2
    const repaymentsAmountTotal = Number(
        result?.total_cost
        ?? result?.totalCost
        ?? result?.repayments_amount_total
        ?? result?.repaymentsAmountTotal
        ?? result?.advanced?.repaymentsAmountTotal
        ?? result?.advanced?.repayments_amount_total
    );

    // creditCostAmountTotal maps to total_cost_of_credit in Inbank v2
    const creditCostAmountTotal = Number(
        result?.total_cost_of_credit
        ?? result?.totalCostOfCredit
        ?? result?.credit_cost_amount_total
        ?? result?.creditCostAmountTotal
        ?? result?.advanced?.creditCostAmountTotal
        ?? result?.advanced?.credit_cost_amount_total
    );

    const contractFeeAmountTotal = Number(
        result?.contract_fee
        ?? result?.contractFee
        ?? result?.contract_fee_amount
        ?? result?.contractFeeAmount
        ?? result?.contract_fee_amount_total
        ?? result?.contractFeeAmountTotal
        ?? result?.advanced?.contractFeeAmountTotal
        ?? result?.advanced?.contract_fee_amount_total
        ?? 0
    );

    const interestAmountTotal = Number(
        result?.interest_amount
        ?? result?.interestAmount
        ?? result?.interest_amount_total
        ?? result?.interestAmountTotal
        ?? result?.advanced?.interestAmountTotal
        ?? result?.advanced?.interest_amount_total
    );

    const lastPaymentAmount = Number(
        result?.last_payment_amount
        ?? result?.lastPaymentAmount
        ?? result?.advanced?.lastPaymentAmount
        ?? result?.advanced?.last_payment_amount
    );

    const repaymentsAmountTotalVal = Number.isFinite(repaymentsAmountTotal) ? repaymentsAmountTotal : null;
    const creditCostAmountTotalVal = Number.isFinite(creditCostAmountTotal) ? creditCostAmountTotal : null;
    const contractFeeAmountTotalVal = Number.isFinite(contractFeeAmountTotal) ? contractFeeAmountTotal : 0;

    // Calculate interest dynamically if not provided (repaymentsAmountTotal - netCredit - contractFee)
    let interestAmountTotalVal = Number.isFinite(interestAmountTotal) ? interestAmountTotal : null;
    if (interestAmountTotalVal === null && repaymentsAmountTotalVal !== null) {
        const netCredit = params.price - params.downPaymentAmount;
        interestAmountTotalVal = Math.max(0, repaymentsAmountTotalVal - netCredit - contractFeeAmountTotalVal);
    }

    // Calculate lastPaymentAmount dynamically if not provided (repaymentsAmountTotal - monthlyInstallment * (period - 1))
    const lastPaymentAmountVal = Number.isFinite(lastPaymentAmount)
        ? lastPaymentAmount
        : (repaymentsAmountTotalVal !== null
            ? Math.max(0, repaymentsAmountTotalVal - monthlyInstallment * (params.period - 1))
            : monthlyInstallment);

    return {
        monthlyInstallment,
        provider: product.provider,
        creditCostRateAnnual: Number.isFinite(creditCostRateAnnual) ? creditCostRateAnnual : null,
        interestRateAnnual: Number.isFinite(interestRateAnnual) ? interestRateAnnual : null,
        repaymentsAmountTotal: repaymentsAmountTotalVal,
        creditCostAmountTotal: creditCostAmountTotalVal,
        contractFeeAmountTotal: contractFeeAmountTotalVal,
        interestAmountTotal: interestAmountTotalVal,
        lastPaymentAmount: lastPaymentAmountVal
    };
}

/** Calls VEHIS partner API. Extracted verbatim from routes/financing.ts — same payload/response mapping. */
export async function calcVehisInstallment(
    product: FinancingProduct,
    connection: ConnectionLike,
    params: CalcParams,
    log: SimpleLogger
) {
    const config = (product.providerConfig || {}) as Record<string, any>;
    if (!params.manufacturingYear) {
        throw new FinancingCalcError(422, { error: 'Missing vehicle year' });
    }

    // Vehis API only supports these durations
    const VEHIS_ALLOWED_DURATIONS = [36, 48, 60];
    if (!VEHIS_ALLOWED_DURATIONS.includes(params.period)) {
        throw new FinancingCalcError(422, {
            error: 'Unsupported duration for Vehis',
            details: `Allowed: ${VEHIS_ALLOWED_DURATIONS.join(', ')}`
        });
    }

    const clientType = config.clientType === 'consumer' ? 'consumer' : 'entrepreneur';
    const initialFeePercent = params.initialFeePercent ?? Math.round((params.downPaymentAmount / params.price) * 100);
    const finalPaymentPercent = params.finalPaymentPercent ?? 0;
    const vehicleState = params.mileageKm != null && params.mileageKm > 10 ? 1 : 0;

    // Vehis /broker/calculate does not distinguish netto/brutto explicitly.
    // The API interprets the price based on the client type:
    //   - consumer: frontend sends brutto -> Vehis returns brutto installment
    //   - entrepreneur: frontend sends netto -> Vehis returns netto installment
    // So we pass the price through as-is — no conversion needed.
    const vehisPayload = {
        client: clientType,
        initialFee: Math.max(1, Math.min(product.maxInitialPayment, Math.round(initialFeePercent))),
        repurchase: Math.max(1, Math.min(product.maxFinalPayment, Math.round(finalPaymentPercent))),
        duration: params.period,
        cars: [
            {
                state: vehicleState,
                manufacturing_year: params.manufacturingYear,
                price: Math.round(params.price)
            }
        ]
    };

    try {
        const token = await getVehisToken({
            apiBaseUrl: connection.apiBaseUrl,
            apiKey: connection.apiKey,
            apiSecret: connection.apiSecret
        });

        const vehisUrl = `${connection.apiBaseUrl.replace(/\/$/, '')}/broker/calculate`;

        const response = await fetchWithTimeout(vehisUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(vehisPayload)
        });

        const responseText = await response.text();

        if (!response.ok) {
            log.error({ provider: 'VEHIS', status: response.status, body: responseText?.slice(0, 800), request: vehisPayload }, 'VEHIS provider error');
            throw new FinancingCalcError(502, { error: 'Provider request failed' });
        }

        let result: any = {};
        try { result = JSON.parse(responseText); } catch { /* non-JSON response */ }

        // Vehis returns installment in the same convention as the input price:
        //   - consumer input (brutto) -> installment is brutto
        //   - entrepreneur input (netto) -> installment is netto
        // No conversion needed — just pass through.
        const monthlyInstallment = Number((result as any)?.cars?.[0]?.installment);
        if (!Number.isFinite(monthlyInstallment)) {
            log.error({ provider: 'VEHIS', resultKeys: Object.keys(result) }, 'VEHIS invalid response format');
            throw new FinancingCalcError(502, { error: 'Invalid provider response' });
        }

        const isConsumer = clientType === 'consumer';

        // Construct rich preview response
        const richResult = result as any;
        const richPreview = {
            client: richResult.client,
            initialFee: richResult.initialFee,
            repurchase: richResult.repurchase,
            duration: richResult.duration,
            cars: (richResult.cars || []).map((car: any) => ({
                state: car.state,
                manufacturing_year: car.manufacturing_year,
                price: car.price,
                installment: car.installment,
                initialFee: car.initialFee,
                repurchase: car.repurchase,
                wibor: car.wibor
            }))
        };

        return {
            monthlyInstallment,
            isGross: isConsumer,
            provider: product.provider,
            ...richPreview
        };
    } catch (error) {
        if (error instanceof FinancingCalcError) throw error;
        throw new FinancingCalcError(502, {
            error: 'Provider request failed',
            details: error instanceof Error ? error.message : 'Unknown provider error'
        });
    }
}

/** PMT formula for OWN products, identical to FinancingCalculator's client-side calculation. */
export function calcOwnInstallment(
    product: FinancingProduct,
    price: number,
    opts: { downPct: number; finalPct: number; months: number }
): number {
    const initial = Math.round(price * opts.downPct / 100);
    const finalAmount = Math.round(price * opts.finalPct / 100);
    const amountToFinance = price - initial;
    const annualRate = product.referenceRate + product.margin;
    const monthlyRate = annualRate / 100 / 12;

    let pmt: number;
    if (monthlyRate === 0) {
        pmt = (amountToFinance - finalAmount) / opts.months;
    } else {
        const pow = Math.pow(1 + monthlyRate, opts.months);
        pmt = (amountToFinance * monthlyRate - finalAmount * monthlyRate / pow) / (1 - 1 / pow);
    }
    return Math.round(pmt);
}

// ---------------------------------------------------------------------------
// Reference installment engine (Etap 3) — precomputes and stores card-facing
// credit/leasing installments on the Listing, mirroring the calculator's
// default state (25% wpłata / 35% wykup / 60 mc, clamped to product limits).
// ---------------------------------------------------------------------------

const REFERENCE_MONTHS = 60;
const REFERENCE_INITIAL_PCT = 25;
const REFERENCE_FINAL_PCT = 35;
const VAT = 1.23;

type Category = 'CREDIT' | 'LEASING';

/** Maksymalny wiek pojazdu (od rocznika) dla leasingu. Kredyt: bez limitu. */
export const LEASING_MAX_VEHICLE_AGE_YEARS = 5;

interface ListingForCalc {
    id: string;
    pricePln: number;
    creditAvailable: boolean;
    leasingAvailable: boolean;
    creditProductId: string | null;
    leasingProductId: string | null;
    productionYear: number;
    mileageKm: number;
}

export interface CalcContext {
    prisma: PrismaClient;
    log: SimpleLogger;
}

/** Mirrors `candidateProduct` from FinancingCalculator.tsx: category + availability + amount range + forced product, then priority/isDefault, with an OWN fallback. */
function selectProductCandidates(
    products: FinancingProduct[],
    category: Category,
    listing: ListingForCalc,
    amountToFinance: number
): FinancingProduct[] {
    const available = category === 'CREDIT' ? listing.creditAvailable : listing.leasingAvailable;
    if (!available) return [];
    // Leasing tylko dla aut ≤ LEASING_MAX_VEHICLE_AGE_YEARS lat (kredyt bez limitu) — spójne z src/utils/financingEligibility.ts.
    if (category === 'LEASING' && listing.productionYear && new Date().getFullYear() - listing.productionYear > LEASING_MAX_VEHICLE_AGE_YEARS) return [];

    const forcedProductId = category === 'CREDIT' ? listing.creditProductId : listing.leasingProductId;

    const eligible = products.filter(p => {
        if (p.category !== category) return false;
        if (forcedProductId !== p.id) {
            if (p.minAmount != null && amountToFinance < p.minAmount) return false;
            if (p.maxAmount != null && amountToFinance > p.maxAmount) return false;
        }
        return true;
    });

    const sorted = [...eligible].sort((a, b) => {
        const priorityDiff = (b.priority ?? 0) - (a.priority ?? 0);
        if (priorityDiff !== 0) return priorityDiff;
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
        if (a.provider !== b.provider) {
            if (a.provider === 'OWN') return 1;
            if (b.provider === 'OWN') return -1;
        }
        return 0;
    });

    // Forced (listing-specific) product first — mirrors FinancingCalculator's forcedProductId.
    if (forcedProductId) {
        const idx = sorted.findIndex(p => p.id === forcedProductId);
        if (idx > 0) {
            const [forced] = sorted.splice(idx, 1);
            sorted.unshift(forced);
        }
    }

    // Terminal OWN fallback (like the calculator) — guarantees a value if every partner fails.
    if (!sorted.some(p => p.provider === 'OWN')) {
        const ownFallback = products.find(p => p.category === category && p.provider === 'OWN' && p.isDefault)
            || products.find(p => p.category === category && p.provider === 'OWN');
        if (ownFallback) sorted.push(ownFallback);
    }

    return sorted;
}

/** Tries candidates in priority order until one yields an installment — mirrors the calculator's failed-product fallback (a broken partner product is skipped, not fatal). */
async function firstSuccessfulInstallment(
    ctx: CalcContext,
    candidates: FinancingProduct[],
    connectionByProvider: Map<string, FinancingProviderConnection>,
    category: Category,
    grossPricePln: number,
    manufacturingYear: number,
    mileageKm: number,
    cache?: Map<string, Promise<number | null>>
): Promise<number | null> {
    for (const product of candidates) {
        const installment = await calcInstallmentForProduct(ctx, product, connectionByProvider, category, grossPricePln, manufacturingYear, mileageKm, cache);
        if (installment != null) return installment;
    }
    return null;
}

/**
 * Computes the reference installment for a single category/product, mirroring
 * FinancingCalculator's default-state math. `grossPricePln` is always the
 * listing's gross PLN price — OWN uses it (or its /1.23 netto) directly per
 * category, partner APIs are always called with netto (matching the frontend's
 * external-calculation effect) and the credit result is converted back to brutto.
 */
async function calcInstallmentForProduct(
    ctx: CalcContext,
    product: FinancingProduct | null,
    connectionByProvider: Map<string, FinancingProviderConnection>,
    category: Category,
    grossPricePln: number,
    manufacturingYear: number,
    mileageKm: number,
    cache?: Map<string, Promise<number | null>>
): Promise<number | null> {
    if (!product) return null;

    const months = Math.min(Math.max(REFERENCE_MONTHS, product.minInstallments), product.maxInstallments);
    const downPct = Math.min(REFERENCE_INITIAL_PCT, product.maxInitialPayment);
    const finalPct = category === 'CREDIT'
        ? (product.hasBalloonPayment ? Math.min(REFERENCE_FINAL_PCT, product.maxFinalPayment) : 0)
        : Math.min(REFERENCE_FINAL_PCT, product.maxFinalPayment);

    if (product.provider === 'OWN') {
        const basisPrice = category === 'CREDIT' ? grossPricePln : grossPricePln / VAT;
        return calcOwnInstallment(product, basisPrice, { downPct, finalPct, months });
    }

    const connection = connectionByProvider.get(product.provider);
    if (!connection) return null;

    // Zaokrąglamy jak kalkulator (Math.round(price/1.23)) — INBANK wymaga całkowitego `amount`
    // (price - downPayment); ułamkowa cena netto dawała 422 od partnera.
    const nettoPrice = Math.round(grossPricePln / VAT);
    const cacheKey = `${product.id}:${category}:${nettoPrice}:${downPct}:${finalPct}:${months}`;
    if (cache?.has(cacheKey)) {
        return cache.get(cacheKey)!;
    }

    const promise = (async (): Promise<number | null> => {
        try {
            const downPaymentAmount = Math.round(nettoPrice * downPct / 100);
            const params: CalcParams = {
                price: nettoPrice,
                downPaymentAmount,
                period: months,
                initialFeePercent: downPct,
                finalPaymentPercent: finalPct,
                manufacturingYear,
                mileageKm,
            };

            const result = product.provider === 'INBANK'
                ? await calcInbankInstallment(product, connection, params, ctx.log)
                : await calcVehisInstallment(product, connection, params, ctx.log);

            const netto = result.monthlyInstallment;
            return Math.round(category === 'CREDIT' ? netto * VAT : netto);
        } catch (err) {
            ctx.log.error({ err, productId: product.id, provider: product.provider, category }, 'Reference installment: partner calculation failed');
            return null;
        }
    })();

    cache?.set(cacheKey, promise);
    return promise;
}

/**
 * Computes and persists referenceCreditInstallment/referenceLeasingInstallment
 * for a single listing. Never throws for partner/product issues — those
 * degrade to `null` for that leg so a single failure doesn't block the rest.
 * `cache` (optional) lets bulk callers dedupe identical partner calls within a run.
 */
export async function computeReferenceInstallments(
    ctx: CalcContext,
    listingId: string,
    cache?: Map<string, Promise<number | null>>
): Promise<{ creditInstallment: number | null; leasingInstallment: number | null } | null> {
    const listing = await ctx.prisma.listing.findUnique({
        where: { id: listingId },
        select: {
            id: true,
            pricePln: true,
            creditAvailable: true,
            leasingAvailable: true,
            creditProductId: true,
            leasingProductId: true,
            productionYear: true,
            mileageKm: true,
        }
    });
    if (!listing) return null;

    let creditInstallment: number | null = null;
    let leasingInstallment: number | null = null;

    if (listing.pricePln > 0) {
        const [products, connections] = await Promise.all([
            ctx.prisma.financingProduct.findMany(),
            ctx.prisma.financingProviderConnection.findMany({ where: { isActive: true } }),
        ]);
        const connectionByProvider = new Map(connections.map(c => [c.provider, c]));

        const price = listing.pricePln;
        const creditAmountToFinance = price - Math.round(price * REFERENCE_INITIAL_PCT / 100);
        const creditCandidates = selectProductCandidates(products, 'CREDIT', listing, creditAmountToFinance);

        const netPrice = price / VAT;
        const leasingAmountToFinance = netPrice - Math.round(netPrice * REFERENCE_INITIAL_PCT / 100);
        const leasingCandidates = selectProductCandidates(products, 'LEASING', listing, leasingAmountToFinance);

        [creditInstallment, leasingInstallment] = await Promise.all([
            firstSuccessfulInstallment(ctx, creditCandidates, connectionByProvider, 'CREDIT', price, listing.productionYear, listing.mileageKm, cache),
            firstSuccessfulInstallment(ctx, leasingCandidates, connectionByProvider, 'LEASING', price, listing.productionYear, listing.mileageKm, cache),
        ]);
    }

    await ctx.prisma.listing.update({
        where: { id: listingId },
        data: {
            referenceCreditInstallment: creditInstallment,
            referenceLeasingInstallment: leasingInstallment,
            referenceCalcAt: new Date(),
        }
    });

    return { creditInstallment, leasingInstallment };
}

const RECOMPUTE_CONCURRENCY = 4;
const RECOMPUTE_DELAY_MS = 150;

/** Recomputes reference installments for all active, non-archived listings with limited concurrency (partner API rate limits). */
export async function recomputeAll(ctx: CalcContext, opts?: { onlyMissing?: boolean }): Promise<number> {
    const where: any = { isArchived: false };
    if (opts?.onlyMissing) {
        where.referenceCalcAt = null;
    }

    const listings = await ctx.prisma.listing.findMany({ where, select: { id: true } });
    const cache = new Map<string, Promise<number | null>>();

    let cursor = 0;
    let processed = 0;

    const worker = async () => {
        while (cursor < listings.length) {
            const listing = listings[cursor++];
            try {
                await computeReferenceInstallments(ctx, listing.id, cache);
                processed++;
            } catch (err) {
                ctx.log.error({ err, listingId: listing.id }, 'Reference installments: recompute failed for listing');
            }
            if (RECOMPUTE_DELAY_MS > 0) {
                await new Promise(resolve => setTimeout(resolve, RECOMPUTE_DELAY_MS));
            }
        }
    };

    const workers = Array.from({ length: Math.min(RECOMPUTE_CONCURRENCY, listings.length) }, () => worker());
    await Promise.all(workers);

    return processed;
}

/** Nightly cron (03:00) — refreshes reference installments for all listings (partner rates drift). */
export function initReferenceInstallmentsCron(prisma: PrismaClient) {
    console.log('[FinancingCalc] Rejestracja zadania cron przeliczenia rat referencyjnych (03:00)');
    cron.schedule('0 3 * * *', async () => {
        console.log('[CRON] Wykonanie nocnego przeliczenia rat referencyjnych');
        try {
            const count = await recomputeAll({ prisma, log: console });
            console.log(`[CRON] Przeliczono raty referencyjne dla ${count} ofert`);
        } catch (e) {
            console.error('[CRON] Nie udało się przeliczyć rat referencyjnych:', e);
        }
    });
}
