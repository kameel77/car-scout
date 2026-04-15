import { FastifyInstance } from 'fastify';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

export async function debugRoutes(fastify: FastifyInstance) {
    fastify.get('/api/debug/db-push', async (request, reply) => {
        try {
            const { stdout, stderr } = await execAsync('npx prisma db push --accept-data-loss');
            return { success: true, stdout, stderr };
        } catch (error: any) {
            return reply.code(500).send({ success: false, error: error.message, stdout: error.stdout, stderr: error.stderr });
        }
    });
}
