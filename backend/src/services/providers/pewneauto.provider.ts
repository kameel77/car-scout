import { StockFeedProvider, StockFeedFetchResult, NormalizedFeedCar } from '../../types/stock-sync.types.js';
import { getPewneAutoAccessToken, fetchAllPewneAutoCars, PewneAutoCarRaw } from '../../utils/pewneauto-client.js';

export interface PewneAutoProviderConfig {
    sourceId: string;
    sourceSlug: string;
    tokenUrl: string;
    apiUrl: string;
    domainHeader?: string;
    clientId: string;
    clientSecret: string;
}

export function parseDealerCodeAndName(codeAndName?: string | null, fallbackDealer?: string | null) {
    if (!codeAndName && !fallbackDealer) {
        return { rawCode: undefined, rawName: 'Dealer Nieznany' };
    }

    const text = (codeAndName || fallbackDealer || '').trim();
    // Pattern np. "010 Toyota Piaseczno o. ZGORZAŁA" lub "110 Toyota Chodzeń Warszawa"
    const match = text.match(/^(\d{2,4})\s+(.+)$/);
    if (match) {
        return {
            rawCode: match[1],
            rawName: match[2].trim()
        };
    }

    return {
        rawCode: undefined,
        rawName: text
    };
}

export function formatUnixTimestampToDate(timestampInSeconds: number | null | undefined): string | null {
    if (!timestampInSeconds || isNaN(timestampInSeconds)) return null;
    try {
        // Jeśli timestamp jest w milisekundach (np. > 1e11), nie mnożymy przez 1000
        const ms = timestampInSeconds > 10000000000 ? timestampInSeconds : timestampInSeconds * 1000;
        const date = new Date(ms);
        if (isNaN(date.getTime())) return null;
        return date.toISOString().split('T')[0];
    } catch {
        return null;
    }
}

export function mapPewneAutoFuel(fuelRaw?: string | null, isHybrid?: number | null, isElectric?: number | null): string {
    if (isElectric === 1) return 'Elektryczny';
    if (isHybrid === 1) {
        if (fuelRaw && fuelRaw.toLowerCase().includes('plug-in')) return 'Hybryda Plug-in';
        return 'Hybryda';
    }
    if (!fuelRaw) return 'Benzyna';
    
    const lower = fuelRaw.toLowerCase();
    if (lower.includes('diesel') || lower.includes('on')) return 'Diesel';
    if (lower.includes('plug-in')) return 'Hybryda Plug-in';
    if (lower.includes('hybryd')) return 'Hybryda';
    if (lower.includes('elektrycz') || lower.includes('electric')) return 'Elektryczny';
    if (lower.includes('lpg') || lower.includes('gaz')) return 'LPG';
    if (lower.includes('benzyn') || lower.includes('petrol') || lower.includes('pb')) return 'Benzyna';

    return fuelRaw.trim();
}

export function mapRawCarToNormalized(raw: PewneAutoCarRaw): NormalizedFeedCar | null {
    const { rawCode, rawName } = parseDealerCodeAndName(raw.dealer_code_and_name, raw.dealer);
    const mileage = Number(raw.mileage);
    const safeMileage = isNaN(mileage) || mileage < 0 ? 0 : mileage;
    
    // Warunek dla stanu nowego: opieramy się wyłącznie na klasie typu pojazdu,
    // a nie na niskim przebiegu (używane auto bez wpisanego przebiegu nie może stać się "nowe")
    let condition: 'NEW' | 'USED' = 'USED';
    const carClass = (raw.car_type_class || '').toLowerCase();
    const carText = (raw.car_type_text || '').toLowerCase();
    if (carClass === 'new' || carText === 'nowy') {
        condition = 'NEW';
    }

    const vin = raw.vin ? raw.vin.trim().toUpperCase() : null;

    // Wyznaczanie ceny brutto
    let priceGross = Number(raw.priceGross) || 0;
    const rawPrice = Number(raw.price) || 0;
    const isNetto = (raw.priceType || '').toLowerCase() === 'netto';

    if (priceGross <= 0) {
        if (isNetto && rawPrice > 0) {
            priceGross = Math.round(rawPrice * 1.23);
        } else {
            priceGross = rawPrice;
        }
    }

    // Bezpieczne wyznaczenie marki i modelu (bez twardego fallbacku 'Toyota')
    const rawBrand = (raw.brand_name || '').trim();
    const rawModel = (raw.model_name || '').trim();
    const rawFullName = (raw.name || '').trim();

    let make = rawBrand;
    let model = rawModel;

    if (!make && rawFullName) {
        const parts = rawFullName.split(/\s+/);
        make = parts[0];
        if (!model && parts.length > 1) {
            model = parts.slice(1).join(' ');
        }
    }

    if (!make) {
        // Jeśli marka jest całkowicie nieznana, zwracamy null (odrzucenie wiersza z ostrzeżeniem)
        return null;
    }

    if (!model) {
        model = 'Inny';
    }

    const isReserved = Number(raw.reserved) === 1;

    return {
        externalId: String(raw.id),
        vin,
        make,
        model,
        version: raw.subname || raw.subtitle || null,
        slug: raw.slug || null,
        productionYear: Number(raw.year) || 0,
        mileageKm: safeMileage,
        fuelType: mapPewneAutoFuel(raw.fuel, raw.isHybrid, raw.isElectric),
        doors: raw.doors ? Number(raw.doors) : null,
        firstRegistrationDate: formatUnixTimestampToDate(raw.first_registration_date),
        condition,
        pricePln: priceGross,
        priceGross,
        priceType: isNetto ? 'netto' : 'brutto',
        omnibusLowest30dPln: raw.lowest_price_30_days ? Number(raw.lowest_price_30_days) : null,
        isReserved,
        primaryImageUrl: raw.img ? raw.img.trim() : null,
        galleryImageUrls: raw.img ? [raw.img.trim()] : [],
        dealer: {
            rawCode,
            rawName,
            websiteUrl: raw.onevidio_address || null
        },
        kintoNetInstallment: raw.kinto_net_installment ? Number(raw.kinto_net_installment) : null,
        kintoGrossInstallment: raw.kinto_gross_installment ? Number(raw.kinto_gross_installment) : null,
        rawSpecs: {
            add_date: raw.add_date,
            et_type_id: raw.et_type_id,
            offer_supervisor_id: raw.offer_supervisor_id,
            registration_number: raw.registration_number,
            onevidio_address: raw.onevidio_address,
            isKinto: raw.isKinto
        }
    };
}

export class PewneAutoProvider implements StockFeedProvider {
    readonly providerSlug = 'pewneauto';

    constructor(private readonly config: PewneAutoProviderConfig) {}

    async fetchCars(): Promise<StockFeedFetchResult> {
        const token = await getPewneAutoAccessToken(
            this.config.tokenUrl,
            this.config.clientId,
            this.config.clientSecret
        );

        const { cars: rawCars, totalReportedSize, totalPages } = await fetchAllPewneAutoCars(
            this.config.apiUrl,
            token,
            this.config.domainHeader || 'pewneauto.pl'
        );

        const normalizedCars: NormalizedFeedCar[] = [];
        for (const raw of rawCars) {
            const mapped = mapRawCarToNormalized(raw);
            if (mapped) {
                normalizedCars.push(mapped);
            }
        }

        return {
            cars: normalizedCars,
            totalCount: totalReportedSize,
            totalPages,
            metadata: {
                sourceSlug: this.config.sourceSlug,
                rawCount: rawCars.length
            }
        };
    }
}
