import { PrismaClient } from '@prisma/client';
import type { CSVRow, SyncResult, ImportMode } from '../types/csv.types.js';
import { mapCSVToListing, mapCSVToListingUpdate } from './csv-mapper.js';
import { generateListingSlug } from '../utils/url-utils.js';

export async function syncListingsFromCSV(
    prisma: PrismaClient,
    csvData: CSVRow[],
    userId: string,
    source?: string,
    importMode: ImportMode = 'replace',
    contextDealerId?: string   // multi-tenant: assign to this dealer if no dealer info in CSV
): Promise<SyncResult> {
    const startTime = Date.now();

    return await prisma.$transaction(async (tx) => {
        // 1. Get existing listings for archiving logic scoped to this source
        const archiveWhere: any = {};
        if (contextDealerId) {
            archiveWhere.dealerId = contextDealerId;
        }
        if (source) {
            archiveWhere.importSource = source;
        }

        const listingsFromThisSource = await tx.listing.findMany({
            where: archiveWhere,
            select: {
                id: true,
                vin: true,
                listingId: true,
                isArchived: true
            }
        });

        // 1.5 Deduplicate CSV rows locally
        // Sometimes CSV contains duplicate VINs/IDs. We take the first one encountered.
        const uniqueCsvRows: CSVRow[] = [];
        const seenKeysInCsv = new Set<string>();

        for (const row of csvData) {
            const key = row.vin || row.listing_id;
            if (!key) continue; // Skip rows without identity

            if (!seenKeysInCsv.has(key)) {
                seenKeysInCsv.add(key);
                uniqueCsvRows.push(row);
            }
        }

        const csvVINSet = new Set(seenKeysInCsv);

        // Fetch ALL existing listings that match the keys in the CSV to prevent global unique constraints and catch duplicates
        const existingListingsForKeys = await tx.listing.findMany({
            where: {
                OR: [
                    { vin: { in: Array.from(seenKeysInCsv) } },
                    { listingId: { in: Array.from(seenKeysInCsv) } }
                ]
            },
            select: {
                id: true,
                vin: true,
                listingId: true,
                pricePln: true,
                isArchived: true,
                importSource: true,
                dealerId: true
            }
        });

        const vinMap = new Map(
            existingListingsForKeys.map(l => [l.vin || l.listingId, l])
        );

        // 2. Categorize operations
        const toUpdate: Array<{ csvRow: CSVRow; existing: any }> = [];
        const toInsert: CSVRow[] = [];
        const toArchive: any[] = [];
        let failedCount = 0;

        for (const row of uniqueCsvRows) {
            const key = row.vin || row.listing_id;
            const existing = vinMap.get(key);

            if (existing) {
                // If the item exists but from a different source, we reject it as a duplicate for now.
                if (existing.importSource && source && existing.importSource !== source) {
                    failedCount++;
                } else {
                    toUpdate.push({ csvRow: row, existing });
                }
            } else {
                toInsert.push(row);
            }
        }

        if (importMode === 'replace') {
            for (const listing of listingsFromThisSource) {
                const key = listing.vin || listing.listingId;
                // Archive only active listings that disappeared from CSV
                if (!listing.isArchived && key && !csvVINSet.has(key)) {
                    toArchive.push(listing);
                }
            }
        }

        // 3. Process updates with price history
        const priceHistoryEntries = [];

        for (const { csvRow, existing } of toUpdate) {
            const newPrice = parseInt(csvRow.price_pln) || 0;

            // Update listing
            await tx.listing.update({
                where: { id: existing.id },
                data: {
                    ...mapCSVToListingUpdate(csvRow, source),
                    isArchived: false,
                    archivedAt: null,
                    archivedReason: null
                }
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

            // Fallback to context dealer if no dealer resolved from CSV
            if (!dealerId && contextDealerId) {
                dealerId = contextDealerId;
            }

            const listing = await tx.listing.create({
                data: mapCSVToListing(row, dealerId, source)
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

        // 5.5 Generate and update slugs for new listings
        for (const listing of newListings) {
            const slug = generateListingSlug(
                listing.make,
                listing.model,
                listing.version,
                listing.productionYear,
                listing.bodyType,
                listing.fuelType,
                listing.id
            );

            await tx.listing.update({
                where: { id: listing.id },
                data: { slug }
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

        // 6.5. Recalculate prices using the current settings for all active listings
        const settings = await tx.appSettings.findUnique({
            where: { id: 'default' }
        });

        if (settings) {
            await tx.$executeRaw`
                UPDATE "listings"
                SET
                    "dealer_price_net_pln" = "price_pln" / 1.23,
                    "dealer_price_net_eur" = "price_pln" / 1.23 / ${settings.eurExRate}::float,
                    "broker_price_pln"     = ROUND(
                        ("price_pln" / 1.23 * (1 + ${settings.brokerFeePctPln}::float / 100) * 1.23) / 10
                    ) * 10,
                    "broker_price_eur"     = CEIL(
                        ("price_pln" / 1.23 / ${settings.eurExRate}::float * (1 + ${settings.brokerFeePctEur}::float / 100) * 1.23) / 10
                    ) * 10
                WHERE "is_archived" = false
            `;
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
                failed: failedCount,
                status: 'success',
                duration
            }
        });

        return {
            totalRows: csvData.length,
            inserted: toInsert.length,
            updated: toUpdate.length,
            archived: toArchive.length,
            failed: failedCount,
            priceChanges: priceHistoryEntries.length,
            duration,
            importLogId: importLog.id
        };
    }, {
        timeout: 180000, // allow more time for larger CSV imports (~3 min)
        maxWait: 5000
    });
}
