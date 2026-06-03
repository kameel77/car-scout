import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log("Fetching rental vehicles...");
    const vehicles = await prisma.rentalVehicle.findMany({
        take: 10,
        select: {
            id: true,
            make: true,
            model: true,
            primaryImageUrl: true,
            imageUrls: true
        }
    });
    console.log("Result:", JSON.stringify(vehicles, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
