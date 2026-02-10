/**
 * Polish to ASCII transliteration map
 */
const POLISH_CHARS: Record<string, string> = {
  'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n',
  'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
  'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N',
  'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z'
};

/**
 * Transliterates Polish characters to ASCII
 */
function transliteratePolish(text: string): string {
  return text.split('').map(char => POLISH_CHARS[char] || char).join('');
}

/**
 * Sanitizes text for URL slug
 * - Removes special characters
 * - Converts to lowercase
 * - Replaces spaces with hyphens
 * - Removes multiple hyphens
 */
function sanitizeForSlug(text: string): string {
  return transliteratePolish(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generates SEO-friendly slug for a vehicle listing
 * Format: marka-model-trim-rocznik-typ-paliwo-id_ogloszenia
 * 
 * @param make - Vehicle make (e.g., 'BMW')
 * @param model - Vehicle model (e.g., '3 Series')
 * @param version - Vehicle version/trim (e.g., '320d xDrive')
 * @param year - Production year
 * @param bodyType - Body type (e.g., 'sedan')
 * @param fuelType - Fuel type (e.g., 'diesel')
 * @param listingId - Unique listing ID
 * @returns SEO-friendly slug
 */
export function generateListingSlug(
  make: string,
  model: string,
  version: string | null | undefined,
  year: number,
  bodyType: string | null | undefined,
  fuelType: string | null | undefined,
  listingId: string
): string {
  const parts = [
    sanitizeForSlug(make),
    sanitizeForSlug(model),
    version ? sanitizeForSlug(version) : null,
    String(year),
    bodyType ? sanitizeForSlug(bodyType) : null,
    fuelType ? sanitizeForSlug(fuelType) : null,
    listingId
  ].filter(Boolean);

  return parts.join('-');
}

/**
 * Extracts listing ID from a slug
 * Assumes ID is the last segment after the last hyphen
 * 
 * @param slug - The URL slug
 * @returns The listing ID or null if not found
 */
export function extractListingIdFromSlug(slug: string): string | null {
  const parts = slug.split('-');
  const lastPart = parts[parts.length - 1];
  
  // Check if last part looks like a CUID (24 chars, alphanumeric)
  if (lastPart && /^[a-z0-9]{24,}$/i.test(lastPart)) {
    return lastPart;
  }
  
  return null;
}

/**
 * Generates listing URL path from listing data
 * 
 * @param listing - Listing object with required fields
 * @returns URL path (e.g., '/oferta/bmw-3-series-320d-2020-sedan-diesel-abc123')
 */
export function getListingUrlPath(listing: {
  id: string;
  make: string;
  model: string;
  version?: string | null;
  productionYear: number;
  bodyType?: string | null;
  fuelType?: string | null;
}): string {
  const slug = generateListingSlug(
    listing.make,
    listing.model,
    listing.version,
    listing.productionYear,
    listing.bodyType,
    listing.fuelType,
    listing.id
  );
  
  return `/oferta/${slug}`;
}
