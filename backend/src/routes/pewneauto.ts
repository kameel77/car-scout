import { FastifyPluginAsync } from 'fastify';
import { requirePermission } from '../middleware/permissions.js';
import { encryptSecret } from '../utils/crypto.js';
import { syncPewneAutoSource, syncAllPewneAutoSources } from '../services/pewneauto.service.js';

function slugify(name: string): string {
    return name
        .toLowerCase()
        .replace(/ł/g, 'l')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export const pewneautoRoutes: FastifyPluginAsync = async (fastify) => {
    // ─── 1. Lista źródeł PewneAuto z licznikiem aktywnych ofert ───
    fastify.get('/api/pewneauto/sources', {
        onRequest: [fastify.authenticate, requirePermission('stock:sources:write')]
    }, async (_request, reply) => {
        try {
            const sources = await fastify.prisma.pewneAutoSource.findMany({
                orderBy: { createdAt: 'asc' },
                include: {
                    dealerGroup: { select: { id: true, name: true } },
                    _count: { select: { listings: { where: { isArchived: false } } } }
                }
            });

            const masked = sources.map(({ _count, clientSecretEncrypted, ...s }: any) => ({
                ...s,
                clientSecret: '••••••••',
                activeListings: _count.listings
            }));

            return reply.send({ sources: masked });
        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Nie udało się pobrać źródeł PewneAuto' });
        }
    });

    // ─── 2. Dodanie nowego źródła PewneAuto ───
    fastify.post('/api/pewneauto/sources', {
        onRequest: [fastify.authenticate, requirePermission('stock:sources:write')]
    }, async (request, reply) => {
        try {
            const body = request.body as {
                name?: string;
                slug?: string;
                clientId?: string;
                clientSecret?: string;
                dealerGroupId?: string | null;
                tokenUrl?: string;
                apiUrl?: string;
                domainHeader?: string;
            };

            if (!body.name?.trim() || !body.clientId?.trim() || !body.clientSecret?.trim()) {
                return reply.status(400).send({ error: 'Wymagane pola: name, clientId, clientSecret' });
            }

            const slug = body.slug?.trim() || slugify(body.name);
            if (!slug) {
                return reply.status(400).send({ error: 'Nie udało się wygenerować sluga z nazwy' });
            }

            const existing = await fastify.prisma.pewneAutoSource.findUnique({ where: { slug } });
            if (existing) {
                return reply.status(400).send({ error: `Źródło ze slugiem "${slug}" już istnieje` });
            }

            function isValidPewneAutoUrl(rawUrl?: string): boolean {
                if (!rawUrl) return true;
                try {
                    const parsed = new URL(rawUrl);
                    if (parsed.protocol !== 'https:') return false;
                    const host = parsed.hostname.toLowerCase();
                    return host === 'pewneauto.pl' || host.endsWith('.pewneauto.pl');
                } catch {
                    return false;
                }
            }

            if (body.tokenUrl && !isValidPewneAutoUrl(body.tokenUrl)) {
                return reply.status(400).send({ error: 'Nieprawidłowy tokenUrl - wymagany protokół HTTPS i domena *.pewneauto.pl' });
            }
            if (body.apiUrl && !isValidPewneAutoUrl(body.apiUrl)) {
                return reply.status(400).send({ error: 'Nieprawidłowy apiUrl - wymagany protokół HTTPS i domena *.pewneauto.pl' });
            }

            const clientSecretEncrypted = encryptSecret(body.clientSecret.trim());

            const source = await fastify.prisma.pewneAutoSource.create({
                data: {
                    name: body.name.trim(),
                    slug,
                    clientId: body.clientId.trim(),
                    clientSecretEncrypted,
                    dealerGroupId: body.dealerGroupId || null,
                    tokenUrl: body.tokenUrl?.trim() || undefined,
                    apiUrl: body.apiUrl?.trim() || undefined,
                    domainHeader: body.domainHeader?.trim() || undefined
                }
            });

            return reply.status(201).send({
                source: {
                    ...source,
                    clientSecret: '••••••••'
                }
            });
        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({ error: error.message || 'Błąd tworzenia źródła PewneAuto' });
        }
    });

    // ─── 3. Edycja źródła PewneAuto ───
    fastify.patch('/api/pewneauto/sources/:id', {
        onRequest: [fastify.authenticate, requirePermission('stock:sources:write')]
    }, async (request, reply) => {
        try {
            const { id } = request.params as { id: string };
            const body = request.body as {
                name?: string;
                clientId?: string;
                clientSecret?: string;
                dealerGroupId?: string | null;
                isEnabled?: boolean;
                tokenUrl?: string;
                apiUrl?: string;
                domainHeader?: string;
            };

            const existing = await fastify.prisma.pewneAutoSource.findUnique({ where: { id } });
            if (!existing) {
                return reply.status(404).send({ error: 'Źródło nie istnieje' });
            }

            function isValidPewneAutoUrl(rawUrl?: string): boolean {
                if (!rawUrl) return true;
                try {
                    const parsed = new URL(rawUrl);
                    if (parsed.protocol !== 'https:') return false;
                    const host = parsed.hostname.toLowerCase();
                    return host === 'pewneauto.pl' || host.endsWith('.pewneauto.pl');
                } catch {
                    return false;
                }
            }

            if (body.tokenUrl && !isValidPewneAutoUrl(body.tokenUrl)) {
                return reply.status(400).send({ error: 'Nieprawidłowy tokenUrl - wymagany protokół HTTPS i domena *.pewneauto.pl' });
            }
            if (body.apiUrl && !isValidPewneAutoUrl(body.apiUrl)) {
                return reply.status(400).send({ error: 'Nieprawidłowy apiUrl - wymagany protokół HTTPS i domena *.pewneauto.pl' });
            }

            if (body.dealerGroupId) {
                const group = await fastify.prisma.dealerGroup.findUnique({ where: { id: body.dealerGroupId } });
                if (!group) return reply.status(400).send({ error: 'Wskazana grupa dealerska nie istnieje' });
            }

            let clientSecretEncrypted: string | undefined;
            if (body.clientSecret && body.clientSecret !== '••••••••' && body.clientSecret.trim().length > 0) {
                clientSecretEncrypted = encryptSecret(body.clientSecret.trim());
            }

            const updated = await fastify.prisma.pewneAutoSource.update({
                where: { id },
                data: {
                    ...(body.name !== undefined ? { name: body.name.trim() } : {}),
                    ...(body.clientId !== undefined ? { clientId: body.clientId.trim() } : {}),
                    ...(clientSecretEncrypted ? { clientSecretEncrypted } : {}),
                    ...(body.dealerGroupId !== undefined ? { dealerGroupId: body.dealerGroupId || null } : {}),
                    ...(body.isEnabled !== undefined ? { isEnabled: Boolean(body.isEnabled) } : {}),
                    ...(body.tokenUrl !== undefined ? { tokenUrl: body.tokenUrl.trim() } : {}),
                    ...(body.apiUrl !== undefined ? { apiUrl: body.apiUrl.trim() } : {}),
                    ...(body.domainHeader !== undefined ? { domainHeader: body.domainHeader.trim() } : {})
                }
            });

            // Jeśli źródło zostało wyłączone -> bezpiecznie zarchiwizuj oferty
            if (existing.isEnabled === true && body.isEnabled === false) {
                const archived = await fastify.prisma.listing.updateMany({
                    where: { pewneautoSourceId: id, isArchived: false },
                    data: {
                        isArchived: true,
                        archivedAt: new Date(),
                        archivedReason: 'pewneauto_source_disabled'
                    }
                });
                fastify.log.info(`[PewneAuto] Wyłączono źródło ${existing.slug} - zarchiwizowano ${archived.count} ofert`);
            }

            return reply.send({
                source: {
                    ...updated,
                    clientSecret: '••••••••'
                }
            });
        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({ error: error.message || 'Błąd edycji źródła PewneAuto' });
        }
    });

    // ─── 4. Usunięcie źródła PewneAuto ───
    fastify.delete('/api/pewneauto/sources/:id', {
        onRequest: [fastify.authenticate, requirePermission('stock:sources:write')]
    }, async (request, reply) => {
        try {
            const { id } = request.params as { id: string };
            const existing = await fastify.prisma.pewneAutoSource.findUnique({ where: { id } });
            if (!existing) {
                return reply.status(404).send({ error: 'Źródło nie istnieje' });
            }

            // Archiwizuj oferty przed usunięciem
            await fastify.prisma.listing.updateMany({
                where: { pewneautoSourceId: id, isArchived: false },
                data: {
                    isArchived: true,
                    archivedAt: new Date(),
                    archivedReason: 'pewneauto_source_deleted'
                }
            });

            await fastify.prisma.pewneAutoSource.delete({ where: { id } });
            return reply.send({ success: true, message: 'Źródło usunięte pomyślnie' });
        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Błąd podczas usuwania źródła' });
        }
    });

    // ─── 5. Symulacja Dry-Run pojedynczego źródła ───
    fastify.post('/api/pewneauto/sources/:id/dry-run', {
        onRequest: [fastify.authenticate, requirePermission('stock:sources:write')]
    }, async (request, reply) => {
        try {
            const { id } = request.params as { id: string };
            const source = await fastify.prisma.pewneAutoSource.findUnique({ where: { id } });
            if (!source) {
                return reply.status(404).send({ error: 'Źródło nie istnieje' });
            }

            const user = request.user as { userId: string };
            const report = await syncPewneAutoSource(fastify.prisma, source, {
                userId: user.userId,
                dryRun: true
            });

            return reply.send({ success: true, report });
        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({
                success: false,
                error: error.message || 'Błąd podczas wykonywania symulacji Dry-Run'
            });
        }
    });

    // ─── 6. Ręczna synchronizacja jednego źródła ───
    fastify.post('/api/pewneauto/sources/:id/sync', {
        onRequest: [fastify.authenticate, requirePermission('stock:sources:write')]
    }, async (request, reply) => {
        try {
            const { id } = request.params as { id: string };
            const body = (request.body || {}) as { forceSync?: boolean };
            const source = await fastify.prisma.pewneAutoSource.findUnique({ where: { id } });
            if (!source) {
                return reply.status(404).send({ error: 'Źródło nie istnieje' });
            }
            if (!source.isEnabled) {
                return reply.status(400).send({ error: 'Źródło jest wyłączone' });
            }

            const user = request.user as { userId: string };
            const result = await syncPewneAutoSource(fastify.prisma, source, {
                userId: user.userId,
                dryRun: false,
                forceSync: Boolean(body.forceSync)
            });

            return reply.send({ success: true, result });
        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({
                success: false,
                error: error.message || 'Błąd synchronizacji źródła PewneAuto'
            });
        }
    });

    // ─── 7. Globalna synchronizacja wszystkich aktywnych źródeł ───
    fastify.post('/api/pewneauto/sync', {
        onRequest: [fastify.authenticate, requirePermission('stock:sources:write')]
    }, async (request, reply) => {
        try {
            const user = request.user as { userId: string };
            const summary = await syncAllPewneAutoSources(fastify.prisma, user.userId);
            return reply.send({ success: true, summary });
        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({
                success: false,
                error: error.message || 'Błąd globalnej synchronizacji PewneAuto'
            });
        }
    });
};
