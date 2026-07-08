import { PrismaClient } from '@prisma/client';
import { normalizeBrand } from '../services/brand-normalization.service.js';

const prisma = new PrismaClient();

async function migrate() {
    console.log('Starting brand normalization migration...');

    // 1. Listings
    const listings = await prisma.listing.findMany({
        select: { id: true, make: true }
    });
    console.log(`Checking ${listings.length} listings...`);
    let listingUpdates = 0;
    for (const l of listings) {
        const normalized = normalizeBrand(l.make);
        if (normalized !== l.make) {
            await prisma.listing.update({
                where: { id: l.id },
                data: { make: normalized }
            });
            listingUpdates++;
        }
    }
    console.log(`Updated ${listingUpdates} listings.`);

    // 2. VehicleSpecifications
    const specs = await prisma.vehicleSpecification.findMany({
        select: { id: true, brand: true }
    });
    console.log(`Checking ${specs.length} specifications...`);
    let specUpdates = 0;
    for (const s of specs) {
        const normalized = normalizeBrand(s.brand);
        if (normalized !== s.brand) {
            await prisma.vehicleSpecification.update({
                where: { id: s.id },
                data: { brand: normalized }
            });
            specUpdates++;
        }
    }
    console.log(`Updated ${specUpdates} specifications.`);

    // 3. RentalVehicles
    const rentals = await prisma.rentalVehicle.findMany({
        select: { id: true, make: true }
    });
    console.log(`Checking ${rentals.length} rental vehicles...`);
    let rentalUpdates = 0;
    for (const r of rentals) {
        const normalized = normalizeBrand(r.make);
        if (normalized !== r.make) {
            await prisma.rentalVehicle.update({
                where: { id: r.id },
                data: { make: normalized }
            });
            rentalUpdates++;
        }
    }
    console.log(`Updated ${rentalUpdates} rental vehicles.`);

    console.log('Migration finished.');
}

migrate()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
