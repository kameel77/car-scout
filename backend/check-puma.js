import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const listings = await prisma.listing.findMany({
    where: { make: 'Ford', model: 'Puma' },
    select: { id: true, listingId: true, make: true, model: true, primaryImageUrl: true, imageUrls: true },
    take: 3
  });
  console.log(JSON.stringify(listings, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
