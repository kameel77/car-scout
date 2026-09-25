import { FastifyInstance } from 'fastify';
import { getSsrRedisClient, getSsrNamespace } from '../services/ssr-cache.js';

const RUM_LIST_MAX_ENTRIES = 49999;
const RUM_LIST_TTL_SECONDS = 30 * 24 * 3600; // 30 days

function sanitizeNumber(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    return Math.min(Math.max(Math.round(value), 0), 60000);
}

function sanitizeString(value: unknown, maxLength: number): string | null {
    if (typeof value !== 'string') return null;
    return value.slice(0, maxLength);
}

interface SanitizedRumInpReport {
    path: string;
    value: number | null;
    rating: string | null;
    navigationType: string | null;
    type: string | null;
    target: string | null;
    inputDelay: number | null;
    processingDuration: number | null;
    presentationDelay: number | null;
    loadState: string | null;
    interactionTime: number | null;
    script: {
        src: string | null;
        invoker: string | null;
        fn: string | null;
        duration: number | null;
        forced: number | null;
    } | null;
    gtmLoaded: boolean;
    cpu: number | null;
    mem: number | null;
    net: string | null;
    vw: number | null;
}

function sanitizeReport(body: unknown): SanitizedRumInpReport | null {
    if (!body || typeof body !== 'object') return null;
    const raw = body as Record<string, unknown>;

    const path = sanitizeString(raw.path, 200);
    if (!path || !path.startsWith('/')) return null;

    let script: SanitizedRumInpReport['script'] = null;
    if (raw.script && typeof raw.script === 'object') {
        const rawScript = raw.script as Record<string, unknown>;
        script = {
            src: sanitizeString(rawScript.src, 200),
            invoker: sanitizeString(rawScript.invoker, 120),
            fn: sanitizeString(rawScript.fn, 80),
            duration: sanitizeNumber(rawScript.duration),
            forced: sanitizeNumber(rawScript.forced),
        };
    }

    return {
        path,
        value: sanitizeNumber(raw.value),
        rating: sanitizeString(raw.rating, 32),
        navigationType: sanitizeString(raw.navigationType, 32),
        type: sanitizeString(raw.type, 64),
        target: sanitizeString(raw.target, 200),
        inputDelay: sanitizeNumber(raw.inputDelay),
        processingDuration: sanitizeNumber(raw.processingDuration),
        presentationDelay: sanitizeNumber(raw.presentationDelay),
        loadState: sanitizeString(raw.loadState, 32),
        interactionTime: sanitizeNumber(raw.interactionTime),
        script,
        gtmLoaded: raw.gtmLoaded === true,
        cpu: sanitizeNumber(raw.cpu),
        mem: sanitizeNumber(raw.mem),
        net: sanitizeString(raw.net, 16),
        vw: sanitizeNumber(raw.vw),
    };
}

export async function rumRoutes(fastify: FastifyInstance) {
    // Never let a malformed beacon body (or an oversize one rejected by bodyLimit)
    // surface as anything other than 204 to the client.
    fastify.setErrorHandler((_err, _request, reply) => {
        reply.code(204).send();
    });

    fastify.post('/api/rum/inp', {
        bodyLimit: 8 * 1024,
        config: { rateLimit: { max: 300, timeWindow: '1 minute' } }
    }, async (request, reply) => {
        try {
            const sanitized = sanitizeReport(request.body);
            if (sanitized) {
                fastify.log.info({ rum: 'inp', host: request.hostname, ...sanitized }, 'RUM INP');

                const redis = getSsrRedisClient();
                if (redis) {
                    const key = `${getSsrNamespace()}:rum:inp`;
                    const entry = JSON.stringify({ ...sanitized, ts: Date.now(), host: request.hostname });
                    await redis.lpush(key, entry);
                    await redis.ltrim(key, 0, RUM_LIST_MAX_ENTRIES);
                    await redis.expire(key, RUM_LIST_TTL_SECONDS);
                }
            }
        } catch (err) {
            fastify.log.error({ err }, 'Failed to process RUM INP report');
        }
        return reply.code(204).send();
    });
}
