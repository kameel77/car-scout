import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const listing = await prisma.listing.findFirst({
    where: { entrySource: 'MANUAL' },
    orderBy: { createdAt: 'desc' },
  });
  console.log('id:', listing?.id);
  console.log('primaryImageUrl:', listing?.primaryImageUrl);
  console.log('imageUrls:', listing?.imageUrls);
}
main().catch(console.error).finally(() => prisma.$disconnect());
