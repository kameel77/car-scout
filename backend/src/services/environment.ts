import { FastifyRequest } from 'fastify';

const BRAND_CANONICAL_HOSTS: Record<string, string> = {
    motolia: 'motolia.pl',
    carsalon: 'carsalon.pl',
};

const NON_PRODUCTION_SUBDOMAINS = ['dev.', 'staging.', 'test.', 'preview.', 'stage.', 'qa.', 'local.'];

/**
 * Extracts normalized hostname (lowercase, no port) from FastifyRequest or raw headers object.
 * Reads Host directly. X-Forwarded-Host is intentionally ignored because nginx always forwards
 * the authoritative host via `proxy_set_header Host $host;` and does not set X-Forwarded-Host.
 * Trusting X-Forwarded-Host would allow malicious clients to spoof non-production hosts and
 * poison edge caches with `noindex`.
 */
export function extractRequestHost(
    request: FastifyRequest | { headers: Record<string, string | string[] | undefined> }
): string {
    const rawHost = Array.isArray(request.headers.host) ? request.headers.host[0] : request.headers.host;
    if (!rawHost || typeof rawHost !== 'string') return '';

    // Strip port if present
    return rawHost.trim().replace(/:\d+$/, '').toLowerCase();
}

/**
 * Returns set of allowed canonical production hostnames for the deployment.
 * Includes apex and www pair (e.g. motolia.pl and www.motolia.pl).
 */
export function getCanonicalProductionHosts(
    frontendUrl: string | undefined = process.env.FRONTEND_URL,
    brand: string | undefined = process.env.BRAND
): Set<string> {
    const hosts = new Set<string>();

    // 1. If brand is recognized, add its canonical apex + www pair
    const brandKey = (brand || '').toLowerCase().trim();
    const brandHost = BRAND_CANONICAL_HOSTS[brandKey];
    if (brandHost) {
        hosts.add(brandHost);
        hosts.add(`www.${brandHost}`);
    }

    // 2. If FRONTEND_URL is provided, extract its hostname if it's a valid production host
    if (frontendUrl) {
        try {
            const url = new URL(frontendUrl.startsWith('http') ? frontendUrl : `https://${frontendUrl}`);
            const hostname = url.hostname.toLowerCase().trim();
            if (hostname) {
                const isNonProd =
                    NON_PRODUCTION_SUBDOMAINS.some((sub) => hostname.startsWith(sub)) ||
                    hostname.includes('.sslip.io') ||
                    hostname.includes('localhost') ||
                    /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);

                if (!isNonProd) {
                    if (hostname.startsWith('www.')) {
                        hosts.add(hostname);
                        hosts.add(hostname.slice(4));
                    } else {
                        hosts.add(hostname);
                        hosts.add(`www.${hostname}`);
                    }
                }
            }
        } catch {
            // ignore invalid URL
        }
    }

    return hosts;
}

/**
 * Predicate to determine if the incoming request is targeting the canonical production host.
 * Everything else (dev, staging, previews, sslip.io, raw IPs, blank hosts) returns false.
 */
export function isProductionHost(
    request: FastifyRequest | { headers: Record<string, string | string[] | undefined> } | string,
    frontendUrl: string | undefined = process.env.FRONTEND_URL,
    brand: string | undefined = process.env.BRAND
): boolean {
    const canonicalHosts = getCanonicalProductionHosts(frontendUrl, brand);
    if (canonicalHosts.size === 0) return false;

    const requestHost =
        typeof request === 'string'
            ? request.split(',')[0].trim().replace(/:\d+$/, '').toLowerCase()
            : extractRequestHost(request);

    if (!requestHost) return false;
    return canonicalHosts.has(requestHost);
}
