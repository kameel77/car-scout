import { TFunction } from 'i18next';

/**
 * Maps common Polish technical values to i18n keys
 */
const valueMap: Record<string, string> = {
    // Fuel types
    'beznyna': 'fuel.petrol',
    'benzyna': 'fuel.petrol',
    'diesel': 'fuel.diesel',
    'hybryda': 'fuel.hybrid',
    'elektryczny': 'fuel.electric',
    'lpg': 'fuel.lpg',
    'cng': 'fuel.cng',

    // Transmissions
    'manualna': 'transmission.manual',
    'automatyczna': 'transmission.automatic',
    'automat': 'transmission.automatic',

    // Drive
    'przedni': 'drive.fwd',
    'tylny': 'drive.rwd',
    '4x4': 'drive.awd',
    'awd': 'drive.awd',

    // Body types
    'sedan': 'body.sedan',
    'hatchback': 'body.hatchback',
    'suv': 'body.suv',
    'kombi': 'body.kombi',
    'coupe': 'body.coupe',
    'kabriolet': 'body.cabrio',
    'van': 'body.van',
    'pickup': 'body.pickup',
    'minivan': 'body.minivan',
};

/**
 * Translates a technical value (e.g., fuel type, transmission) from Polish database value
 * to the currently selected language.
 */
export function translateTechnicalValue(category: string, value: string | null | undefined, t: TFunction): string {
    if (!value) return '';

    const normalizedValue = value.toLowerCase().trim();
    const key = valueMap[normalizedValue] || `${category}.${normalizedValue}`;

    // Try to translate. If key doesn't exist in i18n, t() returns the key itself.
    // In that case, we fall back to the original value if it doesn't look like a key.
    const translated = t(key);
    if (translated === key) {
        return value;
    }

    return translated;
}

/**
 * Normalizes equipment feature names for translation keys
 */
export function getFeatureKey(feature: string): string {
    return feature
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // remove diacritics
        .replace(/[^a-z0-9]/g, '_')     // replace non-alphanumeric with underscore
        .replace(/_+/g, '_')            // collapse underscores
        .replace(/^_+|_+$/g, '');       // trim underscores
}

export function translateFeature(feature: string, t: TFunction): string {
    const key = `features.${getFeatureKey(feature)}`;
    const translated = t(key);
    return translated === key ? feature : translated;
}
