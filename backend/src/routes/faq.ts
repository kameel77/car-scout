import { FastifyInstance } from 'fastify';
import { authorizeRoles } from '../middleware/authorize.js';

const PAGE_OPTIONS = ['home', 'offers', 'contact', 'faq'] as const;

type FaqPayload = {
    id?: string;
    page: (typeof PAGE_OPTIONS)[number];
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

        // Try to authenticate; if missing/invalid token, proceed as public
        let role: string | undefined;
        try {
            await request.jwtVerify();
            role = (request as any).user?.role;
        } catch {
            role = undefined;
        }

        const normalizedPage = PAGE_OPTIONS.find((opt) => opt === page);
        const where: any = {};
        if (normalizedPage) where.page = normalizedPage;
        // Only admins/managers can see unpublished entries
        if (role !== 'admin' && role !== 'manager') {
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
        preHandler: [fastify.authenticate, authorizeRoles(['admin', 'manager'])]
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
        preHandler: [fastify.authenticate, authorizeRoles(['admin', 'manager'])]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };

        try {
            await fastify.prisma.faqEntry.delete({ where: { id } });
            return { success: true };
        } catch (error) {
            return reply.code(404).send({ error: 'FAQ entry not found' });
        }
    });
}
