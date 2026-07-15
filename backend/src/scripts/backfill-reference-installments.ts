import { PrismaClient } from '@prisma/client';
import { recomputeAll } from '../services/financing-calc.service.js';

// Przelicza i zapisuje referenceCreditInstallment/referenceLeasingInstallment
// dla wszystkich aktywnych, nie-zarchiwizowanych ofert. To moment "zapłonu" rat
// na kafelkach — przed uruchomieniem tego skryptu (i przy braku produktów)
// wartości są null, więc kafelki ukrywają blok rat.
// Uruchomienie (kontener): node dist/scripts/backfill-reference-installments.js
// Uruchomienie (lokalnie): npx tsx src/scripts/backfill-reference-installments.ts

const prisma = new PrismaClient();

async function run() {
    console.log('Backfilling reference credit/leasing installments...');
    const processed = await recomputeAll({ prisma, log: console });
    console.log(`Done. Processed ${processed} listing(s).`);
}

run()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
