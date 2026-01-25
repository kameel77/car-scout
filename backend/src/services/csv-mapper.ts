import { Prisma } from '@prisma/client';
import type { CSVRow } from '../types/csv.types.js';
import { getMarketplaceFromUrl } from '../utils/url-utils.js';

export function mapCSVToListing(row: CSVRow, dealerId?: string): Prisma.ListingCreateInput {
    return {
        listingId: row.listing_id || undefined,
        listingUrl: row.listing_url || undefined,
        marketplace: getMarketplaceFromUrl(row.listing_url),
        scrapedAt: row.scraped_at ? new Date(row.scraped_at) : undefined,

        make: row.make,
        model: row.model,
        version: row.version || undefined,
        vin: row.vin || undefined,

        pricePln: safeInt(row.price_pln) || 0,
        priceDisplay: row.price_display || undefined,
        omnibusLowest30dPln: safeInt(row.omnibus_lowest_30d_pln),
        omnibusText: row.omnibus_text || undefined,

        productionYear: safeInt(row.production_year) || 0,
        mileageKm: safeInt(row.mileage_km) || 0,
        fuelType: row.fuel_type,
        transmission: row.transmission,
        enginePowerHp: safeInt(row.engine_power_hp),
        engineCapacityCm3: safeInt(row.engine_capacity_cm3),
        drive: row.drive || undefined,
        bodyType: row.body_type || undefined,
        doors: safeInt(row.doors),
        seats: safeInt(row.seats),
        color: row.color || undefined,
        paintType: row.paint_type || undefined,

        registrationNumber: row.registration_number || undefined,
        firstRegistrationDate: row.first_registration_date || undefined,

        primaryImageUrl: row.primary_image_url || undefined,
        imageCount: safeInt(row.image_count),
        imageUrls: row.image_urls ? row.image_urls.split('|') : [],

        equipmentAudioMultimedia: row.equipment_audio_multimedia ? row.equipment_audio_multimedia.split('|') : [],
        equipmentSafety: row.equipment_safety ? row.equipment_safety.split('|') : [],
        equipmentComfortExtras: row.equipment_comfort_extras ? row.equipment_comfort_extras.split('|') : [],
        equipmentOther: row.equipment_other ? row.equipment_other.split('|') : [],

        additionalInfoHeader: row.additional_info_header || undefined,
        additionalInfoContent: row.additional_info_content || undefined,
        specsJson: safeJsonParse(row.specs_json),

        dealer: dealerId ? { connect: { id: dealerId } } : undefined,
    };
}

function safeJsonParse(jsonString: string | undefined): any {
    if (!jsonString) return undefined;
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        return undefined; // Or log error if needed
    }
}

function safeInt(value: string | undefined | null): number | undefined {
    if (!value) return undefined;
    // Remove all spaces (e.g. "100 000")
    const cleaned = value.toString().replace(/\s+/g, '');
    const parsed = parseInt(cleaned, 10);
    return isNaN(parsed) ? undefined : parsed;
}

export function mapCSVToListingUpdate(row: CSVRow): Prisma.ListingUpdateInput {
    const data = mapCSVToListing(row) as any;
    delete data.dealer; // Don't update dealer relationship
    return data;
}
