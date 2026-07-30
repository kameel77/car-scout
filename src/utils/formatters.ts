/**
 * Formats a number with thousands separators according to the Polish locale.
 * Ensures that even 4-digit numbers have a separator.
 */
export const formatNumber = (value: number | string): string => {
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/\s/g, '').replace(',', '.')) : value;
    if (isNaN(numValue)) return String(value);
    return new Intl.NumberFormat('pl-PL', {
        useGrouping: true,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(numValue).replace(/\u00A0/g, ' '); // Replace non-breaking space with regular space for better visibility if needed
};

/**
 * Formats a price with currency.
 */
export const formatPrice = (price: number, currency: string): string => {
    return `${formatNumber(price)} ${currency}`;
};

/**
 * Formats a phone number string to be safe and functional for tel: links.
 * Strips all whitespaces, hyphens, and other non-digit/non-plus characters.
 * Prepends +48 for Polish numbers when no international prefix is present.
 */
export const formatPhoneForTelLink = (phone?: string): string => {
    if (!phone) return '';
    
    // Remove all characters except digits and '+'
    const cleaned = phone.replace(/[^0-9+]/g, '');
    
    if (cleaned.startsWith('+')) {
        return cleaned;
    }
    
    if (cleaned.startsWith('00')) {
        return `+${cleaned.slice(2)}`;
    }
    
    // If it starts with '48' and is 11 digits long, it already has the Poland country code.
    if (cleaned.startsWith('48') && cleaned.length === 11) {
        return `+${cleaned}`;
    }
    
    return `+48${cleaned}`;
};


// ─── Czas polski w formularzach admina ───────────────────────────────
// Pola <input type="datetime-local"> operują na czasie lokalnym przeglądarki i oddają
// string bez strefy ("2026-07-30T14:00"). Backend działa w UTC, więc bez jawnej konwersji
// wpisana godzina przesuwała się o offset strefy — landing startował i wygasał o złej porze.

const WARSAW_TZ = 'Europe/Warsaw';

/** Offset danej strefy względem UTC (w minutach) dla konkretnego momentu. */
function timeZoneOffsetMinutes(date: Date, timeZone: string): number {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(date).reduce<Record<string, string>>((acc, part) => {
        acc[part.type] = part.value;
        return acc;
    }, {});

    const asUtc = Date.UTC(
        Number(parts.year), Number(parts.month) - 1, Number(parts.day),
        Number(parts.hour) % 24, Number(parts.minute), Number(parts.second)
    );

    return (asUtc - date.getTime()) / 60000;
}

/** "2026-07-30T14:00" rozumiane jako czas polski → ISO w UTC. */
export const warsawInputToIso = (value?: string | null): string | null => {
    const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return null;

    const [, year, month, day, hour, minute] = match;
    const naiveUtc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));

    // Dwa przebiegi, bo offset zależy od momentu (czas letni/zimowy).
    const firstGuess = naiveUtc - timeZoneOffsetMinutes(new Date(naiveUtc), WARSAW_TZ) * 60000;
    const offset = timeZoneOffsetMinutes(new Date(firstGuess), WARSAW_TZ);

    return new Date(naiveUtc - offset * 60000).toISOString();
};

/** ISO z API → "2026-07-30T14:00" w czasie polskim, gotowe dla datetime-local. */
export const isoToWarsawInput = (iso?: string | null): string => {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';

    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: WARSAW_TZ,
        hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
    }).formatToParts(date).reduce<Record<string, string>>((acc, part) => {
        acc[part.type] = part.value;
        return acc;
    }, {});

    return `${parts.year}-${parts.month}-${parts.day}T${String(Number(parts.hour) % 24).padStart(2, '0')}:${parts.minute}`;
};
