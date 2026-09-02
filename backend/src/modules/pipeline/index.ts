import { FastifyInstance } from 'fastify';
import { registerQueueRoutes } from './routes/queue.routes.js';
import { registerOpportunityRoutes } from './routes/opportunities.routes.js';
import { registerInboxRoutes } from './routes/inbox.routes.js';
import { registerDictionaryRoutes } from './routes/dictionaries.routes.js';

export async function registerPipelineModule(app: FastifyInstance) {
  await registerQueueRoutes(app);
  await registerOpportunityRoutes(app);
  await registerInboxRoutes(app);
  await registerDictionaryRoutes(app);
  app.log.info('Pipeline CRM module registered successfully');
}
