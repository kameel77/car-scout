import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Katalog uploads/ względem katalogu dist/services/ → ../../uploads
const uploadsRoot = path.resolve(__dirname, '../../uploads');
const CSFLOW_IMAGES_DIR = path.join(uploadsRoot, 'csflow-images');

const DOWNLOAD_TIMEOUT_MS = 10_000;
const MAX_CONCURRENT = 3;

/**
 * Pobiera zdjęcia z zewnętrznych URL-i CSFlow i zapisuje je lokalnie.
 * Idempotentna: jeśli plik już istnieje na dysku, pomija pobieranie.
 *
 * @param listingId - wewnętrzny listingId z bazy (np. "csflow-35203")
 * @param externalUrls - tablica URL-i zdjęć ze źródłowego API
 * @returns tablica lokalnych ścieżek (/uploads/csflow-images/{listingId}/{index}.jpg)
 *          Dla plików których nie udało się pobrać zachowany zostaje oryginalny URL.
 */
export async function downloadAndCacheImages(
    listingId: string,
    externalUrls: string[]
): Promise<string[]> {
    if (!externalUrls || externalUrls.length === 0) return [];

    // Sanitize listingId żeby go można było użyć jako nazwy katalogu
    const safeId = listingId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const targetDir = path.join(CSFLOW_IMAGES_DIR, safeId);

    await fs.mkdir(targetDir, { recursive: true });

    const results: string[] = new Array(externalUrls.length);

    // Prosta kolejka batch — max MAX_CONCURRENT równoległych pobierań
    for (let i = 0; i < externalUrls.length; i += MAX_CONCURRENT) {
        const batch = externalUrls.slice(i, i + MAX_CONCURRENT);
        await Promise.all(
            batch.map(async (url, batchIdx) => {
                const globalIdx = i + batchIdx;
                const localPath = `/uploads/csflow-images/${safeId}/${globalIdx}.jpg`;
                const filePath = path.join(targetDir, `${globalIdx}.jpg`);

                // Sprawdź czy plik już istnieje
                try {
                    await fs.access(filePath);
                    // Plik istnieje — pomiń pobieranie
                    results[globalIdx] = localPath;
                    return;
                } catch {
                    // Plik nie istnieje — pobierz
                }

                // Pobierz zdjęcie
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

                    const response = await fetch(url, {
                        signal: controller.signal as any,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (compatible; CarSalon/1.0)',
                            'Accept': 'image/*,*/*'
                        }
                    });

                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        console.warn(`[CSFlow Images] HTTP ${response.status} dla ${url} — zachowuję oryginalny URL`);
                        results[globalIdx] = url;
                        return;
                    }

                    const buffer = await response.buffer();
                    await fs.writeFile(filePath, buffer);
                    results[globalIdx] = localPath;
                } catch (err: any) {
                    const reason = err?.name === 'AbortError' ? 'timeout' : err?.message;
                    console.warn(`[CSFlow Images] Błąd pobierania [${globalIdx}] ${url}: ${reason} — zachowuję oryginalny URL`);
                    results[globalIdx] = url;
                }
            })
        );
    }

    return results;
}

/**
 * Usuwa lokalnie zcachowane zdjęcia danego listingu (np. przy trwałym usunięciu z bazy).
 * Bezpieczna: jeśli katalogu nie ma, nic nie robi.
 */
export async function removeCachedImages(listingId: string): Promise<void> {
    const safeId = listingId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const targetDir = path.join(CSFLOW_IMAGES_DIR, safeId);
    try {
        await fs.rm(targetDir, { recursive: true, force: true });
    } catch {
        // Ignore
    }
}
