import crypto from 'crypto';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  ThuliumWebhookConflictError,
  ThuliumWebhookNotFoundError,
  linkThuliumTicket,
} from '../services/thulium-webhook.service.js';

const thuliumWebhookSchema = z
  .object({
    event_id: z.string().min(1).max(200),
    event_type: z.enum(['TICKET_CREATED', 'CUSTOMER_CREATED', 'CUSTOMER_UPDATED']),
    opportunity_id: z.string().min(1).optional(),
    customer_phone: z.string().trim().min(3).max(64).optional(),
    thulium_ticket_id: z.number().int().positive().nullable().optional(),
    thulium_customer_id: z.number().int().positive().nullable().optional(),
  })
  .refine(
    (payload) => payload.thulium_ticket_id != null || payload.thulium_customer_id != null,
    { message: 'At least one Thulium ID is required' }
  )
  .refine(
    (payload) => payload.opportunity_id != null || payload.customer_phone != null,
    { message: 'At least one opportunity selector is required' }
  )
  .superRefine((payload, context) => {
    if (payload.event_type === 'TICKET_CREATED' && payload.thulium_ticket_id == null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'TICKET_CREATED requires thulium_ticket_id' });
    }
    if (payload.event_type !== 'TICKET_CREATED' && payload.thulium_customer_id == null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Customer event requires thulium_customer_id' });
    }
  });

function hasValidWebhookBasicAuth(authorization: string | undefined, user: string, password: string): boolean {
  const providedCredentials = authorization?.match(/^Basic\s+(.+)$/i)?.[1];
  if (!providedCredentials) return false;

  const decoded = Buffer.from(providedCredentials, 'base64').toString('utf8');
  const provided = Buffer.from(decoded);
  const expected = Buffer.from(`${user}:${password}`);
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}

export async function registerThuliumWebhookRoutes(app: FastifyInstance) {
  app.post('/api/pipeline/integrations/thulium/webhook', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const webhookUser = process.env.THULIUM_WEBHOOK_USER;
    const webhookPassword = process.env.THULIUM_WEBHOOK_PASSWORD;
    if (!webhookUser || !webhookPassword) {
      request.log.error('THULIUM_WEBHOOK_USER / THULIUM_WEBHOOK_PASSWORD is not configured');
      return reply.code(503).send({ error: 'Thulium webhook is not configured' });
    }

    if (!hasValidWebhookBasicAuth(request.headers.authorization, webhookUser, webhookPassword)) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const parsed = thuliumWebhookSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    try {
      const result = await app.prisma.$transaction((tx) =>
        linkThuliumTicket(tx, {
          eventType: parsed.data.event_type,
          opportunityId: parsed.data.opportunity_id,
          customerPhone: parsed.data.customer_phone,
          thuliumTicketId:
            parsed.data.event_type === 'TICKET_CREATED' ? parsed.data.thulium_ticket_id : undefined,
          thuliumCustomerId: parsed.data.thulium_customer_id,
          idempotencyKey: `thulium:${parsed.data.event_id}`,
        })
      );

      if (result.status === 'unresolved') {
        const phoneDigits = parsed.data.customer_phone?.replace(/\D/g, '') ?? '';
        request.log.info(
          {
            thuliumEventId: parsed.data.event_id,
            thuliumEventType: parsed.data.event_type,
            customerPhoneSuffix: phoneDigits ? phoneDigits.slice(-4) : undefined,
            matchCount: result.matchCount,
          },
          'Thulium webhook could not be linked to a unique open opportunity'
        );
        return reply.code(204).send();
      }

      return reply.code(202).send({ accepted: true, eventId: result.eventId });
    } catch (error) {
      if (error instanceof ThuliumWebhookNotFoundError) {
        return reply.code(404).send({ error: error.message });
      }
      if (error instanceof ThuliumWebhookConflictError) {
        return reply.code(409).send({ error: error.message });
      }
      throw error;
    }
  });
}
