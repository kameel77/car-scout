import sharp from 'sharp';
import path from 'path';

export interface OptimizeImageOptions {
    targetDir: string;
    baseFilename: string; // bez rozszerzenia, np. "12345-hash"
    largeWidth?: number; // domyślnie 1920
    mediumWidth?: number; // domyślnie 900
    thumbWidth?: number; // domyślnie 600
    quality?: number; // domyślnie 80
    generateThumbnail?: boolean; // domyślnie true
    generateAvif?: boolean; // domyślnie true
    generateLqip?: boolean; // domyślnie true
}

export interface OptimizeImageResult {
    largeFilename: string; // np. "12345-hash.webp"
    mediumFilename?: string; // np. "12345-hash-md.webp"
    thumbFilename?: string; // np. "12345-hash-thumb.webp"
    avifLargeFilename?: string;
    avifMediumFilename?: string;
    avifThumbFilename?: string;
    lqip?: string; // base64 blurhash/placeholder
}

/**
 * Optymalizuje obraz w locie:
 * - Konwertuje do WebP i AVIF
 * - Skaluje do wariantów szerokości
 * - Generuje LQIP (Low Quality Image Placeholder)
 */
export async function optimizeAndSaveImage(
    inputBuffer: Buffer,
    options: OptimizeImageOptions
): Promise<OptimizeImageResult> {
    const {
        targetDir,
        baseFilename,
        largeWidth = 1920,
        mediumWidth = 900,
        thumbWidth = 600,
        quality = 80,
        generateThumbnail = true,
        generateAvif = true,
        generateLqip = true,
    } = options;

    const image = sharp(inputBuffer).rotate(); // auto-rotate based on EXIF
    const metadata = await image.metadata();

    const result: OptimizeImageResult = {
        largeFilename: `${baseFilename}.webp`,
    };

    // --- WebP Pipeline ---
    const webpPipe = async (width: number, suffix: string = '') => {
        const filename = `${baseFilename}${suffix}.webp`;
        const p = path.join(targetDir, filename);
        let instance = image.clone();
        if (metadata.width && metadata.width > width) {
            instance = instance.resize(width, null, { withoutEnlargement: true });
        }
        await instance.webp({ quality }).toFile(p);
        return filename;
    };

    await webpPipe(largeWidth);
    if (generateThumbnail) {
        result.mediumFilename = await webpPipe(mediumWidth, '-md');
        result.thumbFilename = await webpPipe(thumbWidth, '-thumb');
    }

    // --- AVIF Pipeline ---
    if (generateAvif) {
        const avifPipe = async (width: number, suffix: string = '') => {
            const filename = `${baseFilename}${suffix}.avif`;
            const p = path.join(targetDir, filename);
            let instance = image.clone();
            if (metadata.width && metadata.width > width) {
                instance = instance.resize(width, null, { withoutEnlargement: true });
            }
            // AVIF quality 60-70 is usually comparable to WebP 80 but smaller
            await instance.avif({ quality: Math.max(quality - 15, 50) }).toFile(p);
            return filename;
        };

        result.avifLargeFilename = await avifPipe(largeWidth);
        if (generateThumbnail) {
            result.avifMediumFilename = await avifPipe(mediumWidth, '-md');
            result.avifThumbFilename = await avifPipe(thumbWidth, '-thumb');
        }
    }

    // --- LQIP Pipeline ---
    if (generateLqip) {
        try {
            const lqipBuffer = await image
                .clone()
                .resize(20, null, { fit: 'inside' })
                .webp({ quality: 20 })
                .toBuffer();
            result.lqip = `data:image/webp;base64,${lqipBuffer.toString('base64')}`;
        } catch (err) {
            console.error('[ImageOptimizer] Failed to generate LQIP:', err);
        }
    }

    return result;
}
