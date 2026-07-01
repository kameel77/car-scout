import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const listings = await prisma.listing.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  listings.forEach(l => {
    console.log(l.id, l.primaryImageUrl);
  });
}
main().catch(console.error).finally(() => prisma.$disconnect());
