import { FastifyInstance } from 'fastify';
import { getBrowser } from '../services/puppeteer.js';
import { sanitizeListing, tryAuthenticate } from '../constants/dealer.js';

const ID_REGEX = /^[\w-]+(,[\w-]+)*$/;
const CACHE_KEY = 'onepager:pdf:default';
const CACHE_TTL_S = 1800;
const OFFERS_LIMIT = 9;

export async function onepagerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/onepager/offers', async (req, reply) => {
    const { ids } = req.query as { ids?: string };

    if (ids !== undefined && !ID_REGEX.test(ids)) {
      return reply.code(400).send({ error: 'Invalid ids format' });
    }

    const isAuthenticated = await tryAuthenticate(fastify, req);

    if (ids) {
      const idList = ids.split(',');
      const found = await fastify.prisma.listing.findMany({
        where: { id: { in: idList }, isArchived: false, pricePln: { gt: 0 } },
        include: { dealer: true },
      });
      const byId = new Map(found.map((l) => [l.id, l]));
      const ordered = idList.map((id) => byId.get(id)).filter(Boolean);
      return { offers: ordered.map((l) => sanitizeListing(l, isAuthenticated)) };
    }

    const featured = await fastify.prisma.listing.findMany({
      where: { isFeatured: true, isArchived: false, pricePln: { gt: 0 } },
      take: OFFERS_LIMIT,
      orderBy: { createdAt: 'desc' },
      include: { dealer: true },
    });

    if (featured.length >= OFFERS_LIMIT) {
      return { offers: featured.map((l) => sanitizeListing(l, isAuthenticated)) };
    }

    const fillCount = OFFERS_LIMIT - featured.length;
    const filler = await fastify.prisma.listing.findMany({
      where: {
        isArchived: false,
        pricePln: { gt: 0 },
        id: { notIn: featured.map((f) => f.id) },
      },
      take: fillCount,
      orderBy: { createdAt: 'desc' },
      include: { dealer: true },
    });

    return { offers: [...featured, ...filler].map((l) => sanitizeListing(l, isAuthenticated)) };
  });

  fastify.get('/api/onepager/pdf', async (req, reply) => {
    const { ids } = req.query as { ids?: string };

    if (ids !== undefined && !ID_REGEX.test(ids)) {
      return reply.code(400).send({ error: 'Invalid ids format' });
    }

    // Cache hit (default URL only)
    if (!ids) {
      const cached = await fastify.redis.getBuffer(CACHE_KEY);
      if (cached && cached.length > 0) {
        const filename = `carsalon-oferta-${new Date().toISOString().slice(0, 10)}.pdf`;
        return reply
          .header('Content-Type', 'application/pdf')
          .header('Content-Disposition', `attachment; filename="${filename}"`)
          .send(cached);
      }
    }

    const internalBase = process.env.INTERNAL_FRONTEND_URL || 'http://frontend:80';
    const publicBase = process.env.FRONTEND_URL?.replace(/\/$/, '');
    const idsQs = ids ? `&ids=${encodeURIComponent(ids)}` : '';
    const publicQs = publicBase ? `&publicBase=${encodeURIComponent(publicBase)}` : '';
    const url = `${internalBase}/dla-firmy?print=1${idsQs}${publicQs}`;

    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
      await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 1 });
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 });
      await page.waitForSelector('[data-onepager-ready]', { timeout: 10000 });
      await page.emulateMediaType('print');

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '6mm', right: '6mm', bottom: '6mm', left: '6mm' },
      });

      if (!ids) {
        await fastify.redis.set(CACHE_KEY, pdf, 'EX', CACHE_TTL_S);
      }

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
