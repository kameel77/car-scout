import { FastifyReply, FastifyRequest } from 'fastify';

export function authorizeRoles(roles: string[]) {
    return async function (request: FastifyRequest, reply: FastifyReply) {
        const role = (request.user as any)?.role;
        if (!role || !roles.includes(role)) {
            return reply.code(403).send({ error: 'Forbidden' });
        }
    };
}
