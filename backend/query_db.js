import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log("Connecting to Database...");
    
    const unarchivedNullSource = await prisma.listing.count({
        where: { isArchived: false, importSource: null }
    });
    const totalListings = await prisma.listing.count();
    const totalArchived = await prisma.listing.count({ where: { isArchived: true } });
    const totalUnarchived = await prisma.listing.count({ where: { isArchived: false } });
    
    console.log(JSON.stringify({ unarchivedNullSource, totalListings, totalArchived, totalUnarchived }, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
