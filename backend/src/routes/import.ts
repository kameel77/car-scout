import { FastifyInstance } from 'fastify';
import { parse } from 'csv-parse/sync';
import { syncListingsFromCSV } from '../services/sync.service.js';
import type { CSVRow, ImportMode } from '../types/csv.types.js';
import { resolveScope } from '../utils/scope-resolver.js';

const parseImportMode = (mode?: string): ImportMode =>
    mode === 'merge' ? 'merge' : 'replace';

export async function importRoutes(fastify: FastifyInstance) {
    // OPCJA A: Upload pliku CSV
    fastify.post('/api/import/csv', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        try {
            const data = await request.file();
            const { mode } = request.query as { mode?: string };
            const importMode = parseImportMode(mode);

            // Resolve active context for dealer assignment
            const scope = await resolveScope(fastify, request);
            const contextDealerId = scope.activeContext.scopeType === 'DEALER'
                ? scope.activeContext.scopeId
                : undefined;

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
                data.filename,
                importMode,
                contextDealerId   // scope: assign dealer if in dealer context
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
                    source: { type: 'string' },
                    mode: { type: 'string', enum: ['replace', 'merge'], default: 'replace' }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { data, source, mode } = request.body as {
                data: CSVRow[];
                source?: string;
                mode?: ImportMode;
            };
            const importMode = parseImportMode(mode);

            // Resolve active context for dealer assignment
            const scope = await resolveScope(fastify, request);
            const contextDealerId = scope.activeContext.scopeType === 'DEALER'
                ? scope.activeContext.scopeId
                : undefined;

            if (!data || data.length === 0) {
                return reply.code(400).send({ error: 'Data array is empty' });
            }

            // Start import process
            const result = await syncListingsFromCSV(
                fastify.prisma,
                data,
                request.user!.userId,
                source || 'api-json-upload',
                importMode,
                contextDealerId   // scope: assign dealer if in dealer context
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

    // Get import history (scope-aware)
    fastify.get('/api/import/history', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        try {
            const scope = await resolveScope(fastify, request);

            const where: any = {};
            // Non-platform users only see their own imports
            if (!scope.isPlatform) {
                where.importedBy = (request.user as any)?.userId;
            }

            const logs = await fastify.prisma.importLog.findMany({
                where,
                take: 50,
                orderBy: { importedAt: 'desc' },
                include: {
                    user: {
                        select: { email: true, name: true }
                    }
                }
            });

            return { logs };
        } catch (error) {
            fastify.log.error(error, 'Failed to load import history');
            return reply.code(500).send({ error: 'Failed to load import history' });
        }
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
