import { FastifyInstance } from 'fastify';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import crypto from 'crypto';
import { optimizeAndSaveImage } from '../services/image-optimizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.resolve(__dirname, '../../uploads');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
const ALLOWED_PDF_MIME = ['application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function generateFilename(originalName: string): string {
    const ext = path.extname(originalName).toLowerCase();
    const hash = crypto.randomBytes(8).toString('hex');
    return `${Date.now()}-${hash}${ext}`;
}

function generateBaseFilename(): string {
    const hash = crypto.randomBytes(8).toString('hex');
    return `${Date.now()}-${hash}`;
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

            const buffer = await part.toBuffer();
            if (buffer.length > MAX_FILE_SIZE) {
                return reply.code(413).send({ error: 'File too large (max 10MB)' });
            }

            const baseFilename = generateBaseFilename();
            const { largeFilename } = await optimizeAndSaveImage(buffer, {
                targetDir: listingDir,
                baseFilename,
            });

            uploadedUrls.push(`/uploads/listing-images/${id}/${largeFilename}`);
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
            const thumbPath = filepath.replace('.webp', '-thumb.webp'); // Usuwamy też miniaturę, jeśli istnieje
            try {
                await fs.unlink(filepath);
                await fs.unlink(thumbPath).catch(() => {});
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

    // Set primary image
    fastify.patch('/api/listings/:id/images/primary', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { url } = request.body as { url: string };

        if (!url) return reply.code(400).send({ error: 'url is required' });

        const listing = await fastify.prisma.listing.findUnique({ where: { id } });
        if (!listing) return reply.code(404).send({ error: 'Listing not found' });

        if (!(listing.imageUrls || []).includes(url)) {
            return reply.code(400).send({ error: 'URL not in image list' });
        }

        const updated = await fastify.prisma.listing.update({
            where: { id },
            data: { primaryImageUrl: url, lastManualEditAt: new Date() },
        });

        return reply.send({ listing: updated });
    });

    // Add image by URL (external link, no file upload)
    fastify.post('/api/listings/:id/images/url', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { url } = request.body as { url: string };

        if (!url) return reply.code(400).send({ error: 'url is required' });

        const listing = await fastify.prisma.listing.findUnique({ where: { id } });
        if (!listing) return reply.code(404).send({ error: 'Listing not found' });

        const newUrls = [...(listing.imageUrls || []), url];
        const newPrimary = listing.primaryImageUrl || url;

        const updated = await fastify.prisma.listing.update({
            where: { id },
            data: {
                imageUrls: newUrls,
                primaryImageUrl: newPrimary,
                imageCount: newUrls.length,
                lastManualEditAt: new Date(),
            },
        });

        return reply.send({ listing: updated });
    });

    // Reorder images
    fastify.patch('/api/listings/:id/images/reorder', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { imageUrls } = request.body as { imageUrls: string[] };

        if (!Array.isArray(imageUrls)) return reply.code(400).send({ error: 'imageUrls must be an array' });

        const listing = await fastify.prisma.listing.findUnique({ where: { id } });
        if (!listing) return reply.code(404).send({ error: 'Listing not found' });

        const updated = await fastify.prisma.listing.update({
            where: { id },
            data: {
                imageUrls,
                imageCount: imageUrls.length,
                lastManualEditAt: new Date(),
            },
        });

        return reply.send({ listing: updated });
    });

    // Upload specification PDF for a listing
    fastify.post('/api/listings/:id/specs', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const { id } = request.params as { id: string };

        const listing = await fastify.prisma.listing.findUnique({ where: { id } });
        if (!listing) return reply.code(404).send({ error: 'Listing not found' });

        const parts = request.parts();
        let uploadedUrl: string | null = null;

        const specDir = path.join(uploadsRoot, 'listing-specs', id);
        await fs.mkdir(specDir, { recursive: true });

        for await (const part of parts) {
            if (part.type !== 'file') continue;

            if (!ALLOWED_PDF_MIME.includes(part.mimetype)) {
                return reply.code(400).send({ error: `Unsupported MIME: ${part.mimetype}. Only PDF allowed.` });
            }

            const filename = generateFilename(part.filename || 'spec.pdf');
            const filepath = path.join(specDir, filename);
            await pipeline(part.file, createWriteStream(filepath));

            const stats = await fs.stat(filepath);
            if (stats.size > MAX_FILE_SIZE) {
                await fs.unlink(filepath);
                return reply.code(413).send({ error: 'File too large (max 10MB)' });
            }

            // Remove old spec file if it was uploaded
            if (listing.specificationUrl?.startsWith('/uploads/listing-specs/')) {
                const oldPath = path.join(uploadsRoot, listing.specificationUrl.replace('/uploads/', ''));
                try { await fs.unlink(oldPath); } catch { /* ignore */ }
            }

            uploadedUrl = `/uploads/listing-specs/${id}/${filename}`;
            break; // only first file
        }

        if (!uploadedUrl) {
            return reply.code(400).send({ error: 'No file uploaded' });
        }

        const updated = await fastify.prisma.listing.update({
            where: { id },
            data: { specificationUrl: uploadedUrl, lastManualEditAt: new Date() },
        });

        return reply.send({ listing: updated, specificationUrl: uploadedUrl });
    });

    // Save spec URL (external link) or clear it for a listing
    fastify.patch('/api/listings/:id/specs', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { specificationUrl } = request.body as { specificationUrl: string | null };

        const listing = await fastify.prisma.listing.findUnique({ where: { id } });
        if (!listing) return reply.code(404).send({ error: 'Listing not found' });

        // If clearing and old file was uploaded — delete it
        if (!specificationUrl && listing.specificationUrl?.startsWith('/uploads/listing-specs/')) {
            const oldPath = path.join(uploadsRoot, listing.specificationUrl.replace('/uploads/', ''));
            try { await fs.unlink(oldPath); } catch { /* ignore */ }
        }

        const updated = await fastify.prisma.listing.update({
            where: { id },
            data: { specificationUrl: specificationUrl || null, lastManualEditAt: new Date() },
        });

        return reply.send({ listing: updated });
    });
}
