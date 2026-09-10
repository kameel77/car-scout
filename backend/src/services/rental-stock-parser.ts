import { parse } from 'csv-parse/sync';

export interface CanonicalRentalStockRow {
    stock_no?: string;
    spec_no?: string;
    vin?: string;
    reg_no?: string;
    make?: string;
    model?: string;
    model_description?: string;
    body_type?: string;
    color?: string;
    fuel?: string;
    dealer?: string;
    docs_delivery_date?: string;
    vehicle_delivery_date?: string;
    [key: string]: string | undefined;
}

export interface ParsedRentalStockRow {
    stockNo: string;
    specNoRaw: string;
    specNo: string | null;
    specNoNote: string | null;
    vin: string | null;
    registrationNumber: string | null;
    make: string | null;
    model: string | null;
    modelDescription: string | null;
    bodyType: string | null;
    color: string | null;
    fuelType: string | null;
    dealerName: string | null;
    docsDeliveryDate: Date | null;
    vehicleDeliveryDate: Date | null;
    rowIndex: number;
}

export interface RentalStockParseResult {
    rows: ParsedRentalStockRow[];
    errors: Array<{ row: number; error: string }>;
}

export function extractSpecNo(raw: string | null | undefined): {
    specNo: string | null;
    specNoNote: string | null;
} {
    if (!raw || typeof raw !== 'string') {
        return { specNo: null, specNoNote: null };
    }
    const trimmed = raw.trim();
    if (!trimmed) {
        return { specNo: null, specNoNote: null };
    }

    const match = trimmed.match(/^\s*([A-Za-z]?\d+[A-Za-z]?)(.*)$/);
    if (!match) {
        return { specNo: null, specNoNote: trimmed || null };
    }

    const specNo = match[1];
    let remainder = match[2] ? match[2].trim() : '';

    remainder = remainder
        .replace(/^[\s\-–—:()[\]]+/, '')
        .replace(/[\s\-–—:()[\]]+$/, '')
        .trim();

    const specNoNote = remainder.length > 0 ? remainder : null;

    return { specNo, specNoNote };
}

export function parseDeliveryDate(raw: string | undefined | null): Date | null {
    if (!raw || !raw.trim()) return null;
    const trimmed = raw.trim();

    // Try YYYY-MM-DD or ISO
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        const date = new Date(trimmed);
        return isNaN(date.getTime()) ? null : date;
    }

    // Try DD.MM.YYYY
    const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (ddmmyyyyMatch) {
        const day = parseInt(ddmmyyyyMatch[1], 10);
        const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
        const year = parseInt(ddmmyyyyMatch[3], 10);
        const date = new Date(Date.UTC(year, month, day));
        if (isNaN(date.getTime())) return null;
        if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) {
            return null;
        }
        return date;
    }

    const fallback = new Date(trimmed);
    return isNaN(fallback.getTime()) ? null : fallback;
}

export function parseRentalStockCSV(csvContent: string): RentalStockParseResult {
    // Strip UTF-8 BOM and normalize line endings
    let content = csvContent;
    if (content.charCodeAt(0) === 0xfeff) {
        content = content.slice(1);
    }
    content = content.replace(/\r\r\n/g, '\n').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    const headerLine = content.split('\n')[0] || '';
    const commaCount = (headerLine.match(/,/g) || []).length;
    const semiCount = (headerLine.match(/;/g) || []).length;
    const tabCount = (headerLine.match(/\t/g) || []).length;
    const delimiter =
        tabCount >= commaCount && tabCount >= semiCount
            ? '\t'
            : semiCount > commaCount
              ? ';'
              : ',';

    let records: Record<string, string>[];
    try {
        records = parse(content, {
            columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
            skip_empty_lines: true,
            delimiter,
            relax_column_count: true,
            trim: true,
            bom: true,
        }) as Record<string, string>[];
    } catch (err) {
        return {
            rows: [],
            errors: [{ row: 0, error: `Błąd parsowania CSV: ${err instanceof Error ? err.message : 'Nieprawidłowy format'}` }],
        };
    }

    const rows: ParsedRentalStockRow[] = [];
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const rowIndex = i + 2; // 1-based index including header

        const stockNo = record.stock_no?.trim();
        const specNoRaw = record.spec_no?.trim();

        if (!stockNo) {
            errors.push({ row: rowIndex, error: `Wiersz ${rowIndex}: brak wymaganego pola stock_no` });
            continue;
        }

        if (!specNoRaw) {
            errors.push({ row: rowIndex, error: `Wiersz ${rowIndex}: brak wymaganego pola spec_no` });
            continue;
        }

        const { specNo, specNoNote } = extractSpecNo(specNoRaw);

        rows.push({
            stockNo,
            specNoRaw,
            specNo,
            specNoNote,
            vin: record.vin?.trim() || null,
            registrationNumber: record.reg_no?.trim() || null,
            make: record.make?.trim() || null,
            model: record.model?.trim() || null,
            modelDescription: record.model_description?.trim() || null,
            bodyType: record.body_type?.trim() || null,
            color: record.color?.trim() || null,
            fuelType: record.fuel?.trim() || null,
            dealerName: record.dealer?.trim() || null,
            docsDeliveryDate: parseDeliveryDate(record.docs_delivery_date),
            vehicleDeliveryDate: parseDeliveryDate(record.vehicle_delivery_date),
            rowIndex,
        });
    }

    return { rows, errors };
}
