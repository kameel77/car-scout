import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const spec = await prisma.specification.findFirst({
    where: { imageUrls: { isEmpty: false } },
  });
  console.log('primaryImageUrl:', spec?.primaryImageUrl);
  console.log('imageUrls:', spec?.imageUrls);
}
main().catch(console.error).finally(() => prisma.$disconnect());
