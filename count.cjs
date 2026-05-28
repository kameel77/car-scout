const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const v = await prisma.rentalVehicle.count();
  const a = await prisma.vehicleRentalAssignment.count();
  const m = await prisma.rentalMatrixEntry.count();
  console.log(`Vehicles: ${v}, Assignments: ${a}, Matrix: ${m}`);
  process.exit(0);
}
run();
