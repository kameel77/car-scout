import { PrismaClient } from '@prisma/client';
import { getCSFlowCars, getCSFlowCarDetails } from '../utils/csflow-client.js';
import { generateListingSlug } from '../utils/url-utils.js';
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

        const currentApiIds = new Set<string>();

        // Do śledzenia historii cen z transaction
        const priceHistoryEntries: any[] = [];
        
        let i = 1;
        // Pętla odpytująca dokładnie każde auto - optymalizujemy: używamy Promise.all dla max 5 na raz.
        // Jednak na potrzeby stabilności po prostu iterujemy asynchronicznie.
        for (const basicCar of carsData) {
            try {
                const listingId = `csflow-${basicCar.id}`;
                currentApiIds.add(listingId);
                
                // Fetch full details
                const car = await getCSFlowCarDetails(basicCar.id);
                if (!car) continue;

                // 1. Zapis Dealera
                let currentDealerId: string | undefined;
                if (car.dealer) {
                    const d = car.dealer;
                    const dealer = await prisma.dealer.upsert({
                        where: {
                            name_addressLine1: {
                                name: d.name || 'Brak Nazwy Dealera',
                                addressLine1: d.address || 'Brak Ulicy'
                            }
                        },
                        create: {
                            name: d.name || 'Brak Nazwy Dealera',
                            addressLine1: d.address || 'Brak Ulicy',
                            city: d.city,
                            contactPhone: d.phone_used || d.phone_number,
                            googleLink: d.url
                        },
                        update: {
                            contactPhone: d.phone_used || d.phone_number
                        }
                    });
                    currentDealerId = dealer.id;
                }

                const mappedEq = mapEquipment(car.equipment_groups);

                // Szukamy po CSFlow ID oraz po unikalnym VIN, aby zapobiec Prisma Unique VIN Constrain Error
                const existingByCsflowId = existingListings.find(l => l.listingId === listingId);
                const existingByVin = existingListings.find(l => l.vin && l.vin === car.vin);
                
                // Ustalanie czy w ogóle to auto można wstawić (jeśli VIN już występuje w bazie i nie należy do tego CSFlow ID, będzie skip)
                if (!existingByCsflowId && existingByVin) {
                    console.log(`[CSFlow] Zignorowano auto id ${car.id} ponieważ VIN ${car.vin} już istnieje u innej oferty w bazie.`);
                    result.failed++;
                    continue;
                }

                // Przygotuj format pliku (mapowanie na pola Listing Prisma)
                const price = Number(car.price || 0);
                
                // Upewnijmy się, że imageUrls i primaryImageUrl poprawnie operują uboższym widokiem z bazy
                const photos = Array.isArray(car.photos_lg) && car.photos_lg.length > 0
                    ? car.photos_lg
                    : (Array.isArray(car.photos) ? car.photos : []);
                    
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
                            archivedReason: null
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
                            slug: temporarySlug
                        }
                    });

                    // Update real slug using actual DB record UUID
                    const finalSlug = generateListingSlug(make, model, version, prodYear, bodyType, fuelType, savedListing.id);
                    await prisma.listing.update({ where: { id: savedListing.id }, data: { slug: finalSlug } });

                    priceHistoryEntries.push({ listingId: savedListing.id, pricePln: price });
                    result.inserted++;
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
        
        // Zapis do logów importu, o ile użytkownik został przekazany jako konkretne ID, chociaż dla crona można założyć np. id: "system" ale nasza tabela wymaga user Relation "importedBy". 
        // W bazie car-scout "User" relation zakłada poprawne ObjectId/uuid z tabeli użytkowników. 
        // Więc jeżeli mamy przekazany id z endpointu 'manualnego' to ok. Jeżeli odpalamy z crona - można po prostu nie raportować tego w 'importLog' albo dodać specjalne id usera systemowego.

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
