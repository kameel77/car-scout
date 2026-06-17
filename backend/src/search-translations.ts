import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Searching database for "Autopunkt"...');
    
    // 1. Search translations
    const translations = await prisma.translation.findMany({
        where: {
            OR: [
                { sourceValue: { contains: 'Autopunkt', mode: 'insensitive' } },
                { pl: { contains: 'Autopunkt', mode: 'insensitive' } },
                { en: { contains: 'Autopunkt', mode: 'insensitive' } },
                { de: { contains: 'Autopunkt', mode: 'insensitive' } }
            ]
        }
    });
    console.log(`Found ${translations.length} translations:`, translations);

    // 2. Search dealers
    const dealers = await prisma.dealer.findMany({
        where: {
            OR: [
                { name: { contains: 'Autopunkt', mode: 'insensitive' } }
            ]
        }
    });
    console.log(`Found ${dealers.length} dealers:`, dealers);

    // 3. Search AppSettings
    const appSettings = await prisma.appSettings.findMany();
    const appSettingsJson = JSON.stringify(appSettings);
    if (appSettingsJson.toLowerCase().includes('autopunkt')) {
        console.log('Found Autopunkt in AppSettings!');
    } else {
        console.log('Autopunkt not found in AppSettings.');
    }

    // 4. Search Listings
    const listings = await prisma.listing.findMany({
        where: {
            OR: [
                { additionalInfoHeader: { contains: 'Autopunkt', mode: 'insensitive' } },
                { additionalInfoContent: { contains: 'Autopunkt', mode: 'insensitive' } }
            ]
        },
        select: { id: true, listingId: true }
    });
    console.log(`Found ${listings.length} listings with Autopunkt in description.`);

    // 5. Search FaqEntries
    const faqs = await prisma.faqEntry.findMany({
        where: {
            OR: [
                { questionPl: { contains: 'Autopunkt', mode: 'insensitive' } },
                { answerPl: { contains: 'Autopunkt', mode: 'insensitive' } }
            ]
        }
    });
    console.log(`Found ${faqs.length} FAQ entries with Autopunkt.`);

    // 6. Search DealerGroups
    const groups = await prisma.dealerGroup.findMany({
        where: {
            name: { contains: 'Autopunkt', mode: 'insensitive' }
        }
    });
    console.log(`Found ${groups.length} dealer groups with Autopunkt:`, groups);

}

main().finally(() => prisma.$disconnect());
