import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
    console.log('--- Rozpoczynanie naprawy rozszerzeń zdjęć w bazie danych ---');
    let fixedListingsCount = 0;

    try {
        const listings = await prisma.listing.findMany({
            select: { id: true, primaryImageUrl: true, imageUrls: true }
        });

        for (const listing of listings) {
            let changed = false;

            const newPrimary = listing.primaryImageUrl 
                ? listing.primaryImageUrl.replace(/\.(jpg|jpeg|png)$/i, '.webp') 
                : null;
            if (newPrimary !== listing.primaryImageUrl) changed = true;

            const newUrls = listing.imageUrls.map(url => url.replace(/\.(jpg|jpeg|png)$/i, '.webp'));
            
            // Check if arrays are different
            if (listing.imageUrls.length !== newUrls.length) changed = true;
            for (let i = 0; i < listing.imageUrls.length; i++) {
                if (listing.imageUrls[i] !== newUrls[i]) {
                    changed = true;
                    break;
                }
            }

            if (changed) {
                await prisma.listing.update({
                    where: { id: listing.id },
                    data: {
                        primaryImageUrl: newPrimary,
                        imageUrls: newUrls
                    }
                });
                console.log(`Naprawiono ogłoszenie: ${listing.id}`);
                fixedListingsCount++;
            }
        }

        console.log(`\n--- Podsumowanie ---`);
        console.log(`Zakończono sukcesem. Naprawiono ogłoszeń: ${fixedListingsCount}`);
    } catch (error) {
        console.error('Wystąpił błąd podczas naprawy:', error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
