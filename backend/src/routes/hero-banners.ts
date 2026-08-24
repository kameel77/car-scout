import { FastifyInstance } from 'fastify';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { requirePermission } from '../middleware/permissions.js';
import { optimizeAndSaveImage } from '../services/image-optimizer.js';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const BANNERS_DIR = path.join(UPLOADS_DIR, 'hero-banners');
const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BANNER_IMAGE_SIZE = 8 * 1024 * 1024;
const ALIGN_VALUES = new Set(['left', 'center', 'right']);

type BannerBody = {
  altText?: string;
  buttonLabel?: string;
  buttonUrl?: string;
  buttonPositionYPct?: number;
  buttonAlign?: string;
  isActive?: boolean;
};

function clampPct(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return undefined;
  return Math.min(100, Math.max(0, n));
}

async function unlinkBannerImage(imageUrl: string | null) {
  if (!imageUrl?.startsWith('/uploads/hero-banners/')) return;
  const oldPath = path.join(process.cwd(), imageUrl.replace(/^\//, ''));
  const mediumPath = oldPath.replace('.webp', '-md.webp');
  const thumbPath = oldPath.replace('.webp', '-thumb.webp');
  try {
    await fs.unlink(oldPath);
    await fs.unlink(mediumPath).catch(() => {});
    await fs.unlink(thumbPath).catch(() => {});
  } catch { /* ignore */ }
}

export async function heroBannerRoutes(fastify: FastifyInstance) {
  // Public: active banners, ordered
  fastify.get('/api/hero-banners/public', async () => {
    const banners = await fastify.prisma.heroBanner.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return {
      banners: banners.map((b) => ({
        id: b.id,
        imageUrlDesktop: b.imageUrlDesktop,
        imageUrlMobile: b.imageUrlMobile,
        altText: b.altText,
        buttonLabel: b.buttonLabel,
        buttonUrl: b.buttonUrl,
        buttonPositionYPct: b.buttonPositionYPct,
        buttonAlign: b.buttonAlign,
      })),
    };
  });

  // Admin: list all
  fastify.get('/api/hero-banners', {
    preHandler: [fastify.authenticate, requirePermission('content:read')],
  }, async () => {
    const banners = await fastify.prisma.heroBanner.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return { banners };
  });

  // Admin: create
  fastify.post('/api/hero-banners', {
    preHandler: [fastify.authenticate, requirePermission('content:write')],
  }, async (request) => {
    const body = request.body as BannerBody;
    const max = await fastify.prisma.heroBanner.aggregate({ _max: { sortOrder: true } });
    const align = body.buttonAlign && ALIGN_VALUES.has(body.buttonAlign) ? body.buttonAlign : 'left';
    const banner = await fastify.prisma.heroBanner.create({
      data: {
        altText: body.altText ?? '',
        buttonLabel: body.buttonLabel ?? '',
        buttonUrl: body.buttonUrl ?? '',
        buttonPositionYPct: clampPct(body.buttonPositionYPct) ?? 60,
        buttonAlign: align,
        isActive: body.isActive ?? true,
        sortOrder: (max._max.sortOrder ?? 0) + 1,
      },
    });
    return { banner };
  });

  // Admin: update
  fastify.put('/api/hero-banners/:id', {
    preHandler: [fastify.authenticate, requirePermission('content:write')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as BannerBody;
    const pct = clampPct(body.buttonPositionYPct);
    const align = body.buttonAlign && ALIGN_VALUES.has(body.buttonAlign) ? body.buttonAlign : undefined;
    try {
      const banner = await fastify.prisma.heroBanner.update({
        where: { id },
        data: {
          ...(body.altText !== undefined ? { altText: body.altText } : {}),
          ...(body.buttonLabel !== undefined ? { buttonLabel: body.buttonLabel } : {}),
          ...(body.buttonUrl !== undefined ? { buttonUrl: body.buttonUrl } : {}),
          ...(pct !== undefined ? { buttonPositionYPct: pct } : {}),
          ...(align !== undefined ? { buttonAlign: align } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        },
      });
      return { banner };
    } catch {
      return reply.code(404).send({ error: 'Banner not found' });
    }
  });

  // Admin: delete (+ remove image files)
  fastify.delete('/api/hero-banners/:id', {
    preHandler: [fastify.authenticate, requirePermission('content:write')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const banner = await fastify.prisma.heroBanner.findUnique({ where: { id } });
    if (!banner) return reply.code(404).send({ error: 'Banner not found' });
    await unlinkBannerImage(banner.imageUrlDesktop);
    await unlinkBannerImage(banner.imageUrlMobile);
    await fastify.prisma.heroBanner.delete({ where: { id } });
    return { success: true };
  });

  // Admin: reorder — body: { order: [id, id, ...] }
  fastify.post('/api/hero-banners/reorder', {
    preHandler: [fastify.authenticate, requirePermission('content:write')],
  }, async (request, reply) => {
    const { order } = request.body as { order?: string[] };
    if (!Array.isArray(order)) {
      return reply.code(400).send({ error: 'order array required' });
    }
    await fastify.prisma.$transaction(
      order.map((id, idx) =>
        fastify.prisma.heroBanner.update({ where: { id }, data: { sortOrder: idx + 1 } })
      )
    );
    return { success: true };
  });

  // Admin: upload image for a banner — ?slot=desktop|mobile (default desktop)
  fastify.post('/api/hero-banners/:id/image', {
    preHandler: [fastify.authenticate, requirePermission('content:write')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { slot } = request.query as { slot?: string };
    const isMobile = slot === 'mobile';
    const banner = await fastify.prisma.heroBanner.findUnique({ where: { id } });
    if (!banner) return reply.code(404).send({ error: 'Banner not found' });

    const file = await request.file();
    if (!file) return reply.code(400).send({ error: 'File is required' });
    if (!ALLOWED_IMAGE_MIME.includes(file.mimetype)) {
      return reply.code(400).send({ error: `Unsupported MIME: ${file.mimetype}` });
    }

    await fs.mkdir(BANNERS_DIR, { recursive: true });
    const buffer = await file.toBuffer();
    if (buffer.length > MAX_BANNER_IMAGE_SIZE) {
      return reply.code(413).send({ error: 'File too large (max 8MB)' });
    }

    const baseFilename = `${id}-${slot ?? 'desktop'}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const { largeFilename } = await optimizeAndSaveImage(buffer, { targetDir: BANNERS_DIR, baseFilename });
    const url = `/uploads/hero-banners/${largeFilename}`;

    const prevUrl = isMobile ? banner.imageUrlMobile : banner.imageUrlDesktop;
    await unlinkBannerImage(prevUrl);

    const updated = await fastify.prisma.heroBanner.update({
      where: { id },
      data: isMobile ? { imageUrlMobile: url } : { imageUrlDesktop: url },
    });
    return { banner: updated, url };
  });
}
