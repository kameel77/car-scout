import sharp from 'sharp';
import path from 'path';

export interface OptimizeImageOptions {
    targetDir: string;
    baseFilename: string; // bez rozszerzenia, np. "12345-hash"
    largeWidth?: number; // domyślnie 1920
    thumbWidth?: number; // domyślnie 600
    quality?: number; // domyślnie 80
    generateThumbnail?: boolean; // domyślnie true
}

export interface OptimizeImageResult {
    largeFilename: string; // np. "12345-hash.webp"
    thumbFilename?: string; // np. "12345-hash-thumb.webp" (jeśli wygenerowano)
}

/**
 * Optymalizuje obraz w locie:
 * - Konwertuje do WebP
 * - Skaluje do max szerokości (główne zdjęcie)
 * - Skaluje do małej szerokości (miniatura)
 * - Zapisuje pliki w docelowym folderze.
 */
export async function optimizeAndSaveImage(
    inputBuffer: Buffer,
    options: OptimizeImageOptions
): Promise<OptimizeImageResult> {
    const {
        targetDir,
        baseFilename,
        largeWidth = 1920,
        thumbWidth = 600,
        quality = 80,
        generateThumbnail = true,
    } = options;

    const largeFilename = `${baseFilename}.webp`;
    const largePath = path.join(targetDir, largeFilename);

    const image = sharp(inputBuffer);
    const metadata = await image.metadata();

    // Główny obraz
    const largeProcessor = image.clone();
    if (metadata.width && metadata.width > largeWidth) {
        largeProcessor.resize(largeWidth, null, { withoutEnlargement: true });
    }
    await largeProcessor
        .webp({ quality })
        .toFile(largePath);

    const result: OptimizeImageResult = { largeFilename };

    // Miniatura
    if (generateThumbnail) {
        const thumbFilename = `${baseFilename}-thumb.webp`;
        const thumbPath = path.join(targetDir, thumbFilename);

        const thumbProcessor = image.clone();
        if (metadata.width && metadata.width > thumbWidth) {
            thumbProcessor.resize(thumbWidth, null, { withoutEnlargement: true });
        }
        await thumbProcessor
            .webp({ quality })
            .toFile(thumbPath);
            
        result.thumbFilename = thumbFilename;
    }

    return result;
}
