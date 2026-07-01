import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
    const listings = await prisma.listing.findMany({
        where: {
            id: {
                in: ['cmpuz61630336z52rw0qbx6p5', 'cmqjbz8pz00incp01ts7jf6p3']
            }
        },
        select: {
            id: true,
            make: true,
            model: true,
            primaryImageUrl: true,
            imageUrls: true
        }
    });
    
    console.log(JSON.stringify(listings, null, 2));
}

run().catch(console.error).finally(() => prisma.$disconnect());
