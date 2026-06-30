import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
    console.log('--- Rozpoczynanie naprawy primaryImageUrl dla zewnetrznych zdjec ---');
    let fixedListingsCount = 0;

    try {
        const listings = await prisma.listing.findMany({
            select: { id: true, primaryImageUrl: true, imageUrls: true }
        });

        for (const listing of listings) {
            let changed = false;
            let newPrimary = listing.primaryImageUrl;

            // Trim trailing spaces in imageUrls
            const cleanedUrls = listing.imageUrls.map(url => url.trim());
            for (let i = 0; i < listing.imageUrls.length; i++) {
                if (listing.imageUrls[i] !== cleanedUrls[i]) {
                    changed = true;
                }
            }

            if (newPrimary && newPrimary.endsWith('.webp') && !newPrimary.startsWith('/uploads/')) {
                // Find matching original URL in imageUrls
                const baseName = newPrimary.substring(0, newPrimary.length - 5); // remove .webp
                
                const match = cleanedUrls.find(u => {
                    const uBase = u.substring(0, u.lastIndexOf('.'));
                    return uBase.toLowerCase() === baseName.toLowerCase();
                });

                if (match) {
                    newPrimary = match;
                    changed = true;
                } else if (cleanedUrls.length > 0) {
                    // Fallback to first image
                    newPrimary = cleanedUrls[0];
                    changed = true;
                }
            }

            if (changed) {
                await prisma.listing.update({
                    where: { id: listing.id },
                    data: {
                        primaryImageUrl: newPrimary,
                        imageUrls: cleanedUrls
                    }
                });
                console.log(`Naprawiono ogloszenie: ${listing.id}`);
                fixedListingsCount++;
            }
        }

        console.log(`\n--- Podsumowanie ---`);
        console.log(`Zakonczono sukcesem. Naprawiono ogloszen: ${fixedListingsCount}`);
    } catch (error) {
        console.error('Wystapil blad podczas naprawy:', error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
