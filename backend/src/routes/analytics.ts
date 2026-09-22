import { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { analyticsConfig } from '../config/analytics.config.js';
import { requirePermission } from '../middleware/permissions.js';
import { z } from 'zod';

const analyticsEventSchema = z.object({
  eventName: z.string().min(1).max(100),
  path: z.string().min(1).max(500),
  referrer: z.string().max(500).optional(),
  metadata: z.record(z.unknown()).optional()
});

export async function analyticsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/analytics/price-trends', {
    preHandler: [fastify.authenticate, requirePermission('analytics:read')],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          days: {
            type: 'integer',
            minimum: analyticsConfig.priceHistory.minDays,
            maximum: analyticsConfig.priceHistory.maxDays
          },
          make: { type: 'string' },
          model: { type: 'string' },
          groupBy: {
            type: 'string',
            enum: ['day', 'week', 'month']
          }
        }
      }
    }
  }, async (request, reply) => {
    const {
      days = analyticsConfig.priceHistory.defaultDays,
      make,
      model,
      groupBy
    } = request.query as any;

    // Auto-adjust grouping for large ranges
    const effectiveGroupBy = groupBy || (
      days > analyticsConfig.autoGrouping.weekThreshold ? 'month' :
        days > analyticsConfig.autoGrouping.dayThreshold ? 'week' :
          'day'
    );

    const since = new Date();
    since.setDate(since.getDate() - days);

    // Cache key
    const cacheKey = `analytics:trends:${days}:${make || 'all'}:${model || 'all'}:${effectiveGroupBy}`;

    // Try cache first
    const cached = await fastify.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Query database
    const dateGrouping = effectiveGroupBy === 'month'
      ? Prisma.sql`DATE_TRUNC('month', changed_at)`
      : effectiveGroupBy === 'week'
        ? Prisma.sql`DATE_TRUNC('week', changed_at)`
        : Prisma.sql`DATE(changed_at)`;

    const trends = await fastify.prisma.$queryRaw`
      SELECT 
        ${dateGrouping} as date,
        AVG(ph.price_pln)::int as avg_price,
        MIN(ph.price_pln) as min_price,
        MAX(ph.price_pln) as max_price,
        COUNT(DISTINCT ph.listing_id) as count
      FROM price_history ph
      JOIN listings l ON l.id = ph.listing_id
      WHERE ph.changed_at >= ${since}
        ${make ? Prisma.sql`AND l.make = ${make}` : Prisma.empty}
        ${model ? Prisma.sql`AND l.model = ${model}` : Prisma.empty}
      GROUP BY ${dateGrouping}
      ORDER BY date DESC
    `;

    const priceChanges = await fastify.prisma.$queryRaw`
      WITH ranked_prices AS (
        SELECT 
          ph.listing_id,
          ph.price_pln,
          ph.changed_at,
          l.make, l.model, l.vin, l.listing_id as external_listing_id,
          LAG(ph.price_pln) OVER (
            PARTITION BY ph.listing_id 
            ORDER BY ph.changed_at
          ) as prev_price,
          ROW_NUMBER() OVER (
            PARTITION BY ph.listing_id 
            ORDER BY ph.changed_at DESC
          ) as rn
        FROM price_history ph
        JOIN listings l ON l.id = ph.listing_id
        WHERE ph.changed_at >= ${since}
          ${make ? Prisma.sql`AND l.make = ${make}` : Prisma.empty}
          ${model ? Prisma.sql`AND l.model = ${model}` : Prisma.empty}
      )
      SELECT 
        rp.listing_id, make, model, vin,
        prev_price as old_price,
        price_pln as new_price,
        ROUND(((price_pln - prev_price)::numeric / prev_price * 100), 2) as change_percent,
        changed_at
      FROM ranked_prices rp
      WHERE rn = 1 
        AND prev_price IS NOT NULL
        AND prev_price != price_pln
      ORDER BY ABS(price_pln - prev_price) DESC
      LIMIT 50
    `;

    const sanitize = (rows: any[]) =>
      rows.map(row =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [
            key,
            typeof value === 'bigint' ? Number(value) : value
          ])
        )
      );

    const result = {
      trends: sanitize(trends as any[]),
      priceChanges: sanitize(priceChanges as any[]),
      config: {
        days,
        groupBy: effectiveGroupBy,
        filters: { make, model }
      }
    };

    // Cache result
    await fastify.redis.setex(
      cacheKey,
      analyticsConfig.charts.cacheTimeout,
      JSON.stringify(result)
    );

    return result;
  });

  // Cookieless Telemetry Event
  fastify.post('/api/analytics/event', {
    config: {
      rateLimit: {
        max: 1200,
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    const parsed = analyticsEventSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid event payload' });
    }

    const { eventName, path, referrer, metadata } = parsed.data;
    const cleanPath = (path || '/').trim().toLowerCase().replace(/[^a-z0-9/_-]/g, '').slice(0, 100) || '/';
    const today = new Date().toISOString().slice(0, 10);

    fastify.log.info({
      event: eventName,
      path: cleanPath,
      referrer,
      metadata,
      date: today
    }, 'Cookieless analytics event');

    if (fastify.redis) {
      try {
        const dailyKey = `analytics:daily:${today}`;
        await fastify.redis.hincrby(dailyKey, `event_path:${eventName}:${cleanPath}`, 1);
        await fastify.redis.hincrby(dailyKey, `event:${eventName}`, 1);
        await fastify.redis.hincrby(dailyKey, `path:${cleanPath}`, 1);
        if (eventName === 'page_view') {
          await fastify.redis.hincrby(dailyKey, `view:${cleanPath}`, 1);
        }
        await fastify.redis.expire(dailyKey, 86400 * 90);

        // Backward-compatible raw key
        const metricKey = `analytics:${today}:${eventName}`;
        await fastify.redis.incr(metricKey);
        await fastify.redis.expire(metricKey, 86400 * 90);
      } catch (err) {
        fastify.log.warn({ err }, 'Failed to record analytics metric in Redis');
      }
    }

    return reply.code(200).send({ success: true });
  });

  // Summary endpoint for Telemetry & Conversion Analytics
  const telemetryQuerySchema = z.object({
    days: z.coerce.number().int().min(1).max(90).default(7)
  });

  fastify.get('/api/analytics/telemetry/summary', {
    preHandler: [fastify.authenticate, requirePermission('analytics:read')]
  }, async (request, reply) => {
    const parsed = telemetryQuerySchema.safeParse(request.query);
    const days = parsed.success ? parsed.data.days : 7;

    const now = new Date();
    const dates: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(now.getTime() - i * 86400000);
      dates.push(d.toISOString().slice(0, 10));
    }

    const pathViewsMap: Record<string, number> = {};
    const pathEventsMap: Record<string, number> = {};
    const eventsMap: Record<string, number> = {};
    const dailyTimeline: Array<{
      date: string;
      views: number;
      leads: number;
      b2bViews: number;
      b2bLeads: number;
    }> = [];

    let totalPageViews = 0;
    let totalLeadsSubmitted = 0;
    let totalEmployerB2BViews = 0;
    let totalEmployerB2BLeads = 0;

    if (fastify.redis) {
      for (const date of dates) {
        const dailyKey = `analytics:daily:${date}`;
        let data: Record<string, string> = {};
        try {
          data = await fastify.redis.hgetall(dailyKey) || {};
        } catch {
          data = {};
        }

        let dayViews = 0;
        let dayLeads = 0;
        let dayB2BViews = 0;
        let dayB2BLeads = 0;

        for (const [key, valStr] of Object.entries(data)) {
          const count = parseInt(valStr, 10) || 0;
          if (key.startsWith('event:')) {
            const evName = key.slice('event:'.length);
            eventsMap[evName] = (eventsMap[evName] || 0) + count;
            if (evName === 'page_view') dayViews += count;
            if (evName === 'lead_submitted' || evName === 'b2b_lead_submitted') dayLeads += count;
          } else if (key.startsWith('path:')) {
            const p = key.slice('path:'.length);
            pathEventsMap[p] = (pathEventsMap[p] || 0) + count;
          } else if (key.startsWith('view:')) {
            const p = key.slice('view:'.length);
            pathViewsMap[p] = (pathViewsMap[p] || 0) + count;
            if (p === '/dla-firm' || p === 'employer_b2b') {
              dayB2BViews += count;
            }
          } else if (key.startsWith('event_path:')) {
            const parts = key.slice('event_path:'.length).split(':');
            const ev = parts[0];
            const p = parts.slice(1).join(':');
            if ((ev === 'lead_submitted' || ev === 'b2b_lead_submitted') && (p === '/dla-firm' || p === 'employer_b2b')) {
              dayB2BLeads += count;
            }
          }
        }

        totalPageViews += dayViews;
        totalLeadsSubmitted += dayLeads;
        totalEmployerB2BViews += dayB2BViews;
        totalEmployerB2BLeads += dayB2BLeads;

        dailyTimeline.push({
          date,
          views: dayViews,
          leads: dayLeads,
          b2bViews: dayB2BViews,
          b2bLeads: dayB2BLeads
        });
      }
    }

    const allPaths = Array.from(new Set([...Object.keys(pathViewsMap), ...Object.keys(pathEventsMap)]));
    const pathBreakdown = allPaths.map(p => ({
      path: p,
      views: pathViewsMap[p] || 0,
      events: pathEventsMap[p] || 0
    })).sort((a, b) => b.views - a.views);

    const eventsBreakdown = Object.entries(eventsMap).map(([eventName, count]) => ({
      eventName,
      count
    })).sort((a, b) => b.count - a.count);

    const b2bConversionRatePercent = totalEmployerB2BViews > 0
      ? Number(((totalEmployerB2BLeads / totalEmployerB2BViews) * 100).toFixed(1))
      : 0;

    return reply.code(200).send({
      period: {
        days,
        startDate: dates[dates.length - 1],
        endDate: dates[0]
      },
      totals: {
        pageViews: totalPageViews,
        leadsSubmitted: totalLeadsSubmitted,
        employerB2BViews: totalEmployerB2BViews,
        employerB2BLeads: totalEmployerB2BLeads,
        b2bConversionRatePercent
      },
      pathBreakdown,
      eventsBreakdown,
      dailyTimeline: dailyTimeline.reverse()
    });
  });
}
