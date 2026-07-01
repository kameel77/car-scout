import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const listings = await prisma.listing.findMany({
    where: { isArchived: false, primaryImageUrl: { not: null } },
    select: { id: true, listingId: true, primaryImageUrl: true, imageUrls: true }
  });
  
  let issues = [];
  for (const l of listings) {
    if (!l.imageUrls.includes(l.primaryImageUrl)) {
      issues.push(l.listingId);
    }
  }
  
  console.log(`Found ${issues.length} listings where primaryImageUrl is not in imageUrls`);
  if (issues.length > 0) {
    console.log(issues.slice(0, 10));
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
