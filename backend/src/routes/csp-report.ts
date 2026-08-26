import { FastifyInstance } from 'fastify';

interface CspReportFields {
    documentUri: string | null;
    violatedDirective: string | null;
    blockedUri: string | null;
    disposition: string | null;
}

function truncate(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    return value.slice(0, 300);
}

// Browsers send two different shapes depending on the delivery mechanism:
// - legacy `report-uri`: { "csp-report": { "document-uri", "violated-directive", "blocked-uri", "disposition", ... } }
// - modern `report-to` (Reporting API): [ { type, url, body: { documentURL, effectiveDirective, blockedURL, disposition, ... } }, ... ]
function extractCspReport(raw: unknown): CspReportFields {
    let report: any = raw;

    if (Array.isArray(raw)) {
        report = raw[0]?.body ?? raw[0];
    } else if (raw && typeof raw === 'object' && 'csp-report' in (raw as any)) {
        report = (raw as any)['csp-report'];
    }

    if (!report || typeof report !== 'object') {
        return { documentUri: null, violatedDirective: null, blockedUri: null, disposition: null };
    }

    return {
        documentUri: truncate(report['document-uri'] ?? report.documentURL),
        violatedDirective: truncate(report['violated-directive'] ?? report.effectiveDirective),
        blockedUri: truncate(report['blocked-uri'] ?? report.blockedURL),
        disposition: truncate(report.disposition),
    };
}

// Both content types below are NOT parsed by Fastify's default JSON parser
// (which only matches "application/json"), so without these, browsers sending
// CSP violation reports would get a 415. Registered on this plugin instance
// only, so they don't affect content-type parsing elsewhere in the app.
function rawJsonParser(_req: unknown, body: string, done: (err: Error | null, result?: unknown) => void) {
    try {
        done(null, JSON.parse(body));
    } catch {
        // Never fail on a malformed report body — just treat it as empty.
        done(null, null);
    }
}

export async function cspReportRoutes(fastify: FastifyInstance) {
    fastify.addContentTypeParser('application/csp-report', { parseAs: 'string', bodyLimit: 64 * 1024 }, rawJsonParser);
    fastify.addContentTypeParser('application/reports+json', { parseAs: 'string', bodyLimit: 64 * 1024 }, rawJsonParser);

    fastify.post('/api/csp-report', {
        config: { rateLimit: { max: 300, timeWindow: '1 minute' } }
    }, async (request, reply) => {
        try {
            const fields = extractCspReport(request.body);
            fastify.log.warn(fields, 'CSP violation');
        } catch (err) {
            fastify.log.error({ err }, 'Failed to process CSP violation report');
        }
        return reply.code(204).send();
    });
}
