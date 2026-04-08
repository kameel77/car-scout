import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const latestLogs = await prisma.importLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5
    });
    console.log(JSON.stringify(latestLogs, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
