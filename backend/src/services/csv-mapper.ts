import { Prisma } from '@prisma/client';
import type { CSVRow } from '../types/csv.types.js';

export function mapCSVToListing(row: CSVRow, dealerId?: string): Prisma.ListingCreateInput {
    return {
        listingId: row.listing_id || undefined,
        listingUrl: row.listing_url || undefined,
        scrapedAt: row.scraped_at ? new Date(row.scraped_at) : undefined,

        make: row.make,
        model: row.model,
        version: row.version || undefined,
        vin: row.vin || undefined,

        pricePln: parseInt(row.price_pln) || 0,
        priceDisplay: row.price_display || undefined,
        omnibusLowest30dPln: row.omnibus_lowest_30d_pln ? parseInt(row.omnibus_lowest_30d_pln) : undefined,
        omnibusText: row.omnibus_text || undefined,

        productionYear: parseInt(row.production_year) || 0,
        mileageKm: parseInt(row.mileage_km) || 0,
        fuelType: row.fuel_type,
        transmission: row.transmission,
        enginePowerHp: row.engine_power_hp ? parseInt(row.engine_power_hp) : undefined,
        engineCapacityCm3: row.engine_capacity_cm3 ? parseInt(row.engine_capacity_cm3) : undefined,
        drive: row.drive || undefined,
        bodyType: row.body_type || undefined,
        doors: row.doors ? parseInt(row.doors) : undefined,
        seats: row.seats ? parseInt(row.seats) : undefined,
        color: row.color || undefined,
        paintType: row.paint_type || undefined,

        registrationNumber: row.registration_number || undefined,
        firstRegistrationDate: row.first_registration_date || undefined,

        primaryImageUrl: row.primary_image_url || undefined,
        imageCount: row.image_count ? parseInt(row.image_count) : undefined,
        imageUrls: row.image_urls ? row.image_urls.split('|') : [],

        equipmentAudioMultimedia: row.equipment_audio_multimedia ? row.equipment_audio_multimedia.split('|') : [],
        equipmentSafety: row.equipment_safety ? row.equipment_safety.split('|') : [],
        equipmentComfortExtras: row.equipment_comfort_extras ? row.equipment_comfort_extras.split('|') : [],
        equipmentOther: row.equipment_other ? row.equipment_other.split('|') : [],

        additionalInfoHeader: row.additional_info_header || undefined,
        additionalInfoContent: row.additional_info_content || undefined,
        specsJson: row.specs_json ? JSON.parse(row.specs_json) : undefined,

        dealer: dealerId ? { connect: { id: dealerId } } : undefined,
    };
}

export function mapCSVToListingUpdate(row: CSVRow): Prisma.ListingUpdateInput {
    const data = mapCSVToListing(row) as any;
    delete data.dealer; // Don't update dealer relationship
    return data;
}
