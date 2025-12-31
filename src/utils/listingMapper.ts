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

        // Calculated Prices
        dealer_price_net_pln: backendListing.dealerPriceNetPln,
        dealer_price_net_eur: backendListing.dealerPriceNetEur,
        broker_price_pln: backendListing.brokerPricePln,
        broker_price_eur: backendListing.brokerPriceEur,

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
        specifications: (() => {
            const specs: { label: string; value: string }[] = [];

            // 1. Start with data from specsJson if it exists
            if (backendListing.specsJson) {
                const parsed = typeof backendListing.specsJson === 'string'
                    ? JSON.parse(backendListing.specsJson)
                    : backendListing.specsJson;
                if (Array.isArray(parsed)) {
                    specs.push(...parsed);
                }
            }

            // 2. Supplement with individual fields if not already present in specs
            const addSpecIfMissing = (label: string, value: string | number | undefined | null) => {
                if (value === undefined || value === null || value === '') return;
                const exists = specs.some(s => s.label.toLowerCase() === label.toLowerCase());
                if (!exists) {
                    specs.push({ label, value: value.toString() });
                }
            };

            addSpecIfMissing('specs.color', backendListing.color);
            addSpecIfMissing('specs.bodyType', backendListing.bodyType);
            addSpecIfMissing('specs.doors', backendListing.doors);
            addSpecIfMissing('specs.seats', backendListing.seats);
            addSpecIfMissing('specs.paintType', backendListing.paintType);
            addSpecIfMissing('specs.vin', backendListing.vin);
            addSpecIfMissing('specs.firstRegistration', backendListing.firstRegistrationDate);
            addSpecIfMissing('specs.registrationNumber', backendListing.registrationNumber);

            return specs;
        })(),

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
