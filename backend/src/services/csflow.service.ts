import { PrismaClient, CsflowSource } from '@prisma/client';
import { getCSFlowCars, getCSFlowCarDetails } from '../utils/csflow-client.js';
import { generateListingSlug } from '../utils/url-utils.js';
import { downloadAndCacheImages, queueListingImagesDownload } from './csflow-image-downloader.js';
import { normalizeBrand } from './brand-normalization.service.js';
import cron from 'node-cron';

// Pomocnicza funkcja mapowania CSFlow -> Prisma
function mapEquipment(groups: any[]) {
    const audio: string[] = [];
    const comfort: string[] = [];
    const safety: string[] = [];
    const other: string[] = [];

    if (!Array.isArray(groups)) return { audio, comfort, safety, other };

    for (const group of groups) {
        // CSFlow uses specific IDs like 15001 = Audio...
        const id = group.group_id;
        const elements = group.elements || [];

        if (id === 15001) {
            audio.push(...elements);
        } else if (id === 15002) {
            comfort.push(...elements);
        } else if (id === 15004 || id === 15006) {
            safety.push(...elements);
        } else {
            // e.g. 15003 EVs, 15005 tuning
            other.push(...elements);
        }
    }

    return { audio, comfort, safety, other };
}

export async function syncCSFlowAPI(prisma: PrismaClient, source: CsflowSource, userId: string = 'system-cron') {
    const startTime = Date.now();
    console.log(`[CSFlow:${source.slug}] Start synchronizacji API`);

    try {
        const carsData = await getCSFlowCars(source.apiUrl);
        console.log(`[CSFlow:${source.slug}] Pobrane pojazdy z API: ${carsData.length}`);

        const result = {
            inserted: 0,
            updated: 0,
            archived: 0,
            failed: 0,
            totalRows: carsData.length
        };

        // Zbieranie wszystkich już zapisanych ofert tego źródła CSFlow w bazie
        const existingListings = await prisma.listing.findMany({
            where: { csflowSourceId: source.id },
            select: { id: true, vin: true, listingId: true, csflowCarId: true, isArchived: true, pricePln: true }
        });

        // Mapa WSZYSTKICH VIN-ów w bazie (nie tylko CSFlow) — zapobiega duplikatom
        // cross-source (np. VIN ręcznie dodanego auta = VIN z CSFlow)
        const allVinEntries = await prisma.listing.findMany({
            select: { vin: true, listingId: true },
            where: { vin: { not: null } }
        });
        const allVinToListingId = new Map<string, string | null>(
            allVinEntries.map(l => [l.vin as string, l.listingId])
        );

        const currentCarIds = new Set<number>();

        // Do śledzenia historii cen z transaction
        const priceHistoryEntries: any[] = [];
        
        // Pobieramy szczegóły wszystkich aut w równoległych paczkach (po 15)
        const fullCars: any[] = [];
        const BATCH_SIZE = 15;
        console.log(`[CSFlow:${source.slug}] Pobieranie szczegółów dla ${carsData.length} pojazdów w paczkach po ${BATCH_SIZE}...`);
        
        for (let idx = 0; idx < carsData.length; idx += BATCH_SIZE) {
            const batch = carsData.slice(idx, idx + BATCH_SIZE);
            const details = await Promise.all(
                batch.map(async (basicCar) => {
                    try {
                        const car = await getCSFlowCarDetails(source.apiUrl, basicCar.id);
                        return car;
                    } catch (err: any) {
                        console.error(`[CSFlow:${source.slug}] Błąd pobierania szczegółów dla ID ${basicCar.id}: ${err.message}`);
                        result.failed++;
                        return null;
                    }
                })
            );
            fullCars.push(...details.filter(Boolean));
        }
        console.log(`[CSFlow:${source.slug}] Pomyślnie pobrano szczegóły dla ${fullCars.length}/${carsData.length} pojazdów.`);

        for (const car of fullCars) {
            try {
                const carId = Number(car.id);
                currentCarIds.add(carId);
                const listingId = `csflow-${source.slug}-${carId}`; // tylko dla NOWYCH rekordów
                
                // 1. Zapis Dealera — pre-check zamiast try-catch (brak P2002, brak pisma:error spam)
                let currentDealerId: string | undefined;
                if (car.dealer) {
                    const d = car.dealer;
                    const dealerData = {
                        name: d.name || `Dealer #${d.id}`,
                        addressLine1: d.address || '',
                        city: d.city || null,
                        postalCode: d.postal_code || null,
                        contactPhone: d.phone_used || d.phone_number || null,
                        contactEmail: d.email || null,
                        contactEmailService: d.email_service || null,
                        googleLink: d.url || null,
                    };

                    let dealer;
                    if (d.id) {
                        // Krok 1: Szukaj po CSFlow ID (najszybsza ścieżka, O(1))
                        const byId = await prisma.dealer.findUnique({
                            where: { csflowSourceId_csflowDealerId: { csflowSourceId: source.id, csflowDealerId: d.id } }
                        });

                        if (byId) {
                            // Dealer już powiązany — zaktualizuj dane (np. telefon, miasto)
                            dealer = await prisma.dealer.update({
                                where: { id: byId.id },
                                data: {
                                    ...dealerData,
                                    ...(byId.dealerGroupId === null && source.dealerGroupId
                                        ? { dealerGroupId: source.dealerGroupId }
                                        : {}),
                                },
                            });
                        } else {
                            // Krok 2: Sprawdź czy jest dealer z tym samym name+adres (ręcznie dodany
                            // lub inny CSFlow ID z identyczną nazwą/adresem)
                            const byNameAddr = await prisma.dealer.findFirst({
                                where: {
                                    name: dealerData.name,
                                    addressLine1: dealerData.addressLine1 || '',
                                }
                            });

                            if (byNameAddr) {
                                if (!byNameAddr.csflowDealerId) {
                                    // Dealer bez CSFlow ID — połącz go z bieżącym
                                    dealer = await prisma.dealer.update({
                                        where: { id: byNameAddr.id },
                                        data: { ...dealerData, csflowDealerId: d.id, csflowSourceId: source.id },
                                    });
                                    console.log(`[CSFlow:${source.slug}] Połączono dealera "${dealerData.name}" (DB: ${byNameAddr.id}) z CSFlow ID ${d.id}`);
                                } else {
                                    // Dealer już powiązany z INNYM csflowDealerId — użyj go bez nadpisywania
                                    // (zapobiega ping-pongowi gdy dwa CSFlow-dealerzy mają tę samą nazwę/adres)
                                    console.log(`[CSFlow:${source.slug}] Dealer "${dealerData.name}" już powiązany z CSFlow ID ${byNameAddr.csflowDealerId}, pomijam przypisanie ID ${d.id}`);
                                    dealer = byNameAddr;
                                }
                            } else {
                                // Krok 3: Nowy dealer — utwórz
                                dealer = await prisma.dealer.create({
                                    data: {
                                        csflowDealerId: d.id,
                                        csflowSourceId: source.id,
                                        dealerGroupId: source.dealerGroupId,
                                        ...dealerData,
                                    },
                                });
                            }
                        }
                    } else {
                        // Fallback gdy brak d.id (nie powinno się zdarzać)
                        dealer = await prisma.dealer.upsert({
                            where: {
                                name_addressLine1: {
                                    name: dealerData.name,
                                    addressLine1: dealerData.addressLine1 || 'Brak Ulicy',
                                }
                            },
                            create: {
                                ...dealerData,
                                addressLine1: dealerData.addressLine1 || 'Brak Ulicy',
                                csflowSourceId: source.id,
                                dealerGroupId: source.dealerGroupId,
                            },
                            update: dealerData,
                        });
                    }
                    currentDealerId = dealer.id;
                }

                const mappedEq = mapEquipment(car.equipment_groups);

                // Szukamy po CSFlow ID oraz po unikalnym VIN
                const existingByCsflowId = existingListings.find(l => l.csflowCarId === carId);
                
                // Sprawdź VIN w CAŁEJ bazie (nie tylko w CSFlow)
                const vinConflictListingId = car.vin ? allVinToListingId.get(car.vin) : undefined;
                const isVinConflict = !existingByCsflowId && car.vin && vinConflictListingId !== undefined;

                if (isVinConflict) {
                    console.log(`[CSFlow:${source.slug}] Pominięto auto id ${car.id} ponieważ VIN ${car.vin} już istnieje (oferta: ${vinConflictListingId || 'brak ID'}).`);
                    result.failed++;
                    continue;
                }

                // Przygotuj format pliku (mapowanie na pola Listing Prisma)
                const apiPrice = Number(car.price || 0);

                // Sprawdź czy to pojazd dostawczy / ciężarowy lub cena jest netto w opisie:
                const categoryLower = String(car.category || '').toLowerCase();
                const bodyLower = String(car.body || '').toLowerCase();
                const versionLower = String(car.version || '').toLowerCase();
                const descLower = String(car.description || '').toLowerCase();
                const seatsCount = Number(car.seats || 0);

                const titleLower = String(car.title || '').toLowerCase();

                const isCommercial =
                    categoryLower === 'dostawcze' ||
                    categoryLower === 'ciężarowe' ||
                    bodyLower === 'furgon' ||
                    bodyLower.includes('skrzynia') ||
                    bodyLower.includes('plandeka') ||
                    bodyLower.includes('kontener') ||
                    versionLower.includes('furgon') ||
                    versionLower.includes('l4h2') ||
                    versionLower.includes('l3h2') ||
                    versionLower.includes('l2h2') ||
                    (seatsCount > 0 && seatsCount <= 3 && !bodyLower.includes('coupe') && !bodyLower.includes('kabriolet') && !bodyLower.includes('sportowy'));

                const hasNettoInDescription =
                    descLower.includes('netto') ||
                    titleLower.includes('netto');

                // W systemie CSFlow dla pojazdów dostawczych i ciężarowych przy pełnej fakturze VAT 23%
                // (invoice_vat === 1 oraz tax_type_id === 1) cena w API jest ceną netto pod warunkiem,
                // że opis lub tytuł ogłoszenia jawnie wskazuje, że cena jest netto.
                // Ponieważ w bazie danych pole pricePln przechowuje cenę brutto, musimy ją przeliczyć.
                const isCommercialNetPrice =
                    (Number(car.invoice_vat) === 1 && Number(car.tax_type_id) === 1) &&
                    hasNettoInDescription;

                const price = isCommercialNetPrice ? Math.round(apiPrice * 1.23) : apiPrice;

                
                // Pobierz zewnętrzne URL-e zdjęć
                const externalPhotos = Array.isArray(car.photos_lg) && car.photos_lg.length > 0
                    ? car.photos_lg
                    : (Array.isArray(car.photos) ? car.photos : []);

                // Początkowo przypisujemy zewnętrzne URL zdjęć, a pobieranie lokalne zlecamy w tle
                const primaryImage = externalPhotos.length > 0 ? externalPhotos[0] : null;

                const make = normalizeBrand(car.brand_name || car.brand?.name);
                const model = car.model_name || car.model?.name || 'Inne';
                const version = car.version || null;
                const prodYear = parseInt(car.production_year) || new Date().getFullYear();
                const bodyType = car.body || null;
                const fuelType = car.fuel || null;

                const payload = {
                    listingId: listingId,
                    csflowSourceId: source.id,
                    csflowCarId: carId,
                    make: make,
                    model: model,
                    version: version,
                    vin: car.vin || null,
                    pricePln: price,
                    productionYear: prodYear,
                    registrationNumber: car.registration_number || null,
                    mileageKm: car.mileage ? parseInt(car.mileage) : 0,
                    fuelType: fuelType,
                    transmission: car.transmission || null,
                    enginePowerHp: car.power ? parseInt(car.power) : null,
                    engineCapacityCm3: car.capacity ? parseInt(car.capacity) : null,
                    drive: car.drive || null,
                    bodyType: bodyType,
                    doors: car.doors ? parseInt(car.doors) : null,
                    seats: car.seats ? parseInt(car.seats) : null,
                    color: car.color || null,
                    paintType: car.laquer || null,
                    primaryImageUrl: primaryImage,
                    imageUrls: externalPhotos,
                    imageCount: externalPhotos.length,
                    dealerId: currentDealerId,
                    equipmentAudioMultimedia: mappedEq.audio,
                    equipmentSafety: mappedEq.safety,
                    equipmentComfortExtras: mappedEq.comfort,
                    equipmentOther: mappedEq.other,
                    additionalInfoHeader: car.description_header,
                    additionalInfoContent: car.description_footer,
                    marketplace: 'csflow', // Można oznaczyć jako specyficzne źródło
                    importSource: 'csflow',
                    vatMargin: Number(car.invoice_vat) === 0 || Number(car.tax_type_id) !== 1,
                    // slug: generated below
                };

                let savedListing;
                if (existingByCsflowId) {
                    const { listingId: _ignored, ...updatePayload } = payload;
                    savedListing = await prisma.listing.update({
                        where: { id: existingByCsflowId.id },
                        data: { ...updatePayload, isArchived: false, archivedAt: null, archivedReason: null, entrySource: 'CSFLOW' as const }
                    });

                    if (existingByCsflowId.pricePln !== price) {
                        priceHistoryEntries.push({ listingId: savedListing.id, pricePln: price });
                    }
                    result.updated++;
                } else {
                    const temporarySlug = generateListingSlug(make, model, version, prodYear, bodyType, fuelType, listingId);

                    savedListing = await prisma.listing.create({
                        data: {
                            ...payload,
                            slug: temporarySlug,
                            entrySource: 'CSFLOW' as const
                        }
                    });

                    // Update real slug using actual DB record UUID
                    const finalSlug = generateListingSlug(make, model, version, prodYear, bodyType, fuelType, savedListing.id);
                    await prisma.listing.update({ where: { id: savedListing.id }, data: { slug: finalSlug } });

                    priceHistoryEntries.push({ listingId: savedListing.id, pricePln: price });
                    result.inserted++;
                    // Dodaj VIN do mapy, żeby duplikaty w tym samym batchu też były wykryte
                    if (car.vin) allVinToListingId.set(car.vin, listingId);
                }

                // Dodaj pobieranie i zcachowanie zdjęć do kolejki w tle
                if (externalPhotos.length > 0) {
                    queueListingImagesDownload(savedListing.listingId as string, externalPhotos, prisma);
                }
            } catch (err: any) {
                console.error(`[CSFlow:${source.slug}] Błąd zapisu ID ${car.id}: ${err.message}`);
                result.failed++;
            }
        }

        // Archiwizowanie nieobecnych na aktualnej liście CSFlow API
        for (const l of existingListings) {
            if (!l.isArchived && l.csflowCarId !== null && !currentCarIds.has(l.csflowCarId)) {
                await prisma.listing.update({
                    where: { id: l.id },
                    data: {
                        isArchived: true,
                        archivedAt: new Date(),
                        archivedReason: `Usunięte ze źródła CSFlow (${source.name})`
                    }
                });
                result.archived++;
            }
        }

        // Dodanie cen do PriceHistory
        if (priceHistoryEntries.length > 0) {
            await prisma.priceHistory.createMany({
                data: priceHistoryEntries.map(e => ({
                    listingId: e.listingId,
                    pricePln: e.pricePln,
                    changedAt: new Date()
                }))
            });
        }

        const duration = Date.now() - startTime;

        let actualUserId = userId;
        if (userId === 'system-cron') {
            const defaultAdmin = await prisma.user.findFirst({ where: { role: 'admin', isActive: true } });
            if (defaultAdmin) {
                actualUserId = defaultAdmin.id;
            }
        }

        if (actualUserId !== 'system-cron') {
            await prisma.importLog.create({
                data: {
                    importedBy: actualUserId,
                    fileName: `Zewnętrzne API (CSFlow: ${source.name})`,
                    totalRows: carsData.length,
                    inserted: result.inserted,
                    updated: result.updated,
                    archived: result.archived,
                    failed: result.failed,
                    status: result.failed === 0 ? 'success' : (result.inserted + result.updated > 0 ? 'partial' : 'failed'),
                    duration: duration
                }
            });
        }

        console.log(`[CSFlow:${source.slug}] Synchronizacja zakończona w ${duration}ms. Wstawiono: ${result.inserted}, Aktualiz: ${result.updated}, Zarch: ${result.archived}, Błędy: ${result.failed}`);

        await prisma.csflowSource.update({ where: { id: source.id }, data: { lastSyncAt: new Date() } });

        return result;

    } catch (err) {
        console.error(`[CSFlow:${source.slug}] Krytyczny błąd pobrania listy pojazdów`, err);
        throw err;
    }
}

