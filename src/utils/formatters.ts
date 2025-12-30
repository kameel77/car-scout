/**
 * Formats a number with thousands separators according to the Polish locale.
 * Ensures that even 4-digit numbers have a separator.
 */
export const formatNumber = (value: number): string => {
    return new Intl.NumberFormat('pl-PL', {
        useGrouping: true,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value).replace(/\u00A0/g, ' '); // Replace non-breaking space with regular space for better visibility if needed
};

/**
 * Formats a price with currency.
 */
export const formatPrice = (price: number, currency: string): string => {
    return `${formatNumber(price)} ${currency}`;
};
