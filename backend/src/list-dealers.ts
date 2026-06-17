import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Listing all dealers in DB...');
    const dealers = await prisma.dealer.findMany({
        include: {
            _count: {
                select: { listings: true }
            }
        }
    });
    console.log(dealers);
}

main().finally(() => prisma.$disconnect());
