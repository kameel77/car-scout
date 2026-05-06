import { FastifyInstance } from 'fastify';

const ID_REGEX = /^[\w-]+(,[\w-]+)*$/;

export async function onepagerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/onepager/offers', async (req, reply) => {
    const { ids } = req.query as { ids?: string };

    if (ids !== undefined && !ID_REGEX.test(ids)) {
      return reply.code(400).send({ error: 'Invalid ids format' });
    }

    if (ids) {
      const idList = ids.split(',');
      const found = await fastify.prisma.listing.findMany({
        where: { id: { in: idList }, isArchived: false },
        include: { dealer: true },
      });
      const byId = new Map(found.map((l) => [l.id, l]));
      const ordered = idList.map((id) => byId.get(id)).filter(Boolean);
      return { offers: ordered };
    }

    const featured = await fastify.prisma.listing.findMany({
      where: { isFeatured: true, isArchived: false },
      take: 6,
      orderBy: { createdAt: 'desc' },
      include: { dealer: true },
    });

    if (featured.length >= 6) {
      return { offers: featured };
    }

    const fillCount = 6 - featured.length;
    const filler = await fastify.prisma.listing.findMany({
      where: {
        isArchived: false,
        id: { notIn: featured.map((f) => f.id) },
      },
      take: fillCount,
      orderBy: { createdAt: 'desc' },
      include: { dealer: true },
    });

    return { offers: [...featured, ...filler] };
  });
}
