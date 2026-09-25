import { FastifyInstance } from 'fastify';
import { requirePermission, hasPermission } from '../middleware/permissions.js';
import { invalidateOfferCache } from '../services/cache-invalidation.service.js';

const PAGE_OPTIONS = ['home', 'offers', 'contact', 'faq', 'rental', 'financing', 'business'] as const;
const PAGE_CONTEXT_OPTIONS = ['offers', 'rental', 'all'] as const;

type FaqPayload = {
    id?: string;
    page: (typeof PAGE_OPTIONS)[number];
    pageContext?: (typeof PAGE_CONTEXT_OPTIONS)[number];
    financingType?: string;
    sortOrder?: number;
    questionPl?: string;
    answerPl?: string;
    questionEn?: string;
    answerEn?: string;
    questionDe?: string;
    answerDe?: string;
    isPublished?: boolean;
};

export async function faqRoutes(fastify: FastifyInstance) {
    // List FAQ entries
    fastify.get('/api/faq', async (request, reply) => {
        const { page } = request.query as { page?: string };
        const hasAuthHeader = Boolean(request.headers.authorization);

        // Try to authenticate; if missing/invalid token, proceed as public
        let canReadUnpublished = false;
        try {
            await request.jwtVerify();
            const user = (request as any).user;
            if (user && (user.role === 'admin' || hasPermission(user.memberships, user.activeContext, 'content:read'))) {
                canReadUnpublished = true;
            }
        } catch {
            canReadUnpublished = false;
        }

        const normalizedPage = PAGE_OPTIONS.find((opt) => opt === page);
        const where: any = {};
        if (normalizedPage) where.page = normalizedPage;
        // Filter by pageContext if provided
        const { pageContext } = request.query as { pageContext?: string };
        if (pageContext && PAGE_CONTEXT_OPTIONS.includes(pageContext as any)) {
            where.pageContext = { in: ['all', pageContext] };
        }

        // Filter by financingType if provided
        const { financingType } = request.query as { financingType?: string };
        if (financingType) {
            where.OR = [
                { financingType },
                { financingType: null },
                { financingType: 'all' }
            ];
        }

        // Only users with content:read can see unpublished entries
        if (!canReadUnpublished) {
            where.isPublished = true;
        }

        try {
            const entries = await fastify.prisma.faqEntry.findMany({
                where,
                orderBy: [
                    { page: 'asc' },
                    { sortOrder: 'asc' },
                    { createdAt: 'desc' }
                ]
            });

            // Odpowiedź zależy od Authorization (widoczność nieopublikowanych wpisów), więc
            // przy edge-cache'owaniu żądania z tokenem nie mogą trafić do publicznego cache'a.
            reply.header('Cache-Control', hasAuthHeader ? 'private, no-store' : 'public, max-age=0, s-maxage=300');
            return { entries };
        } catch (error) {
            fastify.log.error(error, 'FAQ: List failed');
            return reply.code(500).send({
                error: 'Internal Server Error',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // Create or update FAQ entry
    fastify.post('/api/faq', {
        preHandler: [fastify.authenticate, requirePermission('content:write')]
    }, async (request, reply) => {
        const payload = request.body as FaqPayload;

        if (!payload.page || !PAGE_OPTIONS.includes(payload.page)) {
            return reply.code(400).send({ error: 'Invalid or missing page' });
        }

        // Check if at least one language is filled
        const hasPl = payload.questionPl?.trim() && payload.answerPl?.trim();
        const hasEn = payload.questionEn?.trim() && payload.answerEn?.trim();
        const hasDe = payload.questionDe?.trim() && payload.answerDe?.trim();

        if (!hasPl && !hasEn && !hasDe) {
            return reply.code(400).send({ error: 'At least one language must have both question and answer filled' });
        }

        const data = {
            page: payload.page,
            pageContext: PAGE_CONTEXT_OPTIONS.includes(payload.pageContext as any) ? payload.pageContext! : 'all',
            financingType: payload.financingType || null,
            sortOrder: payload.sortOrder ?? 0,
            questionPl: payload.questionPl?.trim() || '',
            answerPl: payload.answerPl?.trim() || '',
            questionEn: payload.questionEn?.trim() || '',
            answerEn: payload.answerEn?.trim() || '',
            questionDe: payload.questionDe?.trim() || '',
            answerDe: payload.answerDe?.trim() || '',
            isPublished: payload.isPublished ?? true
        };

        try {
            let entry;
            if (payload.id) {
                entry = await fastify.prisma.faqEntry.update({
                    where: { id: payload.id },
                    data
                });
            } else {
                entry = await fastify.prisma.faqEntry.create({ data });
            }

            // FAQ z page='offers'/'rental' renderuje się na KAŻDEJ stronie oferty/najmu w SSR —
            // zbiór dotkniętych URL-i jest nieograniczony, więc purgeAll-style jak przy bulk importach.
            await invalidateOfferCache(fastify, { purgeAll: true, purgeEverything: true, purgeSitemap: false }).catch(err => {
                fastify.log.warn({ err }, 'Failed to invalidate cache after FAQ save');
            });

            return { entry };
        } catch (error) {
            fastify.log.error(error, 'FAQ: Save failed');
            return reply.code(500).send({
                error: 'Internal Server Error',
                message: error instanceof Error ? error.message : 'Unknown error during FAQ save'
            });
        }
    });

    // Delete FAQ entry
    fastify.delete('/api/faq/:id', {
        preHandler: [fastify.authenticate, requirePermission('content:write')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };

        try {
            await fastify.prisma.faqEntry.delete({ where: { id } });

            await invalidateOfferCache(fastify, { purgeAll: true, purgeEverything: true, purgeSitemap: false }).catch(err => {
                fastify.log.warn({ err }, 'Failed to invalidate cache after FAQ delete');
            });

            return { success: true };
        } catch (error) {
            return reply.code(404).send({ error: 'FAQ entry not found' });
        }
    });
}
