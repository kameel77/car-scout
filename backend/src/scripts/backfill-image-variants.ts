import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

// Dogenerowuje brakujące warianty -md.webp (1200px) i -thumb.webp (600px)
// dla istniejących plików .webp w uploads/. Idempotentny — pomija pliki,
// dla których warianty już istnieją. Bez dostępu do DB (URL-e się nie zmieniają).
// Uruchomienie: npx tsx src/scripts/backfill-image-variants.ts

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.resolve(__dirname, '../../uploads');

const MEDIUM_WIDTH = 1200;
const THUMB_WIDTH = 600;
const QUALITY = 80;

let generated = 0;
let skipped = 0;
let failed = 0;

async function generateVariant(sourcePath: string, targetPath: string, width: number) {
    try {
        await fs.access(targetPath);
        skipped++;
        return;
    } catch {
        // wariant nie istnieje — generujemy
    }

    const image = sharp(sourcePath);
    const metadata = await image.metadata();
    if (metadata.width && metadata.width > width) {
        image.resize(width, null, { withoutEnlargement: true });
    }
    await image.webp({ quality: QUALITY }).toFile(targetPath);
    generated++;
    console.log(`[OK] ${path.relative(uploadsRoot, targetPath)}`);
}

async function walk(dir: string) {
    let entries;
    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
        return;
    }

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            await walk(fullPath);
            continue;
        }
        if (!entry.name.endsWith('.webp')) continue;
        if (entry.name.endsWith('-md.webp') || entry.name.endsWith('-thumb.webp')) continue;

        const base = fullPath.slice(0, -'.webp'.length);
        try {
            await generateVariant(fullPath, `${base}-md.webp`, MEDIUM_WIDTH);
            await generateVariant(fullPath, `${base}-thumb.webp`, THUMB_WIDTH);
        } catch (err: any) {
            failed++;
            console.error(`[ERROR] ${path.relative(uploadsRoot, fullPath)}: ${err.message}`);
        }
    }
}

async function run() {
    console.log(`Backfilling image variants in ${uploadsRoot}...`);
    await walk(uploadsRoot);
    console.log(`Done. Generated: ${generated}, skipped (already exist): ${skipped}, failed: ${failed}`);
}

run();
