// ── CSV column interfaces ─────────────────────────────────────────

/** Original internal format (vehicle_id, annual_mileage_km, …) */
export interface RentalMatrixCSVRow {
    vehicle_id: string;
    calculation_id?: string;
    annual_mileage_km: string;
    contract_months: string;
    initial_payment_pct: string;
    monthly_rate_net: string;
    monthly_rate_gross: string;
    services_included?: string;
    offer_type?: string; // "business" | "consumer" | "all" — defaults to "all"
}

/** Provider format (car_id, term_months, monthly_cost_net, …) */
export interface ProviderCSVRow {
    car_id: string;
    calc_id?: string;
    offer_type?: string;
    model_code?: string;
    make?: string;
    model?: string;
    trim?: string;
    body_type?: string;
    fuel?: string;
    car_class?: string;
    term_months: string;
    mileage_yearly: string;
    mileage_total?: string;
    catalogue_price_gross?: string;
    investment_net?: string;
    financing_net?: string;
    insurance_net?: string;
    tires_net?: string;
    service_net?: string;
    other_cost_net?: string;
    monthly_cost_net: string;
    over_mileage?: string;
    insurance_500?: string;
    insurance_nolim?: string;
    tires_nolim?: string;
}

export interface RentalMatrixImportResult {
    totalRows: number;
    inserted: number;
    updated: number;
    skipped: number;
    errors: Array<{ row: number; error: string }>;
}

// ── Format detection ──────────────────────────────────────────────

const INTERNAL_REQUIRED = [
    'vehicle_id', 'annual_mileage_km', 'contract_months',
    'initial_payment_pct', 'monthly_rate_net', 'monthly_rate_gross'
];

const PROVIDER_REQUIRED = [
    'car_id', 'term_months', 'mileage_yearly', 'monthly_cost_net'
];

export type CSVFormat = 'internal' | 'provider';

export function detectCSVFormat(headers: string[]): { format: CSVFormat | null; missing: string[] } {
    const normalizedHeaders = headers.map(h => h.trim().toLowerCase());

    // Check internal format first
    const missingInternal = INTERNAL_REQUIRED.filter(col => !normalizedHeaders.includes(col));
    if (missingInternal.length === 0) {
        return { format: 'internal', missing: [] };
    }

    // Check provider format
    const missingProvider = PROVIDER_REQUIRED.filter(col => !normalizedHeaders.includes(col));
    if (missingProvider.length === 0) {
        return { format: 'provider', missing: [] };
    }

    // Neither format matches — report what's closest
    if (missingInternal.length <= missingProvider.length) {
        return { format: null, missing: missingInternal };
    }
    return { format: null, missing: missingProvider };
}

// Keep the legacy export for backward compatibility
export function validateMatrixCSVHeaders(headers: string[]): { valid: boolean; missing: string[] } {
    const result = detectCSVFormat(headers);
    return { valid: result.format !== null, missing: result.missing };
}

// ── Parsing helpers ───────────────────────────────────────────────

