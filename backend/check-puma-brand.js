import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const listings = await prisma.listing.findMany({
    where: { make: 'Ford', model: 'Puma' }
  });

  console.log(`Found ${listings.length} Ford Pumas in total.`);
  
  for (const l of listings) {
    console.log(`ID: ${l.id}, CSFlow: ${l.listingId}, Brand: ${l.brandId}, Arch: ${l.isArchived}, Primary: ${l.primaryImageUrl}`);
  }
}
check();
