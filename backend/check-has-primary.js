import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const listings = await prisma.listing.findMany({
    where: { make: 'Ford', model: 'Puma' }
  });

  console.log(`Found ${listings.length} Ford Pumas in total.`);
  
  for (const l of listings) {
    const hasPrimary = l.imageUrls?.includes(l.primaryImageUrl);
    console.log(`ID: ${l.id}, Primary: ${l.primaryImageUrl}, URLs length: ${l.imageUrls?.length}, Has primary in urls: ${hasPrimary}`);
    if (!hasPrimary) {
      console.log(`First 3 urls: ${l.imageUrls?.slice(0, 3)}`);
    }
  }
}
check();
