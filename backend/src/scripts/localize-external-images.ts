import { PrismaClient } from '@prisma/client';
import { downloadAndCacheImages } from '../services/csflow-image-downloader.js';

// Backfill: pobiera zewnętrzne zdjęcia listingów (np. api.autopunkt.pl z importów CSV)
// na dysk jako WebP z wariantami i podmienia URL-e w bazie na lokalne /uploads/...
// Idempotentny — pliki już pobrane nie są ściągane ponownie.
//
// Lokalnie:      npx tsx src/scripts/localize-external-images.ts
// W kontenerze:  node dist/scripts/localize-external-images.js

const prisma = new PrismaClient();

const isExternal = (u: string) => u.startsWith('http://') || u.startsWith('https://');

async function run() {
    const listings = await prisma.listing.findMany({
        where: { isArchived: false },
        select: { id: true, listingId: true, primaryImageUrl: true, imageUrls: true }
    });

    let processed = 0;
    let localized = 0;
    let skippedNoId = 0;

    for (const listing of listings) {
        const trimmedUrls = listing.imageUrls.map(u => u.trim()).filter(Boolean);
        const externalUrls = trimmedUrls.filter(isExternal);
        const trimChanged = trimmedUrls.some((u, i) => u !== listing.imageUrls[i])
            || trimmedUrls.length !== listing.imageUrls.length;

        if (externalUrls.length === 0) {
            // Brak zewnętrznych zdjęć — popraw co najwyżej spacje w URL-ach
            if (trimChanged) {
                await prisma.listing.update({
                    where: { id: listing.id },
                    data: {
                        imageUrls: trimmedUrls,
                        primaryImageUrl: listing.primaryImageUrl?.trim() || trimmedUrls[0] || null
                    }
                });
            }
            continue;
        }

        if (!listing.listingId) {
            console.warn(`[Backfill] Pomijam ${listing.id} — brak listingId (wymagany jako klucz katalogu cache)`);
            skippedNoId++;
            continue;
        }

        processed++;
        const localPhotos = await downloadAndCacheImages(listing.listingId, trimmedUrls);
        const stillExternal = localPhotos.filter(isExternal).length;

        await prisma.listing.update({
            where: { id: listing.id },
            data: {
                primaryImageUrl: localPhotos[0] ?? null,
                imageUrls: localPhotos,
                imageCount: localPhotos.length
            }
        });

        localized++;
        console.log(
            `[Backfill] ${listing.listingId}: ${localPhotos.length} zdjęć` +
            (stillExternal > 0 ? ` (${stillExternal} nieudanych — zostały zewnętrzne URL-e)` : '')
        );
    }

    console.log(`\n--- Podsumowanie ---`);
    console.log(`Listingów aktywnych: ${listings.length}`);
    console.log(`Z zewnętrznymi zdjęciami: ${processed}, zaktualizowanych: ${localized}, pominiętych (brak listingId): ${skippedNoId}`);
}

run()
    .catch(err => {
        console.error('Backfill failed:', err);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
