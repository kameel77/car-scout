/**
 * RUM INP report: reads the raw INP-attribution beacons persisted by
 * backend/src/routes/rum.ts (Redis list `${namespace}:rum:inp`) and prints
 * percentiles and top offenders, so we can see which interactions make p75 INP bad.
 *
 * Uruchomienie:
 *   lokalnie (z katalogu backend/):  npx tsx src/scripts/rum-inp-report.ts [days=7] [host=motolia.pl]
 *   w kontenerze:                    node dist/scripts/rum-inp-report.js [days=7] [host=motolia.pl]
 */
import Redis from 'ioredis';
import { getSsrNamespace } from '../services/ssr-cache.js';

interface RumInpReport {
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
    ts: number;
    host: string;
}

function percentile(sorted: number[], p: number): number | null {
    if (sorted.length === 0) return null;
    const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
    return sorted[idx];
}

function median(values: (number | null)[]): number | null {
    const nums = values.filter((v): v is number => typeof v === 'number').sort((a, b) => a - b);
    return percentile(nums, 50);
}

function normalizePathTemplate(path: string): string {
    if (/^\/oferta\/[^/]+$/.test(path)) return '/oferta/:slug';
    if (/^\/leasing\/[^/]+$/.test(path)) return '/leasing/:slug';
    if (/^\/kredyt\/[^/]+$/.test(path)) return '/kredyt/:slug';
    if (/^\/wynajem-dlugoterminowy\/[^/]+$/.test(path)) return '/wynajem-dlugoterminowy/:slug';
    if (/^\/samochody\/[^/]+(\/[^/]+)?$/.test(path)) return '/samochody/:make[/:model]';
    return path;
}

function formatMs(value: number | null): string {
    return value === null ? 'n/a' : `${value}ms`;
}

async function main() {
    const days = Number(process.argv[2]) > 0 ? Number(process.argv[2]) : 7;
    const host = process.argv[3] || 'motolia.pl';

    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        connectTimeout: 5000,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
    });

    try {
        await redis.connect();

        const key = `${getSsrNamespace()}:rum:inp`;
        const raw = await redis.lrange(key, 0, -1);

        const cutoff = Date.now() - days * 24 * 3600 * 1000;
        const reports: RumInpReport[] = [];
        for (const line of raw) {
            try {
                const parsed = JSON.parse(line) as RumInpReport;
                if (parsed.host !== host) continue;
                if (typeof parsed.ts !== 'number' || parsed.ts < cutoff) continue;
                reports.push(parsed);
            } catch {
                // skip malformed entries
            }
        }

        console.log(`\n=== RUM INP report: host=${host}, ostatnie ${days} dni ===`);
        console.log(`Liczba raportów: ${reports.length}\n`);

        if (reports.length === 0) {
            return;
        }

        const values = reports
            .map((r) => r.value)
            .filter((v): v is number => typeof v === 'number')
            .sort((a, b) => a - b);

        console.log('--- INP overall ---');
        console.log(`count=${values.length} p50=${formatMs(percentile(values, 50))} p75=${formatMs(percentile(values, 75))} p95=${formatMs(percentile(values, 95))}\n`);

        console.log('--- INP per page template ---');
        const byTemplate = new Map<string, number[]>();
        for (const r of reports) {
            if (typeof r.value !== 'number') continue;
            const template = normalizePathTemplate(r.path);
            if (!byTemplate.has(template)) byTemplate.set(template, []);
            byTemplate.get(template)!.push(r.value);
        }
        const templateRows = Array.from(byTemplate.entries())
            .map(([template, vals]) => {
                const sorted = vals.slice().sort((a, b) => a - b);
                return { template, count: sorted.length, p50: percentile(sorted, 50), p75: percentile(sorted, 75), p95: percentile(sorted, 95) };
            })
            .sort((a, b) => b.count - a.count);
        for (const row of templateRows) {
            console.log(`${row.template.padEnd(35)} count=${String(row.count).padStart(5)} p50=${formatMs(row.p50).padEnd(8)} p75=${formatMs(row.p75).padEnd(8)} p95=${formatMs(row.p95)}`);
        }
        console.log('');

        const slowReports = reports.filter((r) => typeof r.value === 'number' && r.value >= 200);

        console.log(`--- Top 15 type+target (value >= 200ms), n=${slowReports.length} ---`);
        const byInteraction = new Map<string, RumInpReport[]>();
        for (const r of slowReports) {
            const label = `${r.type ?? 'unknown'} | ${r.target ?? 'unknown'}`;
            if (!byInteraction.has(label)) byInteraction.set(label, []);
            byInteraction.get(label)!.push(r);
        }
        const interactionRows = Array.from(byInteraction.entries())
            .map(([label, rs]) => {
                const sortedValues = rs.map((r) => r.value as number).sort((a, b) => a - b);
                return {
                    label,
                    count: rs.length,
                    p75: percentile(sortedValues, 75),
                    medianInputDelay: median(rs.map((r) => r.inputDelay)),
                    medianProcessingDuration: median(rs.map((r) => r.processingDuration)),
                    medianPresentationDelay: median(rs.map((r) => r.presentationDelay)),
                };
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 15);
        for (const row of interactionRows) {
            console.log(
                `${row.label.slice(0, 70).padEnd(72)} count=${String(row.count).padStart(4)} p75=${formatMs(row.p75).padEnd(8)} ` +
                `medInputDelay=${formatMs(row.medianInputDelay).padEnd(8)} medProcessing=${formatMs(row.medianProcessingDuration).padEnd(8)} medPresentation=${formatMs(row.medianPresentationDelay)}`
            );
        }
        console.log('');

        console.log(`--- Top 10 script.src+invoker (value >= 200ms) ---`);
        const byScript = new Map<string, number>();
        for (const r of slowReports) {
            if (!r.script || !r.script.src) continue;
            const label = `${r.script.src} | ${r.script.invoker ?? 'unknown'}`;
            byScript.set(label, (byScript.get(label) || 0) + 1);
        }
        const scriptRows = Array.from(byScript.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        for (const [label, count] of scriptRows) {
            console.log(`${label.slice(0, 90).padEnd(92)} count=${count}`);
        }
        console.log('');

        const notCompleteCount = slowReports.filter((r) => r.loadState !== 'complete').length;
        const gtmLoadedCount = slowReports.filter((r) => r.gtmLoaded === true).length;
        const pct = (n: number) => (slowReports.length === 0 ? '0%' : `${((n / slowReports.length) * 100).toFixed(1)}%`);

        console.log('--- Udział wśród raportów >= 200ms ---');
        console.log(`loadState !== 'complete': ${pct(notCompleteCount)} (${notCompleteCount}/${slowReports.length})`);
        console.log(`gtmLoaded: ${pct(gtmLoadedCount)} (${gtmLoadedCount}/${slowReports.length})\n`);
    } finally {
        redis.disconnect();
    }
}

main().catch((err) => {
    console.error('Błąd wykonania skryptu:', err);
    process.exit(1);
});
