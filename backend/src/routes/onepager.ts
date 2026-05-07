import { FastifyInstance } from 'fastify';
import { getBrowser } from '../services/puppeteer.js';

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

  fastify.get('/api/onepager/pdf', async (req, reply) => {
    const { ids } = req.query as { ids?: string };

    if (ids !== undefined && !ID_REGEX.test(ids)) {
      return reply.code(400).send({ error: 'Invalid ids format' });
    }

    const internalBase = process.env.INTERNAL_FRONTEND_URL || 'http://frontend:80';
    const idsQs = ids ? `&ids=${encodeURIComponent(ids)}` : '';
    const url = `${internalBase}/dla-firm?print=1${idsQs}`;

    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
      await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 2 });
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 });
      await page.waitForSelector('[data-onepager-ready]', { timeout: 10000 });

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
      });

      const filename = `carsalon-oferta-${new Date().toISOString().slice(0, 10)}.pdf`;
      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(pdf);
    } catch (err: any) {
      fastify.log.error(err, 'PDF generation failed');
      const isTimeout = err?.name === 'TimeoutError';
      return reply
        .code(isTimeout ? 504 : 500)
        .send({ error: isTimeout ? 'PDF generation timeout' : 'PDF generation failed' });
    } finally {
      await page.close().catch(() => {});
    }
  });
}
