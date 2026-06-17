import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    try {
        const listing = await prisma.listing.findFirst();
        if (!listing) return console.log("No listing");
        
        console.log("Updating listing", listing.id, "with disconnect: true on creditProduct");
        await prisma.listing.update({
            where: { id: listing.id },
            data: {
                creditProduct: { disconnect: true }
            }
        });
        console.log("Success!");
    } catch (e) {
        console.error("Prisma error:", e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
