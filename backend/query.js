import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const listing = await prisma.listing.findFirst({
    orderBy: { createdAt: 'desc' },
  });
  console.log('primaryImageUrl:', listing.primaryImageUrl);
  console.log('imageUrls:', listing.imageUrls);
}
main().catch(console.error).finally(() => prisma.$disconnect());
