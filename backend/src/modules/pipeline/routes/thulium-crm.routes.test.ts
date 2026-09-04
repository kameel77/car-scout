import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerThuliumCrmRoutes } from './thulium-crm.routes.js';

vi.mock('../services/thulium-crm-lookup.service.js', () => ({
  lookupCustomerByPhone: vi.fn(),
}));

import { lookupCustomerByPhone } from '../services/thulium-crm-lookup.service.js';

describe('Thulium external CRM customer-lookup route', () => {
  const originalUser = process.env.THULIUM_WEBHOOK_USER;
  const originalPassword = process.env.THULIUM_WEBHOOK_PASSWORD;
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    process.env.THULIUM_WEBHOOK_USER = 'motolia-webhook';
    process.env.THULIUM_WEBHOOK_PASSWORD = 'test-thulium-webhook-password';
    vi.mocked(lookupCustomerByPhone).mockReset();
    app = Fastify({ logger: false });
    app.decorate('prisma', {} as any);
    await app.register(rateLimit, { global: false });
    await registerThuliumCrmRoutes(app);
  });

  afterEach(async () => {
    await app.close();
    if (originalUser === undefined) delete process.env.THULIUM_WEBHOOK_USER;
    else process.env.THULIUM_WEBHOOK_USER = originalUser;
    if (originalPassword === undefined) delete process.env.THULIUM_WEBHOOK_PASSWORD;
    else process.env.THULIUM_WEBHOOK_PASSWORD = originalPassword;
  });

  function inject(query: string, headers: Record<string, string> = {}) {
    return app.inject({
      method: 'GET',
      url: `/api/pipeline/integrations/thulium/customer-lookup${query}`,
      headers: {
        authorization: 'Basic ' + Buffer.from('motolia-webhook:test-thulium-webhook-password').toString('base64'),
        ...headers,
      },
    });
  }

  it('returns 200 with the correct Content-Type for a known number', async () => {
    vi.mocked(lookupCustomerByPhone).mockResolvedValue({
      name: 'Jan',
      surname: 'Kowalski',
      phone_number: ['+48523993855'],
      email: null,
      nip: null,
      identifier: 'MTL-2026-00042',
      custom_fields: {},
    });

    const response = await inject('?phone_number=523993855');

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('application/json;charset=utf-8');
    expect(response.json()).toEqual({
      name: 'Jan',
      surname: 'Kowalski',
      phone_number: ['+48523993855'],
      email: null,
      nip: null,
      identifier: 'MTL-2026-00042',
      custom_fields: {},
    });
  });

  it('returns 404 for an unknown number', async () => {
    vi.mocked(lookupCustomerByPhone).mockResolvedValue(null);

    const response = await inject('?phone_number=523993855');

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'Customer not found' });
  });

  it('returns 400 without phone_number', async () => {
    const response = await inject('');

    expect(response.statusCode).toBe(400);
    expect(lookupCustomerByPhone).not.toHaveBeenCalled();
  });

  it('returns 401 without an Authorization header', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/pipeline/integrations/thulium/customer-lookup?phone_number=523993855',
    });

    expect(response.statusCode).toBe(401);
    expect(lookupCustomerByPhone).not.toHaveBeenCalled();
  });

  it('returns 401 with the wrong password', async () => {
    const response = await inject('?phone_number=523993855', {
      authorization: 'Basic ' + Buffer.from('motolia-webhook:wrong-password').toString('base64'),
    });

    expect(response.statusCode).toBe(401);
    expect(lookupCustomerByPhone).not.toHaveBeenCalled();
  });

  it('returns 503 when the credentials are not configured', async () => {
    delete process.env.THULIUM_WEBHOOK_USER;
    delete process.env.THULIUM_WEBHOOK_PASSWORD;

    const response = await inject('?phone_number=523993855');

    expect(response.statusCode).toBe(503);
  });
});
