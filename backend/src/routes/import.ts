import { FastifyInstance } from 'fastify';
import { parse } from 'csv-parse/sync';
import { syncListingsFromCSV } from '../services/sync.service.js';
import type { CSVRow } from '../types/csv.types.js';

export async function importRoutes(fastify: FastifyInstance) {
    // OPCJA A: Upload pliku CSV
    fastify.post('/api/import/csv', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        try {
            const data = await request.file();

            if (!data) {
                return reply.code(400).send({ error: 'No file uploaded' });
            }

            const buffer = await data.toBuffer();
            const csvContent = buffer.toString('utf-8');

            // Parse CSV (tab-separated)
            const records = parse(csvContent, {
                columns: true,
                skip_empty_lines: true,
                delimiter: ',',
                relax_column_count: true
            }) as CSVRow[];

            if (records.length === 0) {
                return reply.code(400).send({ error: 'CSV file is empty' });
            }

            // Start import process
            const result = await syncListingsFromCSV(
                fastify.prisma,
                records,
                request.user!.userId,
                data.filename
            );

            fastify.log.info({
                importLogId: result.importLogId,
                totalRows: result.totalRows,
                inserted: result.inserted,
                updated: result.updated,
                archived: result.archived
            }, 'CSV import completed');

            return result;
        } catch (error) {
            // Log full error to console for debugging
            console.error('CRITICAL IMPORT ERROR:', error);
            fastify.log.error(error, 'CSV import failed');
            return reply.code(500).send({
                error: 'Import failed',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // OPCJA B: JSON API
    fastify.post('/api/import/csv-data', {
        preHandler: [fastify.authenticate],
        schema: {
            body: {
                type: 'object',
                required: ['data'],
                properties: {
                    data: {
                        type: 'array',
                        items: { type: 'object' }
                    },
                    source: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { data, source } = request.body as {
                data: CSVRow[];
                source?: string
            };

            if (!data || data.length === 0) {
                return reply.code(400).send({ error: 'Data array is empty' });
            }

            // Start import process
            const result = await syncListingsFromCSV(
                fastify.prisma,
                data,
                request.user!.userId,
                source || 'api-json-upload'
            );

            fastify.log.info({
                importLogId: result.importLogId,
                totalRows: result.totalRows,
                inserted: result.inserted,
                updated: result.updated,
                archived: result.archived
            }, 'JSON import completed');

            return result;
        } catch (error) {
            fastify.log.error(error, 'JSON import failed');
            return reply.code(500).send({
                error: 'Import failed',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // Get import history
    fastify.get('/api/import/history', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const logs = await fastify.prisma.importLog.findMany({
            take: 50,
            orderBy: { importedAt: 'desc' },
            include: {
                user: {
                    select: { email: true, name: true }
                }
            }
        });

        return { logs };
    });

    // Get import details
    fastify.get('/api/import/:id', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };

        const log = await fastify.prisma.importLog.findUnique({
            where: { id },
            include: {
                user: {
                    select: { email: true, name: true }
                }
            }
        });

        if (!log) {
            return reply.code(404).send({ error: 'Import log not found' });
        }

        return { log };
    });
}
