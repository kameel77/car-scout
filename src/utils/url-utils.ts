/**
 * Financing type definitions for SEO URL architecture.
 * Each financing type maps to a unique URL prefix segment.
 */
export type FinancingType = 'leasing' | 'kredyt' | 'gotowka' | 'wynajem';

const FINANCING_URL_PREFIX: Record<FinancingType, string> = {
  leasing: '/leasing',
  kredyt: '/kredyt',
  gotowka: '/oferta',
  wynajem: '/wynajem-dlugoterminowy',
};

const DEFAULT_FINANCING_TYPE: FinancingType = 'gotowka';

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
 * Generates listing URL path from listing data.
 * Supports optional financing type for SEO-optimized URL prefixes.
 * 
 * @param listing - Listing object with required fields
 * @param financingType - Optional financing type (defaults to 'gotowka' → /oferta/)
 * @returns URL path (e.g., '/leasing/bmw-3-series-320d-2020-sedan-diesel-abc123')
 */
export function getListingUrlPath(listing: {
  id: string;
  make: string;
  model: string;
  version?: string | null;
  productionYear: number;
  bodyType?: string | null;
  fuelType?: string | null;
}, financingType?: FinancingType): string {
  const slug = generateListingSlug(
    listing.make,
    listing.model,
    listing.version,
    listing.productionYear,
    listing.bodyType,
    listing.fuelType,
    listing.id
  );
  
  const prefix = FINANCING_URL_PREFIX[financingType || DEFAULT_FINANCING_TYPE];
  return `${prefix}/${slug}`;
}

/**
 * Determines the financing type from a URL pathname.
 * 
 * @param path - The URL pathname (e.g., '/leasing/bmw-3-series-abc123')
 * @returns The detected financing type
 */
export function getFinancingTypeFromPath(path: string): FinancingType {
  if (path.startsWith('/leasing/')) return 'leasing';
  if (path.startsWith('/kredyt/')) return 'kredyt';
  if (path.startsWith('/wynajem-dlugoterminowy/')) return 'wynajem';
  return 'gotowka';
}

/**
 * Returns a SHORT label for breadcrumb UI display.
 * Concise for mobile screens — full SEO form goes in JSON-LD and meta tags.
 */
export function getFinancingLabel(type: FinancingType, lang: string = 'pl'): string {
  const labels: Record<FinancingType, Record<string, string>> = {
    leasing: { pl: 'Leasing', en: 'Leasing', de: 'Leasing' },
    kredyt: { pl: 'Kredyt', en: 'Car loan', de: 'Autokredit' },
    gotowka: { pl: 'Oferta', en: 'Offer', de: 'Angebot' },
    wynajem: { pl: 'Wynajem', en: 'Rental', de: 'Miete' },
  };
  return labels[type]?.[lang] || labels[type]?.pl || type;
}

/**
 * Returns the FULL SEO-optimized label for a financing type.
 * Used in meta tags, JSON-LD BreadcrumbList, and structured data
 * to match high-volume search queries (e.g., "kredyt samochodowy").
 */
export function getFinancingSeoLabel(type: FinancingType, lang: string = 'pl'): string {
  const labels: Record<FinancingType, Record<string, string>> = {
    leasing: { pl: 'Leasing samochodowy', en: 'Car leasing', de: 'Fahrzeugleasing' },
    kredyt: { pl: 'Kredyt samochodowy', en: 'Car loan', de: 'Autokredit' },
    gotowka: { pl: 'Oferta', en: 'Offer', de: 'Angebot' },
    wynajem: { pl: 'Wynajem długoterminowy', en: 'Long-term rental', de: 'Langzeitmiete' },
  };
  return labels[type]?.[lang] || labels[type]?.pl || type;
}

/**
 * Generates an SEO-optimized meta title for a listing detail page.
 * Uses keyword-rich patterns per financing type for maximum search visibility.
 * 
 * @example "Kredyt Samochodowy na BMW 3 Series 320d 2024 | Kalkulator Rat | CarSalon"
 * @example "Leasing BMW 3 Series 320d 2024 | Oblicz Ratę | CarSalon"
 */
