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

export interface PewneAutoEnrichedDetails {
    bodyType?: string | null;
    engineCapacityCm3?: number | null;
    enginePowerHp?: number | null;
    transmission?: string | null;
    color?: string | null;
    paintType?: string | null;
    galleryImageUrls: string[];
    equipmentSafety: string[];
    equipmentComfortExtras: string[];
    equipmentAudioMultimedia: string[];
    equipmentOther: string[];
}

export function extractPowerHp(text?: string | null): number | null {
    if (!text) return null;
    const match = text.match(/\b(\d{2,3})\s*(?:KM|km|hp|HP|ps|PS)\b/i);
    if (match) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val > 30 && val < 1500) return val;
    }
    return null;
}

export function extractEngineCapacity(text?: string | null): number | null {
    if (!text) return null;
    // Dopasowanie pojemności np. 1.8, 1.5, 2.0, 2.5, 1.2, 1.6
    const match = text.match(/\b(0\.[89]|1\.[0-9]|2\.[0-9]|3\.[0-9]|4\.[0-9]|5\.[0-9]|6\.[0-9])\b/);
    if (match) {
        const liters = parseFloat(match[1]);
        if (!isNaN(liters)) {
            // Standardowe pojemności silników Toyoty/Lexus
            if (liters === 1.8) return 1798;
            if (liters === 1.5) return 1490;
            if (liters === 2.0) return 1987;
            if (liters === 2.5) return 2487;
            if (liters === 1.6) return 1598;
            if (liters === 1.2) return 1197;
            if (liters === 1.0) return 998;
            return Math.round(liters * 1000);
        }
    }
    return null;
}

export function extractTransmission(fuel?: string | null, isHybrid?: number | null, isElectric?: number | null, text?: string | null): string {
    const combined = `${fuel || ''} ${text || ''}`.toLowerCase();
    if (combined.includes('manual') || combined.includes('6mt') || combined.includes('5mt') || combined.includes('m/t')) {
        return 'Manualna';
    }
    if (isHybrid === 1 || isElectric === 1 || combined.includes('hybryd') || combined.includes('hybrid') || combined.includes('elektrycz') || combined.includes('e-cvt') || combined.includes('cvt') || combined.includes('automat')) {
        return 'Automatyczna';
    }
    return 'Automatyczna'; // Domyślnie dla większości współczesnych pojazdów Toyoty
}

export function extractDrive(text?: string | null): string | null {
    if (!text) return null;
    const lower = text.toLowerCase();
    if (lower.includes('awd-i') || lower.includes('awd') || lower.includes('4x4') || lower.includes('4wd')) {
        return '4x4 (AWD)';
    }
    if (lower.includes('fwd') || lower.includes('przód')) {
        return 'Napęd na przednie koła (FWD)';
    }
    if (lower.includes('rwd') || lower.includes('tył')) {
        return 'Napęd na tylne koła (RWD)';
    }
    return null;
}

export function extractBodyType(model?: string | null, text?: string | null, doors?: number | null): string | null {
    const combined = `${model || ''} ${text || ''}`.toLowerCase();
    if (combined.includes('cross') || combined.includes('rav4') || combined.includes('c-hr') || combined.includes('highlander') || combined.includes('land cruiser') || combined.includes('aygo x') || combined.includes('grecale') || combined.includes('bz4x') || combined.includes('suv')) {
        return 'SUV';
    }
    if (combined.includes('kombi') || combined.includes('touring sports') || combined.includes(' ts ') || combined.endsWith(' ts')) {
        return 'Kombi';
    }
    if (combined.includes('sedan') || (combined.includes('corolla') && doors === 4) || combined.includes('camry') || combined.includes('mirai')) {
        return 'Sedan';
    }
    if (combined.includes('hatchback') || combined.includes('yaris') || combined.includes('aygo') || combined.includes('auris')) {
        return 'Hatchback';
    }
    if (combined.includes('proace') || combined.includes('furgon') || combined.includes('van') || combined.includes('dostawczy')) {
        return 'Dostawczy / Van';
    }
    if (combined.includes('hilux') || combined.includes('pick-up') || combined.includes('pickup')) {
        return 'Pick-up';
    }
    if (combined.includes('grancabrio') || combined.includes('kabriolet') || combined.includes('cabrio')) {
        return 'Kabriolet';
    }
    if (combined.includes('gt86') || combined.includes('gr86') || combined.includes('supra') || combined.includes('granturismo') || combined.includes('coupe')) {
        return 'Coupe';
    }
    return null;
}

