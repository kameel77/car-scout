import { PrismaClient } from '@prisma/client';

// ── HARD GUARD: Must strictly run on localhost/127.0.0.1 ──────────
const databaseUrl = process.env.DATABASE_URL || '';
let isLocalhost = false;
try {
    const parsedUrl = new URL(databaseUrl);
    isLocalhost = parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1';
} catch {
    isLocalhost = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
}

if (!isLocalhost) {
    console.error('⛔ BŁĄD BEZPIECZEŃSTWA: Skrypt seed-rental-ayvens-dev może być uruchamiany WYŁĄCZNIE na localhost/127.0.0.1!');
    console.error(`Otrzymany DATABASE_URL wskazuje na zewnętrzne środowisko: ${databaseUrl.replace(/:[^:@]+@/, ':***@')}`);
    process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Uruchamianie seeda deweloperskiego Ayvens (tylko localhost)...');

    // 1. Firma Ayvens (isActive: false)
    const company = await prisma.rentalCompany.upsert({
        where: { slug: 'ayvens' },
        update: {
            name: 'Ayvens',
            isActive: false,
        },
        create: {
            name: 'Ayvens',
            slug: 'ayvens',
            isActive: false,
            includedServices: ['ubezpieczenie', 'serwis', 'opony'],
        },
    });
    console.log(`✅ Firma Ayvens: ${company.id} (isActive: ${company.isActive})`);

    // 2. Pojazd demo: Volkswagen Polo (spec 294) z isPublished: false oraz isActive: false
    const vehicle = await prisma.rentalVehicle.upsert({
        where: { slug: 'dev-ayvens-volkswagen-polo-spec-294' },
        update: {
            isPublished: false,
            isActive: false,
        },
        create: {
            slug: 'dev-ayvens-volkswagen-polo-spec-294',
            make: 'VOLKSWAGEN',
            model: 'Polo',
            version: '1.0 Tsi 95km Dsg 7 Life Plus',
            bodyType: 'hatchback',
            fuelType: 'benzyna',
            transmission: 'automatic',
            productionYear: 2026,
            color: 'Niebieski Crystal',
            isPublished: false,
            isActive: false,
            ownerRentalCompanyId: company.id,
        },
    });
    console.log(`✅ Pojazd demo: ${vehicle.id} (isPublished: ${vehicle.isPublished}, isActive: ${vehicle.isActive})`);

    // 3. Assignment specyfikacji 294 do firmy Ayvens
    const assignment = await prisma.vehicleRentalAssignment.upsert({
        where: {
            vehicleId_rentalCompanyId: {
                vehicleId: vehicle.id,
                rentalCompanyId: company.id,
            },
        },
        update: {
            externalVehicleId: '294',
            calculationId: '3047166',
            isActive: false,
        },
        create: {
            vehicleId: vehicle.id,
            rentalCompanyId: company.id,
            externalVehicleId: '294',
            calculationId: '3047166',
            isActive: false,
        },
    });
    console.log(`✅ Assignment: ${assignment.id} (externalVehicleId: ${assignment.externalVehicleId})`);

    // 4. Pozycje matrycy dla wariantów (base, 6, 8)
    const variants = [
        { variant: 'base', rate: 949 },
        { variant: '6', rate: 1005.94 },
        { variant: '8', rate: 1024.92 },
    ];

    for (const v of variants) {
        await prisma.rentalMatrixEntry.upsert({
            where: {
                assignmentId_annualMileageKm_contractMonths_initialPaymentPct_initialPaymentAmountNet_initialPaymentAmountGross_offerType_priceVariant: {
                    assignmentId: assignment.id,
                    annualMileageKm: 10000,
                    contractMonths: 36,
                    initialPaymentPct: 0,
                    initialPaymentAmountNet: 0,
                    initialPaymentAmountGross: 0,
                    offerType: 'all',
                    priceVariant: v.variant,
                },
            },
            update: {
                monthlyRateNet: v.rate,
                monthlyRateGross: Math.round(v.rate * 1.23 * 100) / 100,
                insuranceExcess500: 61,
                insuranceNoLimit: 180,
                tiresNoLimit: 120,
                overMileageCost: 0.38,
                overMileageTiresNoLimit: 0.53,
            },
            create: {
                assignmentId: assignment.id,
                annualMileageKm: 10000,
                contractMonths: 36,
                initialPaymentPct: 0,
                initialPaymentAmountNet: 0,
                initialPaymentAmountGross: 0,
                offerType: 'all',
                monthlyRateNet: v.rate,
                monthlyRateGross: Math.round(v.rate * 1.23 * 100) / 100,
                insuranceExcess500: 61,
                insuranceNoLimit: 180,
                tiresNoLimit: 120,
                overMileageCost: 0.38,
                overMileageTiresNoLimit: 0.53,
                priceVariant: v.variant,
            },
        });
    }
    console.log('✅ Matryca wyceny: zapisano 3 warianty cenowe (base, 6, 8)');

    // 5. Jednostka stoku dla testów ręcznych API: VW Polo nr 3460697
    const stockUnit = await prisma.rentalStockUnit.upsert({
        where: {
            rentalCompanyId_stockNo: {
                rentalCompanyId: company.id,
                stockNo: '3460697',
            },
        },
        update: {
            specNoRaw: '294',
            specNo: '294',
            specNoNote: null,
            make: 'VOLKSWAGEN',
            model: 'Polo',
            modelDescription: 'Polo 1.0 Tsi 95km Dsg 7 Life Plus',
            bodyType: 'hatchback',
            color: 'Niebieski Crystal',
            fuelType: 'benzyna',
            dealerName: 'GRUPA CICHY-ZASADA SP. Z O.O. SP.J.',
            vehicleDeliveryDate: new Date('2027-02-01'),
            isActive: true,
        },
        create: {
            rentalCompanyId: company.id,
            stockNo: '3460697',
            specNoRaw: '294',
            specNo: '294',
            specNoNote: null,
            make: 'VOLKSWAGEN',
            model: 'Polo',
            modelDescription: 'Polo 1.0 Tsi 95km Dsg 7 Life Plus',
            bodyType: 'hatchback',
            color: 'Niebieski Crystal',
            fuelType: 'benzyna',
            dealerName: 'GRUPA CICHY-ZASADA SP. Z O.O. SP.J.',
            vehicleDeliveryDate: new Date('2027-02-01'),
            isActive: true,
        },
    });
    console.log(`✅ Jednostka stoku: ${stockUnit.stockNo} (specNo: ${stockUnit.specNo})`);

    console.log('🎉 Seed deweloperski zakończony sukcesem.');
}

main()
    .catch((e) => {
        console.error('Błąd podczas seedowania:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
