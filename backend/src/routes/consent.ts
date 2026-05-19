import { FastifyInstance } from 'fastify';
import crypto from 'crypto';

const EEA_COUNTRIES = new Set([
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
    'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
    'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
    'IS', 'LI', 'NO',
    'GB', 'CH',
]);

const IP_HASH_SALT = process.env.CONSENT_IP_SALT || 'car-scout-consent-default-salt';

function hashIp(ip: string): string {
    return crypto.createHash('sha256').update(`${ip}:${IP_HASH_SALT}`).digest('hex');
}

function readCountry(request: any): string | null {
    const headers = request.headers || {};
    const raw =
        headers['cf-ipcountry'] ||
        headers['x-vercel-ip-country'] ||
        headers['x-country-code'] ||
        null;
    if (!raw) return null;
    const code = String(raw).toUpperCase().trim();
    if (code === 'XX' || code === 'T1') return null;
    return code;
}

function readIp(request: any): string {
    return (
        (request.headers?.['cf-connecting-ip'] as string) ||
        (request.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        request.ip ||
        'unknown'
    );
}

interface ConsentChoiceBody {
    analytics?: boolean;
    marketing?: boolean;
    bannerVersion?: string;
    brandId?: string;
}

export async function consentRoutes(fastify: FastifyInstance) {
    fastify.get('/api/geo', async (request) => {
        const country = readCountry(request);
        return {
            country,
            isEEA: country ? EEA_COUNTRIES.has(country) : false,
        };
    });

    fastify.post('/api/consent', async (request, reply) => {
        const body = (request.body || {}) as ConsentChoiceBody;
        const analytics = Boolean(body.analytics);
        const marketing = Boolean(body.marketing);
        const bannerVersion = (body.bannerVersion || '1.0').slice(0, 32);
        const brandId = body.brandId ? String(body.brandId).slice(0, 32) : null;

        const ipHash = hashIp(readIp(request));
        const userAgent = String(request.headers['user-agent'] || '').slice(0, 500);
        const country = readCountry(request);

        try {
            await fastify.prisma.consentRecord.create({
                data: {
                    brandId,
                    ipHash,
                    userAgent,
                    country,
                    choice: { analytics, marketing },
                    bannerVersion,
                },
            });
            return { success: true };
        } catch (err) {
            fastify.log.error({ err }, 'Failed to persist consent record');
            return reply.code(500).send({ error: 'Failed to persist consent' });
        }
    });
}
