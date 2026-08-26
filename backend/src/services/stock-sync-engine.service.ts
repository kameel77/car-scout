import { PrismaClient, Prisma } from '@prisma/client';
import {
    StockFeedProvider,
    StockFeedFetchResult,
    StockSyncEngineOptions,
    SyncEngineResult,
    DryRunReport,
    NormalizedFeedCar
} from '../types/stock-sync.types.js';
import { normalizeBrand } from './brand-normalization.service.js';
import { generateListingSlug, sanitizeForSlug } from '../utils/url-utils.js';
import { invalidateOfferCache } from './cache-invalidation.service.js';

const DEFAULT_CIRCUIT_BREAKER_DROP = 0.20; // 20% max drop
const BATCH_SIZE = 150;

export class StockSyncEngine {
    constructor(private readonly prisma: PrismaClient) {}

    /**
     * Główny punkt wejścia do synchronizacji zasilany przez dowolnego providera.
     */
    async executeSync(
        provider: StockFeedProvider,
        options: StockSyncEngineOptions
    ): Promise<SyncEngineResult | DryRunReport> {
        const startTime = Date.now();
        const dropThreshold = options.circuitBreakerThreshold ?? DEFAULT_CIRCUIT_BREAKER_DROP;
        const dryRun = Boolean(options.dryRun);

        console.log(`[StockSyncEngine:${options.sourceSlug}] Start synchronizacji (dryRun: ${dryRun})`);

        // 1. Pobieranie danych z providera (atomowe - rzuca wyjątek przy błędzie strony lub niespójności pagination.size)
        let feedResult: StockFeedFetchResult;
        try {
            feedResult = await provider.fetchCars();
        } catch (fetchError: any) {
            console.error(`[StockSyncEngine:${options.sourceSlug}] Błąd pobierania feedu:`, fetchError.message);
            if (!dryRun) {
                await this.logImportFailure(options, fetchError.message, startTime);
            }
            return {
                success: false,
                sourceId: options.sourceId,
                sourceSlug: options.sourceSlug,
                totalFetched: 0,
                inserted: 0,
                updated: 0,
                archived: 0,
                failed: 1,
                priceChanges: 0,
                durationMs: Date.now() - startTime,
                error: fetchError.message
            };
        }

        const rawFetchedCars = feedResult.cars;
        const warnings: string[] = [];

        // Deduplikacja feedu po unikalnym ID zewnętrznym oraz VIN
        const uniqueCarsMap = new Map<string, NormalizedFeedCar>();
        const seenFeedVins = new Set<string>();

        for (const car of rawFetchedCars) {
            if (!car.externalId) continue;
            
            // Normalizacja VIN
            if (car.vin) {
                const normalizedVin = car.vin.trim().toUpperCase();
                car.vin = normalizedVin;
                if (seenFeedVins.has(normalizedVin)) {
                    warnings.push(`Zduplikowany VIN ${normalizedVin} w feedzie (ID: ${car.externalId}) - zachowano pierwszy rekord`);
                    continue;
                }
                seenFeedVins.add(normalizedVin);
            }

            if (!uniqueCarsMap.has(car.externalId)) {
                uniqueCarsMap.set(car.externalId, car);
            }
        }

        const fetchedCars = Array.from(uniqueCarsMap.values());
        const totalFetched = fetchedCars.length;

        // 2. Bezpiecznik wolumenowy (Circuit Breaker)
        const lastCount = options.lastSuccessfulCount;
        let circuitBreakerTriggered = false;
        let circuitBreakerReason: string | undefined;

        if (lastCount && lastCount > 0 && totalFetched < lastCount * (1 - dropThreshold)) {
            circuitBreakerTriggered = true;
            const dropPct = Math.round(((lastCount - totalFetched) / lastCount) * 100);
            circuitBreakerReason = `Wykryto drastyczny spadek liczby pojazdów o ${dropPct}% (z ${lastCount} do ${totalFetched}, próg: ${Math.round(dropThreshold * 100)}%). Synchronizacja wstrzymana w celu ochrony bazy przed masową archiwizacją.`;
            
            console.warn(`[StockSyncEngine:${options.sourceSlug}] CIRCUIT BREAKER TRIGGERED: ${circuitBreakerReason}`);

            if (!options.forceSync && !dryRun) {
                await this.logImportFailure(options, circuitBreakerReason, startTime, 'ABORTED_CIRCUIT_BREAKER');
                return {
                    success: false,
                    sourceId: options.sourceId,
                    sourceSlug: options.sourceSlug,
                    totalFetched,
                    inserted: 0,
                    updated: 0,
                    archived: 0,
                    failed: 0,
                    priceChanges: 0,
                    durationMs: Date.now() - startTime,
                    circuitBreakerTriggered: true,
                    error: circuitBreakerReason
                };
            }
        }

        // 3. Pobranie istniejących ofert tego źródła oraz ofert powiązanych po VIN z całej bazy
        const currentSourceListings = await this.prisma.listing.findMany({
            where: { pewneautoSourceId: options.sourceId },
            select: {
                id: true,
                listingId: true,
                vin: true,
                pewneautoSourceId: true,
                pewneautoCarId: true,
                isArchived: true,
                archivedReason: true,
                pricePln: true,
                slug: true,
                make: true,
                model: true,
                version: true,
                productionYear: true,
                bodyType: true,
                fuelType: true,
                dealerId: true,
                entrySource: true,
                lastManualEditAt: true
            }
        });

        // Pobranie ofert z całej bazy mających VIN obecny w pobranym feedzie (Cross-source VIN match)
        const feedVins = fetchedCars.map(c => c.vin).filter(Boolean) as string[];
        const existingListingsByVin = feedVins.length > 0 ? await this.prisma.listing.findMany({
            where: { vin: { in: feedVins } },
            select: {
                id: true,
                listingId: true,
                vin: true,
                pewneautoSourceId: true,
                pewneautoCarId: true,
                isArchived: true,
                archivedReason: true,
                pricePln: true,
                slug: true,
                make: true,
                model: true,
                version: true,
                productionYear: true,
                bodyType: true,
                fuelType: true,
                dealerId: true,
                entrySource: true,
                lastManualEditAt: true
            }
        }) : [];

        // Indeksy pomocnicze O(1)
        const sourceCarIdMap = new Map<number, typeof currentSourceListings[0]>();
        for (const l of currentSourceListings) {
            if (l.pewneautoCarId !== null && l.pewneautoCarId !== undefined) {
                sourceCarIdMap.set(l.pewneautoCarId, l);
            }
        }

        const globalVinMap = new Map<string, typeof existingListingsByVin[0]>();
        for (const l of existingListingsByVin) {
            if (l.vin) {
                globalVinMap.set(l.vin.toUpperCase(), l);
            }
        }

        // 4. Mapowanie i rozwiązywanie Dealerów
        const dealerIdMap = await this.resolveDealers(fetchedCars, options, dryRun);

        // 5. Analiza wierszy i kategoryzacja akcji
        const toInsert: NormalizedFeedCar[] = [];
        const toUpdate: Array<{ feedCar: NormalizedFeedCar; existing: typeof currentSourceListings[0]; oldPrice: number }> = [];
        const seenExternalIds = new Set<string>();
        const seenVins = new Set<string>();

        let matchedByVinCount = 0;
        let matchedByExternalIdCount = 0;
        let priceChangesCount = 0;
        let reservedCount = 0;

        for (const car of fetchedCars) {
            seenExternalIds.add(car.externalId);
            if (car.vin) seenVins.add(car.vin.toUpperCase());
            if (car.isReserved) reservedCount++;

            const carNumId = parseInt(car.externalId, 10);
            
            // Szukanie istniejącego rekordu:
            // 1. Po pewneautoCarId w ramach tego źródła
            // 2. Po unikalnym numerze VIN w całej bazie (cross-source migration)
            let existing = (!isNaN(carNumId) ? sourceCarIdMap.get(carNumId) : undefined);
            if (existing) {
                matchedByExternalIdCount++;
            } else if (car.vin && globalVinMap.has(car.vin.toUpperCase())) {
                existing = globalVinMap.get(car.vin.toUpperCase())!;
                matchedByVinCount++;
                if (existing.pewneautoSourceId && existing.pewneautoSourceId !== options.sourceId) {
                    warnings.push(`Pojazd VIN ${car.vin} przejęty z innego źródła/CSV (${existing.entrySource || 'CSV'} -> PEWNEAUTO)`);
                }
            }

            if (existing) {
                const oldPrice = existing.pricePln;
                if (oldPrice !== car.pricePln) {
                    priceChangesCount++;
                }
                toUpdate.push({ feedCar: car, existing, oldPrice });
            } else {
                toInsert.push(car);
            }
        }

        // 6. Identyfikacja ofert do zarchiwizowania (tylko z bieżącego źródła)
        const toArchive = currentSourceListings.filter(l => 
            !l.isArchived && 
            l.pewneautoCarId !== null && 
            !seenExternalIds.has(String(l.pewneautoCarId)) &&
            (!l.vin || !seenVins.has(l.vin.toUpperCase()))
        );

        // ─── TRYB DRY-RUN (SYMULACJA) ───
        if (dryRun) {
            return {
                sourceId: options.sourceId,
                sourceSlug: options.sourceSlug,
                providerName: options.providerName,
                totalFetched,
                totalActiveInDb: currentSourceListings.filter(l => !l.isArchived).length,
                toInsertCount: toInsert.length,
                toUpdateCount: toUpdate.length,
                toArchiveCount: toArchive.length,
                matchedByVinCount,
                matchedByExternalIdCount,
                priceChangesCount,
                reservedCount,
                circuitBreakerTriggered,
                circuitBreakerReason,
                warnings,
                samples: {
                    toInsert: toInsert.slice(0, 5).map(c => ({
                        externalId: c.externalId,
                        vin: c.vin,
                        make: normalizeBrand(c.make),
                        model: c.model,
                        pricePln: c.pricePln
                    })),
                    toUpdate: toUpdate.slice(0, 5).map(u => ({
                        externalId: u.feedCar.externalId,
                        vin: u.feedCar.vin,
                        make: normalizeBrand(u.feedCar.make),
                        model: u.feedCar.model,
                        oldPrice: u.oldPrice,
                        newPrice: u.feedCar.pricePln
                    })),
                    toArchive: toArchive.slice(0, 5).map(a => ({
                        listingId: a.listingId,
                        vin: a.vin,
                        make: a.make,
                        model: a.model
                    }))
                }
            };
        }

        // ─── PRZYGOTOWANIE OMNIBUS 30D PRZED TRANSAKCJĄ (Eliminacja N+1) ───
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const neededOmnibusListingIds = toUpdate
            .filter(u => u.feedCar.omnibusLowest30dPln === null || u.feedCar.omnibusLowest30dPln === undefined)
            .map(u => u.existing.id);

        const priceHistories = neededOmnibusListingIds.length > 0 ? await this.prisma.priceHistory.findMany({
            where: { listingId: { in: neededOmnibusListingIds }, changedAt: { gte: thirtyDaysAgo } },
            select: { listingId: true, pricePln: true }
        }) : [];

        const minPriceHistoryMap = new Map<string, number>();
        for (const ph of priceHistories) {
            const curMin = minPriceHistoryMap.get(ph.listingId);
            if (curMin === undefined || ph.pricePln < curMin) {
                minPriceHistoryMap.set(ph.listingId, ph.pricePln);
            }
        }

        // ─── TRYB PRODUKCYJNY (ZAPIS DO BAZY) ───
        const priceHistoryEntries: Array<{ listingId: string; pricePln: number; changedAt: Date }> = [];
        const affectedUrls: string[] = [];

        // Wykonanie transakcyjne
        await this.prisma.$transaction(async (tx) => {
            // A. Update istniejących ofert
            for (const { feedCar, existing, oldPrice } of toUpdate) {
                const normMake = normalizeBrand(feedCar.make);
                const carNumId = parseInt(feedCar.externalId, 10);
                const dealerId = feedCar.dealer ? dealerIdMap.get(feedCar.dealer.rawCode || feedCar.dealer.rawName) : existing.dealerId;

                // Omnibus 30d: odczyt z mapy precalculated lub z feedu
                let omnibusPrice = feedCar.omnibusLowest30dPln;
                if (omnibusPrice === null || omnibusPrice === undefined) {
                    const minHist = minPriceHistoryMap.get(existing.id);
                    if (minHist !== undefined) {
                        omnibusPrice = Math.min(minHist, feedCar.pricePln);
                    } else {
                        omnibusPrice = feedCar.pricePln;
                    }
                }

                // Ochrona ręcznych modyfikacji (P1.11): nie nadpisujemy modelu/wersji jeśli była ręczna edycja
                const hasManualEdit = Boolean(existing.lastManualEditAt);
                
                // Ochrona ręcznej archiwizacji (P1.12): przywracamy tylko oferty zarchiwizowane automatycznie przez samą integrację
                const shouldUnarchive = !existing.isArchived
                    || (existing.archivedReason?.startsWith('pewneauto_') ?? false);

                const updateData: Prisma.ListingUpdateInput = {
                    make: hasManualEdit ? undefined : normMake,
                    model: hasManualEdit ? undefined : feedCar.model,
                    version: hasManualEdit ? undefined : (feedCar.version || undefined),
                    productionYear: feedCar.productionYear,
                    mileageKm: feedCar.mileageKm,
                    fuelType: feedCar.fuelType || undefined,
                    doors: feedCar.doors || undefined,
                    firstRegistrationDate: feedCar.firstRegistrationDate || undefined,
                    condition: feedCar.condition,
                    pricePln: feedCar.pricePln,
                    omnibusLowest30dPln: omnibusPrice,
                    isReserved: feedCar.isReserved,
                    ...(shouldUnarchive ? { isArchived: false, archivedAt: null, archivedReason: null } : {}),
                    primaryImageUrl: feedCar.primaryImageUrl || undefined,
                    entrySource: 'PEWNEAUTO',
                    pewneautoSource: { connect: { id: options.sourceId } },
                    pewneautoCarId: isNaN(carNumId) ? undefined : carNumId,
                    // Zerowanie powiązań CSFlow przy przejęciu VIN (P1.9)
                    csflowSource: { disconnect: true },
                    csflowCarId: null,
                    ...(dealerId ? { dealer: { connect: { id: dealerId } } } : {})
                };

                await tx.listing.update({
                    where: { id: existing.id },
                    data: updateData
                });

                const effectiveSlug = existing.slug || generateListingSlug(normMake, feedCar.model, feedCar.version, feedCar.productionYear, undefined, feedCar.fuelType, existing.id);
                affectedUrls.push(`/oferta/${effectiveSlug}`);
                affectedUrls.push(`/samochody/${sanitizeForSlug(normMake)}/${sanitizeForSlug(feedCar.model)}/${effectiveSlug}`);
                affectedUrls.push(`/samochody/${sanitizeForSlug(normMake)}`);
                affectedUrls.push(`/samochody/${sanitizeForSlug(normMake)}/${sanitizeForSlug(feedCar.model)}`);

                if (oldPrice !== feedCar.pricePln) {
                    priceHistoryEntries.push({
                        listingId: existing.id,
                        pricePln: feedCar.pricePln,
                        changedAt: new Date()
                    });
                }
            }

            // B. Insert nowych ofert
            for (const feedCar of toInsert) {
                const normMake = normalizeBrand(feedCar.make);
                const carNumId = parseInt(feedCar.externalId, 10);
                const listingId = `pewneauto-${options.sourceSlug}-${feedCar.externalId}`;
                const slug = generateListingSlug(normMake, feedCar.model, feedCar.version, feedCar.productionYear, undefined, feedCar.fuelType, feedCar.externalId);
                const dealerId = feedCar.dealer ? dealerIdMap.get(feedCar.dealer.rawCode || feedCar.dealer.rawName) : undefined;

                const createData: Prisma.ListingCreateInput = {
                    listingId,
                    slug,
                    vin: feedCar.vin || undefined,
                    make: normMake,
                    model: feedCar.model,
                    version: feedCar.version || undefined,
                    productionYear: feedCar.productionYear,
                    mileageKm: feedCar.mileageKm,
                    fuelType: feedCar.fuelType || undefined,
                    doors: feedCar.doors || undefined,
                    firstRegistrationDate: feedCar.firstRegistrationDate || undefined,
                    condition: feedCar.condition,
                    pricePln: feedCar.pricePln,
                    omnibusLowest30dPln: feedCar.omnibusLowest30dPln || feedCar.pricePln,
                    isReserved: feedCar.isReserved,
                    primaryImageUrl: feedCar.primaryImageUrl || undefined,
                    imageUrls: feedCar.galleryImageUrls || (feedCar.primaryImageUrl ? [feedCar.primaryImageUrl] : []),
                    entrySource: 'PEWNEAUTO',
                    pewneautoSource: { connect: { id: options.sourceId } },
                    pewneautoCarId: isNaN(carNumId) ? undefined : carNumId,
                    marketplace: 'pewneauto',
                    ...(dealerId ? { dealer: { connect: { id: dealerId } } } : {})
                };

                const created = await tx.listing.create({
                    data: createData
                });

                affectedUrls.push(`/oferta/${slug}`);
                affectedUrls.push(`/samochody/${sanitizeForSlug(normMake)}/${sanitizeForSlug(feedCar.model)}/${slug}`);
                affectedUrls.push(`/samochody/${sanitizeForSlug(normMake)}`);
                affectedUrls.push(`/samochody/${sanitizeForSlug(normMake)}/${sanitizeForSlug(feedCar.model)}`);

                priceHistoryEntries.push({
                    listingId: created.id,
                    pricePln: feedCar.pricePln,
                    changedAt: new Date()
                });
            }

            // C. Bezpieczna archiwizacja brakujących aut
            for (const l of toArchive) {
                await tx.listing.update({
                    where: { id: l.id },
                    data: {
                        isArchived: true,
                        archivedAt: new Date(),
                        archivedReason: 'pewneauto_removed'
                    }
                });

                const archiveSlug = l.slug || generateListingSlug(l.make, l.model, l.version, l.productionYear, l.bodyType, l.fuelType, l.id);
                affectedUrls.push(`/oferta/${archiveSlug}`);
                affectedUrls.push(`/samochody/${sanitizeForSlug(l.make)}/${sanitizeForSlug(l.model)}/${archiveSlug}`);
                affectedUrls.push(`/samochody/${sanitizeForSlug(l.make)}`);
                affectedUrls.push(`/samochody/${sanitizeForSlug(l.make)}/${sanitizeForSlug(l.model)}`);
            }

            // D. Zapis historii cen
            if (priceHistoryEntries.length > 0) {
                await tx.priceHistory.createMany({
                    data: priceHistoryEntries
                });
            }

            // E. Aktualizacja metadanych źródła
            await tx.pewneAutoSource.update({
                where: { id: options.sourceId },
                data: {
                    lastSyncAt: new Date(),
                    lastSuccessfulSyncAt: new Date(),
                    lastSuccessfulSyncCount: totalFetched
                }
            });
        }, {
            timeout: 60000 // 60s timeout for large batches
        });

        const durationMs = Date.now() - startTime;

        // 7. Zapis w ImportLog
        let importLogId: string | undefined;
        const actualUserId = await this.resolveUserId(options.userId);
        if (actualUserId) {
            try {
                const importLog = await this.prisma.importLog.create({
                    data: {
                        importedBy: actualUserId,
                        fileName: `pewneauto-${options.sourceSlug}`,
                        totalRows: totalFetched,
                        inserted: toInsert.length,
                        updated: toUpdate.length,
                        archived: toArchive.length,
                        failed: 0,
                        status: 'success',
                        duration: durationMs,
                        errorLog: {
                            warnings,
                            priceChanges: priceHistoryEntries.length,
                            reservedCount
                        }
                    }
                });
                importLogId = importLog.id;
            } catch (logErr: any) {
                console.warn('[StockSyncEngine] Nie udało się zapisać ImportLog:', logErr.message);
            }
        }

        // 8. Inwalidacja cache (P0.4: przekazanie dedykowanych URL-i + sitemap)
        if (toInsert.length > 0 || toUpdate.length > 0 || toArchive.length > 0) {
            try {
                const uniqueUrls = [...new Set(affectedUrls)];
                await invalidateOfferCache(undefined, {
                    urls: uniqueUrls,
                    purgeSitemap: (toInsert.length + toArchive.length) > 0
                });
            } catch (cacheErr: any) {
                console.warn('[StockSyncEngine] Błąd inwalidacji cache:', cacheErr.message);
            }
        }

        console.log(`[StockSyncEngine:${options.sourceSlug}] Sync zakończony sukcesem w ${durationMs}ms (wstawiono: ${toInsert.length}, zaktualizowano: ${toUpdate.length}, zarchiwizowano: ${toArchive.length})`);

        return {
            success: true,
            sourceId: options.sourceId,
            sourceSlug: options.sourceSlug,
            totalFetched,
            inserted: toInsert.length,
            updated: toUpdate.length,
            archived: toArchive.length,
            failed: 0,
            priceChanges: priceHistoryEntries.length,
            durationMs,
            importLogId,
            warnings
        };
    }

