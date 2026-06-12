
import { FastifyInstance } from 'fastify';
import { authorizeRoles } from '../middleware/authorize.js';

export async function seoRoutes(fastify: FastifyInstance) {
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
        const today = formatDate(new Date());

        const urls: { loc: string; lastmod: string; changefreq: string; priority: string }[] = [];

        // 1. Static Pages
        const staticPages = [
            { path: '', priority: '1.0' },
            { path: '/samochody', priority: '0.9' },
            { path: '/nowe', priority: '0.8' },
            { path: '/uzywane', priority: '0.8' },
            { path: '/wynajem-dlugoterminowy', priority: '0.9' },
            { path: '/dla-ciebie', priority: '0.8' },
            { path: '/dla-firm', priority: '0.6' },
            { path: '/faq', priority: '0.5' },
            { path: '/kontakt', priority: '0.5' }
        ];

        staticPages.forEach(page => {
            urls.push({
                loc: `${baseUrl}${page.path}`,
                lastmod: today,
                changefreq: 'daily',
                priority: page.priority
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
            where: { isArchived: false },
            select: {
                id: true,
                make: true,
                model: true,
                version: true,
                productionYear: true,
                bodyType: true,
                fuelType: true,
                updatedAt: true
            }
        });

        listings.forEach(listing => {
            const slug = generateListingSlug(listing);
            urls.push({
                loc: `${baseUrl}/oferta/${slug}`,
                lastmod: formatDate(listing.updatedAt),
                changefreq: 'weekly',
                priority: '0.8'
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
                    lastmod: formatDate(rental.updatedAt),
                    changefreq: 'weekly',
                    priority: '0.8'
                });
            }
        });

        // Build XML
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
        
        urls.forEach(url => {
            xml += `  <url>\n`;
            xml += `    <loc>${url.loc}</loc>\n`;
            xml += `    <lastmod>${url.lastmod}</lastmod>\n`;
            xml += `    <changefreq>${url.changefreq}</changefreq>\n`;
            xml += `    <priority>${url.priority}</priority>\n`;
            xml += `  </url>\n`;
        });
        
        xml += `</urlset>`;

        return reply.header('Content-Type', 'application/xml').send(xml);
    });

    // robots.txt — served via nginx proxy at /robots.txt (brand-aware Sitemap line)
    fastify.get('/api/robots.txt', async (_request, reply) => {
        const baseUrl = process.env.FRONTEND_URL?.replace(/\/$/, '') || 'https://carsalon.pl';
        const body = `User-agent: Googlebot
Allow: /
Allow: /api/sitemap.xml
Disallow: /login
Disallow: /api/
Disallow: /nowy/podglad/
Disallow: /storage/

User-agent: Bingbot
Allow: /
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
Allow: /api/sitemap.xml
Disallow: /login
Disallow: /api/
Disallow: /nowy/podglad/
Disallow: /storage/

User-agent: *
Allow: /
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
        return reply.header('Content-Type', 'text/plain; charset=utf-8').send(body);
    });
}
