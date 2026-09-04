import crypto from 'crypto';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  ThuliumWebhookConflictError,
  handleThuliumNotification,
  recordThuliumDeadLetter,
  type ThuliumNotification,
} from '../services/thulium-webhook.service.js';

const thuliumWebhookSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('AGENT_RINGING'),
    connection_id: z.string().min(1).max(200),
    source_number: z.string().trim().min(3).max(64),
    queue_id: z.number().int().optional(),
    agent_login: z.string().optional(),
    destination_number: z.string().optional(),
    date: z.string().optional(),
  }),
  z.object({
    action: z.literal('RECORDING_READY'),
    connection_id: z.string().min(1).max(200),
    filename: z.string().min(1),
    date: z.string().optional(),
  }),
  z.object({
    action: z.literal('TICKET_CREATED'),
    ticket_id: z.number().int().positive(),
    customer_id: z.number().int().positive(),
    agent_login: z.string().optional(),
    direction: z.string().optional(),
    date: z.string().optional(),
  }),
  z.object({
    action: z.literal('CUSTOMER_CREATED'),
    customer_id: z.number().int().positive(),
    company_id: z.number().int().optional(),
    date: z.string().optional(),
  }),
  z.object({
    action: z.literal('CUSTOMER_UPDATED'),
    customer_id: z.number().int().positive(),
    company_id: z.number().int().optional(),
    date: z.string().optional(),
  }),
]);

function hasValidWebhookBasicAuth(authorization: string | undefined, user: string, password: string): boolean {
  const providedCredentials = authorization?.match(/^Basic\s+(.+)$/i)?.[1];
  if (!providedCredentials) return false;

  const decoded = Buffer.from(providedCredentials, 'base64').toString('utf8');
  const provided = Buffer.from(decoded);
  const expected = Buffer.from(`${user}:${password}`);
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}

function toNotification(payload: z.infer<typeof thuliumWebhookSchema>): ThuliumNotification {
  switch (payload.action) {
    case 'AGENT_RINGING':
      return {
        action: 'AGENT_RINGING',
        connectionId: payload.connection_id,
        sourceNumber: payload.source_number,
        agentLogin: payload.agent_login ?? null,
      };
    case 'RECORDING_READY':
      return {
        action: 'RECORDING_READY',
        connectionId: payload.connection_id,
        filename: payload.filename,
      };
    case 'TICKET_CREATED':
      return {
        action: 'TICKET_CREATED',
        ticketId: payload.ticket_id,
        customerId: payload.customer_id,
      };
    case 'CUSTOMER_CREATED':
    case 'CUSTOMER_UPDATED':
      return { action: payload.action, customerId: payload.customer_id };
  }
}

function buildIdempotencyKey(payload: z.infer<typeof thuliumWebhookSchema>): string {
  switch (payload.action) {
    case 'AGENT_RINGING':
      return `thulium:ringing:${payload.connection_id}`;
    case 'RECORDING_READY':
      return `thulium:recording:${payload.connection_id}`;
    case 'TICKET_CREATED':
      return `thulium:ticket:${payload.ticket_id}`;
    case 'CUSTOMER_CREATED':
    case 'CUSTOMER_UPDATED':
      return `thulium:customer:${payload.customer_id}:${payload.date ?? 'nodate'}`;
  }
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
      const rawBody = request.body as Record<string, unknown> | undefined;
      const action = typeof rawBody?.action === 'string' ? rawBody.action : 'UNKNOWN';
      try {
        await recordThuliumDeadLetter(app.prisma, {
          action,
          reason: 'invalid_payload',
          payload: request.body,
        });
      } catch (deadLetterError) {
        request.log.error(deadLetterError, 'Failed to record Thulium dead letter for invalid payload');
      }
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    try {
      const result = await app.prisma.$transaction(async (tx) => {
        const handled = await handleThuliumNotification(tx, {
          notification: toNotification(parsed.data),
          idempotencyKey: buildIdempotencyKey(parsed.data),
        });

        if (handled.status === 'unresolved' && handled.reason !== 'not_actionable_without_thulium_client') {
          const phoneSuffix =
            parsed.data.action === 'AGENT_RINGING'
              ? (() => {
                  const digits = parsed.data.source_number.replace(/\D/g, '');
                  return digits ? digits.slice(-4) : null;
                })()
              : null;
          await recordThuliumDeadLetter(tx, {
            action: parsed.data.action,
            reason: handled.reason,
            payload: parsed.data,
            phoneSuffix,
          });
        }

        return handled;
      });

      if (result.status === 'unresolved') {
        const logContext: Record<string, unknown> = {
          action: parsed.data.action,
          reason: result.reason,
        };
        if ('connection_id' in parsed.data) logContext.connection_id = parsed.data.connection_id;
        if ('ticket_id' in parsed.data) logContext.ticket_id = parsed.data.ticket_id;
        if ('customer_id' in parsed.data) logContext.customer_id = parsed.data.customer_id;
        if (parsed.data.action === 'AGENT_RINGING') {
          const digits = parsed.data.source_number.replace(/\D/g, '');
          logContext.sourceNumberSuffix = digits ? digits.slice(-4) : undefined;
        }
        request.log.info(logContext, 'Thulium webhook notification could not be linked');
        return reply.code(204).send();
      }

      return reply.code(202).send({ accepted: true, eventId: result.eventId });
    } catch (error) {
      if (error instanceof ThuliumWebhookConflictError) {
        return reply.code(409).send({ error: error.message });
      }
      throw error;
    }
  });
}
