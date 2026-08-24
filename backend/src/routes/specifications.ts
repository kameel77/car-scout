import { FastifyInstance } from 'fastify';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { optimizeAndSaveImage } from '../services/image-optimizer.js';
import { getSafeFilePath } from '../utils/path-helpers.js';
import { requirePermission } from '../middleware/permissions.js';
import { resolveScope } from '../utils/scope-resolver.js';
import { LiteParse } from '@llamaindex/liteparse';
import { normalizeBrand } from '../services/brand-normalization.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.resolve(__dirname, '../../uploads');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function specificationRoutes(fastify: FastifyInstance) {

    fastify.post('/api/specifications', {
        onRequest: [fastify.authenticate, requirePermission('stock:write')]
    }, async (request, reply) => {
        const data = (request.body as any) || {};
        const spec = await fastify.prisma.vehicleSpecification.create({
            data: {
                brand: normalizeBrand(data.brand),
                model: data.model || 'Nowy Model',
                version: data.version || 'Wersja',
                condition: data.condition || 'NEW',
            }
        });
        return { specification: spec };
    });

    // 1. Get specifications list (with filters)
    fastify.get('/api/specifications', {
        preValidation: [fastify.authenticate, requirePermission('stock:read')]
    }, async (request, reply) => {
        try {
            // resolveScope(fastify, request);
            
            const specs = await fastify.prisma.vehicleSpecification.findMany({
                orderBy: { updatedAt: 'desc' },
                take: 100,
            });

            return { specifications: specs };
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Failed to fetch specifications' });
        }
    });

    // 2. Get specific specification details
    fastify.get('/api/specifications/:id', {
        preValidation: [fastify.authenticate, requirePermission('stock:read')]
    }, async (request, reply) => {
        try {
            const { id } = request.params as { id: string };
            const spec = await fastify.prisma.vehicleSpecification.findUnique({
                where: { id }
            });

            if (!spec) {
                return reply.status(404).send({ error: 'Specification not found' });
            }

            return { specification: spec };
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Failed to fetch specification' });
        }
    });

    // 3. Update specification (displayMode, equipment, etc.)
    fastify.patch('/api/specifications/:id', {
        preValidation: [fastify.authenticate, requirePermission('stock:write')]
    }, async (request, reply) => {
        try {
            const { id } = request.params as { id: string };
            const data = request.body as any;

            const spec = await fastify.prisma.vehicleSpecification.update({
                where: { id },
                data: {
                    displayMode: data.displayMode,
                    brand: normalizeBrand(data.brand),
                    model: data.model,
                    version: data.version,
                    color: data.color,
                    manufacturingYear: data.manufacturingYear,
                    enginePowerHp: data.enginePowerHp,
                    engineCapacityCm3: data.engineCapacityCm3,
                    fuelType: data.fuelType,
                    transmission: data.transmission,
                    drive: data.drive,
                    bodyType: data.bodyType,
                    catalogPrice: data.catalogPrice,
                    discountedPrice: data.discountedPrice,
                    equipmentAudioMultimedia: data.equipmentAudioMultimedia,
                    equipmentSafety: data.equipmentSafety,
                    equipmentComfortExtras: data.equipmentComfortExtras,
                    equipmentOther: data.equipmentOther,
                    specificationPdfUrl: data.specificationPdfUrl,
                }
            });

            return { specification: spec };
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Failed to update specification' });
        }
    });

    // 4. Parse PDF using LiteParse and OpenRouter
    fastify.post('/api/specifications/parse-pdf', {
        preValidation: [fastify.authenticate, requirePermission('stock:write')]
    }, async (request, reply) => {
        try {
            const fileData = await request.file();
            if (!fileData) {
                return reply.status(400).send({ error: 'No file uploaded' });
            }

            const buffer = await fileData.toBuffer();
            
            // 1. LiteParse: PDF to Markdown
            const lp = new LiteParse({ outputFormat: 'markdown' });
            const parseResult = await lp.parse(buffer);
            const markdown = parseResult.text;

            // 2. OpenRouter: Extract equipment
            const appSettings = await fastify.prisma.appSettings.findUnique({ where: { id: 'default' } });
            const llmModel = appSettings?.pdfParserLlmModel || 'google/gemini-2.5-flash';
            const openRouterKey = process.env.OPENROUTER_API_KEY;

            if (!openRouterKey) {
                return reply.status(500).send({ error: 'OPENROUTER_API_KEY is not configured', rawMarkdown: markdown });
            }

            const defaultPrompt = `
Jesteś asystentem dealera samochodowego. 
Oto zawartość pliku PDF z wyceną pojazdu (przekonwertowana do Markdown):

{{MARKDOWN_CONTENT}}

Zadanie:
Wyciągnij dane pojazdu i wyposażenie z tego dokumentu. Uporządkuj je w strukturalny format JSON.
Zwróć uwagę na sekcje techniczne oraz cenniki.

Klucze w JSON muszą nazywać się dokładnie tak jak poniżej:
{
  "brand": "Marka (np. Toyota, Ford)",
  "model": "Model (np. Camry, Kuga)",
  "version": "Wersja wyposażenia / Trim (np. Executive, ST-Line)",
  "color": "Kolor nadwozia (jeśli podano)",
  "manufacturingYear": 2021,
  "enginePowerHp": 150,
  "engineCapacityCm3": 1498,
  "fuelType": "Benzyna / Diesel / Hybryda / Elektryczny",
  "transmission": "Automatyczna / Manualna",
  "drive": "FWD / RWD / AWD / 4x4",
  "bodyType": "Sedan / SUV / Kombi / Hatchback / Coupe / itp",
  "catalogPrice": 120000,
  "discountedPrice": 110000,
  "equipmentAudioMultimedia": ["Element 1", "Element 2"],
  "equipmentSafety": ["Element 1", "Element 2"],
  "equipmentComfortExtras": ["Element 1", "Element 2"],
  "equipmentOther": ["Element 1", "Element 2"]
}
Uwagi:
- catalogPrice: cena katalogowa (liczba całkowita, np. 150000). Jeśli brak, zwróć null.
- discountedPrice: cena po rabacie / cena do finansowania (liczba całkowita). Jeśli brak, zwróć null.
- Wartości liczbowe (rok, moc, pojemność, ceny) muszą być typem Number.
- Zwróć TYLKO czysty obiekt JSON, bez żadnych znaczników formatowania typu \`\`\`json.
`;

            const promptTemplate = appSettings?.pdfParserSystemPrompt || defaultPrompt;
            const prompt = promptTemplate.replace('{{MARKDOWN_CONTENT}}', markdown.substring(0, 30000));

            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${openRouterKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://car-scout.pl',
                    'X-Title': 'Car Scout'
                },
                body: JSON.stringify({
                    model: llmModel,
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    // We don't use response_format for now because some models on OpenRouter don't fully support structured output natively without errors. We requested JSON explicitly in the prompt.
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                fastify.log.error('OpenRouter error: ' + errText);
                return reply.status(500).send({ error: 'LLM parsing failed' });
            }

            const llmResult = await response.json() as any;
            let content = llmResult.choices[0].message.content;

            content = content.replace(/^```json\n?/g, '').replace(/```$/g, '').trim();

            let parsedData;
            try {
                parsedData = JSON.parse(content);
            } catch (e) {
                fastify.log.error('Failed to parse LLM JSON output: ' + content);
                parsedData = { equipmentOther: [content] };
            }

            return {
                message: 'Parsed successfully',
                data: parsedData,
                rawMarkdown: process.env.NODE_ENV === 'development' ? markdown : undefined
            };

        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Failed to process PDF' });
        }
    });

    // 5. Upload images for specification
    fastify.post('/api/specifications/:id/images', {
        preValidation: [fastify.authenticate, requirePermission('stock:write')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const parts = request.parts();
        const uploadedUrls: string[] = [];

        const spec = await fastify.prisma.vehicleSpecification.findUnique({
            where: { id }
        });

        if (!spec) {
            return reply.code(404).send({ error: 'Specification not found' });
        }

        const imagesDir = path.join(uploadsRoot, 'specification-images', id);
        await fs.mkdir(imagesDir, { recursive: true });

        for await (const part of parts) {
            if (part.type !== 'file') continue;

            if (!ALLOWED_MIME_TYPES.includes(part.mimetype)) {
                return reply.code(400).send({
                    error: `Invalid file type: ${part.mimetype}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`
                });
            }

            const buffer = await part.toBuffer();
            if (buffer.length > 5 * 1024 * 1024) {
                return reply.code(400).send({
                    error: `File too large. Maximum size: 5MB`
                });
            }

            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const baseFilename = `img-${uniqueSuffix}`;

            const optimizedResult = await optimizeAndSaveImage(buffer, {
                targetDir: imagesDir,
                baseFilename,
                largeWidth: 1920,
                quality: 85,
                generateThumbnail: true,
                thumbWidth: 400
            });

            uploadedUrls.push(`/uploads/specification-images/${id}/${optimizedResult.largeFilename}`);
        }

        if (uploadedUrls.length === 0) {
            return reply.code(400).send({ error: 'No images uploaded' });
        }

        const existingUrls = spec.imageUrls || [];
        const allUrls = [...existingUrls, ...uploadedUrls];

        await fastify.prisma.vehicleSpecification.update({
            where: { id },
            data: { imageUrls: allUrls }
        });

        return {
            uploaded: uploadedUrls.length,
            urls: uploadedUrls,
        };
    });

    // 6. Delete a specific image from specification
    fastify.delete('/api/specifications/:id/images', {
        preHandler: [fastify.authenticate, requirePermission('stock:write')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { imageUrl } = request.body as { imageUrl: string };

        const spec = await fastify.prisma.vehicleSpecification.findUnique({
            where: { id }
        });

        if (!spec) {
            return reply.code(404).send({ error: 'Specification not found' });
        }

        const updatedUrls = spec.imageUrls.filter((url: string) => url !== imageUrl);

        await fastify.prisma.vehicleSpecification.update({
            where: { id },
            data: { imageUrls: updatedUrls }
        });

        if (imageUrl.startsWith('/uploads/specification-images/')) {
            const baseDir = path.join(uploadsRoot, 'specification-images');
            const relativePath = imageUrl.replace('/uploads/specification-images/', '');
            const filePath = getSafeFilePath(baseDir, relativePath);
            
            if (filePath) {
                try {
                    const mediumPath = filePath.replace('.webp', '-md.webp');
                    const thumbPath = filePath.replace('.webp', '-thumb.webp');
                    await fs.unlink(filePath);
                    await fs.unlink(mediumPath).catch(() => {});
                    await fs.unlink(thumbPath).catch(() => {});
                } catch {
                    // Ignore missing files
                }
            }
        }

        return { success: true, remainingImages: updatedUrls.length };
    });

    // 7. Reorder images
    fastify.patch('/api/specifications/:id/images/reorder', {
        preHandler: [fastify.authenticate, requirePermission('stock:write')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { imageUrls } = request.body as { imageUrls: string[] };

        if (!Array.isArray(imageUrls)) return reply.code(400).send({ error: 'imageUrls must be an array' });

        const spec = await fastify.prisma.vehicleSpecification.findUnique({ where: { id } });
        if (!spec) return reply.code(404).send({ error: 'Specification not found' });

        await fastify.prisma.vehicleSpecification.update({
            where: { id },
            data: { imageUrls },
        });

        return reply.send({ success: true, imageUrls });
    });

    // 8. Add image by URL
    fastify.post('/api/specifications/:id/images/url', {
        preHandler: [fastify.authenticate, requirePermission('stock:write')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { url } = request.body as { url: string };

        if (!url) return reply.code(400).send({ error: 'url is required' });

        const spec = await fastify.prisma.vehicleSpecification.findUnique({ where: { id } });
        if (!spec) return reply.code(404).send({ error: 'Specification not found' });

        const newUrls = [...(spec.imageUrls || []), url];

        await fastify.prisma.vehicleSpecification.update({
            where: { id },
            data: { imageUrls: newUrls },
        });

        return reply.send({ success: true, imageUrls: newUrls });
    });

    // 9. Delete specification
    fastify.delete('/api/specifications/:id', {
        preHandler: [fastify.authenticate, requirePermission('stock:write')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        try {
            await fastify.prisma.vehicleSpecification.delete({ where: { id } });
            return reply.send({ success: true });
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Failed to delete specification. It may be in use.' });
        }
    });

    // 10. Archive / Restore specification
    fastify.patch('/api/specifications/:id/archive', {
        preHandler: [fastify.authenticate, requirePermission('stock:write')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { isArchived } = request.body as { isArchived: boolean };
        try {
            const spec = await fastify.prisma.vehicleSpecification.update({
                where: { id },
                data: { isArchived }
            });
            return reply.send({ specification: spec });
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Failed to update specification archive status.' });
        }
    });

    // 11. Duplicate specification
    fastify.post('/api/specifications/:id/duplicate', {
        preHandler: [fastify.authenticate, requirePermission('stock:write')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        try {
            const spec = await fastify.prisma.vehicleSpecification.findUnique({ where: { id } });
            if (!spec) return reply.code(404).send({ error: 'Specification not found' });

            const { id: _, createdAt, updatedAt, ...specData } = spec;

            const newSpec = await fastify.prisma.vehicleSpecification.create({
                data: {
                    ...specData,
                    brand: `${specData.brand} (Kopia)`
                }
            });
            return reply.send({ specification: newSpec });
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Failed to duplicate specification.' });
        }
    });

}
