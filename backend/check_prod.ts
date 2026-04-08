import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    const total = await prisma.listing.count();
    const active = await prisma.listing.count({ where: { isArchived: false } });
    const archived = await prisma.listing.count({ where: { isArchived: true } });
    const sources = await prisma.listing.groupBy({
        by: ['importSource', 'isArchived'],
        _count: { id: true }
    });
    console.log({ total, active, archived, sources });
}
check().finally(() => prisma.$disconnect());
