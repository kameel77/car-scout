import { TFunction } from 'i18next';

/**
 * Maps common Polish technical values to i18n keys
 */
const valueMap: Record<string, string> = {
    // Fuel types — common raw variants from imports/dealers map to the canonical bucket
    'beznyna': 'fuel.petrol',
    'benzyna': 'fuel.petrol',
    'benzynowy': 'fuel.petrol',
    'pb': 'fuel.petrol',
    'diesel': 'fuel.diesel',
    'on': 'fuel.diesel',
    'hybryda': 'fuel.hybrid',
    'hybrydowy': 'fuel.hybrid',
    'hybryda plug-in': 'fuel.hybridPlugin',
    'benzynowy + gaz': 'fuel.petrolLpg',
    'benzyna + lpg': 'fuel.petrolLpg',
    'elektryczny': 'fuel.electric',
    'elektryk': 'fuel.electric',
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

export function getTechnicalTranslationKey(category: string, value: string | null | undefined): string {
    if (!value) return '';
    const normalizedValue = value.toLowerCase().trim();
    return valueMap[normalizedValue] || `${category}.${normalizedValue}`;
}

/**
 * Translates a technical value (e.g., fuel type, transmission) from Polish database value
 * to the currently selected language.
 */
export function translateTechnicalValue(category: string, value: string | null | undefined, t: TFunction): string {
    const key = getTechnicalTranslationKey(category, value);

    // Try to translate. If key doesn't exist in i18n, t() returns the key itself.
    // In that case, we fall back to the original value if it doesn't look like a key.
    const translated = t(key);
    if (translated === key) {
        return value || '';
    }

    return translated;
}

/**
 * Short 1-letter label for transmission, used on listing card pills.
 * Buckets all vendor variants by prefix: anything starting with "manual" → M,
 * anything starting with "automat" → A. Falls back to the raw value otherwise.
 */
export function getTransmissionShortLabel(value: string | null | undefined, t: TFunction): string {
    if (!value) return '';
    const lower = value.toLowerCase();
    if (lower.startsWith('manual')) return t('transmission.short.manual', 'M');
    if (lower.startsWith('automat')) return t('transmission.short.automatic', 'A');
    return value;
}

/**
 * Normalises a raw transmission value (any vendor variant) to one of the
 * canonical filter tokens 'manual' | 'automatic'. Returns the raw value
 * unchanged when no prefix matches.
 */
export function canonicalTransmission(value: string | null | undefined): string {
    if (!value) return '';
    const lower = value.toLowerCase();
    if (lower.startsWith('manual')) return 'manual';
    if (lower.startsWith('automat')) return 'automatic';
    return value;
}

/**
 * Normalises a raw fuel value (any vendor variant) to a canonical filter token.
 * Mirrors the backend bucket logic in listings.ts / rental-public.ts so that
 * URL bookmarks built from old raw values still match the new checkbox state.
 */
export function canonicalFuel(value: string | null | undefined): string {
    if (!value) return '';
    const lower = value.toLowerCase();
    if (lower.includes('plug') && lower.includes('hybryd')) return 'hybrid_plugin';
    if (lower.includes('plug-in')) return 'hybrid_plugin';
    if (lower.startsWith('hybryd') || lower.startsWith('hybrid')) return 'hybrid';
    if (/benzyn.*gaz|benzyn.*lpg|gaz.*benzyn|petrol.*lpg/.test(lower)) return 'petrol_lpg';
    if (lower.startsWith('benzyn') || lower === 'pb' || lower === 'petrol') return 'petrol';
    if (lower.startsWith('diesel') || lower === 'on') return 'diesel';
    if (lower.startsWith('elektry') || lower === 'ev' || lower === 'bev' || lower === 'electric') return 'electric';
    if (lower === 'lpg' || lower === 'gaz') return 'lpg';
    if (lower === 'cng') return 'cng';
    return value;
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
