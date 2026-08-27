import fetch from 'node-fetch';

const DEFAULT_FETCH_TIMEOUT_MS = 15000;
const TOKEN_EXPIRY_SAFETY_MARGIN_MS = 60 * 1000; // 1 min margin
const MAX_RETRIES = 3;

interface CachedToken {
    token: string;
    expiresAt: number;
}

const tokenCache = new Map<string, CachedToken>();

/**
 * Pomocnik do wykonywania zapytań HTTP z mechanizmem retry i exponential backoff.
 */
async function fetchWithRetry(url: string, options: any, maxRetries: number = MAX_RETRIES): Promise<any> {
    let lastError: any;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), DEFAULT_FETCH_TIMEOUT_MS);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal as any
            });

            // 429 Too Many Requests lub błędy serwera 5xx kwalifikują się do ponowienia
            if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
                const errBody = await response.text().catch(() => '');
                lastError = new Error(`HTTP ${response.status}: ${errBody.slice(0, 150)}`);
                if (attempt < maxRetries) {
                    const delayMs = Math.pow(2, attempt) * 500 + Math.floor(Math.random() * 200);
                    await new Promise((res) => setTimeout(res, delayMs));
                    continue;
                }
            }

            return response;
        } catch (err: any) {
            lastError = err;
            if (attempt < maxRetries) {
                const delayMs = Math.pow(2, attempt) * 500 + Math.floor(Math.random() * 200);
                await new Promise((res) => setTimeout(res, delayMs));
            }
        } finally {
            clearTimeout(timeoutId);
        }
    }
    throw lastError;
}

/**
 * Pobiera i cache'uje token OAuth2 z serwera PewneAuto.
 */
export async function getPewneAutoAccessToken(
    tokenUrl: string,
    clientId: string,
    clientSecret: string
): Promise<string> {
    const cacheKey = `${tokenUrl}::${clientId}`;
    const cached = tokenCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
        return cached.token;
    }

    try {
        const bodyParams = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret
        });

        const response = await fetchWithRetry(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: bodyParams.toString()
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(`Błąd autoryzacji PewneAuto OAuth2 (status: ${response.status}): ${errorText.slice(0, 200)}`);
        }

        const data = (await response.json()) as any;
        const accessToken = data.access_token;
        const expiresInSeconds = Number(data.expires_in) || 3600;

        if (!accessToken) {
            throw new Error('Odpowiedź OAuth2 nie zawiera access_token');
        }

        tokenCache.set(cacheKey, {
            token: accessToken,
            expiresAt: Date.now() + (expiresInSeconds * 1000) - TOKEN_EXPIRY_SAFETY_MARGIN_MS
        });

        return accessToken;
    } catch (err: any) {
        tokenCache.delete(cacheKey);
        throw new Error(`[PewneAuto Auth] ${err.message}`);
    }
}

export interface PewneAutoCarRaw {
    id: number;
    brand_id?: number;
    name: string;
    subname?: string;
    subtitle?: string;
    year: number;
    mileage: number;
    price: number;
    priceGross: number;
    priceFormattedToInteger?: string;
    netPriceFormattedToInteger?: string | null;
    priceType?: string;
    price_before_discount?: number | null;
    lowest_price_30_days?: number | null;
    currency?: string;
    installment?: number;
    img?: string;
    add_date?: number;
    fuel?: string;
    isHybrid?: number;
    isElectric?: number;
    dealer?: string;
    dealer_code_and_name?: string;
    onevidio_address?: string | null;
    slug?: string;
    reserved?: number;
    brand_name?: string;
    model_name?: string;
    vin?: string;
    registration_number?: string;
    isKinto?: boolean;
    kinto_net_installment?: number | null;
    kinto_gross_installment?: number | null;
    kinto_km_limit?: number | null;
    kinto_period_months?: number | null;
    car_type_class?: string;
    car_type_text?: string;
    first_registration_date?: number;
    doors?: number;
    [key: string]: any;
}

export interface PewneAutoListResponse {
    rows: PewneAutoCarRaw[];
    pagination: {
        count: number;
        page: number;
        pages: number;
        size: number;
    };
    [key: string]: any;
}

/**
 * Atomowo pobiera 100% stron z API PewneAuto.
 * Jeśli jakakolwiek strona zwróci błąd lub timeout, rzuca wyjątek przerywający proces,
 * zapobiegając częściowemu przetwarzaniu danych i omyłkowej masowej archiwizacji.
 * Weryfikuje zgodność faktycznie pobranych aut z pagination.size (±1 tolerancja na wyścig).
 */
export async function fetchAllPewneAutoCars(
    apiUrl: string,
    token: string,
    domainHeader: string = 'pewneauto.pl'
): Promise<{ cars: PewneAutoCarRaw[]; totalReportedSize: number; totalPages: number }> {
    const rawCars: PewneAutoCarRaw[] = [];
    let currentPage = 1;
    let totalPages = 1;
    let totalReportedSize = 0;

    const headers = {
        'Authorization': `Bearer ${token}`,
        'domain': domainHeader,
        'Accept': 'application/json'
    };

    while (currentPage <= totalPages) {
        const url = new URL(apiUrl);
        url.searchParams.set('strona', currentPage.toString());

        try {
            const response = await fetchWithRetry(url.toString(), {
                method: 'GET',
                headers
            });

            if (!response.ok) {
                const errText = await response.text().catch(() => '');
                throw new Error(
                    `PewneAuto API error on page ${currentPage}/${totalPages} (HTTP ${response.status}): ${errText.slice(0, 150)}`
                );
            }

            const data = (await response.json()) as PewneAutoListResponse;
            if (!data || !Array.isArray(data.rows)) {
                throw new Error(`PewneAuto API zwróciło nieprawidłową strukturę danych na stronie ${currentPage}`);
            }

            if (currentPage === 1) {
                totalPages = data.pagination?.pages || 1;
                totalReportedSize = data.pagination?.size || data.rows.length;
            }

            rawCars.push(...data.rows);
            currentPage++;
        } catch (err: any) {
            throw new Error(`[PewneAuto Sync Error] Strona ${currentPage}/${totalPages}: ${err.message}`);
        }
    }

    // Deduplikacja rekordów z feedu po ID (w razie powtórzenia strony)
    const uniqueMap = new Map<number, PewneAutoCarRaw>();
    for (const c of rawCars) {
        if (c.id !== undefined && c.id !== null) {
            uniqueMap.set(c.id, c);
        }
    }
    const deduplicatedCars = Array.from(uniqueMap.values());

    // Twardy bezpiecznik zgodności z pagination.size (±1 tolerancja na wyścig paginacji na żywym API)
    if (totalReportedSize > 0 && Math.abs(deduplicatedCars.length - totalReportedSize) > 1) {
        throw new Error(
            `[PewneAuto Sync Error] Niezgodność liczby rekordów: API zadeklarowało pagination.size = ${totalReportedSize}, ale pobrano tylko ${deduplicatedCars.length} unikalnych aut. Pobieranie przerwane w celu ochrony bazy przed omyłkową archiwizacją.`
        );
    }

    return {
        cars: deduplicatedCars,
        totalReportedSize,
        totalPages
    };
}
