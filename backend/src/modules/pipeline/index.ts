import { FastifyInstance } from 'fastify';
import { registerQueueRoutes } from './routes/queue.routes.js';
import { registerOpportunityRoutes } from './routes/opportunities.routes.js';
import { registerInboxRoutes } from './routes/inbox.routes.js';
import { registerDictionaryRoutes } from './routes/dictionaries.routes.js';
import { registerVehicleRoutes } from './routes/vehicles.routes.js';
import { registerOfferRoutes } from './routes/offers.routes.js';
import { registerApplicationRoutes } from './routes/applications.routes.js';
import { registerDocumentRoutes } from './routes/documents.routes.js';
import { registerThuliumWebhookRoutes } from './routes/thulium-webhook.routes.js';

export async function registerPipelineModule(app: FastifyInstance) {
  await registerQueueRoutes(app);
  await registerOpportunityRoutes(app);
  await registerInboxRoutes(app);
  await registerDictionaryRoutes(app);
  await registerVehicleRoutes(app);
  await registerOfferRoutes(app);
  await registerApplicationRoutes(app);
  await registerDocumentRoutes(app);
  await registerThuliumWebhookRoutes(app);
  app.log.info('Pipeline CRM module registered successfully');
}