export function getFinancingMetaTitle(
  type: FinancingType,
  make: string,
  model: string,
  version: string | null | undefined,
  year: number,
  lang: string = 'pl'
): string | null {
  const carName = version ? `${make} ${model} ${version}` : `${make} ${model}`;

  if (type === 'gotowka') return null; // Let default SEO template handle it

  const templates: Record<Exclude<FinancingType, 'gotowka'>, Record<string, string>> = {
    leasing: {
      pl: `Leasing ${carName} ${year} | Oblicz Ratę Online`,
      en: `Lease ${carName} ${year} | Calculate Payments`,
      de: `Leasing ${carName} ${year} | Rate Berechnen`,
    },
    kredyt: {
      pl: `Kredyt Samochodowy na ${carName} ${year} | Kalkulator Rat`,
      en: `Car Loan for ${carName} ${year} | Payment Calculator`,
      de: `Autokredit für ${carName} ${year} | Ratenrechner`,
    },
    wynajem: {
      pl: `Wynajem Długoterminowy ${carName} ${year} | Sprawdź Ofertę`,
      en: `Long-term Rental ${carName} ${year} | Check Offer`,
      de: `Langzeitmiete ${carName} ${year} | Angebot Prüfen`,
    },
  };

  return templates[type]?.[lang] || templates[type]?.pl || null;
}

/**
 * Generates an SEO-optimized meta description for a listing detail page.
 * Rich in keywords for SERP boldface matching and CTR improvement.
 */
export function getFinancingMetaDescription(
  type: FinancingType,
  make: string,
  model: string,
  year: number,
  price: string,
  lang: string = 'pl'
): string | null {
  if (type === 'gotowka') return null; // Let default SEO template handle it

  const templates: Record<Exclude<FinancingType, 'gotowka'>, Record<string, string>> = {
    leasing: {
      pl: `Weź ${make} ${model} ${year} w leasing. Dopasuj wpłatę własną, okres i wysokość raty. Cena od ${price}. Oblicz ratę leasingu online!`,
      en: `Lease a ${make} ${model} ${year} from ${price}. Customize your down payment and lease terms. Calculate your monthly payment online!`,
      de: `${make} ${model} ${year} leasen ab ${price}. Passen Sie Anzahlung und Laufzeit an. Berechnen Sie Ihre Leasingrate online!`,
    },
    kredyt: {
      pl: `Sfinansuj ${make} ${model} ${year} korzystnym kredytem samochodowym. Cena od ${price}. Dopasuj wpłatę własną, sprawdź RRSO i oblicz ratę online!`,
      en: `Finance a ${make} ${model} ${year} with a car loan from ${price}. Adjust your down payment, check APR and calculate payments online!`,
      de: `${make} ${model} ${year} finanzieren ab ${price}. Autokredit berechnen, Anzahlung anpassen und eff. Jahreszins prüfen!`,
    },
    wynajem: {
      pl: `Wynajmij ${make} ${model} ${year} długoterminowo. Cena od ${price}. Sprawdź warunki wynajmu, ubezpieczenie i serwis w cenie!`,
      en: `Rent a ${make} ${model} ${year} long-term from ${price}. Insurance and service included. Check rental conditions!`,
      de: `${make} ${model} ${year} langzeitmieten ab ${price}. Versicherung und Service inklusive. Konditionen prüfen!`,
    },
  };

  return templates[type]?.[lang] || templates[type]?.pl || null;
}

/**
 * Returns the URL prefix for a given financing type.
 * Useful for generating lead/negotiate sub-paths.
 * 
 * @param type - The financing type
 * @returns URL prefix string (e.g., '/leasing')
 */
export function getFinancingUrlPrefix(type: FinancingType): string {
  return FINANCING_URL_PREFIX[type] || FINANCING_URL_PREFIX[DEFAULT_FINANCING_TYPE];
}