    /**
     * Mapuje salony dealerskie z feedu do bazy.
     */
    private async resolveDealers(
        cars: NormalizedFeedCar[],
        options: StockSyncEngineOptions,
        dryRun: boolean
    ): Promise<Map<string, string>> {
        const dealerIdMap = new Map<string, string>(); // code/name -> dealer DB id
        const uniqueDealers = new Map<string, { rawCode?: string; rawName: string }>();

        for (const car of cars) {
            if (car.dealer && car.dealer.rawName) {
                const key = car.dealer.rawCode || car.dealer.rawName;
                if (!uniqueDealers.has(key)) {
                    uniqueDealers.set(key, car.dealer);
                }
            }
        }

        for (const [key, d] of uniqueDealers.entries()) {
            let existingDealer = null;

            if (d.rawCode) {
                existingDealer = await this.prisma.dealer.findFirst({
                    where: {
                        pewneautoSourceId: options.sourceId,
                        pewneautoDealerCode: d.rawCode
                    }
                });
            }

            if (!existingDealer && d.rawName) {
                existingDealer = await this.prisma.dealer.findFirst({
                    where: {
                        name: { equals: d.rawName, mode: 'insensitive' }
                    }
                });
            }

            if (existingDealer) {
                dealerIdMap.set(key, existingDealer.id);
            } else if (!dryRun) {
                const newDealer = await this.prisma.dealer.create({
                    data: {
                        name: d.rawName,
                        addressLine1: 'Adres do uzupełnienia',
                        pewneautoSource: { connect: { id: options.sourceId } },
                        pewneautoDealerCode: d.rawCode || undefined,
                        ...(options.dealerGroupId ? { dealerGroup: { connect: { id: options.dealerGroupId } } } : {})
                    }
                });
                dealerIdMap.set(key, newDealer.id);
            }
        }

        return dealerIdMap;
    }

    private async resolveUserId(userId?: string): Promise<string | null> {
        if (userId && userId !== 'system-cron') {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { id: true }
            });
            if (user) return user.id;
        }

        const fallbackUser = await this.prisma.user.findFirst({
            where: { role: 'admin', isActive: true },
            select: { id: true }
        }) || await this.prisma.user.findFirst({
            where: { isActive: true },
            select: { id: true }
        });

        return fallbackUser ? fallbackUser.id : null;
    }

    private async logImportFailure(
        options: StockSyncEngineOptions,
        errorMessage: string,
        startTime: number,
        status: string = 'failed'
    ) {
        try {
            const actualUserId = await this.resolveUserId(options.userId);
            if (actualUserId) {
                await this.prisma.importLog.create({
                    data: {
                        importedBy: actualUserId,
                        fileName: `pewneauto-${options.sourceSlug}`,
                        totalRows: 0,
                        inserted: 0,
                        updated: 0,
                        archived: 0,
                        failed: 1,
                        status,
                        duration: Date.now() - startTime,
                        errorLog: { error: errorMessage }
                    }
                });
            }
        } catch (e) {
            console.error('[StockSyncEngine] Nie udało się zapisać błędu do ImportLog:', e);
        }
    }
}
