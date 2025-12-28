import { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { analyticsConfig } from '../config/analytics.config.js';

export async function analyticsRoutes(fastify: FastifyInstance) {
    fastify.get('/api/analytics/price-trends', {
        preHandler: [fastify.authenticate],
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
        AVG(price_pln)::int as avg_price,
        MIN(price_pln) as min_price,
        MAX(price_pln) as max_price,
        COUNT(DISTINCT listing_id) as count
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
          ph.*,
          l.make, l.model, l.vin, l.listing_id,
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
        listing_id, make, model, vin,
        prev_price as old_price,
        price_pln as new_price,
        ROUND(((price_pln - prev_price)::numeric / prev_price * 100), 2) as change_percent,
        changed_at
      FROM ranked_prices
      WHERE rn = 1 
        AND prev_price IS NOT NULL
        AND prev_price != price_pln
      ORDER BY ABS(price_pln - prev_price) DESC
      LIMIT 50
    `;

        const result = {
            trends,
            priceChanges,
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
}
