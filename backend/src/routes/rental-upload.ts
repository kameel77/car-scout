import { FastifyInstance } from 'fastify';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import crypto from 'crypto';
import { optimizeAndSaveImage } from '../services/image-optimizer.js';
import { resolveScope } from '../utils/scope-resolver.js';
import { getSafeFilePath } from '../utils/path-helpers.js';
import { requirePermission } from '../middleware/permissions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.resolve(__dirname, '../../uploads');

const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per image

function generateFilename(originalName: string): string {
    const ext = path.extname(originalName).toLowerCase();
    const hash = crypto.randomBytes(8).toString('hex');
    return `${Date.now()}-${hash}${ext}`;
}

function generateBaseFilename(): string {
    const hash = crypto.randomBytes(8).toString('hex');
    return `${Date.now()}-${hash}`;
}

export async function rentalUploadRoutes(fastify: FastifyInstance) {
    // Upload images for a rental vehicle
    fastify.post('/api/rental-vehicles/:id/images', {
        preHandler: [fastify.authenticate, requirePermission('rental:write')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };

        // Verify vehicle exists
        const vehicle = await fastify.prisma.rentalVehicle.findFirst({
            where: { id, ...(await resolveScope(fastify, request)).dealerFilter }
        });

        if (!vehicle) {
            return reply.code(404).send({ error: 'Rental vehicle not found' });
        }

        const parts = request.parts();
        const uploadedUrls: string[] = [];
        let setPrimary = false;

        const vehicleDir = path.join(uploadsRoot, 'rental-images', id);
        await fs.mkdir(vehicleDir, { recursive: true });

        for await (const part of parts) {
            if (part.type === 'field') {
                if (part.fieldname === 'setPrimary') {
                    setPrimary = part.value === 'true';
                }
                continue;
            }

            if (part.type !== 'file') continue;

            // Validate mime type
            if (!ALLOWED_MIME_TYPES.includes(part.mimetype)) {
                return reply.code(400).send({
                    error: `Invalid file type: ${part.mimetype}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`
                });
            }

            const buffer = await part.toBuffer();
            if (buffer.length > MAX_FILE_SIZE) {
                return reply.code(400).send({
                    error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`
                });
            }

            const baseFilename = generateBaseFilename();
            const { largeFilename } = await optimizeAndSaveImage(buffer, {
                targetDir: vehicleDir,
                baseFilename,
            });

            const imageUrl = `/uploads/rental-images/${id}/${largeFilename}`;
            uploadedUrls.push(imageUrl);
        }

        if (uploadedUrls.length === 0) {
            return reply.code(400).send({ error: 'No images uploaded' });
        }

        // Update vehicle with new image URLs
        const existingUrls = vehicle.imageUrls || [];
        const allUrls = [...existingUrls, ...uploadedUrls];

        const updateData: any = {
            imageUrls: allUrls
        };

        // Set primary image if requested or if it's the first image
        if (setPrimary || !vehicle.primaryImageUrl) {
            updateData.primaryImageUrl = uploadedUrls[0];
        }

        await fastify.prisma.rentalVehicle.update({
            where: { id },
            data: updateData
        });

        return {
            uploaded: uploadedUrls.length,
            urls: uploadedUrls,
            primaryImageUrl: updateData.primaryImageUrl || vehicle.primaryImageUrl
        };
    });

    // Delete a specific image from a rental vehicle
    fastify.delete('/api/rental-vehicles/:id/images', {
        preHandler: [fastify.authenticate, requirePermission('rental:write')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { imageUrl } = request.body as { imageUrl: string };

        const vehicle = await fastify.prisma.rentalVehicle.findFirst({
            where: { id, ...(await resolveScope(fastify, request)).dealerFilter }
        });

        if (!vehicle) {
            return reply.code(404).send({ error: 'Rental vehicle not found' });
        }

        // Remove from imageUrls
        const updatedUrls = vehicle.imageUrls.filter((url: string) => url !== imageUrl);

        const updateData: any = {
            imageUrls: updatedUrls
        };

        // If deleted image was primary, set next available or null
        if (vehicle.primaryImageUrl === imageUrl) {
            updateData.primaryImageUrl = updatedUrls.length > 0 ? updatedUrls[0] : null;
        }

        await fastify.prisma.rentalVehicle.update({
            where: { id },
            data: updateData
        });

        // Try to delete file from disk
        if (imageUrl.startsWith('/uploads/rental-images/')) {
            const baseDir = path.join(uploadsRoot, 'rental-images');
            const relativePath = imageUrl.replace('/uploads/rental-images/', '');
            const filePath = getSafeFilePath(baseDir, relativePath);
            
            if (filePath) {
                try {
                    const mediumPath = filePath.replace('.webp', '-md.webp');
                    const thumbPath = filePath.replace('.webp', '-thumb.webp');
                    const cardPath = filePath.replace('.webp', '-lg.webp');
                    await fs.unlink(filePath);
                    await fs.unlink(mediumPath).catch(() => {});
                    await fs.unlink(thumbPath).catch(() => {});
                    await fs.unlink(cardPath).catch(() => {});
                } catch {
                    // File might not exist on disk, that's ok
                }
            }
        }

        return { success: true, remainingImages: updatedUrls.length };
    });

    // Set primary image for a rental vehicle
    fastify.patch('/api/rental-vehicles/:id/primary-image', {
        preHandler: [fastify.authenticate, requirePermission('rental:write')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { imageUrl } = request.body as { imageUrl: string };

        const vehicle = await fastify.prisma.rentalVehicle.findFirst({
            where: { id, ...(await resolveScope(fastify, request)).dealerFilter }
        });

        if (!vehicle) {
            return reply.code(404).send({ error: 'Rental vehicle not found' });
        }

        if (!vehicle.imageUrls.includes(imageUrl)) {
            return reply.code(400).send({ error: 'Image URL not found in vehicle images' });
        }

        await fastify.prisma.rentalVehicle.update({
            where: { id },
            data: { primaryImageUrl: imageUrl }
        });

        return { success: true, primaryImageUrl: imageUrl };
    });

    // Add image by URL (external link, no file upload)
    fastify.post('/api/rental-vehicles/:id/images/url', {
        preHandler: [fastify.authenticate, requirePermission('rental:write')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { url } = request.body as { url: string };

        if (!url) return reply.code(400).send({ error: 'url is required' });

        const vehicle = await fastify.prisma.rentalVehicle.findFirst({ where: { id, ...(await resolveScope(fastify, request)).dealerFilter } });
        if (!vehicle) return reply.code(404).send({ error: 'Rental vehicle not found' });

        const newUrls = [...(vehicle.imageUrls || []), url];
        const newPrimary = vehicle.primaryImageUrl || url;

        await fastify.prisma.rentalVehicle.update({
            where: { id },
            data: { imageUrls: newUrls, primaryImageUrl: newPrimary },
        });

        return reply.send({ success: true, imageUrls: newUrls, primaryImageUrl: newPrimary });
    });

    // Reorder images
    fastify.patch('/api/rental-vehicles/:id/images/reorder', {
        preHandler: [fastify.authenticate, requirePermission('rental:write')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { imageUrls } = request.body as { imageUrls: string[] };

        if (!Array.isArray(imageUrls)) return reply.code(400).send({ error: 'imageUrls must be an array' });

        const vehicle = await fastify.prisma.rentalVehicle.findFirst({ where: { id, ...(await resolveScope(fastify, request)).dealerFilter } });
        if (!vehicle) return reply.code(404).send({ error: 'Rental vehicle not found' });

        await fastify.prisma.rentalVehicle.update({
            where: { id },
            data: { imageUrls },
        });

        return reply.send({ success: true, imageUrls });
    });

    // Upload specification for a rental vehicle
    fastify.post('/api/rental-vehicles/:id/specs', {
        preHandler: [fastify.authenticate, requirePermission('rental:write')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };

        const vehicle = await fastify.prisma.rentalVehicle.findFirst({
            where: { id, ...(await resolveScope(fastify, request)).dealerFilter }
        });

        if (!vehicle) {
            return reply.code(404).send({ error: 'Rental vehicle not found' });
        }

        const parts = request.parts();
        let uploadedUrl: string | null = null;

        const vehicleDir = path.join(uploadsRoot, 'rental-specs', id);
        await fs.mkdir(vehicleDir, { recursive: true });

        for await (const part of parts) {
            if (part.type !== 'file') continue;

            const ALLOWED_SPEC_TYPES = ['application/pdf'];
            if (!ALLOWED_SPEC_TYPES.includes(part.mimetype)) {
                return reply.code(400).send({
                    error: `Invalid file type: ${part.mimetype}. Allowed: PDF`
                });
            }

            const filename = generateFilename(part.filename);
            const filePath = path.join(vehicleDir, filename);

            await pipeline(part.file, createWriteStream(filePath));

            if (part.file.truncated) {
                await fs.unlink(filePath);
                return reply.code(400).send({
                    error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`
                });
            }

            uploadedUrl = `/uploads/rental-specs/${id}/${filename}`;
            break; // only process the first file
        }

        if (!uploadedUrl) {
            return reply.code(400).send({ error: 'No specification file uploaded' });
        }

        // Delete old spec file if exists and is local
        if (vehicle.specificationUrl && vehicle.specificationUrl.startsWith('/uploads/rental-specs/')) {
            try {
                const baseDir = path.join(uploadsRoot, 'rental-specs');
                const relativePath = vehicle.specificationUrl.replace('/uploads/rental-specs/', '');
                const filePath = getSafeFilePath(baseDir, relativePath);
                if (filePath) {
                    await fs.unlink(filePath);
                }
            } catch {
                // Ignore
            }
        }

        await fastify.prisma.rentalVehicle.update({
            where: { id },
            data: { specificationUrl: uploadedUrl }
        });

        return { success: true, specificationUrl: uploadedUrl };
    });
}
