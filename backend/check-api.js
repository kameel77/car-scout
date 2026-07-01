import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const listing = await prisma.listing.findFirst({
    where: { make: 'Ford', model: 'Puma' }
  });
  console.log('API representation of imageUrls:', JSON.stringify(listing.imageUrls, null, 2));
  console.log('primaryImageUrl:', listing.primaryImageUrl);
}
check();
