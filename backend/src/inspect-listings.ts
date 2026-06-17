import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Inspecting CSFlow listings in DB...');
    const listings = await prisma.listing.findMany({
        where: {
            entrySource: 'CSFLOW'
        },
        take: 5,
        include: {
            dealer: true
        }
    });
    
    for (const l of listings) {
        console.log('--- Listing ---');
        console.log(`ID: ${l.id}, ListingId: ${l.listingId}`);
        console.log(`Make/Model: ${l.make} ${l.model}`);
        console.log(`Additional Info Header:`, l.additionalInfoHeader);
        console.log(`Additional Info Content:`, l.additionalInfoContent);
        console.log(`Dealer:`, l.dealer);
    }
}

main().finally(() => prisma.$disconnect());
