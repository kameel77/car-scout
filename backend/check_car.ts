import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const listing = await prisma.listing.findUnique({
        where: { id: 'cmq6se2gt00qeewehdtqmqshb' }
    });
    console.log("Listing URL:", listing?.url);
    console.log("Listing importSource:", listing?.importSource);
    console.log("Listing vatMargin:", listing?.vatMargin);
}
main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
