import { FastifyInstance } from 'fastify';
import { authorizeRoles } from '../middleware/authorize.js';
import { getSeoContentPage } from '../services/seo-content.js';
import { slugifyBrandName } from '../services/brand-pages.service.js';

// urlPath admin CRUD musi pasować do wzorca stron marek/modeli (spec §5): /samochody/<segment>
// lub /samochody/<segment>/<segment>. Segmenty są normalizowane tym samym slugifierem co
// katalog marek/modeli (slugifyBrandName), żeby zapis zawsze lądował na kanonicznym slugu
// niezależnie od tego, co dokładnie przyszło od klienta (np. surowa nazwa marki z
// diakrytykami spoza polskiego alfabetu — Škoda, Citroën) — zamiast tylko walidować regexem
// zakładającym, że urlPath jest już poprawnie zesluggowany.
const URL_PATH_SHAPE_RE = /^\/samochody\/([^/]+)(?:\/([^/]+))?$/;

function normalizeUrlPath(urlPath: string): string | null {
    const match = urlPath.match(URL_PATH_SHAPE_RE);
    if (!match) return null;
    const makeSlug = slugifyBrandName(match[1]);
    if (!makeSlug) return null;
    if (match[2] === undefined) return `/samochody/${makeSlug}`;
    const modelSlug = slugifyBrandName(match[2]);
    if (!modelSlug) return null;
    return `/samochody/${makeSlug}/${modelSlug}`;
}

export async function seoContentRoutes(fastify: FastifyInstance) {
    // Public: treść CMS dla SPA (SearchPage na trasach marki/modelu) — tylko opublikowane.
    // Ten sam HTML co w SSR (/api/render), więc treść jest identyczna dla każdego User-Agenta.
    fastify.get('/api/seo-content', async (request, reply) => {
        const { path: urlPath } = request.query as { path?: string };
        if (!urlPath) return reply.code(400).send({ error: 'path is required' });

        const content = await getSeoContentPage(fastify, urlPath);
        if (!content) return reply.code(404).send({ error: 'Not found' });

        reply.header('Cache-Control', 'public, max-age=60');
        return { html: content.html, metaTitle: content.metaTitle, metaDescription: content.metaDescription };
    });

    // Admin: list all (published + draft)
    fastify.get('/api/admin/seo-content', {
        preHandler: [fastify.authenticate, authorizeRoles(['admin', 'manager'])]
    }, async () => {
        const pages = await fastify.prisma.seoContentPage.findMany({ orderBy: { urlPath: 'asc' } });
        return { pages };
    });

    // Admin: create
    fastify.post('/api/admin/seo-content', {
        preHandler: [fastify.authenticate, authorizeRoles(['admin', 'manager'])]
    }, async (request, reply) => {
        const body = request.body as {
            urlPath?: string;
            contentMd?: string;
            metaTitle?: string | null;
            metaDescription?: string | null;
            isPublished?: boolean;
        };
        const normalizedUrlPath = body.urlPath ? normalizeUrlPath(body.urlPath) : null;
        if (!normalizedUrlPath) {
            return reply.code(400).send({ error: 'urlPath must match /samochody/<slug> or /samochody/<slug>/<slug>' });
        }
        if (!body.contentMd?.trim()) {
            return reply.code(400).send({ error: 'contentMd is required' });
        }

        try {
            const page = await fastify.prisma.seoContentPage.create({
                data: {
                    urlPath: normalizedUrlPath,
                    contentMd: body.contentMd,
                    metaTitle: body.metaTitle || null,
                    metaDescription: body.metaDescription || null,
                    isPublished: body.isPublished ?? false,
                },
            });
            return { page };
        } catch (error: any) {
            if (error?.code === 'P2002') return reply.code(409).send({ error: 'urlPath already exists' });
            fastify.log.error(error, 'SeoContentPage: create failed');
            return reply.code(500).send({ error: 'Internal Server Error' });
        }
    });

    // Admin: update
    fastify.put('/api/admin/seo-content/:id', {
        preHandler: [fastify.authenticate, authorizeRoles(['admin', 'manager'])]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = request.body as {
            urlPath?: string;
            contentMd?: string;
            metaTitle?: string | null;
            metaDescription?: string | null;
            isPublished?: boolean;
        };
        let normalizedUrlPath: string | undefined;
        if (body.urlPath !== undefined) {
            const normalized = normalizeUrlPath(body.urlPath);
            if (!normalized) {
                return reply.code(400).send({ error: 'urlPath must match /samochody/<slug> or /samochody/<slug>/<slug>' });
            }
            normalizedUrlPath = normalized;
        }
        if (body.contentMd !== undefined && !body.contentMd.trim()) {
            return reply.code(400).send({ error: 'contentMd is required' });
        }

        try {
            const page = await fastify.prisma.seoContentPage.update({
                where: { id },
                data: {
                    ...(normalizedUrlPath !== undefined ? { urlPath: normalizedUrlPath } : {}),
                    ...(body.contentMd !== undefined ? { contentMd: body.contentMd } : {}),
                    ...(body.metaTitle !== undefined ? { metaTitle: body.metaTitle || null } : {}),
                    ...(body.metaDescription !== undefined ? { metaDescription: body.metaDescription || null } : {}),
                    ...(body.isPublished !== undefined ? { isPublished: body.isPublished } : {}),
                },
            });
            return { page };
        } catch (error: any) {
            if (error?.code === 'P2002') return reply.code(409).send({ error: 'urlPath already exists' });
            if (error?.code === 'P2025') return reply.code(404).send({ error: 'Not found' });
            fastify.log.error(error, 'SeoContentPage: update failed');
            return reply.code(500).send({ error: 'Internal Server Error' });
        }
    });

    // Admin: delete
    fastify.delete('/api/admin/seo-content/:id', {
        preHandler: [fastify.authenticate, authorizeRoles(['admin', 'manager'])]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        try {
            await fastify.prisma.seoContentPage.delete({ where: { id } });
            return { success: true };
        } catch {
            return reply.code(404).send({ error: 'Not found' });
        }
    });
}
