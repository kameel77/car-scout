import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log("Searching for listing by VIN...");
    const listing = await prisma.listing.findFirst({
        where: { vin: "TMBJH7NPXN7039429" }
    });
    console.log("Result:", JSON.stringify(listing, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
