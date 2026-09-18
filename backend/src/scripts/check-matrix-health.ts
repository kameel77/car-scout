/**
 * Diagnostic & Gate Script: Check Matrix Health
 *
 * Verifies that all rental companies with active matrix entries have complete insurance pricing.
 * Flags companies where insuranceAddMode is INSURANCE_23 or INSURANCE_0 but insuranceNet is missing or zero.
 *
 * Usage:
 *   npx tsx src/scripts/check-matrix-health.ts
 *   npx tsx src/scripts/check-matrix-health.ts --fix-all-in          # Dry-run plan
 *   npx tsx src/scripts/check-matrix-health.ts --fix-all-in --apply  # Non-production DB only
 */

import { PrismaClient } from '@prisma/client';
import { isProductionHost } from '../services/environment.js';

const prisma = new PrismaClient();

const hasInsuranceService = (services: any): boolean => {
    if (!Array.isArray(services)) return false;
    return services.some((s: any) => {
        if (typeof s !== 'string') return false;
        const lower = s.trim().toLowerCase();
        return lower === 'insurance' || lower === 'ubezpieczenie';
    });
};

async function main() {
    const shouldFixAllIn = process.argv.includes('--fix-all-in');
    const hasApplyFlag = process.argv.includes('--apply') || process.argv.includes('--confirm');

    // Extract database host from DATABASE_URL
    const databaseUrl = process.env.DATABASE_URL || '';
    let dbHost = 'localhost';
    try {
        if (databaseUrl) {
            const parsed = new URL(databaseUrl);
            dbHost = parsed.hostname.toLowerCase();
        }
    } catch {
        const match = databaseUrl.match(/@([^:/]+)/);
        if (match) dbHost = match[1].toLowerCase();
    }

    const isLocal = dbHost === 'localhost' || dbHost === '127.0.0.1' || dbHost === '::1';
    const isNonProdDomain =
        dbHost.endsWith('.local') ||
        dbHost.endsWith('.test') ||
        dbHost.includes('dev') ||
        dbHost.includes('staging') ||
        dbHost.includes('sslip.io');
    const isProd = isProductionHost(dbHost);
    const isNodeEnvProd = process.env.NODE_ENV === 'production';
    const isRecognizedNonProduction = (isLocal || isNonProdDomain) && !isProd && !isNodeEnvProd;

    if (shouldFixAllIn && !isRecognizedNonProduction) {
        console.error('\n⛔ BLOKADA BEZPIECZEŃSTWA: Flaga --fix-all-in odmawia działania!');
        console.error(`   Host bazy danych '${dbHost}' nie został rozpoznany jako środowisko nieprodukcyjne.`);
        console.error(`   isProductionHost: ${isProd} | NODE_ENV: '${process.env.NODE_ENV || 'brak'}'`);
        console.error('   Modyfikacja konfiguracji firm na bazie produkcyjnej przez skrypt masowy jest zabroniona.');
        console.error('   Zmiany konfiguracji na produkcji należy dokonywać ręcznie w panelu administratora.\n');
        process.exit(1);
    }

    console.log('\n======================================================');
    console.log('   DIAGNOSTYKA MATRYC NAJMU: KONTROLA UBEZPIECZENIA   ');
    console.log('======================================================\n');

    const companies = await prisma.rentalCompany.findMany({
        include: {
            vehicleAssignments: {
                include: {
                    matrixEntries: {
                        select: { id: true, insuranceNet: true, contractMonths: true, annualMileageKm: true }
                    },
                    vehicle: {
                        select: { id: true, make: true, model: true }
                    }
                }
            }
        },
        orderBy: { name: 'asc' }
    });

    if (companies.length === 0) {
        console.log('Brak firm najmowych w bazie danych.\n');
        process.exit(0);
    }

    let defectiveCompaniesCount = 0;
    let totalEntriesAll = 0;
    let totalMissingAll = 0;

    const reports: Array<{
        id: string;
        name: string;
        mode: string;
        includedServices: string[];
        totalAssignments: number;
        totalEntries: number;
        missingCount: number;
        affectedVehiclesCount: number;
        isHealthy: boolean;
        canAutoFixAllIn: boolean;
    }> = [];

    for (const c of companies) {
        let totalEntries = 0;
        let missingCount = 0;
        const affectedVehicles = new Set<string>();

        for (const a of c.vehicleAssignments) {
            const mode = a.insuranceAddModeOverride || c.insuranceAddMode || 'INSURANCE_23';
            const isExternal = mode === 'INSURANCE_23' || mode === 'INSURANCE_0';

            for (const m of a.matrixEntries) {
                totalEntries++;
                if (isExternal && (!m.insuranceNet || m.insuranceNet <= 0)) {
                    missingCount++;
                    affectedVehicles.add(a.vehicleId);
                }
            }
        }

        totalEntriesAll += totalEntries;
        totalMissingAll += missingCount;

        const isHealthy = missingCount === 0;
        if (!isHealthy) defectiveCompaniesCount++;

        const canAutoFixAllIn = !isHealthy && hasInsuranceService(c.includedServices) && c.insuranceAddMode !== 'INSURANCE_INCLUDED';

        reports.push({
            id: c.id,
            name: c.name,
            mode: c.insuranceAddMode || 'INSURANCE_23',
            includedServices: c.includedServices,
            totalAssignments: c.vehicleAssignments.length,
            totalEntries,
            missingCount,
            affectedVehiclesCount: affectedVehicles.size,
            isHealthy,
            canAutoFixAllIn
        });
    }

    // Print summary table
    console.log('ID                           | FIRMA                     | TRYB               | WPISY | BRAKI | POJAZDY | STATUS');
    console.log('-----------------------------+---------------------------+--------------------+-------+-------+---------+----------');
    for (const r of reports) {
        const idCol = r.id.padEnd(28);
        const nameCol = r.name.slice(0, 25).padEnd(25);
        const modeCol = r.mode.padEnd(18);
        const entriesCol = String(r.totalEntries).padStart(5);
        const missingCol = String(r.missingCount).padStart(5);
        const vehCol = String(r.affectedVehiclesCount).padStart(7);
        const statusCol = r.isHealthy ? '  [OK]' : '  [DEFECT]';
        console.log(`${idCol} | ${nameCol} | ${modeCol} | ${entriesCol} | ${missingCol} | ${vehCol} |${statusCol}`);
    }
    console.log('-----------------------------+---------------------------+--------------------+-------+-------+---------+----------');
    console.log(`Łącznie firm: ${companies.length} | Pozycji w cennikach: ${totalEntriesAll} | Braków ubezpieczenia: ${totalMissingAll}\n`);

    if (defectiveCompaniesCount > 0) {
        console.log('⚠️  WYKRYTO NIESPÓJNOŚCI W MATRYCACH!\n');
        console.log('Skutki biznesowe na produkcji:');
        console.log('  1. Pojazdy z brakami ubezpieczenia wyświetlają „Wycena ubezpieczenia na zapytanie”.');
        console.log('  2. Pojazdy te wypadają z filtru budżetowego w wyszukiwarce publicznej (minRate = null).\n');

        for (const r of reports.filter(r => !r.isHealthy)) {
            console.log(`-> Firma: ${r.name} (id: ${r.id})`);
            console.log(`   Tryb ubezpieczenia: ${r.mode}`);
            console.log(`   Wliczone usługi: ${JSON.stringify(r.includedServices)}`);
            console.log(`   Dotknięte pozycje: ${r.missingCount} wpisów w ${r.affectedVehiclesCount} autach`);

            if (r.canAutoFixAllIn) {
                console.log('   Diagnoza: Firma ma ubezpieczenie zaznaczone w liście wliczonych usług, ale tryb ustawiony na zewnętrzny.');
                console.log('   Zalecane działanie: Zmiana trybu na All-In (INSURANCE_INCLUDED).');

                if (shouldFixAllIn) {
                    if (hasApplyFlag) {
                        console.log(`   [ZAPIS] Aktualizuję tryb firmy ${r.name} na INSURANCE_INCLUDED...`);
                        await prisma.rentalCompany.update({
                            where: { id: r.id },
                            data: { insuranceAddMode: 'INSURANCE_INCLUDED' }
                        });
                        console.log(`   [ZAPIS] Zaktualizowano pomyślnie!`);
                    } else {
                        console.log(`   [PLAN ZMIAN / DRY-RUN] Firma ${r.name} zostanie przestawiona na INSURANCE_INCLUDED.`);
                    }
                }
            } else {
                console.log('   Diagnoza: Stawki wymagają zewnętrznego ubezpieczenia, ale brak kwoty insuranceNet w matrycy.');
                console.log('   Zalecane działanie: Uzupełnij kolumnę ubezpieczenia w cenniku (reimport matrycy) lub zmień tryb.');
            }
            console.log('');
        }

        if (!shouldFixAllIn) {
            const hasAutoFixable = reports.some(r => r.canAutoFixAllIn);
            if (hasAutoFixable) {
                console.log('Wskazówka: Aby przejrzeć plan automatycznej naprawy firm mających ubezpieczenie na liście usług:');
                console.log('   npx tsx src/scripts/check-matrix-health.ts --fix-all-in\n');
            }
            process.exit(1);
        } else if (!hasApplyFlag) {
            console.log('⚠️  TRYB PLANOWANIA (DRY-RUN): Żadne zmiany w bazie danych NIE zostały zapisane.');
            console.log('   Aby faktycznie zapisać zmiany w bazie nieprodukcyjnej, dodaj flagę --apply:');
            console.log('   npx tsx src/scripts/check-matrix-health.ts --fix-all-in --apply\n');
            process.exit(0);
        } else {
            console.log('Naprawa zakończona. Uruchom skrypt ponownie bez flagi, aby zweryfikować stan końcowy.\n');
            process.exit(0);
        }
    } else {
        console.log('✅ Wszystkie matryce są zdrowe. Brak cichych wyłączeń ofert najmu!\n');
        process.exit(0);
    }
}

main()
    .catch((err) => {
        console.error('Błąd wykonania skryptu:', err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
