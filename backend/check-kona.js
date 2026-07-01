import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const listing = await prisma.listing.findUnique({
    where: { id: 'cmpybdxnu004hbzwblniqt2dj' }
  });

  if (!listing) {
    console.log('Listing not found');
    return;
  }

  console.log(`ID: ${listing.id}`);
  console.log(`Primary Image: ${listing.primaryImageUrl}`);
  console.log(`Image URLs length: ${listing.imageUrls?.length}`);
  console.log(`First 3 URLs: ${listing.imageUrls?.slice(0, 3)}`);
}
check();
