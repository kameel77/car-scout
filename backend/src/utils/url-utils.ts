/**
 * Detects the marketplace name from a listing URL.
 * 
 * @param url The URL of the listing
 * @returns The marketplace name (e.g., 'otomoto', 'olx', 'allegro', 'mobile.de', 'autoscout24') or null if not detected.
 */
export function getMarketplaceFromUrl(url: string | null | undefined): string | null {
    if (!url) return null;

    const lowerUrl = url.toLowerCase();

    if (lowerUrl.includes('otomoto.pl')) return 'otomoto';
    if (lowerUrl.includes('olx.pl')) return 'olx';
    if (lowerUrl.includes('allegro.pl')) return 'allegro';
    if (lowerUrl.includes('mobile.de')) return 'mobile.de';
    if (lowerUrl.includes('autoscout24')) return 'autoscout24';
    if (lowerUrl.includes('facebook.com')) return 'facebook';

    // Add more patterns as needed

    return null;
}
