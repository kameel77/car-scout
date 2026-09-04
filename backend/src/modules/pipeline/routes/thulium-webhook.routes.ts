import crypto from 'crypto';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  ThuliumWebhookConflictError,
  handleThuliumNotification,
  recordThuliumDeadLetter,
  type ThuliumNotification,
} from '../services/thulium-webhook.service.js';

// Thulium sends webhooks as application/x-www-form-urlencoded, so every value arrives as a
// string, and empty fields are serialized as the literal string "null" (not an empty string).
// Normalize those away to `undefined` before validation, once, for the whole payload — rather
// than patching each optional field individually — so both numeric and text optional fields are
// covered.
function normalizeThuliumPayload(input: unknown): unknown {
  if (typeof input !== 'object' || input === null) return input;

  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    normalized[key] = typeof value === 'string' && ['', 'null', 'undefined'].includes(value.trim()) ? undefined : value;
  }
  return normalized;
}

const thuliumWebhookPayloadSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('AGENT_RINGING'),
    connection_id: z.string().min(1).max(200),
    source_number: z.string().trim().min(3).max(64),
    queue_id: z.coerce.number().int().optional(),
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
    ticket_id: z.coerce.number().int().positive(),
    customer_id: z.coerce.number().int().positive(),
    agent_login: z.string().optional(),
    direction: z.string().optional(),
    date: z.string().optional(),
  }),
  z.object({
    action: z.literal('CUSTOMER_CREATED'),
    customer_id: z.coerce.number().int().positive(),
    company_id: z.coerce.number().int().optional(),
    date: z.string().optional(),
  }),
  z.object({
    action: z.literal('CUSTOMER_UPDATED'),
    customer_id: z.coerce.number().int().positive(),
    company_id: z.coerce.number().int().optional(),
    date: z.string().optional(),
  }),
]);

const thuliumWebhookSchema = z.preprocess(normalizeThuliumPayload, thuliumWebhookPayloadSchema);

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
  await app.register(async (scoped) => {
    // Thulium's docs don't state a Content-Type, and the flat payload shape suggests
    // application/x-www-form-urlencoded, but we have no proof from production. So we accept
    // both, and log the actual Content-Type for anything unrecognized to learn the truth.
    //
    // Drop the inherited default text/plain parser (which just returns the raw string body)
    // so that an unexpected text/plain request falls through to our '*' catch-all below
    // instead of being handled — unparsed — by Fastify's built-in parser.
    scoped.removeContentTypeParser('text/plain');

    scoped.addContentTypeParser<string>(
      'application/x-www-form-urlencoded',
      { parseAs: 'string' },
      (_request, body, done) => {
        try {
          done(null, body === '' ? {} : Object.fromEntries(new URLSearchParams(body)));
        } catch (error) {
          done(error as Error);
        }
      }
    );

    scoped.addContentTypeParser<string>('*', { parseAs: 'string' }, (request, body, done) => {
      scoped.log.warn(
        { contentType: request.headers['content-type'] ?? null },
        'Thulium webhook: nieznany Content-Type'
      );

      if (body === '') {
        done(null, {});
        return;
      }

      try {
        done(null, JSON.parse(body));
        return;
      } catch {
        // fall through to the form-urlencoded fallback below
      }

      try {
        done(null, Object.fromEntries(new URLSearchParams(body)));
      } catch {
        const error: Error & { statusCode?: number } = new Error(
          'Nie udało się rozpoznać treści żądania Thulium'
        );
        error.statusCode = 400;
        done(error);
      }
    });

    scoped.post(
      '/api/pipeline/integrations/thulium/webhook',
      { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
      async (request, reply) => {
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
      }
    );
  });
}
