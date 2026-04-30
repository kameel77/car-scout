import { PrismaClient } from '@prisma/client';
import { getCSFlowCars, getCSFlowCarDetails } from '../utils/csflow-client.js';
import { generateListingSlug } from '../utils/url-utils.js';
import { downloadAndCacheImages } from './csflow-image-downloader.js';
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

export async function syncCSFlowAPI(prisma: PrismaClient, userId: string = 'system-cron') {
    const startTime = Date.now();
    console.log('[CSFlow] Start synchronizacji API');

    try {
        const settings = await prisma.appSettings.findUnique({ where: { id: 'default' } });
        if (settings?.csflowEnabled === false) {
            console.log('[CSFlow] Synchronizacja pominięta — integracja wyłączona w ustawieniach');
            return { inserted: 0, updated: 0, archived: 0, failed: 0, totalRows: 0, skipped: true };
        }

        const carsData = await getCSFlowCars();
        console.log(`[CSFlow] Pobrane pojazdy z API: ${carsData.length}`);

        const result = {
            inserted: 0,
            updated: 0,
            archived: 0,
            failed: 0,
            totalRows: carsData.length
        };

        // Zbieranie wszystkich już zapisanych ofert systemu CSFlow w bazie
        const existingListings = await prisma.listing.findMany({
            where: {
                listingId: { startsWith: 'csflow-' }
            },
            select: { id: true, vin: true, listingId: true, isArchived: true, pricePln: true }
        });

        const activeCsflowIdsInDB = new Set(
            existingListings
                .filter(l => !l.isArchived && l.listingId !== null)
                .map(l => l.listingId as string)
        );

        // Mapa WSZYSTKICH VIN-ów w bazie (nie tylko CSFlow) — zapobiega duplikatom
        // cross-source (np. VIN ręcznie dodanego auta = VIN z CSFlow)
        const allVinEntries = await prisma.listing.findMany({
            select: { vin: true, listingId: true },
            where: { vin: { not: null } }
        });
        const allVinToListingId = new Map<string, string | null>(
            allVinEntries.map(l => [l.vin as string, l.listingId])
        );

        const currentApiIds = new Set<string>();

        // Do śledzenia historii cen z transaction
        const priceHistoryEntries: any[] = [];
        
        const i = 1;
        // Pętla odpytująca dokładnie każde auto - optymalizujemy: używamy Promise.all dla max 5 na raz.
        // Jednak na potrzeby stabilności po prostu iterujemy asynchronicznie.
        for (const basicCar of carsData) {
            try {
                const listingId = `csflow-${basicCar.id}`;
                currentApiIds.add(listingId);
                
                // Fetch full details
                const car = await getCSFlowCarDetails(basicCar.id);
                if (!car) continue;

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
                            where: { csflowDealerId: d.id }
                        });

                        if (byId) {
                            // Dealer już powiązany — zaktualizuj dane (np. telefon, miasto)
                            dealer = await prisma.dealer.update({
                                where: { id: byId.id },
                                data: dealerData,
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
                                        data: { ...dealerData, csflowDealerId: d.id },
                                    });
                                    console.log(`[CSFlow] Połączono dealera "${dealerData.name}" (DB: ${byNameAddr.id}) z CSFlow ID ${d.id}`);
                                } else {
                                    // Dealer już powiązany z INNYM csflowDealerId — użyj go bez nadpisywania
                                    // (zapobiega ping-pongowi gdy dwa CSFlow-dealerzy mają tę samą nazwę/adres)
                                    console.log(`[CSFlow] Dealer "${dealerData.name}" już powiązany z CSFlow ID ${byNameAddr.csflowDealerId}, pomijam przypisanie ID ${d.id}`);
                                    dealer = byNameAddr;
                                }
                            } else {
                                // Krok 3: Nowy dealer — utwórz
                                dealer = await prisma.dealer.create({
                                    data: { csflowDealerId: d.id, ...dealerData },
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
                            },
                            update: dealerData,
                        });
                    }
                    currentDealerId = dealer.id;
                }

                const mappedEq = mapEquipment(car.equipment_groups);

                // Szukamy po CSFlow ID oraz po unikalnym VIN
                const existingByCsflowId = existingListings.find(l => l.listingId === listingId);
                
                // Sprawdź VIN w CAŁEJ bazie (nie tylko w CSFlow)
                const vinConflictListingId = car.vin ? allVinToListingId.get(car.vin) : undefined;
                const isVinConflict = !existingByCsflowId && car.vin && vinConflictListingId !== undefined;

                if (isVinConflict) {
                    console.log(`[CSFlow] Pominięto auto id ${car.id} ponieważ VIN ${car.vin} już istnieje (oferta: ${vinConflictListingId || 'brak ID'}).`);
                    result.failed++;
                    continue;
                }

                // Przygotuj format pliku (mapowanie na pola Listing Prisma)
                const price = Number(car.price || 0);
                
                // Pobierz zewnętrzne URL-e zdjęć
                const externalPhotos = Array.isArray(car.photos_lg) && car.photos_lg.length > 0
                    ? car.photos_lg
                    : (Array.isArray(car.photos) ? car.photos : []);

                // Pobierz i zcachuj zdjęcia lokalnie (idempotentne — pomija istniejące pliki)
                const photos = await downloadAndCacheImages(listingId, externalPhotos);
                    
                const primaryImage = photos.length > 0 ? photos[0] : null;

                const make = car.brand_name || car.brand?.name || 'Inne';
                const model = car.model_name || car.model?.name || 'Inne';
                const version = car.version || null;
                const prodYear = parseInt(car.production_year) || new Date().getFullYear();
                const bodyType = car.body || null;
                const fuelType = car.fuel || null;

                const payload = {
                    listingId: listingId,
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
                    imageUrls: photos,
                    imageCount: photos.length,
                    dealerId: currentDealerId,
                    equipmentAudioMultimedia: mappedEq.audio,
                    equipmentSafety: mappedEq.safety,
                    equipmentComfortExtras: mappedEq.comfort,
                    equipmentOther: mappedEq.other,
                    additionalInfoHeader: car.description_header,
                    additionalInfoContent: car.description_footer,
                    marketplace: 'csflow', // Można oznaczyć jako specyficzne źródło
                    // slug: generated below
                };

                let savedListing;
                if (existingByCsflowId) {
                    savedListing = await prisma.listing.update({
                        where: { id: existingByCsflowId.id },
                        data: {
                            ...payload,
                            isArchived: false,
                            archivedAt: null,
                            archivedReason: null,
                            entrySource: 'CSFLOW' as const
                        }
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
            } catch (err: any) {
                console.error(`[CSFlow] Błąd zapisu ID ${basicCar.id}: ${err.message}`);
                result.failed++;
            }
        }

        // Archiwizowanie nieobecnych na aktualnej liście CSFlow API
        for (const existingListingId of activeCsflowIdsInDB) {
            if (!currentApiIds.has(existingListingId)) {
                // Był w aktywnej puli, ale zniknął w obecnym pakiecie
                // Prisma is expected to have it if we fetched active ones earlier
                await prisma.listing.update({
                    where: { listingId: existingListingId },
                    data: {
                        isArchived: true,
                        archivedAt: new Date(),
                        archivedReason: 'Usunięte ze źródła CSFlow'
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
                    fileName: 'Zewnętrzne API (CSFlow)',
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

        console.log(`[CSFlow] Synchronizacja zakończona w ${duration}ms. Wstawiono: ${result.inserted}, Aktualiz: ${result.updated}, Zarch: ${result.archived}, Błędy: ${result.failed}`);
        
        return result;

    } catch (err) {
        console.error('[CSFlow] Krytyczny błąd pobrania listy pojazdów', err);
        throw err;
    }
}

// Funkcja rejestracji harmonogramu
export function initCSFlowCron(prisma: PrismaClient) {
    // Cron odpala się co 6 godzin (zgodnie z decyzją "co 6 godzin")
    console.log('[CSFlow] Rejestracja zadania (co 6 godzin)');
    cron.schedule('0 */6 * * *', async () => {
        console.log('[CRON] Wykonanie automatycznego importu CSFlow API');
        try {
            await syncCSFlowAPI(prisma);
        } catch (e) {
            console.error('[CRON] Nie udało się wykonać zadania importu CSFlow:', e);
        }
    });
}
