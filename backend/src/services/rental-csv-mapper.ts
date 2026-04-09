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

export interface RentalMatrixImportResult {
    totalRows: number;
    inserted: number;
    updated: number;
    skipped: number;
    errors: Array<{ row: number; error: string }>;
}

const REQUIRED_COLUMNS = [
    'vehicle_id',
    'annual_mileage_km',
    'contract_months',
    'initial_payment_pct',
    'monthly_rate_net',
    'monthly_rate_gross'
];

function safeFloat(value: string | undefined | null): number | null {
    if (!value) return null;
    const cleaned = value.toString().replace(/\s+/g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
}

function safeInt(value: string | undefined | null): number | null {
    if (!value) return null;
    const cleaned = value.toString().replace(/\s+/g, '');
    const parsed = parseInt(cleaned, 10);
    return isNaN(parsed) ? null : parsed;
}

export function validateMatrixCSVHeaders(headers: string[]): { valid: boolean; missing: string[] } {
    const normalizedHeaders = headers.map(h => h.trim().toLowerCase());
    const missing = REQUIRED_COLUMNS.filter(col => !normalizedHeaders.includes(col));
    return { valid: missing.length === 0, missing };
}

export function mapCSVRowToMatrixEntry(row: RentalMatrixCSVRow, rowIndex: number): {
    data: {
        vehicleId: string;
        calculationId: string | null;
        annualMileageKm: number;
        contractMonths: number;
        initialPaymentPct: number;
        offerType: string;
        monthlyRateNet: number;
        monthlyRateGross: number;
        servicesIncluded: string[];
    } | null;
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
            servicesIncluded
        },
        error: null
    };
}
