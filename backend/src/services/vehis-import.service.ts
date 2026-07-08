import { PrismaClient, ListingCondition, Prisma } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import { normalizeBrand } from './brand-normalization.service.js';

export async function importVehisCSV(
    prisma: PrismaClient,
    dealerId: string,
    userId: string,
    csvContent: string,
    fileName: string
) {
    const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        delimiter: [',', ';'],
        bom: true
    });

    let inserted = 0;
    let updated = 0;
    let failed = 0;
    const errors: any[] = [];
    const touchedSpecificationIds = new Set<string>();

    // Import logic
    for (let i = 0; i < records.length; i++) {
        const row = records[i];
        try {
            // Extract fields
            const vin = row['vin'] || null;
            const isNew = row['is_new'] === '1' || row['is_new'] === 'true' || row['is_new'] === 'TRUE';
            const brand = normalizeBrand(row['brand']);
            const model = row['model']?.replace(/\t|\n/g, '').trim() || 'Unknown';
            const version = row['version'] || '';
            const color = row['color'] || null;
            const originalColor = row['original_color'] || null;
            const yearStr = row['manufacturing_year'];
            const manufacturingYear = yearStr ? parseInt(yearStr, 10) : null;
            const externalId = row['external_id'] || null;
            const ecCode = row['ec_code'] || null;

            // Technical specs
            const enginePowerHp = row['engine_power'] ? parseInt(row['engine_power'], 10) : null;
            const engineCapacityCm3 = row['engine_capacity'] ? parseInt(row['engine_capacity'], 10) : null;
            const fuelType = row['fuel_type'] || null;
            const transmission = row['gearbox_type'] || null;
            const drive = row['drive_type'] || null;
            const bodyType = row['body_type'] || null;
            
            // Listing details
            const dealerPriceNetPln = row['dealer_netto_price'] ? parseFloat(row['dealer_netto_price']) : null;
            const catalogPrice = row['catalog_netto_price'] ? parseFloat(row['catalog_netto_price']) : null;
            const mileageKm = row['mileage'] ? parseInt(row['mileage'], 10) : (isNew ? 5 : 0);
            
            // Grouping Key
            const specCondition: ListingCondition = isNew ? 'NEW' : 'USED';
            const specColor = color; 
            
            let specificationId: string | null = null;
            
            const existingSpecs = await prisma.vehicleSpecification.findMany({
                where: {
                    dealerId,
                    condition: specCondition,
                    brand,
                    model,
                    version,
                    color: specColor,
                    manufacturingYear: manufacturingYear
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });

            if (existingSpecs.length > 0) {
                specificationId = existingSpecs[0].id;
            } else {
                // Create new spec
                const newSpec = await prisma.vehicleSpecification.create({
                    data: {
                        dealerId,
                        condition: specCondition,
                        brand,
                        model,
                        version,
                        color: specColor,
                        manufacturingYear,
                        enginePowerHp: !isNaN(enginePowerHp as number) ? enginePowerHp : null,
                        engineCapacityCm3: !isNaN(engineCapacityCm3 as number) ? engineCapacityCm3 : null,
                        fuelType,
                        transmission,
                        drive,
                        bodyType,
                        displayMode: isNew ? 'GROUPED' : 'ALL', // default
                    }
                });
                specificationId = newSpec.id;
            }

            const listingIdStr = externalId || vin || `gen_${dealerId}_${i}_${Date.now()}`;
            
            const listingData = {
                make: brand,
                model: model,
                version: version,
                vin: vin,
                color: color || originalColor,
                productionYear: manufacturingYear || new Date().getFullYear(),
                mileageKm: !isNaN(mileageKm) ? mileageKm : 0,
                fuelType,
                transmission,
                enginePowerHp: !isNaN(enginePowerHp as number) ? enginePowerHp : null,
                engineCapacityCm3: !isNaN(engineCapacityCm3 as number) ? engineCapacityCm3 : null,
                drive,
                bodyType,
                condition: specCondition,
                dealerPriceNetPln: !isNaN(dealerPriceNetPln as number) ? dealerPriceNetPln : null,
                catalogPrice: !isNaN(catalogPrice as number) ? catalogPrice : null,
                pricePln: !isNaN(dealerPriceNetPln as number) ? Math.round(dealerPriceNetPln! * 1.23) : 0,
                dealerId,
                importSource: 'VEHIS_CSV',
                specificationId,
                imageUrls: (!isNew && row['images']) ? [row['images']] : [], 
            };

            touchedSpecificationIds.add(specificationId);

            const hasRepresentative = await prisma.listing.findFirst({
                where: { specificationId, isRepresentative: true }
            });
            const isRepresentative = !hasRepresentative;

            const existingListing = await prisma.listing.findFirst({
                where: {
                    dealerId,
                    OR: [
                        { vin: vin ? vin : undefined },
                        { listingId: externalId ? externalId : undefined }
                    ].filter(x => Object.values(x)[0] !== undefined)
                }
            });

            if (existingListing && (vin || externalId)) {
                await prisma.listing.update({
                    where: { id: existingListing.id },
                    data: listingData
                });
                updated++;
            } else {
                await prisma.listing.create({
                    data: {
                        ...listingData,
                        listingId: listingIdStr,
                        isRepresentative
                    }
                });
                inserted++;
            }

        } catch (err: any) {
            failed++;
            errors.push({ row: i + 1, error: err.message });
        }
    }

    // Update stock counts
    for (const specId of touchedSpecificationIds) {
        const count = await prisma.listing.count({
            where: { specificationId: specId, isArchived: false }
        });
        await prisma.vehicleSpecification.update({
            where: { id: specId },
            data: { stockCount: count }
        });
    }

    await prisma.importLog.create({
        data: {
            importedBy: userId,
            fileName: fileName,
            totalRows: records.length,
            inserted,
            updated,
            archived: 0,
            failed,
            status: failed === records.length ? 'FAILED' : (failed > 0 ? 'PARTIAL_SUCCESS' : 'SUCCESS'),
            errorLog: errors.length > 0 ? errors : Prisma.JsonNull
        }
    });

    return { inserted, updated, failed, errors };
}
