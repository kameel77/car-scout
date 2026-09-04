import crypto from 'crypto';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { lookupCustomerByPhone } from '../services/thulium-crm-lookup.service.js';

const customerLookupQuerySchema = z.object({
  phone_number: z.string().trim().min(3).max(64),
});

function hasValidBasicAuth(authorization: string | undefined, user: string, password: string): boolean {
  const providedCredentials = authorization?.match(/^Basic\s+(.+)$/i)?.[1];
  if (!providedCredentials) return false;

  const decoded = Buffer.from(providedCredentials, 'base64').toString('utf8');
  const provided = Buffer.from(decoded);
  const expected = Buffer.from(`${user}:${password}`);
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}

export async function registerThuliumCrmRoutes(app: FastifyInstance) {
  app.get('/api/pipeline/integrations/thulium/customer-lookup', {
    config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const webhookUser = process.env.THULIUM_WEBHOOK_USER;
    const webhookPassword = process.env.THULIUM_WEBHOOK_PASSWORD;
    if (!webhookUser || !webhookPassword) {
      request.log.error('THULIUM_WEBHOOK_USER / THULIUM_WEBHOOK_PASSWORD is not configured');
      return reply.code(503).send({ error: 'Thulium external CRM lookup is not configured' });
    }

    if (!hasValidBasicAuth(request.headers.authorization, webhookUser, webhookPassword)) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const parsed = customerLookupQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const customer = await lookupCustomerByPhone(app.prisma, parsed.data.phone_number);
    if (!customer) {
      return reply.code(404).send({ error: 'Customer not found' });
    }

    reply.header('Content-Type', 'application/json;charset=utf-8');
    return reply.code(200).send(customer);
  });
}
