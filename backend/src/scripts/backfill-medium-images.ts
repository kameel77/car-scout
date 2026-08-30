import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

interface BackfillStats {
    scanned: number;
    reEncoded: number;
    bytesBefore: number;
    bytesAfter: number;
    errors: number;
}

const QUALITY = 80;
const TARGET_WIDTH = 900;

async function processDirectory(dir: string, stats: BackfillStats): Promise<void> {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            await processDirectory(fullPath, stats);
            continue;
        }

        // We target master .webp files (not -thumb.webp, not -md.webp)
        if (entry.isFile() && entry.name.endsWith('.webp') && !entry.name.endsWith('-md.webp') && !entry.name.endsWith('-thumb.webp')) {
            stats.scanned++;
            const baseName = entry.name.slice(0, -'.webp'.length);
            const mdFileName = `${baseName}-md.webp`;
            const mdFilePath = path.join(dir, mdFileName);

            let oldSize = 0;
            if (fs.existsSync(mdFilePath)) {
                oldSize = fs.statSync(mdFilePath).size;
                stats.bytesBefore += oldSize;
            }

            try {
                // Read original master image
                const masterBuffer = fs.readFileSync(fullPath);
                const masterMeta = await sharp(masterBuffer).metadata();

                if (masterMeta.width && masterMeta.width > TARGET_WIDTH) {
                    const newMdBuffer = await sharp(masterBuffer)
                        .rotate()
                        .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
                        .webp({ quality: QUALITY, effort: 4 })
                        .toBuffer();

                    fs.writeFileSync(mdFilePath, newMdBuffer);
                    stats.bytesAfter += newMdBuffer.length;
                    stats.reEncoded++;
                } else if (fs.existsSync(mdFilePath)) {
                    // Master is <= 900px wide, keep or clone master
                    stats.bytesAfter += oldSize;
                }
            } catch (err: any) {
                console.error(`[Backfill] Error processing ${fullPath}:`, err.message);
                stats.errors++;
            }
        }
    }
}

async function main() {
    const targetDirs = process.argv.slice(2);
    const defaultDirs = [
        path.resolve(process.cwd(), 'uploads/listing-images'),
        path.resolve(process.cwd(), 'uploads/specification-images'),
        path.resolve(process.cwd(), 'uploads/csflow-images'),
        path.resolve(process.cwd(), 'backend/uploads/listing-images'),
        path.resolve(process.cwd(), 'backend/uploads/specification-images'),
        path.resolve(process.cwd(), 'backend/uploads/csflow-images'),
    ];

    const dirsToScan = targetDirs.length > 0
        ? targetDirs.map(d => path.resolve(process.cwd(), d))
        : defaultDirs.filter(d => fs.existsSync(d));

    console.log(`[Backfill] Target directories to scan:`, dirsToScan);

    const stats: BackfillStats = {
        scanned: 0,
        reEncoded: 0,
        bytesBefore: 0,
        bytesAfter: 0,
        errors: 0,
    };

    for (const dir of dirsToScan) {
        console.log(`[Backfill] Scanning ${dir}...`);
        await processDirectory(dir, stats);
    }

    const savedBytes = stats.bytesBefore - stats.bytesAfter;
    const pctSaved = stats.bytesBefore > 0 ? ((savedBytes / stats.bytesBefore) * 100).toFixed(1) : '0';

    console.log(`\n--- Backfill Summary ---`);
    console.log(`Master images scanned: ${stats.scanned}`);
    console.log(`-md.webp re-encoded to ${TARGET_WIDTH}px: ${stats.reEncoded}`);
    console.log(`Total bytes before: ${(stats.bytesBefore / 1024).toFixed(1)} KiB (${stats.bytesBefore} bytes)`);
    console.log(`Total bytes after:  ${(stats.bytesAfter / 1024).toFixed(1)} KiB (${stats.bytesAfter} bytes)`);
    console.log(`Savings: ${(savedBytes / 1024).toFixed(1)} KiB (${pctSaved}%)`);
    console.log(`Errors: ${stats.errors}`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
