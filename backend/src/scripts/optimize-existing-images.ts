import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { optimizeAndSaveImage } from '../src/services/image-optimizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.resolve(__dirname, '../../uploads');

const prisma = new PrismaClient();

async function optimizeUrl(url: string | null): Promise<string | null> {
    if (!url) return null;
    if (!url.startsWith('/uploads/')) return url;
    if (url.endsWith('.webp')) return url; // Already optimized
    if (url.endsWith('.svg')) return url; // Skip svg

    const relativePath = url.replace('/uploads/', '');
    const fullPath = path.join(uploadsRoot, relativePath);

    try {
        await fs.access(fullPath);
    } catch {
        console.warn(`[WARN] File not found on disk, skipping: ${fullPath}`);
        return url; // Cannot optimize if not on disk, return original
    }

    try {
        const buffer = await fs.readFile(fullPath);
        const ext = path.extname(fullPath);
        const baseFilename = path.basename(fullPath, ext);
        const targetDir = path.dirname(fullPath);

        const { largeFilename } = await optimizeAndSaveImage(buffer, {
            targetDir,
            baseFilename,
            generateThumbnail: true
        });

        await fs.unlink(fullPath).catch(() => {});
        return url.replace(path.basename(fullPath), largeFilename);
    } catch (err: any) {
        console.error(`[ERROR] Failed to optimize ${url}:`, err.message);
        return url;
    }
}

async function processListings() {
    console.log('--- Processing Listings ---');
    const listings = await prisma.listing.findMany({
        select: { id: true, primaryImageUrl: true, imageUrls: true }
    });

    for (let i = 0; i < listings.length; i++) {
        const listing = listings[i];
        let changed = false;

        const newPrimary = await optimizeUrl(listing.primaryImageUrl);
        if (newPrimary !== listing.primaryImageUrl) changed = true;

        const newUrls: string[] = [];
        for (const url of listing.imageUrls) {
            const newUrl = await optimizeUrl(url);
            newUrls.push(newUrl || url);
            if (newUrl !== url) changed = true;
        }

        if (changed) {
            await prisma.listing.update({
                where: { id: listing.id },
                data: {
                    primaryImageUrl: newPrimary,
                    imageUrls: newUrls
                }
            });
            console.log(`Updated listing ${listing.id}`);
        }
    }
}

async function processRentals() {
    console.log('--- Processing Rentals ---');
    const rentals = await prisma.rentalVehicle.findMany({
        select: { id: true, primaryImageUrl: true, imageUrls: true }
    });

    for (let i = 0; i < rentals.length; i++) {
        const rental = rentals[i];
        let changed = false;

        const newPrimary = await optimizeUrl(rental.primaryImageUrl);
        if (newPrimary !== rental.primaryImageUrl) changed = true;

        const newUrls: string[] = [];
        for (const url of rental.imageUrls) {
            const newUrl = await optimizeUrl(url);
            newUrls.push(newUrl || url);
            if (newUrl !== url) changed = true;
        }

        if (changed) {
            await prisma.rentalVehicle.update({
                where: { id: rental.id },
                data: {
                    primaryImageUrl: newPrimary,
                    imageUrls: newUrls
                }
            });
            console.log(`Updated rental ${rental.id}`);
        }
    }
}

async function processFeatureTiles() {
    console.log('--- Processing Feature Tiles ---');
    const tiles = await prisma.featureTile.findMany();

    for (const tile of tiles) {
        const newUrl = await optimizeUrl(tile.imageUrl);
        if (newUrl !== tile.imageUrl) {
            await prisma.featureTile.update({
                where: { id: tile.id },
                data: { imageUrl: newUrl }
            });
            console.log(`Updated tile ${tile.id}`);
        }
    }
}

async function processSettings() {
    // Settings has headerLogoUrl, footerLogoUrl etc which are base64, so optimizeUrl won't touch them 
    // because they don't start with /uploads/. 
    // Wait, some older ones might. We skip settings for now or just log.
    console.log('--- Skiping Settings (usually base64) ---');
}

async function run() {
    console.log('Starting image migration...');
    try {
        await processListings();
        await processRentals();
        await processFeatureTiles();
        await processSettings();
        console.log('Done.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await prisma.$disconnect();
    }
}

run();
