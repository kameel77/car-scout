const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const l = await prisma.listing.findUnique({ where: { vin: 'TESTVIN001S19999' }});
    console.log(l);
}
main().finally(() => prisma.$disconnect());
