export interface FeedDealerInfo {
    rawCode?: string;         // np. "010"
    rawName: string;          // np. "Toyota Piaseczno o. ZGORZAŁA"
    city?: string | null;     // np. "Piaseczno"
    addressLine1?: string | null;
    postalCode?: string | null;
    phone?: string | null;
    email?: string | null;
    websiteUrl?: string | null;
}

export interface NormalizedFeedCar {
    externalId: string;       // np. "423382"
    vin?: string | null;      // np. "SB1Z53BE60E058494"
    make: string;             // np. "Toyota" (przechodzi przez normalizeBrand)
    model: string;            // np. "Corolla"
    version?: string | null;  // np. "2.0 Hybrid Comfort"
    slug?: string | null;
    productionYear: number;
    mileageKm: number;
    fuelType?: string | null;
    transmission?: string | null;
    enginePowerHp?: number | null;
    engineCapacityCm3?: number | null;
    drive?: string | null;
    doors?: number | null;
    seats?: number | null;
    bodyType?: string | null;
    color?: string | null;
    registrationNumber?: string | null;
    firstRegistrationDate?: string | null; // sformatowana data YYYY-MM-DD
    condition: 'NEW' | 'USED';
    pricePln: number;
    priceGross?: number | null;
    priceType?: 'brutto' | 'netto';
    vatMargin?: boolean;
    omnibusLowest30dPln?: number | null;
    omnibusText?: string | null;
    isReserved: boolean;
    primaryImageUrl?: string | null;
    galleryImageUrls?: string[];
    equipmentAudioMultimedia?: string[];
    equipmentSafety?: string[];
    equipmentComfortExtras?: string[];
    equipmentOther?: string[];
    dealer?: FeedDealerInfo;
    rawSpecs?: Record<string, any>;
    kintoNetInstallment?: number | null;
    kintoGrossInstallment?: number | null;
}

export interface StockFeedFetchResult {
    cars: NormalizedFeedCar[];
    totalCount: number;
    totalPages?: number;
    metadata?: Record<string, any>;
}

export interface StockFeedProvider {
    readonly providerSlug: string;
    fetchCars(): Promise<StockFeedFetchResult>;
}

export interface StockSyncEngineOptions {
    sourceId: string;
    sourceSlug: string;
    providerName: string;
    dealerGroupId?: string | null;
    userId?: string;
    forceSync?: boolean;         // Omija bezpiecznik wolumenowy (circuit breaker)
    dryRun?: boolean;            // Symulacja bez zapisu do bazy
    circuitBreakerThreshold?: number; // Domyślnie 0.20 (20% spadek)
    lastSuccessfulCount?: number | null;
}

export interface DryRunReport {
    sourceId: string;
    sourceSlug: string;
    providerName: string;
    totalFetched: number;
    totalActiveInDb: number;
    toInsertCount: number;
    toUpdateCount: number;
    toArchiveCount: number;
    matchedByVinCount: number;
    matchedByExternalIdCount: number;
    priceChangesCount: number;
    reservedCount: number;
    circuitBreakerTriggered: boolean;
    circuitBreakerReason?: string;
    warnings: string[];
    samples: {
        toInsert: Array<{ externalId: string; vin?: string | null; make: string; model: string; pricePln: number }>;
        toUpdate: Array<{ externalId: string; vin?: string | null; make: string; model: string; oldPrice?: number; newPrice: number }>;
        toArchive: Array<{ listingId: string | null; vin?: string | null; make: string; model: string }>;
    };
}

export interface SyncEngineResult {
    success: boolean;
    dryRun?: boolean;
    sourceId: string;
    sourceSlug: string;
    totalFetched: number;
    inserted: number;
    updated: number;
    archived: number;
    failed: number;
    priceChanges: number;
    durationMs: number;
    circuitBreakerTriggered?: boolean;
    importLogId?: string;
    error?: string;
    warnings?: string[];
}