export async function syncAllCSFlowSources(prisma: PrismaClient, userId: string = 'system-cron') {
    const settings = await prisma.appSettings.findUnique({ where: { id: 'default' } });
    if (settings?.csflowEnabled === false) {
        console.log('[CSFlow] Synchronizacja pominięta — integracja wyłączona w ustawieniach (master switch)');
        return { inserted: 0, updated: 0, archived: 0, failed: 0, totalRows: 0, perSource: [], skipped: true };
    }

    const sources = await prisma.csflowSource.findMany({
        where: { isEnabled: true },
        orderBy: { createdAt: 'asc' },
    });

    const totals = { inserted: 0, updated: 0, archived: 0, failed: 0, totalRows: 0 };
    const perSource: any[] = [];

    for (const source of sources) {
        try {
            const result = await syncCSFlowAPI(prisma, source, userId);
            totals.inserted += result.inserted;
            totals.updated += result.updated;
            totals.archived += result.archived;
            totals.failed += result.failed;
            totals.totalRows += result.totalRows;
            perSource.push({ sourceId: source.id, name: source.name, slug: source.slug, ...result });
        } catch (err: any) {
            console.error(`[CSFlow:${source.slug}] Błąd synchronizacji źródła:`, err);
            perSource.push({ sourceId: source.id, name: source.name, slug: source.slug, error: err.message });
        }
    }

    return { ...totals, perSource };
}

export function initCSFlowCron(prisma: PrismaClient) {
    console.log('[CSFlow] Rejestracja zadania (co 6 godzin)');
    cron.schedule('0 */6 * * *', async () => {
        console.log('[CRON] Wykonanie automatycznego importu CSFlow API');
        try {
            await syncAllCSFlowSources(prisma);
        } catch (e) {
            console.error('[CRON] Nie udało się wykonać zadania importu CSFlow:', e);
        }
    });
}
