import { FastifyInstance } from 'fastify';
import { authorizeRoles } from '../middleware/authorize.js';

const PAGE_OPTIONS = ['home', 'offers', 'contact'] as const;

type FaqPayload = {
    id?: string;
    page: (typeof PAGE_OPTIONS)[number];
    sortOrder?: number;
    questionPl: string;
    answerPl: string;
    questionEn: string;
    answerEn: string;
    questionDe: string;
    answerDe: string;
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

        const entries = await fastify.prisma.faqEntry.findMany({
            where,
            orderBy: [
                { page: 'asc' },
                { sortOrder: 'asc' },
                { createdAt: 'desc' }
            ]
        });

        return { entries };
    });

    // Create or update FAQ entry
    fastify.post('/api/faq', {
        preHandler: [fastify.authenticate, authorizeRoles(['admin', 'manager'])]
    }, async (request, reply) => {
        const payload = request.body as FaqPayload;

        if (!payload.page || !PAGE_OPTIONS.includes(payload.page)) {
            return reply.code(400).send({ error: 'Invalid or missing page' });
        }

        const requiredFields = [
            'questionPl',
            'answerPl',
            'questionEn',
            'answerEn',
            'questionDe',
            'answerDe'
        ] as const;

        for (const field of requiredFields) {
            if (!payload[field] || payload[field].trim() === '') {
                return reply.code(400).send({ error: `${field} is required` });
            }
        }

        const data = {
            page: payload.page,
            sortOrder: payload.sortOrder ?? 0,
            questionPl: payload.questionPl.trim(),
            answerPl: payload.answerPl.trim(),
            questionEn: payload.questionEn.trim(),
            answerEn: payload.answerEn.trim(),
            questionDe: payload.questionDe.trim(),
            answerDe: payload.answerDe.trim(),
            isPublished: payload.isPublished ?? true
        };

        let entry;
        if (payload.id) {
            try {
                entry = await fastify.prisma.faqEntry.update({
                    where: { id: payload.id },
                    data
                });
            } catch (error) {
                return reply.code(404).send({ error: 'FAQ entry not found' });
            }
        } else {
            entry = await fastify.prisma.faqEntry.create({ data });
        }

        return { entry };
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
