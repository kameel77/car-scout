import sharp from 'sharp';
import path from 'path';

export interface OptimizeImageOptions {
    targetDir: string;
    baseFilename: string; // bez rozszerzenia, np. "12345-hash"
    largeWidth?: number; // domyślnie 1920
    cardWidth?: number; // domyślnie 1400
    mediumWidth?: number; // domyślnie 900
    thumbWidth?: number; // domyślnie 600
    quality?: number; // domyślnie 75
    generateThumbnail?: boolean; // domyślnie true
    generateAvif?: boolean; // domyślnie false — patrz komentarz przy wartości domyślnej
    generateLqip?: boolean; // domyślnie true
}

export interface OptimizeImageResult {
    largeFilename: string; // np. "12345-hash.webp"
    cardFilename?: string; // np. "12345-hash-lg.webp"
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
        // Wariant karty nie może być szerszy od mastera. Część call sites
        // świadomie obniża largeWidth (feature-tiles: 900) — bez tego ograniczenia
        // -lg byłby tam NAJWIĘKSZYM plikiem zestawu i przeglądarka wybierałaby
        // właśnie jego, odwracając cel zmiany.
        cardWidth: rawCardWidth = 1400,
        mediumWidth = 900,
        thumbWidth = 600,
        quality = 75,
        generateThumbnail = true,
        // Domyślnie WYŁĄCZONE. Warianty .avif nie są dziś serwowane: front nie emituje
        // <source type="image/avif"> (OptimizedImage.test.tsx wprost tego pilnuje), a żaden
        // konsument nie czyta pól avif*Filename z wyniku. Kodowanie AVIF to ~73% czasu CPU
        // całej optymalizacji (pomiar: master 1600x1200 → WebP x4 322 ms, AVIF x3 866 ms),
        // czyli kilkadziesiąt sekund oczekiwania przy zapisie pojazdu z kilkoma zdjęciami.
        // Włączyć razem z realnym serwowaniem AVIF — wtedy trzeba też dorobić -lg.avif
        // i zejść z quality (przy q60 przewaga nad serwowanym WebP q75 jest znikoma).
        generateAvif = false,
        generateLqip = true,
    } = options;

    const cardWidth = Math.min(rawCardWidth, largeWidth);

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
        result.cardFilename = await webpPipe(cardWidth, '-lg');
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
            // -lg.avif celowo pominięty: AVIF nie jest dziś w ogóle serwowany
            // (front nie emituje <source type="image/avif">), a kodowanie AVIF
            // 1400 px to najwolniejszy etap uploadu. Dodać przy włączaniu AVIF.
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
