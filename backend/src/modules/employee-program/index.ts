import { FastifyInstance } from 'fastify';
import { employeeAuthRoutes } from './auth/employee-auth.routes.js';
import { employeeAdminRoutes } from './admin/employee-admin.routes.js';
import { employeeCatalogRoutes } from './catalog/employee-catalog.routes.js';

export async function registerEmployeeProgramModule(app: FastifyInstance) {
  await app.register(employeeAuthRoutes);
  await app.register(employeeAdminRoutes);
  await app.register(employeeCatalogRoutes);
  app.log.info('Employee Program module registered successfully');
}
