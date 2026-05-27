const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const v = await prisma.rentalVehicle.findFirst({
        where: { model: { contains: 'E' }, make: { contains: 'Mercedes' } },
        include: {
            rentalAssignments: {
                include: {
                    matrixEntries: {
                        where: { contractMonths: 36, annualMileageKm: 10000 }
                    }
                }
            }
        }
    });

    if (v) {
        console.log(`Found: ${v.make} ${v.model}`);
        for (const a of v.rentalAssignments) {
            for (const m of a.matrixEntries) {
                console.log(`Pct: ${m.initialPaymentPct}, Amount: ${m.initialPaymentAmountNet}, Gross: ${m.monthlyRateGross}`);
            }
        }
    }
}
main().catch(console.error).finally(() => prisma.$disconnect());
