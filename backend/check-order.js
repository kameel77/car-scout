import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const listings = await prisma.listing.findMany({
    where: { make: 'Ford', model: 'Puma' }
  });

  for (const l of listings) {
    const primary = l.primaryImageUrl;
    const index = l.imageUrls?.indexOf(primary);
    console.log(`ID: ${l.id}, Primary Index: ${index}, URLs: ${l.imageUrls?.length}`);
  }
}
check();
