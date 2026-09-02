import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

/**
 * Regeneruje pełną drabinkę wariantów (-thumb 600 / -md 900 / -lg 1400) z plików
 * master, zgodnie z image-optimizer.ts.
 *
 * Powód: karta ofertowa serwuje srcset "600w, 900w, 1400w" (bez mastera). Bez
 * wariantu -lg przeglądarka dostaje 404 i degraduje do pełnego pliku. Skrypt
 * dogrywa brakujące -lg dla zdjęć wgranych przed tą zmianą.
 *
 * Uruchomienie:
 *   lokalnie (z katalogu backend/):  npx tsx src/scripts/backfill-image-ladder.ts
 *   w kontenerze:                    node dist/scripts/backfill-image-ladder.js
 *
 * Domyślnie dopisuje WYŁĄCZNIE brakujące warianty. Istniejące -thumb/-md bywają
 * wygenerowane celowo innymi parametrami (specifications.ts: q85/thumb 400,
 * feature-tiles.ts: q72/600/400) i nadpisanie ich defaultami pogorszyłoby te
 * obrazy. Przekodowanie istniejących włącza flaga --reencode — używać tylko na
 * katalogach zdjęć aut, np.:
 *   node dist/scripts/backfill-image-ladder.js --reencode uploads/listing-images uploads/csflow-images
 *
 * Opcjonalne argumenty: lista katalogów do przeskanowania (domyślnie całe uploads/).
 * Master NIE jest przekodowywany — tylko warianty pochodne.
 */

const QUALITY = 75;
const VARIANTS: { suffix: string; width: number }[] = [
    { suffix: '-thumb', width: 600 },
    { suffix: '-md', width: 900 },
    { suffix: '-lg', width: 1400 },
];

const VARIANT_SUFFIXES = VARIANTS.map(v => v.suffix);

interface BackfillStats {
    scanned: number;
    created: number;
    reencoded: number;
    skipped: number;
    bytesWritten: number;
    errors: number;
}

function isMasterWebp(name: string): boolean {
    if (!name.endsWith('.webp')) return false;
    const base = name.slice(0, -'.webp'.length);
    return !VARIANT_SUFFIXES.some(s => base.endsWith(s));
}

async function processDirectory(dir: string, stats: BackfillStats, reencode: boolean): Promise<void> {
    if (!fs.existsSync(dir)) return;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            await processDirectory(fullPath, stats, reencode);
            continue;
        }

        if (!entry.isFile() || !isMasterWebp(entry.name)) continue;

        stats.scanned++;
        const baseName = entry.name.slice(0, -'.webp'.length);

        try {
            const masterBuffer = fs.readFileSync(fullPath);
            const masterMeta = await sharp(masterBuffer).metadata();

            for (const { suffix, width } of VARIANTS) {
                const variantPath = path.join(dir, `${baseName}${suffix}.webp`);
                const exists = fs.existsSync(variantPath);

                if (exists && !reencode) {
                    stats.skipped++;
                    continue;
                }

                // withoutEnlargement: gdy master jest węższy niż wariant, plik
                // powstaje w rozmiarze mastera (deskryptor w srcset jest wtedy
                // górnym oszacowaniem — przeglądarka i tak nie pobierze więcej).
                const buffer = await sharp(masterBuffer)
                    .rotate()
                    .resize({ width, withoutEnlargement: true })
                    .webp({ quality: QUALITY, effort: 4 })
                    .toBuffer();

                fs.writeFileSync(variantPath, buffer);
                stats.bytesWritten += buffer.length;
                if (exists) stats.reencoded++; else stats.created++;
            }

            if (!masterMeta.width) {
                console.warn(`[Backfill] Brak metadanych szerokości: ${fullPath}`);
            }
        } catch (err: any) {
            console.error(`[Backfill] Błąd przetwarzania ${fullPath}:`, err.message);
            stats.errors++;
        }
    }
}

async function main() {
    const argv = process.argv.slice(2);
    const reencode = argv.includes('--reencode');
    const unknownFlags = argv.filter(a => a.startsWith('--') && a !== '--reencode');
    if (unknownFlags.length) {
        console.error(`[Backfill] Nieznane flagi: ${unknownFlags.join(', ')} (jedyna obsługiwana to --reencode)`);
        process.exit(1);
    }
    const targetDirs = argv.filter(a => !a.startsWith('--'));
    // Cały katalog uploads rekurencyjnie — warianty są potrzebne wszędzie tam,
    // gdzie front renderuje OptimizedImage (oferty, specyfikacje, csflow,
    // banery hero, kafelki, widgety), a lista podkatalogów szybko się dezaktualizuje.
    const defaultDirs = [
        path.resolve(process.cwd(), 'uploads'),
        path.resolve(process.cwd(), 'backend/uploads'),
    ];

    const dirsToScan = targetDirs.length > 0
        ? targetDirs.map(d => path.resolve(process.cwd(), d))
        : defaultDirs.filter(d => fs.existsSync(d));

    if (dirsToScan.length === 0) {
        console.error(`[Backfill] Nie znaleziono żadnego katalogu do przeskanowania (cwd: ${process.cwd()}).`);
        console.error(`[Backfill] Sprawdzono: ${defaultDirs.join(', ')}`);
        process.exit(1);
    }

    console.log(`[Backfill] Katalogi do przeskanowania:`, dirsToScan);
    console.log(`[Backfill] Warianty: ${VARIANTS.map(v => `${v.suffix} ${v.width}px`).join(', ')} @ q${QUALITY}`);
    console.log(`[Backfill] Tryb: ${reencode ? 'dopisuje brakujące + PRZEKODOWUJE istniejące' : 'tylko brakujące warianty'}`);

    const stats: BackfillStats = { scanned: 0, created: 0, reencoded: 0, skipped: 0, bytesWritten: 0, errors: 0 };

    for (const dir of dirsToScan) {
        console.log(`[Backfill] Skanuję ${dir}...`);
        await processDirectory(dir, stats, reencode);
    }

    console.log(`\n--- Podsumowanie ---`);
    console.log(`Plików master przeskanowanych: ${stats.scanned}`);
    console.log(`Wariantów utworzonych:         ${stats.created}`);
    console.log(`Wariantów przekodowanych:      ${stats.reencoded}`);
    console.log(`Wariantów pominiętych:         ${stats.skipped}`);
    console.log(`Zapisano łącznie:              ${(stats.bytesWritten / 1024 / 1024).toFixed(1)} MiB`);
    console.log(`Błędy: ${stats.errors}`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
