import { FastifyInstance } from 'fastify';
import { parse } from 'csv-parse/sync';
import { syncListingsFromCSV } from '../services/sync.service.js';
import { importVehisCSV } from '../services/vehis-import.service.js';
import type { CSVRow, ImportMode } from '../types/csv.types.js';
import { resolveScope } from '../utils/scope-resolver.js';
import { requirePermission } from '../middleware/permissions.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const parseImportMode = (mode?: string): ImportMode =>
    mode === 'merge' ? 'merge' : 'replace';


// In-memory tracker for chunk uploads (uploadId -> metadata)
const activeUploads = new Map<string, {
    totalChunks: number;
    receivedChunks: Set<number>;
    dir: string;
    filename: string;
    createdAt: number;
}>();

// Cleanup stale uploads older than 30 minutes
function cleanupStaleUploads() {
    const now = Date.now();
    for (const [uploadId, meta] of activeUploads) {
        if (now - meta.createdAt > 30 * 60 * 1000) {
            fs.rm(meta.dir, { recursive: true, force: true }).catch(() => {});
            activeUploads.delete(uploadId);
        }
    }
}

export async function importRoutes(fastify: FastifyInstance) {
    // Periodic cleanup every 5 minutes
    const cleanupInterval = setInterval(cleanupStaleUploads, 5 * 60 * 1000);
    fastify.addHook('onClose', () => clearInterval(cleanupInterval));

    // Get list of existing unique import sources
    fastify.get('/api/import/sources', {
        preHandler: [fastify.authenticate, requirePermission('stock:import')]
    }, async (request, reply) => {
        try {
            const sourcesRaw = await fastify.prisma.listing.findMany({
                select: { importSource: true },
                distinct: ['importSource'],
                where: { importSource: { not: null } }
            });
            const sources = sourcesRaw.map(s => s.importSource).filter(Boolean).sort();
            return { success: true, sources };
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Failed to fetch import sources' });
        }
    });
    
    // ─── CHUNK UPLOAD: receive individual chunk ───
    fastify.post('/api/import/csv-chunk', {
        preHandler: [fastify.authenticate, requirePermission('stock:import')]
    }, async (request, reply) => {
        try {
            const uploadId = request.headers['x-upload-id'] as string;
            const chunkIndex = parseInt(request.headers['x-chunk-index'] as string);
            const totalChunks = parseInt(request.headers['x-total-chunks'] as string);
            const originalFilename = request.headers['x-original-filename'] as string || 'upload.csv';

            if (!uploadId || isNaN(chunkIndex) || isNaN(totalChunks)) {
                return reply.code(400).send({
                    error: 'Missing required headers: X-Upload-ID, X-Chunk-Index, X-Total-Chunks'
                });
            }

            // Create upload directory on first chunk
            if (!activeUploads.has(uploadId)) {
                const dir = path.join(os.tmpdir(), `csv-upload-${uploadId}`);
                await fs.mkdir(dir, { recursive: true });
                activeUploads.set(uploadId, {
                    totalChunks,
                    receivedChunks: new Set(),
                    dir,
                    filename: originalFilename,
                    createdAt: Date.now()
                });
            }

            const upload = activeUploads.get(uploadId)!;

            // Read chunk from multipart
            const data = await request.file();
            if (!data) {
                return reply.code(400).send({ error: 'No file data in chunk' });
            }

            const buffer = await data.toBuffer();
            const chunkPath = path.join(upload.dir, `chunk-${String(chunkIndex).padStart(5, '0')}`);
            await fs.writeFile(chunkPath, buffer);

            upload.receivedChunks.add(chunkIndex);

            fastify.log.info({
                uploadId,
                chunkIndex,
                totalChunks,
                receivedCount: upload.receivedChunks.size,
                chunkSize: buffer.length
            }, 'Chunk received');

            return {
                status: 'chunk_received',
                chunkIndex,
                receivedChunks: upload.receivedChunks.size,
                totalChunks,
                complete: upload.receivedChunks.size === totalChunks
            };
        } catch (error) {
            fastify.log.error(error, 'Chunk upload failed');
            return reply.code(500).send({
                error: 'Chunk upload failed',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // ─── FINALIZE: reassemble chunks and run import ───
    fastify.post('/api/import/csv-finalize', {
        preHandler: [fastify.authenticate, requirePermission('stock:import')]
    }, async (request, reply) => {
        try {
            const { uploadId, mode, source } = request.query as { uploadId: string; mode?: string; source?: string };
            const importMode = parseImportMode(mode);

            // Resolve active context for dealer assignment
            const scope = await resolveScope(fastify, request);
            const contextDealerId = scope.activeContext.scopeType === 'DEALER'
                ? scope.activeContext.scopeId
                : undefined;

            if (!uploadId || !activeUploads.has(uploadId)) {
                return reply.code(400).send({ error: 'Invalid or expired upload ID' });
            }

            const upload = activeUploads.get(uploadId)!;

            // Verify all chunks received
            if (upload.receivedChunks.size !== upload.totalChunks) {
                return reply.code(400).send({
                    error: `Missing chunks: received ${upload.receivedChunks.size}/${upload.totalChunks}`
                });
            }

            // Reassemble file from chunks in order
            const chunks: Buffer[] = [];
            for (let i = 0; i < upload.totalChunks; i++) {
                const chunkPath = path.join(upload.dir, `chunk-${String(i).padStart(5, '0')}`);
                chunks.push(await fs.readFile(chunkPath));
            }

            const fullBuffer = Buffer.concat(chunks);
            const csvContent = fullBuffer.toString('utf-8');

            fastify.log.info({
                uploadId,
                totalSize: fullBuffer.length,
                filename: upload.filename
            }, 'Chunks reassembled, starting CSV parse');

            // Cleanup temp files
            await fs.rm(upload.dir, { recursive: true, force: true }).catch(() => {});
            activeUploads.delete(uploadId);

            // Parse CSV
            const records = parse(csvContent, {
                columns: true,
                skip_empty_lines: true,
                delimiter: [',', '\t', ';'],
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
                source || upload.filename,
                importMode,
                contextDealerId   // scope: assign dealer if in dealer context
            );

            fastify.log.info({
                importLogId: result.importLogId,
                totalRows: result.totalRows,
                inserted: result.inserted,
                updated: result.updated,
                archived: result.archived
            }, 'Chunked CSV import completed');

            return result;
        } catch (error) {
            console.error('CRITICAL IMPORT ERROR (chunked):', error);
            fastify.log.error(error, 'Chunked CSV import failed');
            return reply.code(500).send({
                error: 'Import failed',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // ─── OPCJA A: Upload pliku CSV (single request — for files <90MB) ───
    fastify.post('/api/import/csv', {
        preHandler: [fastify.authenticate, requirePermission('stock:import')]
    }, async (request, reply) => {
        try {
            const data = await request.file();
            const { mode, source } = request.query as { mode?: string; source?: string };
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
                delimiter: [',', '\t', ';'],
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
                source || data.filename,
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
        preHandler: async (request: any, reply: any) => {
            const authHeader = request.headers.authorization;
            const staticKey = process.env.IMPORT_API_KEY;
            
            // Allow if valid static key is provided
            if (staticKey && authHeader === `Bearer ${staticKey}`) {
                return;
            }
            
            // Otherwise fallback to standard JWT auth with stock:import permission check
            try {
                await request.jwtVerify();
                await requirePermission('stock:import')(request, reply);
            } catch (err) {
                reply.code(401).send({ error: 'Unauthorized' });
            }
        },
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
                    mode: { type: 'string', enum: ['replace', 'merge'], default: 'replace' },
                    dealerId: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { data, source, mode, dealerId: bodyDealerId } = request.body as {
                data: CSVRow[];
                source?: string;
                mode?: ImportMode;
                dealerId?: string;
            };
            const importMode = parseImportMode(mode);

            const isStaticKey = process.env.IMPORT_API_KEY && request.headers.authorization === `Bearer ${process.env.IMPORT_API_KEY}`;

            // Resolve active context for dealer assignment
            let contextDealerId = bodyDealerId || (request.query as any).dealerId;

            if (!contextDealerId && !isStaticKey) {
                const scope = await resolveScope(fastify, request);
                contextDealerId = scope.activeContext.scopeType === 'DEALER'
                    ? scope.activeContext.scopeId
                    : undefined;
            }

            // Verify dealer exists if specified
            if (contextDealerId) {
                let dealer = await fastify.prisma.dealer.findUnique({ where: { id: contextDealerId } });
                if (!dealer) {
                    // Try to search by name (case-insensitive)
                    dealer = await fastify.prisma.dealer.findFirst({
                        where: {
                            name: {
                                equals: contextDealerId,
                                mode: 'insensitive'
                            }
                        }
                    });
                }
                if (!dealer) {
                    return reply.code(400).send({ error: `Dealer not found: "${contextDealerId}"` });
                }
                contextDealerId = dealer.id;
            }

            if (!data || data.length === 0) {
                return reply.code(400).send({ error: 'Data array is empty' });
            }

            // Resolve user ID for import log
            let userId = request.user?.userId;
            if (!userId) {
                const adminUser = await fastify.prisma.user.findFirst({
                    where: { role: 'admin', isActive: true }
                }) || await fastify.prisma.user.findFirst({
                    where: { isActive: true }
                });

                if (!adminUser) {
                    return reply.code(400).send({ error: 'No active user found to assign the import log to' });
                }
                userId = adminUser.id;
            }

            // Start import process
            const result = await syncListingsFromCSV(
                fastify.prisma,
                data,
                userId,
                source || 'api-json-upload',
                importMode,
                contextDealerId   // scope: assign dealer if in dealer context or passed in body
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
        preHandler: [fastify.authenticate, requirePermission('stock:read')]
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
        preHandler: [fastify.authenticate, requirePermission('stock:read')]
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

    fastify.post('/api/dealers/:dealerId/import-vehis-csv', {
        preHandler: [fastify.authenticate, requirePermission('stock:import')]
    }, async (request, reply) => {
        try {
            const { dealerId } = request.params as { dealerId: string };
            const resolvedScope = await resolveScope(fastify, request);
            const scopeId = resolvedScope.activeContext?.scopeId;
            const scopeType = resolvedScope.activeContext?.scopeType;

            // Access check
            if (scopeType === 'DEALER' && scopeId !== dealerId) {
                return reply.code(403).send({ error: 'Forbidden' });
            }

            const data = await request.file();
            if (!data) {
                return reply.code(400).send({ error: 'No file uploaded' });
            }

            const buffer = await data.toBuffer();
            const csvContent = buffer.toString('utf-8');

            const result = await importVehisCSV(
                fastify.prisma,
                dealerId,
                request.user.userId,
                csvContent,
                data.filename
            );

            return reply.send({ success: true, result });
        } catch (error: any) {
            fastify.log.error(error);
            return reply.code(500).send({ error: error.message || 'Failed to process Vehis CSV import' });
        }
    });
}
