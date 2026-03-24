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

const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/svg+xml'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per image

function generateFilename(originalName: string): string {
    const ext = path.extname(originalName).toLowerCase();
    const hash = crypto.randomBytes(8).toString('hex');
    return `${Date.now()}-${hash}${ext}`;
}

export async function rentalUploadRoutes(fastify: FastifyInstance) {
    // Upload images for a rental vehicle
    fastify.post('/api/rental-vehicles/:id/images', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };

        // Verify vehicle exists
        const vehicle = await fastify.prisma.rentalVehicle.findUnique({
            where: { id }
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

            const filename = generateFilename(part.filename);
            const filePath = path.join(vehicleDir, filename);

            // Stream file to disk
            await pipeline(part.file, createWriteStream(filePath));

            // Check if file was truncated (exceeded size limit)
            if (part.file.truncated) {
                await fs.unlink(filePath);
                return reply.code(400).send({
                    error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`
                });
            }

            const imageUrl = `/uploads/rental-images/${id}/${filename}`;
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
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { imageUrl } = request.body as { imageUrl: string };

        const vehicle = await fastify.prisma.rentalVehicle.findUnique({
            where: { id }
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
        try {
            const relativePath = imageUrl.replace('/uploads/', '');
            const filePath = path.join(uploadsRoot, relativePath);
            await fs.unlink(filePath);
        } catch {
            // File might not exist on disk, that's ok
        }

        return { success: true, remainingImages: updatedUrls.length };
    });

    // Set primary image for a rental vehicle
    fastify.patch('/api/rental-vehicles/:id/primary-image', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { imageUrl } = request.body as { imageUrl: string };

        const vehicle = await fastify.prisma.rentalVehicle.findUnique({
            where: { id }
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
}
