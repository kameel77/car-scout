import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const rental = await prisma.rentalVehicle.findUnique({
    where: { id: 'cmnxc19z20029tscynqannxr7' }
  });
  console.log(JSON.stringify(rental, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
