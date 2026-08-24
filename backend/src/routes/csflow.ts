import { FastifyPluginAsync } from 'fastify';
import { requirePermission } from '../middleware/permissions.js';
import { syncAllCSFlowSources, syncCSFlowAPI } from '../services/csflow.service.js';

function slugify(name: string): string {
    return name
        .toLowerCase()
        .replace(/ł/g, 'l')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function isValidCsflowUrl(apiUrl: string): boolean {
    try {
        const u = new URL(apiUrl);
        return u.protocol === 'https:' && u.hostname.endsWith('.csflow.pl');
    } catch {
        return false;
    }
}

export const csflowRoutes: FastifyPluginAsync = async (fastify) => {
    // Ręczna synchronizacja WSZYSTKICH włączonych źródeł CSFlow
    fastify.post('/api/csflow/sync', {
        onRequest: [fastify.authenticate, requirePermission('stock:sources:write')]
    }, async (request, reply) => {
        try {
            const user = request.user as { userId: string };
            const result = await syncAllCSFlowSources(fastify.prisma, user.userId);
            if ((result as any).skipped) {
                return reply.status(400).send({
                    success: false,
                    error: 'Synchronizacja z CSFlow jest wyłączona w ustawieniach.'
                });
            }
            return reply.send({ success: true, result });
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                success: false,
                error: 'Wystąpił błąd podczas ręcznej synchronizacji CSFlow API'
            });
        }
    });

    // Lista źródeł z licznikiem aktywnych ofert
    fastify.get('/api/csflow/sources', {
        onRequest: [fastify.authenticate, requirePermission('stock:sources:write')]
    }, async (_request, reply) => {
        const sources = await fastify.prisma.csflowSource.findMany({
            orderBy: { createdAt: 'asc' },
            include: {
                dealerGroup: { select: { id: true, name: true } },
                _count: { select: { listings: { where: { isArchived: false } } } },
            },
        });
        return reply.send({
            sources: sources.map(({ _count, ...s }) => ({ ...s, activeListings: _count.listings })),
        });
    });

    // Nowe źródło
    fastify.post('/api/csflow/sources', {
        onRequest: [fastify.authenticate, requirePermission('stock:sources:write')]
    }, async (request, reply) => {
        const body = request.body as { name?: string; apiUrl?: string; slug?: string; dealerGroupId?: string | null };
        if (!body.name?.trim() || !body.apiUrl?.trim()) {
            return reply.status(400).send({ error: 'Wymagane pola: name, apiUrl' });
        }
        if (!isValidCsflowUrl(body.apiUrl)) {
            return reply.status(400).send({ error: 'apiUrl musi być adresem https w domenie *.csflow.pl' });
        }
        const slug = (body.slug?.trim() || slugify(body.name));
        if (!slug) {
            return reply.status(400).send({ error: 'Nie udało się wygenerować sluga z nazwy — podaj slug ręcznie' });
        }
        const existing = await fastify.prisma.csflowSource.findUnique({ where: { slug } });
        if (existing) {
            return reply.status(400).send({ error: `Źródło ze slugiem "${slug}" już istnieje` });
        }
        if (body.dealerGroupId) {
            const group = await fastify.prisma.dealerGroup.findUnique({ where: { id: body.dealerGroupId } });
            if (!group) return reply.status(400).send({ error: 'Wskazana grupa dealerska nie istnieje' });
        }
        const normalizedApiUrl = body.apiUrl.trim().replace(/\/+$/, '');
        const existingApiUrl = await fastify.prisma.csflowSource.findFirst({ where: { apiUrl: normalizedApiUrl } });
        if (existingApiUrl) {
            return reply.status(400).send({ error: 'Źródło z tym adresem API już istnieje' });
        }
        try {
            const source = await fastify.prisma.csflowSource.create({
                data: {
                    name: body.name.trim(),
                    slug,
                    apiUrl: normalizedApiUrl,
                    dealerGroupId: body.dealerGroupId || null,
                },
            });
            return reply.status(201).send({ source });
        } catch (error) {
            if ((error as { code?: string }).code === 'P2002') {
                return reply.status(400).send({ error: `Źródło ze slugiem "${slug}" już istnieje` });
            }
            throw error;
        }
    });

    // Edycja źródła (slug niezmienialny — stabilność identyfikatorów ofert)
    fastify.patch('/api/csflow/sources/:id', {
        onRequest: [fastify.authenticate, requirePermission('stock:sources:write')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = request.body as { name?: string; apiUrl?: string; dealerGroupId?: string | null; isEnabled?: boolean };
        const existing = await fastify.prisma.csflowSource.findUnique({ where: { id } });
        if (!existing) return reply.status(404).send({ error: 'Źródło nie istnieje' });

        if (body.apiUrl !== undefined && !isValidCsflowUrl(body.apiUrl)) {
            return reply.status(400).send({ error: 'apiUrl musi być adresem https w domenie *.csflow.pl' });
        }
        if (body.dealerGroupId) {
            const group = await fastify.prisma.dealerGroup.findUnique({ where: { id: body.dealerGroupId } });
            if (!group) return reply.status(400).send({ error: 'Wskazana grupa dealerska nie istnieje' });
        }

        let normalizedApiUrl: string | undefined;
        if (body.apiUrl !== undefined) {
            normalizedApiUrl = body.apiUrl.trim().replace(/\/+$/, '');
            const existingApiUrl = await fastify.prisma.csflowSource.findFirst({
                where: { apiUrl: normalizedApiUrl, id: { not: id } },
            });
            if (existingApiUrl) {
                return reply.status(400).send({ error: 'Źródło z tym adresem API już istnieje' });
            }
        }

        const source = await fastify.prisma.csflowSource.update({
            where: { id },
            data: {
                ...(body.name !== undefined ? { name: body.name.trim() } : {}),
                ...(normalizedApiUrl !== undefined ? { apiUrl: normalizedApiUrl } : {}),
                ...(body.dealerGroupId !== undefined ? { dealerGroupId: body.dealerGroupId || null } : {}),
                ...(body.isEnabled !== undefined ? { isEnabled: Boolean(body.isEnabled) } : {}),
            },
        });

        // Wyłączenie źródła archiwizuje jego aktywne oferty (analogicznie do globalnego wyłącznika)
        if (existing.isEnabled === true && body.isEnabled === false) {
            const archived = await fastify.prisma.listing.updateMany({
                where: { csflowSourceId: id, isArchived: false },
                data: { isArchived: true, archivedAt: new Date(), archivedReason: 'csflow_source_disabled' },
            });
            fastify.log.info(`[CSFlow] Wyłączono źródło ${existing.slug} — zarchiwizowano ${archived.count} ofert`);
        }

        return reply.send({ source });
    });

    // Ręczna synchronizacja jednego źródła
    fastify.post('/api/csflow/sources/:id/sync', {
        onRequest: [fastify.authenticate, requirePermission('stock:sources:write')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const settings = await fastify.prisma.appSettings.findUnique({ where: { id: 'default' } });
        if (settings?.csflowEnabled === false) {
            return reply.status(400).send({ success: false, error: 'Synchronizacja z CSFlow jest wyłączona w ustawieniach.' });
        }
        const source = await fastify.prisma.csflowSource.findUnique({ where: { id } });
        if (!source) return reply.status(404).send({ success: false, error: 'Źródło nie istnieje' });
        if (!source.isEnabled) return reply.status(400).send({ success: false, error: 'Źródło jest wyłączone' });

        try {
            const user = request.user as { userId: string };
            const result = await syncCSFlowAPI(fastify.prisma, source, user.userId);
            return reply.send({ success: true, result });
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ success: false, error: 'Błąd synchronizacji źródła CSFlow' });
        }
    });
};
