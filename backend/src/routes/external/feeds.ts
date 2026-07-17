import { FastifyInstance } from 'fastify';

export async function marketingFeedsRoutes(fastify: FastifyInstance) {
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

            const cleanTitle = escapeXml(title);
            
            // Construct simple description
            let desc = listing.additionalInfoContent || `Pojazd ${cleanTitle}`;
            if (desc.length > 5000) desc = desc.substring(0, 4997) + '...';
            const cleanDesc = escapeXml(desc);

            const condition = listing.condition === 'NEW' ? 'new' : 'used';
            
            // Add UTM parameters based on source
            const link = `${baseUrl}/oferty/${listing.slug}?utm_source=${source}&utm_medium=catalog&utm_campaign=feed`;
            
            const imageLink = listing.primaryImageUrl ? escapeXml(listing.primaryImageUrl) : '';

            xml += `    <item>\n`;
            xml += `      <g:id>${escapeXml(id)}</g:id>\n`;
            xml += `      <g:title>${cleanTitle}</g:title>\n`;
            xml += `      <g:description>${cleanDesc}</g:description>\n`;
            xml += `      <g:availability>in stock</g:availability>\n`;
            xml += `      <g:condition>${condition}</g:condition>\n`;
            xml += `      <g:price>${listing.pricePln}.00 PLN</g:price>\n`;
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

    fastify.get('/api/external/facebook/feed.xml', async (request, reply) => {
        try {
            const xml = await generateXmlFeed('facebook');
            reply.header('Content-Type', 'application/xml');
            reply.header('Cache-Control', 'public, max-age=3600');
            return reply.send(xml);
        } catch (error) {
            fastify.log.error(error, 'Error generating Facebook XML feed');
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
