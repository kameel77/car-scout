const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const vehicles = await prisma.rentalVehicle.findMany({
        take: 5,
        include: {
            rentalAssignments: {
                include: {
                    matrixEntries: {
                        take: 5
                    }
                }
            }
        }
    });

    for (const v of vehicles) {
        console.log(`Vehicle ID: ${v.id}, Make: ${v.make}, Model: ${v.model}`);
        for (const a of v.rentalAssignments) {
            console.log(`  Assignment ID: ${a.id}`);
            for (const m of a.matrixEntries) {
                console.log(`    Entry: ${m.contractMonths} months, ${m.annualMileageKm} km, Pct: ${m.initialPaymentPct}, Amount: ${m.initialPaymentAmountNet}, GrossRate: ${m.monthlyRateGross}`);
            }
        }
    }
}
main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
