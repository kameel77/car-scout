import { FastifyInstance } from 'fastify';
import { employeeAuthRoutes } from './auth/employee-auth.routes.js';
import { employeeAdminRoutes } from './admin/employee-admin.routes.js';

export async function registerEmployeeProgramModule(app: FastifyInstance) {
  await app.register(employeeAuthRoutes);
  await app.register(employeeAdminRoutes);
  app.log.info('Employee Program module registered successfully');
}
