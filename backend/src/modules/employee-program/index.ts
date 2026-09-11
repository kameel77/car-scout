import { FastifyInstance } from 'fastify';
import { employeeAuthRoutes } from './auth/employee-auth.routes.js';

export async function registerEmployeeProgramModule(app: FastifyInstance) {
  await app.register(employeeAuthRoutes);
  app.log.info('Employee Program module registered successfully');
}