function safeFloat(value: string | undefined | null): number | null {
    if (!value || value.toString().trim() === '') return null;
    const cleaned = value.toString().replace(/\s+/g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
}

function safeInt(value: string | undefined | null): number | null {
    if (!value || value.toString().trim() === '') return null;
    // Handle European number formatting: "10,000" → "10000", "15 000" → "15000"
    const cleaned = value.toString().replace(/"/g, '').replace(/\s+/g, '').replace(/,/g, '');
    const parsed = parseInt(cleaned, 10);
    return isNaN(parsed) ? null : parsed;
}

/** Parse car_id field — may contain multiple IDs separated by ";" */
function parseCarIds(raw: string): string[] {
    if (!raw) return [];
    // Remove surrounding quotes and trim
    const cleaned = raw.replace(/^"|"$/g, '').trim();
    // Split by semicolons (recommended separator for multi-vehicle IDs)
    return cleaned.split(';').map(id => id.trim()).filter(Boolean);
}

function parseServiceFlags(row: ProviderCSVRow): string[] {
    const services: string[] = [];
    if (row.insurance_net && row.insurance_net.toString().trim().toUpperCase() === 'I') services.push('insurance');
    if (row.tires_net && row.tires_net.toString().trim().toUpperCase() === 'I') services.push('tires');
    if (row.service_net && row.service_net.toString().trim().toUpperCase() === 'I') services.push('service');
    if (row.other_cost_net && row.other_cost_net.toString().trim().toUpperCase() === 'I') services.push('other');
    return services;
}

// ── Internal format mapper ────────────────────────────────────────

export interface MappedMatrixEntry {
    vehicleId: string; // externalVehicleId (for matching)
    calculationId: string | null;
    annualMileageKm: number;
    contractMonths: number;
    initialPaymentPct: number;
    offerType: string;
    monthlyRateNet: number;
    monthlyRateGross: number;
    servicesIncluded: string[];
    overMileageCost: number | null;
    insuranceExcess500: number | null;
    insuranceNoLimit: number | null;
    tiresNoLimit: number | null;
    // Provider-only vehicle metadata (used to update vehicle record optionally)
    vehicleMeta?: {
        carClass: string | null;
        modelCode: string | null;
        catalogPriceGross: number | null;
        investmentNet: number | null;
    };
}

export function mapCSVRowToMatrixEntry(row: RentalMatrixCSVRow, rowIndex: number): {
    data: MappedMatrixEntry | null;
    error: string | null;
} {
    const vehicleId = row.vehicle_id?.trim();
    if (!vehicleId) {
        return { data: null, error: `Row ${rowIndex}: missing vehicle_id` };
    }

    const annualMileageKm = safeInt(row.annual_mileage_km);
    if (annualMileageKm === null || annualMileageKm <= 0) {
        return { data: null, error: `Row ${rowIndex}: invalid annual_mileage_km` };
    }

    const contractMonths = safeInt(row.contract_months);
    if (contractMonths === null || contractMonths <= 0) {
        return { data: null, error: `Row ${rowIndex}: invalid contract_months` };
    }

    const initialPaymentPct = safeFloat(row.initial_payment_pct);
    if (initialPaymentPct === null || initialPaymentPct < 0 || initialPaymentPct > 100) {
        return { data: null, error: `Row ${rowIndex}: invalid initial_payment_pct (must be 0-100)` };
    }

    const monthlyRateNet = safeFloat(row.monthly_rate_net);
    if (monthlyRateNet === null || monthlyRateNet <= 0) {
        return { data: null, error: `Row ${rowIndex}: invalid monthly_rate_net` };
    }

    const monthlyRateGross = safeFloat(row.monthly_rate_gross);
    if (monthlyRateGross === null || monthlyRateGross <= 0) {
        return { data: null, error: `Row ${rowIndex}: invalid monthly_rate_gross` };
    }

    const servicesIncluded = row.services_included
        ? row.services_included.split(',').map(s => s.trim()).filter(Boolean)
        : [];

    // Offer type: optional, defaults to 'all'
    const rawOfferType = (row.offer_type?.trim()?.toLowerCase()) || 'all';
    const validOfferTypes = ['business', 'consumer', 'all'];
    const offerType = validOfferTypes.includes(rawOfferType) ? rawOfferType : 'all';

    return {
        data: {
            vehicleId,
            calculationId: row.calculation_id?.trim() || null,
            annualMileageKm,
            contractMonths,
            initialPaymentPct,
            offerType,
            monthlyRateNet,
            monthlyRateGross,
            servicesIncluded,
            overMileageCost: null,
            insuranceExcess500: null,
            insuranceNoLimit: null,
            tiresNoLimit: null
        },
        error: null
    };
}

// ── Provider format mapper ────────────────────────────────────────

const VAT_MULTIPLIER = 1.23;

export interface ProviderMappedResult {
    /** One row can produce entries for multiple vehicles (semicolon-separated car_id) */
    entries: MappedMatrixEntry[];
    error: string | null;
}

export function mapProviderCSVRow(row: ProviderCSVRow, rowIndex: number): ProviderMappedResult {
    // Parse car_id — may contain multiple IDs
    const carIds = parseCarIds(row.car_id);
    if (carIds.length === 0) {
        return { entries: [], error: `Row ${rowIndex}: missing or empty car_id` };
    }

    const annualMileageKm = safeInt(row.mileage_yearly);
    if (annualMileageKm === null || annualMileageKm <= 0) {
        return { entries: [], error: `Row ${rowIndex}: invalid mileage_yearly` };
    }

    const contractMonths = safeInt(row.term_months);
    if (contractMonths === null || contractMonths <= 0) {
        return { entries: [], error: `Row ${rowIndex}: invalid term_months` };
    }

    const monthlyRateNet = safeFloat(row.monthly_cost_net);
    if (monthlyRateNet === null || monthlyRateNet <= 0) {
        return { entries: [], error: `Row ${rowIndex}: invalid monthly_cost_net` };
    }

    // Calculate gross from net
    const monthlyRateGross = Math.round(monthlyRateNet * VAT_MULTIPLIER * 100) / 100;

    // Parse offer type
    const rawOfferType = (row.offer_type?.trim()?.toLowerCase()) || 'all';
    const validOfferTypes = ['business', 'consumer', 'all'];
    const offerType = validOfferTypes.includes(rawOfferType) ? rawOfferType : 'all';

    // Parse service flags
    const servicesIncluded = parseServiceFlags(row);

    // Parse optional financial fields
    const overMileageCost = safeFloat(row.over_mileage);
    const insuranceExcess500 = safeFloat(row.insurance_500);
    const insuranceNoLimit = safeFloat(row.insurance_nolim);
    const tiresNoLimit = safeFloat(row.tires_nolim);

    // Vehicle metadata
    const vehicleMeta = {
        carClass: row.car_class?.trim() || null,
        modelCode: row.model_code?.trim() || null,
        catalogPriceGross: safeInt(row.catalogue_price_gross),
        investmentNet: safeInt(row.investment_net)
    };

    // Create one entry per car_id
    const entries: MappedMatrixEntry[] = carIds.map(carId => ({
        vehicleId: carId,
        calculationId: row.calc_id?.toString().trim() || null,
        annualMileageKm,
        contractMonths,
        initialPaymentPct: 0, // Provider format has no initial payment — always 0%
        offerType,
        monthlyRateNet,
        monthlyRateGross,
        servicesIncluded,
        overMileageCost,
        insuranceExcess500,
        insuranceNoLimit,
        tiresNoLimit,
        vehicleMeta
    }));

    return { entries, error: null };
}