export async function enrichPewneAutoCar(slug?: string | null, externalId?: number | string | null, timeoutMs: number = 5000): Promise<PewneAutoEnrichedDetails | null> {
    if (!slug || !externalId) return null;
    try {
        const url = `https://pewneauto.pl/oferta/${slug}/${externalId}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            signal: controller.signal
        });
        clearTimeout(timer);

        if (!res.ok) return null;
        const html = await res.text();

        const getProp = (prop: string): string | null => {
            const m = html.match(new RegExp(`itemprop=["']${prop}["'][^>]*>\\s*([^<]+)`, 'i'));
            return m ? m[1].trim() : null;
        };

        const rawHp = getProp('horsepower');
        const rawDisp = getProp('engineDisplacement');
        const rawBody = getProp('bodyType');
        const rawTrans = getProp('vehicleTransmission');
        const rawColor = getProp('color');

        const hpVal = rawHp ? parseInt(rawHp.replace(/\D/g, ''), 10) : null;
        const dispVal = rawDisp ? parseInt(rawDisp.replace(/\D/g, ''), 10) : null;

        // Galeria zdjęć HD
        const idStr = String(externalId);
        const galleryImageUrls = Array.from(new Set(
            [...html.matchAll(new RegExp(`https://panel\\.pewneauto\\.pl/media/UsedCar/${idStr}/[a-f0-9]+\\.(?:jpg|png|jpeg)`, 'gi'))]
            .map(m => m[0])
        ));

        // Wyposażenie
        const equipmentSafety: string[] = [];
        const equipmentComfortExtras: string[] = [];
        const equipmentAudioMultimedia: string[] = [];
        const equipmentOther: string[] = [];

        const eqIdx = html.indexOf('Wyposażenie');
        if (eqIdx !== -1) {
            const eqHtml = html.slice(eqIdx, eqIdx + 20000);
            const sections = [...eqHtml.matchAll(/<section>[\s\S]*?<button[^>]*>([\s\S]*?)<\/button>[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/gi)];
            for (const s of sections) {
                const title = s[1].trim().toLowerCase();
                const items = [...s[2].matchAll(/<li>(.*?)<\/li>/gi)].map(m => m[1].trim()).filter(Boolean);
                if (title.includes('bezpiecz')) {
                    equipmentSafety.push(...items);
                } else if (title.includes('komfort')) {
                    equipmentComfortExtras.push(...items);
                } else if (title.includes('multimedia') || title.includes('audio')) {
                    equipmentAudioMultimedia.push(...items);
                } else {
                    equipmentOther.push(...items);
                }
            }
        }

        return {
            bodyType: rawBody || null,
            engineCapacityCm3: (dispVal && !isNaN(dispVal)) ? dispVal : null,
            enginePowerHp: (hpVal && !isNaN(hpVal)) ? hpVal : null,
            transmission: rawTrans || null,
            color: rawColor || null,
            galleryImageUrls,
            equipmentSafety,
            equipmentComfortExtras,
            equipmentAudioMultimedia,
            equipmentOther
        };
    } catch {
        return null;
    }
}

export function mapRawCarToNormalized(raw: PewneAutoCarRaw, enriched?: PewneAutoEnrichedDetails | null): NormalizedFeedCar | null {
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
    const fuelMapped = mapPewneAutoFuel(raw.fuel, raw.isHybrid, raw.isElectric);

    // Heurystyki / Wzbogacenie
    const combinedTexts = `${raw.subname || ''} ${raw.subtitle || ''} ${raw.name || ''}`;
    const enginePowerHp = enriched?.enginePowerHp || extractPowerHp(combinedTexts);
    const engineCapacityCm3 = enriched?.engineCapacityCm3 || extractEngineCapacity(combinedTexts);
    const transmission = enriched?.transmission || extractTransmission(fuelMapped, raw.isHybrid, raw.isElectric, combinedTexts);
    const bodyType = enriched?.bodyType || extractBodyType(model, combinedTexts, raw.doors ? Number(raw.doors) : null);
    const drive = extractDrive(combinedTexts);
    const color = enriched?.color || null;

    // Zdjęcia: preferowana pełna galeria HD, fallback do pojedynczego zdjęcia img
    const primaryImageUrl = raw.img ? raw.img.trim() : null;
    const galleryImageUrls = enriched?.galleryImageUrls && enriched.galleryImageUrls.length > 0
        ? enriched.galleryImageUrls
        : (primaryImageUrl ? [primaryImageUrl] : []);

    return {
        externalId: String(raw.id),
        vin,
        make,
        model,
        version: raw.subname || raw.subtitle || null,
        slug: raw.slug || null,
        productionYear: Number(raw.year) || 0,
        mileageKm: safeMileage,
        fuelType: fuelMapped,
        transmission,
        enginePowerHp,
        engineCapacityCm3,
        doors: raw.doors ? Number(raw.doors) : null,
        bodyType,
        color,
        registrationNumber: raw.registration_number ? raw.registration_number.trim() : null,
        firstRegistrationDate: formatUnixTimestampToDate(raw.first_registration_date),
        condition,
        pricePln: priceGross,
        priceGross,
        priceType: isNetto ? 'netto' : 'brutto',
        omnibusLowest30dPln: raw.lowest_price_30_days ? Number(raw.lowest_price_30_days) : null,
        isReserved,
        primaryImageUrl,
        galleryImageUrls,
        equipmentSafety: enriched?.equipmentSafety || [],
        equipmentComfortExtras: enriched?.equipmentComfortExtras || [],
        equipmentAudioMultimedia: enriched?.equipmentAudioMultimedia || [],
        equipmentOther: enriched?.equipmentOther || [],
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
            isKinto: raw.isKinto,
            drive
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

        // Równoległe wzbogacanie aut z pulą współbieżności (batches po 15)
        const enrichedMap = new Map<string, PewneAutoEnrichedDetails | null>();
        const batchSize = 15;
        for (let i = 0; i < rawCars.length; i += batchSize) {
            const batch = rawCars.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map(car => enrichPewneAutoCar(car.slug, car.id).catch(() => null))
            );
            batch.forEach((car, idx) => {
                enrichedMap.set(String(car.id), batchResults[idx]);
            });
        }

        const normalizedCars: NormalizedFeedCar[] = [];
        for (const raw of rawCars) {
            const enriched = enrichedMap.get(String(raw.id));
            const mapped = mapRawCarToNormalized(raw, enriched);
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
