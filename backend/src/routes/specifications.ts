import { FastifyInstance } from 'fastify';
import { resolveScope } from '../utils/scope-resolver.js';
import { LiteParse } from '@llamaindex/liteparse';

export async function specificationRoutes(fastify: FastifyInstance) {

    fastify.post('/api/specifications', {
        onRequest: [fastify.authenticate, requireAdminOrManager]
    }, async (request, reply) => {
        const spec = await fastify.prisma.vehicleSpecification.create({
            data: {
                brand: 'Nowa Marka',
                model: 'Nowy Model',
                version: 'Wersja',
                condition: 'NEW',
            }
        });
        return { specification: spec };
    });

    // 1. Get specifications list (with filters)
    fastify.get('/api/specifications', {
        preValidation: [fastify.authenticate]
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
        preValidation: [fastify.authenticate]
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
        preValidation: [fastify.authenticate]
    }, async (request, reply) => {
        try {
            const { id } = request.params as { id: string };
            const data = request.body as any;

            const spec = await fastify.prisma.vehicleSpecification.update({
                where: { id },
                data: {
                    displayMode: data.displayMode,
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
        preValidation: [fastify.authenticate]
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
            const llmModel = appSettings?.pdfParserLlmModel || 'deepseek/deepseek-v4-flash';
            const openRouterKey = process.env.OPENROUTER_API_KEY;

            if (!openRouterKey) {
                return reply.status(500).send({ error: 'OPENROUTER_API_KEY is not configured', rawMarkdown: markdown });
            }

            const defaultPrompt = `
Jesteś asystentem dealera samochodowego. 
Oto zawartość pliku PDF z wyceną pojazdu (przekonwertowana do Markdown):

{{MARKDOWN_CONTENT}}

Zadanie:
Wyciągnij wyposażenie z tego dokumentu i uporządkuj w strukturalny format JSON.
Klucze w JSON muszą nazywać się dokładnie tak jak poniżej i zawierać tablice stringów:
{
  "equipmentAudioMultimedia": ["Element 1", "Element 2"],
  "equipmentSafety": ["Element 1", "Element 2"],
  "equipmentComfortExtras": ["Element 1", "Element 2"],
  "equipmentOther": ["Element 1", "Element 2"]
}
Pomiń informacje niebędące wyposażeniem (np. adres dealera, cenę, numer VIN).
Zwróć TYLKO czysty obiekt JSON, bez żadnych znaczników formatowania typu \`\`\`json.
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

            let parsedEquipment;
            try {
                parsedEquipment = JSON.parse(content);
            } catch (e) {
                fastify.log.error('Failed to parse LLM JSON output: ' + content);
                parsedEquipment = { equipmentOther: [content] };
            }

            return {
                message: 'Parsed successfully',
                equipment: parsedEquipment,
                rawMarkdown: process.env.NODE_ENV === 'development' ? markdown : undefined
            };

        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Failed to process PDF' });
        }
    });

}
