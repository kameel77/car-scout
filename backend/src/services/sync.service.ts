import { PrismaClient } from '@prisma/client';
import type { CSVRow, SyncResult } from '../types/csv.types.js';
import { mapCSVToListing, mapCSVToListingUpdate } from './csv-mapper.js';

export async function syncListingsFromCSV(
    prisma: PrismaClient,
    csvData: CSVRow[],
    userId: string,
    source?: string
): Promise<SyncResult> {
    const startTime = Date.now();

    return await prisma.$transaction(async (tx) => {
        // 1. Get existing listings
        const existingListings = await tx.listing.findMany({
            where: { isArchived: false },
            select: {
                id: true,
                vin: true,
                listingId: true,
                pricePln: true
            }
        });

        const vinMap = new Map(
            existingListings.map(l => [l.vin || l.listingId, l])
        );
        const csvVINSet = new Set(
            csvData.map(r => r.vin || r.listing_id)
        );

        // 2. Categorize operations
        const toUpdate: Array<{ csvRow: CSVRow; existing: any }> = [];
        const toInsert: CSVRow[] = [];
        const toArchive: any[] = [];

        for (const row of csvData) {
            const key = row.vin || row.listing_id;
            const existing = vinMap.get(key);

            if (existing) {
                toUpdate.push({ csvRow: row, existing });
            } else {
                toInsert.push(row);
            }
        }

        for (const listing of existingListings) {
            const key = listing.vin || listing.listingId;
            if (!csvVINSet.has(key)) {
                toArchive.push(listing);
            }
        }

        // 3. Process updates with price history
        const priceHistoryEntries = [];

        for (const { csvRow, existing } of toUpdate) {
            const newPrice = parseInt(csvRow.price_pln);

            // Update listing
            await tx.listing.update({
                where: { id: existing.id },
                data: mapCSVToListingUpdate(csvRow)
            });

            // Track price change
            if (newPrice !== existing.pricePln) {
                priceHistoryEntries.push({
                    listingId: existing.id,
                    pricePln: newPrice,
                    changedAt: new Date()
                });
            }
        }

        // 4. Insert price history
        if (priceHistoryEntries.length > 0) {
            await tx.priceHistory.createMany({
                data: priceHistoryEntries
            });
        }

        // 5. Insert new listings
        const newListings = [];
        for (const row of toInsert) {
            // Find or create dealer
            let dealerId: string | undefined;
            if (row.dealer_name && row.dealer_address_line1) {
                const dealer = await tx.dealer.upsert({
                    where: {
                        name_addressLine1: {
                            name: row.dealer_name,
                            addressLine1: row.dealer_address_line1
                        }
                    },
                    update: {},
                    create: {
                        name: row.dealer_name,
                        addressLine1: row.dealer_address_line1,
                        addressLine2: row.dealer_address_line2 || undefined,
                        addressLine3: row.dealer_address_line3 || undefined,
                        city: undefined,
                        contactPhone: row.contact_phone || undefined,
                        googleRating: row.dealer_google_rating ? parseFloat(row.dealer_google_rating) : undefined,
                        googleReviewCount: row.dealer_review_count ? parseInt(row.dealer_review_count) : undefined,
                        googleLink: row.dealer_google_link || undefined
                    }
                });
                dealerId = dealer.id;
            }

            const listing = await tx.listing.create({
                data: mapCSVToListing(row, dealerId)
            });
            newListings.push(listing);
        }

        // Create initial price history for new listings
        if (newListings.length > 0) {
            await tx.priceHistory.createMany({
                data: newListings.map(l => ({
                    listingId: l.id,
                    pricePln: l.pricePln,
                    changedAt: new Date()
                }))
            });
        }

        // 6. Archive old listings
        if (toArchive.length > 0) {
            await tx.listing.updateMany({
                where: {
                    id: { in: toArchive.map(l => l.id) }
                },
                data: {
                    isArchived: true,
                    archivedAt: new Date(),
                    archivedReason: 'Not in latest import'
                }
            });
        }

        // 7. Create import log
        const duration = Date.now() - startTime;

        const importLog = await tx.importLog.create({
            data: {
                importedBy: userId,
                fileName: source || 'api-upload',
                totalRows: csvData.length,
                inserted: toInsert.length,
                updated: toUpdate.length,
                archived: toArchive.length,
                failed: 0,
                status: 'success',
                duration
            }
        });

        return {
            totalRows: csvData.length,
            inserted: toInsert.length,
            updated: toUpdate.length,
            archived: toArchive.length,
            priceChanges: priceHistoryEntries.length,
            duration,
            importLogId: importLog.id
        };
    });
}
