import { FastifyInstance } from 'fastify';

export async function marketingFeedsRoutes(fastify: FastifyInstance) {
    // Helper function to sanitize descriptions and titles
    const sanitizeDescription = (str: string | null | undefined): string => {
        if (!str) return '';
        // Strip HTML tags
        let cleaned = str.replace(/<[^>]*>/g, ' ');
        // Replace newlines, carriage returns, tabs, and multiple spaces with a single space
        cleaned = cleaned.replace(/[\r\n\t\s]+/g, ' ');
        return cleaned.trim();
    };

    // Helper function to generate XML for Google Base / RSS 2.0 compatible feeds
    const generateXmlFeed = async (source: string) => {
        const listings = await fastify.prisma.listing.findMany({
            where: {
                isArchived: false
            },
            select: {
                id: true,
                listingId: true,
                vin: true,
                make: true,
                model: true,
                version: true,
                pricePln: true,
                condition: true,
                primaryImageUrl: true,
                slug: true,
                additionalInfoContent: true
            }
        });

        const baseUrl = process.env.FRONTEND_URL || 'https://motolia.pl';

        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">\n`;
        xml += `  <channel>\n`;
        xml += `    <title>Motolia.pl - Katalog Pojazdów</title>\n`;
        xml += `    <link>${baseUrl}</link>\n`;
        xml += `    <description>Katalog aktywnych ofert Motolia</description>\n`;

        for (const listing of listings) {
            if (!listing.pricePln || !listing.make || !listing.model) {
                continue; // skip incomplete records
            }

            const id = listing.listingId || listing.vin || listing.id;
            let title = `${listing.make} ${listing.model}`;
            if (listing.version) {
                title += ` ${listing.version}`;
            }
            
            // Escape special characters for XML
            const escapeXml = (unsafe: string) => {
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

            const cleanTitle = escapeXml(sanitizeDescription(title));
            
            // Construct simple description
            let desc = listing.additionalInfoContent || `Pojazd ${title}`;
            const sanitizedDesc = sanitizeDescription(desc);
            const truncatedDesc = sanitizedDesc.length > 5000 ? sanitizedDesc.substring(0, 4997) + '...' : sanitizedDesc;
            const cleanDesc = escapeXml(truncatedDesc);

            const condition = listing.condition === 'NEW' ? 'new' : 'used';
            
            // Add UTM parameters based on source
            const link = `${baseUrl}/oferty/${listing.slug}?utm_source=${source}&utm_medium=catalog&utm_campaign=feed`;
            
            const rawImageLink = listing.primaryImageUrl || '';
            const absoluteImageLink = rawImageLink ? (rawImageLink.startsWith('/') ? baseUrl + rawImageLink : rawImageLink) : '';
            const imageLink = absoluteImageLink ? escapeXml(absoluteImageLink) : '';

            const priceNum = typeof listing.pricePln === 'number' ? listing.pricePln : Number(listing.pricePln);
            const formattedPrice = `${priceNum.toFixed(2)} PLN`;

            xml += `    <item>\n`;
            xml += `      <g:id>${escapeXml(id)}</g:id>\n`;
            xml += `      <g:title>${cleanTitle}</g:title>\n`;
            xml += `      <g:description>${cleanDesc}</g:description>\n`;
            xml += `      <g:availability>in stock</g:availability>\n`;
            xml += `      <g:condition>${condition}</g:condition>\n`;
            xml += `      <g:price>${formattedPrice}</g:price>\n`;
            xml += `      <g:link>${escapeXml(link)}</g:link>\n`;
            if (imageLink) {
                xml += `      <g:image_link>${imageLink}</g:image_link>\n`;
            }
            xml += `      <g:brand>${escapeXml(listing.make)}</g:brand>\n`;
            xml += `    </item>\n`;
        }

        xml += `  </channel>\n`;
        xml += `</rss>`;

        return xml;
    };

    // Helper function to generate CSV for Facebook Automotive Inventory
    const generateCsvFeed = async (source: string) => {
        const listings = await fastify.prisma.listing.findMany({
            where: {
                isArchived: false
            },
            select: {
                id: true,
                listingId: true,
                vin: true,
                make: true,
                model: true,
                version: true,
                pricePln: true,
                condition: true,
                primaryImageUrl: true,
                slug: true,
                additionalInfoContent: true,
                productionYear: true,
                mileageKm: true,
                transmission: true,
                bodyType: true
            }
        });

        const baseUrl = process.env.FRONTEND_URL || 'https://motolia.pl';

        const headers = [
            'vehicle_id',
            'vehicle_offer_id',
            'title',
            'description',
            'url',
            'make',
            'model',
            'year',
            'mileage.value',
            'mileage.unit',
            'image[0].url',
            'image',
            'image_link',
            'transmission',
            'body_style',
            'state_of_vehicle',
            'price'
        ];

        let csv = headers.join(',') + '\n';

        const brandName = process.env.BRAND || 'carsalon';
        const fallbackImage = `${baseUrl}/brands/${brandName}/logo.png`;

        for (const listing of listings) {
            if (!listing.pricePln || !listing.make || !listing.model || !listing.productionYear) {
                continue; // skip incomplete records
            }

            const id = listing.listingId || listing.vin || listing.id;
            let title = `${listing.make} ${listing.model}`;
            if (listing.version) {
                title += ` ${listing.version}`;
            }

            let desc = listing.additionalInfoContent || `Pojazd ${title}`;
            const sanitizedDesc = sanitizeDescription(desc);
            const truncatedDesc = sanitizedDesc.length > 5000 ? sanitizedDesc.substring(0, 4997) + '...' : sanitizedDesc;

            const condition = listing.condition === 'NEW' ? 'NEW' : 'USED';
            const link = `${baseUrl}/oferty/${listing.slug}?utm_source=${source}&utm_medium=catalog&utm_campaign=feed`;
            
            const rawImageLink = listing.primaryImageUrl || '';
            let imageLink = rawImageLink ? (rawImageLink.startsWith('/') ? baseUrl + rawImageLink : rawImageLink) : '';
            if (!imageLink) {
                imageLink = fallbackImage;
            }

            const priceNum = typeof listing.pricePln === 'number' ? listing.pricePln : Number(listing.pricePln);
            const formattedPrice = `${priceNum.toFixed(2)} PLN`;

            let mileage = listing.mileageKm || 0;
            if (condition === 'USED' && mileage <= 0) {
                mileage = 1; // used cars must have mileage > 0
            }
            
            // Map transmission to FB accepted values
            const getTransmission = (raw: string | null | undefined): string => {
                if (!raw) return 'other';
                const lower = raw.toLowerCase();
                if (lower.includes('manual')) return 'manual';
                if (lower.includes('automat')) return 'automatic';
                if (lower.includes('półautomat') || lower.includes('semi')) return 'semi-automatic';
                return 'other';
            };

            // Map body styles to FB accepted values
            const getBodyStyle = (raw: string | null | undefined): string => {
                if (!raw) return 'other';
                const lower = raw.toLowerCase();
                if (lower.includes('suv')) return 'suv';
                if (lower.includes('kombi') || lower.includes('wagon')) return 'wagon';
                if (lower.includes('kabriolet') || lower.includes('convertible')) return 'convertible';
                if (lower.includes('coupe')) return 'coupe';
                if (lower.includes('sedan') || lower.includes('limuzyna')) return 'sedan';
                if (lower.includes('van') || lower.includes('minibus') || lower.includes('mpv')) return 'van';
                if (lower.includes('pickup') || lower.includes('furgon') || lower.includes('skrzynia') || lower.includes('doka') || lower.includes('chłodnia')) return 'truck';
                if (lower.includes('kompakt') || lower.includes('liftback') || lower.includes('miejskie') || lower.includes('małe') || lower.includes('hatchback')) return 'hatchback';
                return 'other';
            };

            const bodyStyle = getBodyStyle(listing.bodyType);
            const transmission = getTransmission(listing.transmission);

            const escapeCsv = (str: string | number | null | undefined) => {
                if (str === null || str === undefined) return '';
                const stringified = String(str);
                if (stringified.includes(',') || stringified.includes('"')) {
                    return `"${stringified.replace(/"/g, '""')}"`;
                }
                return stringified;
            };

            const row = [
                id,          // vehicle_id
                id,          // vehicle_offer_id
                sanitizeDescription(title),
                truncatedDesc,
                link,
                listing.make.trim(),
                listing.model.trim(),
                listing.productionYear,
                mileage,
                'KM',
                imageLink,   // image[0].url
                imageLink,   // image
                imageLink,   // image_link
                transmission,
                bodyStyle,
                condition,
                formattedPrice
            ];

            csv += row.map(escapeCsv).join(',') + '\n';
        }

        return csv;
    };

    fastify.get('/api/external/facebook/feed.csv', async (request, reply) => {
        try {
            const csv = await generateCsvFeed('facebook');
            reply.header('Content-Type', 'text/csv');
            reply.header('Cache-Control', 'public, max-age=3600');
            return reply.send(csv);
        } catch (error) {
            fastify.log.error(error, 'Error generating Facebook CSV feed');
            return reply.code(500).send({ error: 'Failed to generate feed' });
        }
    });

    fastify.get('/api/external/google/feed.xml', async (request, reply) => {
        try {
            const xml = await generateXmlFeed('google');
            reply.header('Content-Type', 'application/xml');
            reply.header('Cache-Control', 'public, max-age=3600');
            return reply.send(xml);
        } catch (error) {
            fastify.log.error(error, 'Error generating Google XML feed');
            return reply.code(500).send({ error: 'Failed to generate feed' });
        }
    });

    fastify.get('/api/external/bing/feed.xml', async (request, reply) => {
        try {
            const xml = await generateXmlFeed('bing');
            reply.header('Content-Type', 'application/xml');
            reply.header('Cache-Control', 'public, max-age=3600');
            return reply.send(xml);
        } catch (error) {
            fastify.log.error(error, 'Error generating Bing XML feed');
            return reply.code(500).send({ error: 'Failed to generate feed' });
        }
    });
}
