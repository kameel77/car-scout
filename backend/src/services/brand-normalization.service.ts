/**
 * Standardizes car brand names for consistency across the application.
 * This handles common variants, accents, and casing.
 */

const BRAND_CANONICAL_MAP: Record<string, string> = {
    'citroen': 'Citroën',
    'citroën': 'Citroën',
    'skoda': 'Škoda',
    'škoda': 'Škoda',
    'mercedes': 'Mercedes-Benz',
    'mercedes benz': 'Mercedes-Benz',
    'mercedes-benz': 'Mercedes-Benz',
    'volkswagen': 'Volkswagen',
    'vw': 'Volkswagen',
    'alfa romeo': 'Alfa Romeo',
    'land rover': 'Land Rover',
    'aston martin': 'Aston Martin',
    'ds': 'DS Automobiles',
    'ds automobiles': 'DS Automobiles',
    'ssangyong': 'SsangYong/KGM',
    'kgm': 'SsangYong/KGM',
    'ssangyong/kgm': 'SsangYong/KGM',
    'hyundai': 'Hyundai',
    'toyota': 'Toyota',
    'peugeot': 'Peugeot',
    'renault': 'Renault',
    'opel': 'Opel',
    'ford': 'Ford',
    'fiat': 'Fiat',
    'audi': 'Audi',
    'bmw': 'BMW',
    'kia': 'Kia',
    'mazda': 'Mazda',
    'nissan': 'Nissan',
    'suzuki': 'Suzuki',
    'volvo': 'Volvo',
    'porsche': 'Porsche',
    'seat': 'Seat',
    'cupra': 'Cupra',
    'mg': 'MG',
    'omoda': 'Omoda',
    'jaecoo': 'Jaecoo',
    'chery': 'Chery',
    'baic': 'Baic',
    'jac': 'JAC',
};

/**
 * Normalizes a brand name.
 * 1. Trims whitespace
 * 2. Standardizes case for comparison (lowercase)
 * 3. Checks against canonical map
 * 4. Fallback: Title Case
 */
export function normalizeBrand(brand: string | null | undefined): string {
    if (!brand) return 'Inne';
    
    const trimmed = brand.trim();
    if (!trimmed) return 'Inne';

    const lower = trimmed.toLowerCase();
    
    // Check canonical map
    if (BRAND_CANONICAL_MAP[lower]) {
        return BRAND_CANONICAL_MAP[lower];
    }

    // Default: Title Case (e.g. "FERRARI" -> "Ferrari", "alfa romeo" -> "Alfa Romeo")
    // For brands with spaces, we capitalize each word.
    return trimmed
        .split(/\s+/)
        .map(word => {
            if (word.length === 0) return '';
            // Handle cases like "MG" or "JAC" - if it's all uppercase and short, keep it?
            // But usually Title Case is safer.
            if (word.length <= 3 && word === word.toUpperCase()) return word;
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' ');
}

/**
 * Normalizes a model name (basic trim and title case).
 */
export function normalizeModel(model: string | null | undefined): string {
    if (!model) return 'Inne';
    const trimmed = model.trim();
    if (!trimmed) return 'Inne';
    return trimmed; // Models are often more complex (numbers, letters), so just trim.
}
