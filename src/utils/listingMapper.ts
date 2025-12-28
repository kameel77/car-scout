import { Listing } from '@/data/mockData';

export function mapBackendListingToFrontend(backendListing: any): Listing {
    return {
        listing_id: backendListing.id, // ID refers to internal ID (CUID), listingId is external ID
        listing_url: backendListing.listingUrl,
        make: backendListing.make,
        model: backendListing.model,
        version: backendListing.version || '',
        vin: backendListing.vin || '',
        price_pln: backendListing.pricePln,
        price_display: backendListing.priceDisplay || `${backendListing.pricePln} PLN`,
        production_year: backendListing.productionYear,
        mileage_km: backendListing.mileageKm,
        fuel_type: backendListing.fuelType,
        transmission: backendListing.transmission,
        drive: backendListing.drive || '',
        engine_power_hp: backendListing.enginePowerHp || 0,
        engine_capacity_cm3: backendListing.engineCapacityCm3 || 0,
        body_type: backendListing.bodyType || '',
        first_registration_date: backendListing.firstRegistrationDate || '',
        registration_number: backendListing.registrationNumber,
        primary_image_url: backendListing.primaryImageUrl || '',
        image_urls: backendListing.imageUrls || [],

        // Flatten Dealer Info
        dealer_name: backendListing.dealer?.name || '',
        dealer_address_line1: backendListing.dealer?.addressLine1 || '',
        dealer_address_line2: backendListing.dealer?.addressLine2,
        dealer_address_line3: backendListing.dealer?.addressLine3,
        dealer_city: backendListing.dealer?.city || '',
        contact_phone: backendListing.dealer?.contactPhone || '',
        google_rating: backendListing.dealer?.googleRating,
        google_reviews_count: backendListing.dealer?.googleReviewCount,

        // Specifications & Equipment
        specifications: backendListing.specsJson ?
            (typeof backendListing.specsJson === 'string' ? JSON.parse(backendListing.specsJson) : backendListing.specsJson) : [],

        equipment: {
            audioMultimedia: backendListing.equipmentAudioMultimedia || [],
            safety: backendListing.equipmentSafety || [],
            comfort: backendListing.equipmentComfortExtras || [],
            performance: [], // Map if available
            driverAssist: [], // Map if available
            other: backendListing.equipmentOther || []
        }
    };
}
