import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const DETAIL_API = "https://findcar.pl/api/listings/{}";

export async function refreshListingImages(prisma: PrismaClient, id: string) {
    // 1. Get current listing
    const listing = await prisma.listing.findUnique({
        where: { id },
        select: { listingId: true, listingUrl: true }
    });

    let externalId = listing?.listingId;

    // Fallback: extract ID from URL if missing in listingId field
    if (!externalId && listing?.listingUrl) {
        const match = listing.listingUrl.match(/\/listings\/(\d+)/);
        if (match) {
            externalId = match[1];
        }
    }

    if (!listing || !externalId) {
        throw new Error('Listing not found or missing external ID');
    }

    // 2. Fetch from FindCar API with retries and timeout
    const url = DETAIL_API.replace('{}', externalId);
    const MAX_RETRIES = 3;
    const TIMEOUT_MS = 10000;

    let response: any;
    let lastError: any;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
            console.log(`[ImageRefresh] Attempt ${attempt}/${MAX_RETRIES} fetching from: ${url}`);
            response = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "application/json",
                    "Referer": "https://findcar.pl/",
                },
                signal: controller.signal
            });

            if (response.status === 404) {
                await prisma.listing.update({
                    where: { id },
                    data: {
                        isArchived: true,
                        archivedAt: new Date(),
                        archivedReason: 'Listing removed from source (404)'
                    }
                });
                throw new Error('Listing no longer exists on source (404). Auto-archived.');
            }

            if (response.ok) {
                // Success!
                break;
            }

            if (response.status >= 500) {
                console.warn(`[ImageRefresh] API returned ${response.status} on attempt ${attempt}`);
                if (attempt === MAX_RETRIES) {
                    await prisma.listing.update({
                        where: { id },
                        data: {
                            isArchived: true,
                            archivedAt: new Date(),
                            archivedReason: `External source error (${response.status}) - auto-archived after ${MAX_RETRIES} attempts`
                        }
                    });
                    throw new Error(`External source error (${response.status}). Auto-archived after ${MAX_RETRIES} attempts.`);
                }
            } else {
                // Other non-ok status codes (e.g. 403, 400) - don't retry
                throw new Error(`Failed to fetch data: ${response.statusText} (${response.status})`);
            }
        } catch (error: any) {
            lastError = error;
            if (error.name === 'AbortError') {
                console.warn(`[ImageRefresh] Timeout after ${TIMEOUT_MS}ms on attempt ${attempt}`);
            } else if (error.message.includes('404') || error.message.includes('400')) {
                // Propagate client/not found errors immediately
                throw error;
            } else {
                console.error(`[ImageRefresh] Network error on attempt ${attempt}:`, error.message);
            }

            if (attempt < MAX_RETRIES) {
                // Exponential backoff could be added here if needed, but simple retry for now
                const delay = attempt * 1000;
                console.log(`[ImageRefresh] Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        } finally {
            clearTimeout(timeout);
        }
    }

    if (!response || !response.ok) {
        throw lastError || new Error(`Failed to fetch after ${MAX_RETRIES} attempts`);
    }

    const data = await response.json() as any;

    // 3. Extract images
    const media = data.media || [];
    const imageUrls = media
        .filter((m: any) => m.type === 'image' && m.url)
        .map((m: any) => m.url);

    if (imageUrls.length === 0) {
        throw new Error('No images found for this listing');
    }

    const primaryImageUrl = imageUrls[0];

    // 4. Update database
    const updated = await prisma.listing.update({
        where: { id },
        data: {
            primaryImageUrl,
            imageUrls,
            imageCount: imageUrls.length,
            listingId: externalId
        }
    });

    return updated;
}
