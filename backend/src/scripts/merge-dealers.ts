import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function mergeDealers(sourceDealerId: string, targetDealerId: string) {
    try {
        console.log(`Zaczynam łączenie dealera ${sourceDealerId} do ${targetDealerId}...`);

        const sourceDealer = await prisma.dealer.findUnique({ where: { id: sourceDealerId } });
        const targetDealer = await prisma.dealer.findUnique({ where: { id: targetDealerId } });

        if (!sourceDealer || !targetDealer) {
            console.error('Nie znaleziono jednego z dealerów w bazie.');
            process.exit(1);
        }

        console.log(`Przenoszenie ofert od: "${sourceDealer.name}" do: "${targetDealer.name}"`);

        // Zaktualizuj Listings
        const updatedListings = await prisma.listing.updateMany({
            where: { dealerId: sourceDealerId },
            data: { dealerId: targetDealerId }
        });
        console.log(`Przeniesiono ${updatedListings.count} pojazdów (Listings).`);

        // Zaktualizuj RentalVehicles
        const updatedRentals = await prisma.rentalVehicle.updateMany({
            where: { dealerId: sourceDealerId },
            data: { dealerId: targetDealerId }
        });
        console.log(`Przeniesiono ${updatedRentals.count} pojazdów z wynajmu.`);

        // Usuń duplikat
        await prisma.dealer.delete({ where: { id: sourceDealerId } });
        console.log(`Zduplikowany dealer (${sourceDealerId}) został pomyślnie usunięty.`);

        console.log('Gotowe!');
    } catch (err) {
        console.error('Błąd podczas łączenia dealerów:', err);
    } finally {
        await prisma.$disconnect();
    }
}

const args = process.argv.slice(2);
if (args.length !== 2) {
    console.log('Użycie: npx ts-node merge-dealers.ts <ID_ZDUPLIKOWANEGO_DEALERA> <ID_DOCELOWEGO_DEALERA>');
    process.exit(1);
}

mergeDealers(args[0], args[1]);
