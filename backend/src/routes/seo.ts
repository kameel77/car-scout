
import { FastifyInstance } from 'fastify';
import { authorizeRoles } from '../middleware/authorize.js';
import { resolveBrandCtx } from '../services/seo-meta.js';
import { generateListingSlug as buildListingSlug } from '../utils/url-utils.js';
import { getFinancingArticle } from '../content/financing-content.js';

export async function seoRoutes(fastify: FastifyInstance) {
    // Treść filarowa stron finansowania dla frontendu (sekcja pod listingiem), per brand
    fastify.get('/api/content/financing/:type', async (request, reply) => {
        const { type } = request.params as { type: string };
        const path = { leasing: '/leasing', kredyt: '/kredyt', wynajem: '/wynajem-dlugoterminowy' }[type];
        const article = path ? getFinancingArticle(resolveBrandCtx().brand, path) : undefined;
        if (!article) {
            return reply.status(404).send({ error: 'Unknown financing content type' });
        }
        reply.header('Cache-Control', 'public, max-age=3600');
        return article;
    });

    // Get SEO Config
    fastify.get('/api/seo', async () => {
        const config = await fastify.prisma.seoConfig.findUnique({
            where: { id: 'default' }
        });
        // Return empty object if not found, or default structure
        return config || { id: 'default' };
    });

    // Update SEO Config
    fastify.put('/api/seo', {
        preHandler: [fastify.authenticate, authorizeRoles(['admin', 'manager'])]
    }, async (request, reply) => {
        const data = request.body as any;

        // Basic validation could be added here if needed

        const config = await fastify.prisma.seoConfig.upsert({
            where: { id: 'default' },
            update: {
                gtmId: data.gtmId,
                clarityId: data.clarityId,
                homeTitle: data.homeTitle,
                homeTitleEn: data.homeTitleEn,
                homeTitleDe: data.homeTitleDe,
                homeDescription: data.homeDescription,
                homeDescriptionEn: data.homeDescriptionEn,
                homeDescriptionDe: data.homeDescriptionDe,
                homeOgImage: data.homeOgImage,
                listingTitle: data.listingTitle,
                listingTitleEn: data.listingTitleEn,
                listingTitleDe: data.listingTitleDe,
                listingDescription: data.listingDescription,
                listingDescriptionEn: data.listingDescriptionEn,
                listingDescriptionDe: data.listingDescriptionDe
            },
            create: {
                id: 'default',
                gtmId: data.gtmId,
                clarityId: data.clarityId,
                homeTitle: data.homeTitle,
                homeTitleEn: data.homeTitleEn,
                homeTitleDe: data.homeTitleDe,
                homeDescription: data.homeDescription,
                homeDescriptionEn: data.homeDescriptionEn,
                homeDescriptionDe: data.homeDescriptionDe,
                homeOgImage: data.homeOgImage,
                listingTitle: data.listingTitle,
                listingTitleEn: data.listingTitleEn,
                listingTitleDe: data.listingTitleDe,
                listingDescription: data.listingDescription,
                listingDescriptionEn: data.listingDescriptionEn,
                listingDescriptionDe: data.listingDescriptionDe
            }
        });

        return config;
    });

    // Sitemap generation
    fastify.get('/api/sitemap.xml', async (request, reply) => {
        const baseUrl = process.env.FRONTEND_URL?.replace(/\/$/, '') || 'https://carsalon.pl';
        
        // Helper to format dates
        const formatDate = (date: Date) => date.toISOString().split('T')[0];

        const urls: { loc: string; lastmod?: string; image?: { loc: string } }[] = [];

        // 1. Static Pages (bez lastmod — brak realnej daty modyfikacji jest lepszy niż fałszywy sygnał)
        const staticPages = [
            '', '/samochody', '/nowe', '/uzywane', '/wynajem-dlugoterminowy',
            '/leasing', '/kredyt', '/dla-ciebie', '/dla-firm', '/faq', '/kontakt'
        ];

        staticPages.forEach(path => {
            urls.push({
                loc: `${baseUrl}${path}`
            });
        });

        // Slug generation helpers (must match frontend url-utils.ts)
        const POLISH_CHARS: Record<string, string> = {
            'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n',
            'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
            'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N',
            'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z'
        };

        const transliteratePolish = (text: string) => 
            text.split('').map(char => POLISH_CHARS[char] || char).join('');

        const sanitizeForSlug = (text: string) => 
            transliteratePolish(text)
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .trim()
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-+|-+$/g, '');

        const generateListingSlug = (l: any) => {
            const parts = [
                sanitizeForSlug(l.make),
                sanitizeForSlug(l.model),
                l.version ? sanitizeForSlug(l.version) : null,
                String(l.productionYear),
                l.bodyType ? sanitizeForSlug(l.bodyType) : null,
                l.fuelType ? sanitizeForSlug(l.fuelType) : null,
                l.id
            ].filter(Boolean);
            return parts.join('-');
        };

        // 2. Dynamic Pages: Listings
        const listings = await fastify.prisma.listing.findMany({
            where: { isArchived: false, pricePln: { gt: 0 } },
            select: {
                id: true,
                make: true,
                model: true,
                version: true,
                productionYear: true,
                bodyType: true,
                fuelType: true,
                primaryImageUrl: true,
                updatedAt: true
            }
        });

        // image:loc musi być absolutnym URL-em; & itp. escapujemy przy budowie XML
        const toAbsolute = (url: string) =>
            url.startsWith('http') ? url : `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;

        listings.forEach(listing => {
            const slug = generateListingSlug(listing);
            urls.push({
                loc: `${baseUrl}/oferta/${slug}`,
                lastmod: formatDate(listing.updatedAt),
                image: listing.primaryImageUrl ? { loc: toAbsolute(listing.primaryImageUrl) } : undefined
            });
        });

        // 3. Dynamic Pages: Rental Vehicles
        const rentals = await fastify.prisma.rentalVehicle.findMany({
            where: { isActive: true },
            select: { slug: true, updatedAt: true }
        });

        rentals.forEach(rental => {
            if (rental.slug) {
                urls.push({
                    loc: `${baseUrl}/wynajem-dlugoterminowy/${rental.slug}`,
                    lastmod: formatDate(rental.updatedAt)
                });
            }
        });

        // Build XML
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;
        
        urls.forEach(url => {
            xml += `  <url>\n`;
            xml += `    <loc>${url.loc}</loc>\n`;
            if (url.lastmod) {
                xml += `    <lastmod>${url.lastmod}</lastmod>\n`;
            }
            if (url.image) {
                const imageLoc = url.image.loc.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                xml += `    <image:image>\n`;
                xml += `      <image:loc>${imageLoc}</image:loc>\n`;
                xml += `    </image:image>\n`;
            }
            xml += `  </url>\n`;
        });
        
        xml += `</urlset>`;

        return reply.header('Content-Type', 'application/xml').send(xml);
    });

    // robots.txt — served via nginx proxy at /robots.txt (brand-aware Sitemap line)
    fastify.get('/api/robots.txt', async (_request, reply) => {
        const baseUrl = process.env.FRONTEND_URL?.replace(/\/$/, '') || 'https://carsalon.pl';
        const body = `User-agent: *
Content-Signal: search=yes, ai-input=yes, ai-train=no

User-agent: Googlebot
Allow: /
Allow: /api/settings
Allow: /api/seo
Allow: /api/translations
Allow: /api/listings
Allow: /api/widgets/render
Allow: /api/faq
Allow: /api/feature-tiles
Allow: /api/geo
Allow: /api/rental-public
Allow: /api/sitemap.xml
Disallow: /login
Disallow: /api/
Disallow: /nowy/podglad/
Disallow: /storage/

User-agent: Bingbot
Allow: /
Allow: /api/settings
Allow: /api/seo
Allow: /api/translations
Allow: /api/listings
Allow: /api/widgets/render
Allow: /api/faq
Allow: /api/feature-tiles
Allow: /api/geo
Allow: /api/rental-public
Allow: /api/sitemap.xml
Disallow: /login
Disallow: /api/
Disallow: /nowy/podglad/
Disallow: /storage/

User-agent: Twitterbot
Allow: /

User-agent: facebookexternalhit
Allow: /

User-agent: YandexBot
Disallow: /

User-agent: SemrushBot
Crawl-delay: 10
Allow: /
Allow: /api/settings
Allow: /api/seo
Allow: /api/translations
Allow: /api/listings
Allow: /api/widgets/render
Allow: /api/faq
Allow: /api/feature-tiles
Allow: /api/geo
Allow: /api/rental-public
Allow: /api/sitemap.xml
Disallow: /login
Disallow: /api/
Disallow: /nowy/podglad/
Disallow: /storage/

User-agent: *
Allow: /
Allow: /api/settings
Allow: /api/seo
Allow: /api/translations
Allow: /api/listings
Allow: /api/widgets/render
Allow: /api/faq
Allow: /api/feature-tiles
Allow: /api/geo
Allow: /api/rental-public
Allow: /api/sitemap.xml
Disallow: /login
Disallow: /api/
Disallow: /nowy/podglad/
Disallow: /storage/
Disallow: /wordpress/
Disallow: /backup/
Disallow: /wp/
Disallow: /old/
Disallow: /new/

Sitemap: ${baseUrl}/sitemap.xml
`;
        return reply.type('text/plain').send(body);
    });

    fastify.get('/api/llms.txt', async (request, reply) => {
        const ctx = resolveBrandCtx();
        const listingsCount = await fastify.prisma.listing.count({ where: { isArchived: false, pricePln: { gt: 0 } } });

        const body = `
# ${ctx.brandName} - Motoryzacyjny Marketplace

> Twoje źródło najlepszych ofert samochodów osobowych, leasingu i wynajmu długoterminowego.

## Podstawowe informacje
- **URL:** ${ctx.baseUrl}
- **Oferty:** ~${listingsCount} aktywnych ogłoszeń
- **Sitemap:** ${ctx.baseUrl}/sitemap.xml

## Główne sekcje
- [Wszystkie samochody](${ctx.baseUrl}/samochody)
- [Wynajem długoterminowy](${ctx.baseUrl}/wynajem-dlugoterminowy)
- [Leasing](${ctx.baseUrl}/leasing)
- [Kredyt](${ctx.baseUrl}/kredyt)
- [Kontakt](${ctx.baseUrl}/kontakt)

## Pełna lista ofert (dla AI)
Pełny spis wszystkich aktualnych ofert znajduje się pod adresem: [${ctx.baseUrl}/llms-full.txt](${ctx.baseUrl}/llms-full.txt)
`.trim();

        return reply.type('text/plain').send(body);
    });

    fastify.get('/api/llms-full.txt', async (request, reply) => {
        const ctx = resolveBrandCtx();
        const listings = await fastify.prisma.listing.findMany({
            where: { isArchived: false, pricePln: { gt: 0 } },
            take: 2000, // Limit for sanity, though standard says no strict limit
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                make: true,
                model: true,
                version: true,
                productionYear: true,
                pricePln: true,
                bodyType: true,
                fuelType: true,
            }
        });

        const lines = listings.map(l => {
            const name = [l.make, l.model, l.version, `(${l.productionYear})`].filter(Boolean).join(' ');
            const slug = buildListingSlug(l.make, l.model, l.version, l.productionYear, l.bodyType, l.fuelType, l.id);
            return `- [${name}](${ctx.baseUrl}/oferta/${slug}) - ${l.pricePln.toLocaleString('pl-PL')} PLN`;
        });

        const body = `
# Pełna lista ofert ${ctx.brandName}

Ostatnia aktualizacja: ${new Date().toISOString()}

${lines.join('\n')}
`.trim();

        return reply.type('text/plain').send(body);
    });
}
