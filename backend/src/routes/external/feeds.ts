import { FastifyInstance } from 'fastify';

export async function marketingFeedsRoutes(fastify: FastifyInstance) {
    const sanitizeDescription = (str: string | null | undefined): string => {
        if (!str) return '';
        let cleaned = str.replace(/<[^>]*>/g, ' ');
        cleaned = cleaned.replace(/[\r\n\t\s]+/g, ' ');
        return cleaned.trim();
    };

    const escapeXml = (unsafe: string | null | undefined): string => {
        if (!unsafe) return '';
        return unsafe.replace(/[<>&'"]/g, (c) => {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case "'": return '&apos;';
                case '"': return '&quot;';
                default: return c;
            }
        });
    };

    // Generic Commerce Feed Item (no dealer/geolocation dependencies)
    interface UnifiedFeedItem {
        id: string;
        title: string;
        description: string;
        link: string;
        imageLink: string;
        make: string;
        pricePln: number;
        condition: 'new' | 'used';
        financingType: string;
    }

    const getAllActiveFeedItems = async (source: string): Promise<UnifiedFeedItem[]> => {
        const baseUrl = process.env.FRONTEND_URL || 'https://motolia.pl';

        // 1. Fetch Sales & Leasing Listings
        const listings = await fastify.prisma.listing.findMany({
            where: {
                isArchived: false,
            },
        });

        // 2. Fetch Long-Term Rental Vehicles
        const rentalVehicles = await fastify.prisma.rentalVehicle.findMany({
            where: {
                isActive: true,
            },
        });

        const items: UnifiedFeedItem[] = [];
        let skipped = 0;

        for (const l of listings) {
            if (!l.pricePln || !l.make || !l.model) {
                skipped++;
                continue; // Skip incomplete records with no fabricated fallbacks
            }

            const id = String(l.listingId || l.id);
            let title = `${l.make} ${l.model}`;
            if (l.version) title += ` ${l.version}`;

            const desc = l.additionalInfoContent || `Pojazd ${title} w ofercie Motolia.pl`;
            const image = l.primaryImageUrl || (l.imageUrls && l.imageUrls[0]) || `${baseUrl}/brands/motolia/logo.png`;
            const absoluteImage = image.startsWith('/') ? baseUrl + image : image;
            const link = `${baseUrl}/oferta/${l.slug || l.listingId || l.id}?utm_source=${source}&utm_medium=catalog&utm_campaign=feed`;

            items.push({
                id,
                title: sanitizeDescription(title),
                description: sanitizeDescription(desc).substring(0, 4990),
                link,
                imageLink: absoluteImage,
                make: l.make.trim(),
                pricePln: l.pricePln,
                condition: l.condition === 'NEW' ? 'new' : 'used',
                financingType: 'leasing',
            });
        }

        for (const r of rentalVehicles) {
            const price = r.sellingPrice || r.catalogPrice;
            if (!r.make || !r.model || !price) {
                skipped++;
                continue; // Skip incomplete records with no fabricated fallbacks
            }

            const id = `rental-${r.id}`;
            let title = `${r.make} ${r.model}`;
            if (r.version) title += ` ${r.version}`;

            const desc = r.additionalInfoContent || `Wynajem długoterminowy ${title}`;
            const image = r.primaryImageUrl || (r.imageUrls && r.imageUrls[0]) || `${baseUrl}/brands/motolia/logo.png`;
            const absoluteImage = image.startsWith('/') ? baseUrl + image : image;
            const link = `${baseUrl}/wynajem-dlugoterminowy/${r.slug || r.id}?utm_source=${source}&utm_medium=catalog&utm_campaign=feed`;

            const currentYear = new Date().getFullYear();
            const condition: 'new' | 'used' = (r.productionYear && r.productionYear >= currentYear - 1) ? 'new' : 'used';

            items.push({
                id,
                title: sanitizeDescription(title),
                description: sanitizeDescription(desc).substring(0, 4990),
                link,
                imageLink: absoluteImage,
                make: r.make.trim(),
                pricePln: price,
                condition,
                financingType: 'wynajem',
            });
        }

        fastify.log.info(
            { totalListings: listings.length, totalRentals: rentalVehicles.length, skipped, emitted: items.length },
            'Marketing feed generated'
        );

        return items;
    };

    // Handler for Facebook Standard Commerce CSV Feed
    const handleFacebookCsv = async (request: any, reply: any) => {
        try {
            const items = await getAllActiveFeedItems('facebook');
            const headers = [
                'id',
                'title',
                'description',
                'availability',
                'condition',
                'price',
                'link',
                'image_link',
                'brand'
            ];

            let csv = headers.join(',') + '\n';

            const escapeCsv = (str: string | number | null | undefined) => {
                if (str === null || str === undefined) return '';
                const stringified = String(str);
                if (stringified.includes(',') || stringified.includes('"') || stringified.includes('\n')) {
                    return `"${stringified.replace(/"/g, '""')}"`;
                }
                return stringified;
            };

            for (const item of items) {
                const row = [
                    item.id,
                    item.title,
                    item.description,
                    'in stock',
                    item.condition,
                    `${item.pricePln.toFixed(2)} PLN`,
                    item.link,
                    item.imageLink,
                    item.make,
                ];

                csv += row.map(escapeCsv).join(',') + '\n';
            }

            reply.header('Content-Type', 'text/csv; charset=utf-8');
            reply.header('Cache-Control', 'public, max-age=3600');
            return reply.send(csv);
        } catch (error) {
            fastify.log.error(error, 'Error generating Facebook CSV feed');
            return reply.code(500).send({ error: 'Failed to generate feed' });
        }
    };

    // Handler for Google Custom Dynamic Remarketing XML Feed
    const handleGoogleXml = async (request: any, reply: any) => {
        try {
            const items = await getAllActiveFeedItems('google');
            const baseUrl = process.env.FRONTEND_URL || 'https://motolia.pl';

            let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
            xml += `<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">\n`;
            xml += `  <channel>\n`;
            xml += `    <title>Motolia.pl - Katalog Oferty</title>\n`;
            xml += `    <link>${baseUrl}</link>\n`;
            xml += `    <description>Katalog aktywnych ofert samochodów nowe i używane</description>\n`;

            for (const item of items) {
                xml += `    <item>\n`;
                xml += `      <g:id>${escapeXml(item.id)}</g:id>\n`;
                xml += `      <g:title>${escapeXml(item.title)}</g:title>\n`;
                xml += `      <g:description>${escapeXml(item.description)}</g:description>\n`;
                xml += `      <g:link>${escapeXml(item.link)}</g:link>\n`;
                xml += `      <g:image_link>${escapeXml(item.imageLink)}</g:image_link>\n`;
                xml += `      <g:brand>${escapeXml(item.make)}</g:brand>\n`;
                xml += `      <g:price>${item.pricePln.toFixed(2)} PLN</g:price>\n`;
                xml += `      <g:condition>${item.condition}</g:condition>\n`;
                xml += `      <g:availability>in stock</g:availability>\n`;
                xml += `      <g:identifier_exists>no</g:identifier_exists>\n`;
                xml += `      <g:product_type>Samochody &gt; Osobowe</g:product_type>\n`;
                xml += `    </item>\n`;
            }

            xml += `  </channel>\n`;
            xml += `</rss>`;

            reply.header('Content-Type', 'application/xml; charset=utf-8');
            reply.header('Cache-Control', 'public, max-age=3600');
            return reply.send(xml);
        } catch (error) {
            fastify.log.error(error, 'Error generating Google XML feed');
            return reply.code(500).send({ error: 'Failed to generate feed' });
        }
    };

    // Standard API Endpoints
    fastify.get('/api/external/facebook/feed.csv', handleFacebookCsv);
    fastify.get('/api/external/google/feed.xml', handleGoogleXml);
    fastify.get('/api/external/bing/feed.xml', handleGoogleXml);

    // Root Feed Aliases for Meta Business Manager & Google Merchant Center
    fastify.get('/facebook-feed.csv', handleFacebookCsv);
    fastify.get('/google-feed.xml', handleGoogleXml);
    fastify.get('/feed.xml', handleGoogleXml);
}
