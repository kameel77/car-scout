import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const listings = await prisma.listing.findMany({
    where: { make: 'Ford', model: 'Puma' }
  });

  for (const l of listings) {
    console.log('ID:', l.id, 'Brand:', l.make, l.model, l.brandId);
    console.log('  primaryImageUrl:', l.primaryImageUrl);
    console.log('  imageUrls[0]:', l.imageUrls[0]);
    console.log('  match?', l.primaryImageUrl === l.imageUrls[0]);
    console.log('  exists in array?', l.imageUrls.includes(l.primaryImageUrl));
  }
}
check();
