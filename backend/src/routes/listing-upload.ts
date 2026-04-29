import { FastifyInstance } from 'fastify';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.resolve(__dirname, '../../uploads');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function generateFilename(originalName: string): string {
    const ext = path.extname(originalName).toLowerCase();
    const hash = crypto.randomBytes(8).toString('hex');
    return `${Date.now()}-${hash}${ext}`;
}

export async function listingUploadRoutes(fastify: FastifyInstance) {
    fastify.post('/api/listings/:id/images', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const { id } = request.params as { id: string };

        const listing = await fastify.prisma.listing.findUnique({ where: { id } });
        if (!listing) {
            return reply.code(404).send({ error: 'Listing not found' });
        }

        const parts = request.parts();
        const uploadedUrls: string[] = [];
        let setPrimary = false;

        const listingDir = path.join(uploadsRoot, 'listing-images', id);
        await fs.mkdir(listingDir, { recursive: true });

        for await (const part of parts) {
            if (part.type === 'field') {
                if (part.fieldname === 'setPrimary') {
                    setPrimary = part.value === 'true';
                }
                continue;
            }
            if (part.type !== 'file') continue;

            if (!ALLOWED_MIME_TYPES.includes(part.mimetype)) {
                return reply.code(400).send({ error: `Unsupported MIME: ${part.mimetype}` });
            }

            const filename = generateFilename(part.filename);
            const filepath = path.join(listingDir, filename);
            await pipeline(part.file, createWriteStream(filepath));

            const stats = await fs.stat(filepath);
            if (stats.size > MAX_FILE_SIZE) {
                await fs.unlink(filepath);
                return reply.code(413).send({ error: 'File too large (max 10MB)' });
            }

            uploadedUrls.push(`/uploads/listing-images/${id}/${filename}`);
        }

        const newImageUrls = [...(listing.imageUrls || []), ...uploadedUrls];
        const newPrimary = setPrimary && uploadedUrls.length > 0
            ? uploadedUrls[0]
            : listing.primaryImageUrl;

        const updated = await fastify.prisma.listing.update({
            where: { id },
            data: {
                imageUrls: newImageUrls,
                primaryImageUrl: newPrimary,
                imageCount: newImageUrls.length,
                lastManualEditAt: new Date(),
            },
        });

        return reply.send({ listing: updated, uploadedUrls });
    });

    fastify.delete('/api/listings/:id/images', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { url } = request.body as { url: string };

        if (!url) {
            return reply.code(400).send({ error: 'url is required' });
        }

        const listing = await fastify.prisma.listing.findUnique({ where: { id } });
        if (!listing) {
            return reply.code(404).send({ error: 'Listing not found' });
        }

        const newImageUrls = (listing.imageUrls || []).filter(u => u !== url);
        const newPrimary = listing.primaryImageUrl === url
            ? (newImageUrls[0] || null)
            : listing.primaryImageUrl;

        if (url.startsWith('/uploads/listing-images/')) {
            const filepath = path.join(uploadsRoot, url.replace('/uploads/', ''));
            try {
                await fs.unlink(filepath);
            } catch {
                // file already gone — ignore
            }
        }

        const updated = await fastify.prisma.listing.update({
            where: { id },
            data: {
                imageUrls: newImageUrls,
                primaryImageUrl: newPrimary,
                imageCount: newImageUrls.length,
                lastManualEditAt: new Date(),
            },
        });

        return reply.send({ listing: updated });
    });
}
