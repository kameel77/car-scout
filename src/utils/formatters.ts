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

