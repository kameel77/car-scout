import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const listings = await prisma.listing.findMany({
    where: {
      NOT: { primaryImageUrl: null }
    }
  });

  const emptyImages = listings.filter(l => !l.imageUrls || l.imageUrls.length === 0);
  console.log(`Found ${emptyImages.length} listings with primaryImageUrl but empty imageUrls`);
  
  if (emptyImages.length > 0) {
    console.log(emptyImages.slice(0, 3).map(l => ({ id: l.id, make: l.make, primaryImageUrl: l.primaryImageUrl, imageUrls: l.imageUrls })));
  }
}
check();
