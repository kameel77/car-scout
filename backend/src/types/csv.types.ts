export interface CSVRow {
    listing_id: string;
    listing_url: string;
    scraped_at: string;
    make: string;
    model: string;
    version: string;
    vin: string;
    price_pln: string;
    price_display: string;
    omnibus_lowest_30d_pln: string;
    omnibus_text: string;
    production_year: string;
    mileage_km: string;
    fuel_type: string;
    transmission: string;
    engine_power_hp: string;
    registration_number: string;
    first_registration_date: string;
    engine_capacity_cm3: string;
    drive: string;
    body_type: string;
    doors: string;
    seats: string;
    color: string;
    paint_type: string;
    dealer_name: string;
    dealer_address_line1: string;
    dealer_address_line2: string;
    dealer_address_line3: string;
    dealer_google_rating: string;
    dealer_review_count: string;
    dealer_google_link: string;
    contact_phone: string;
    primary_image_url: string;
    image_count: string;
    image_urls: string;
    equipment_audio_multimedia: string;
    equipment_safety: string;
    equipment_comfort_extras: string;
    equipment_other: string;
    additional_info_header: string;
    additional_info_content: string;
    specs_json: string;
}

export type ImportMode = 'replace' | 'merge';

export interface SyncResult {
    totalRows: number;
    inserted: number;
    updated: number;
    archived: number;
    priceChanges: number;
    duration: number;
    importLogId: string;
}
