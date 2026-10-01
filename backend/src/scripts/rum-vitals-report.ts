/**
 * RUM vitals report: reads the raw LCP/CLS-attribution beacons persisted by
 * backend/src/routes/rum.ts (Redis list `${namespace}:rum:vitals`) and prints
 * percentiles, top offenders and p75 per frontend build, so we can measure the effect
 * of performance work on real phones. CLS is stored as integer milli-CLS (score * 1000)
 * and printed here as a decimal score.
 *
 * Uruchomienie:
 *   lokalnie (z katalogu backend/):  npx tsx src/scripts/rum-vitals-report.ts [days=7] [host=motolia.pl]
 *   w kontenerze:                    node dist/scripts/rum-vitals-report.js [days=7] [host=motolia.pl]
 */
import Redis from 'ioredis';
import { getSsrNamespace } from '../services/ssr-cache.js';
import { percentile, median, normalizePathTemplate, formatMs, p75PerBuild } from './rum-shared.js';

interface RumVitalsReport {
    metric: 'LCP' | 'CLS';
    path: string;
    value: number | null;
    rating: string | null;
    navigationType: string | null;
    build: string | null;
    net: string | null;
    vw: number | null;
    cpu: number | null;
    mem: number | null;
    target: string | null;
    url: string | null;
    ttfb: number | null;
    loadDelay: number | null;
    loadDuration: number | null;
    renderDelay: number | null;
    shiftValue: number | null;
    shiftTime: number | null;
    loadState: string | null;
    ts: number;
    host: string;
}

type Format = (value: number | null) => string;

const formatCls: Format = (value) => (value === null ? 'n/a' : (value / 1000).toFixed(3));

function printMetric(name: 'LCP' | 'CLS', reports: RumVitalsReport[], format: Format) {
    const values = reports
        .map((r) => r.value)
        .filter((v): v is number => typeof v === 'number')
        .sort((a, b) => a - b);

    console.log(`--- ${name} overall ---`);
    console.log(`count=${values.length} p50=${format(percentile(values, 50))} p75=${format(percentile(values, 75))} p95=${format(percentile(values, 95))}\n`);

    console.log(`--- ${name} per page template ---`);
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
        console.log(`${row.template.padEnd(35)} count=${String(row.count).padStart(5)} p50=${format(row.p50).padEnd(8)} p75=${format(row.p75).padEnd(8)} p95=${format(row.p95)}`);
    }
    console.log('');
}

function printBuilds(name: string, reports: RumVitalsReport[], format: Format) {
    console.log(`--- ${name} p75 per build (top 8 by count) ---`);
    for (const row of p75PerBuild(reports)) {
        console.log(`${row.build.padEnd(20)} count=${String(row.count).padStart(5)} p75=${format(row.p75)}`);
    }
    console.log('');
}

function printTargets(
    title: string,
    reports: RumVitalsReport[],
    format: Format,
    extra?: (rs: RumVitalsReport[]) => string
) {
    console.log(title);
    const byTarget = new Map<string, RumVitalsReport[]>();
    for (const r of reports) {
        if (typeof r.value !== 'number') continue;
        const label = r.target || 'unknown';
        if (!byTarget.has(label)) byTarget.set(label, []);
        byTarget.get(label)!.push(r);
    }
    const rows = Array.from(byTarget.entries())
        .map(([label, rs]) => {
            const sorted = rs.map((r) => r.value as number).sort((a, b) => a - b);
            return { label, rs, count: rs.length, p75: percentile(sorted, 75) };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    for (const row of rows) {
        console.log(`${row.label.slice(0, 70).padEnd(72)} count=${String(row.count).padStart(4)} p75=${format(row.p75).padEnd(8)}${extra ? ' ' + extra(row.rs) : ''}`);
    }
    console.log('');
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

        const key = `${getSsrNamespace()}:rum:vitals`;
        const raw = await redis.lrange(key, 0, -1);

        const cutoff = Date.now() - days * 24 * 3600 * 1000;
        const reports: RumVitalsReport[] = [];
        for (const line of raw) {
            try {
                const parsed = JSON.parse(line) as RumVitalsReport;
                if (parsed.host !== host) continue;
                if (typeof parsed.ts !== 'number' || parsed.ts < cutoff) continue;
                reports.push(parsed);
            } catch {
                // skip malformed entries
            }
        }

        const lcp = reports.filter((r) => r.metric === 'LCP');
        const cls = reports.filter((r) => r.metric === 'CLS');

        console.log(`\n=== RUM vitals report: host=${host}, ostatnie ${days} dni ===`);
        console.log(`Liczba raportów: ${reports.length} (LCP=${lcp.length}, CLS=${cls.length})\n`);

        if (lcp.length > 0) {
            printMetric('LCP', lcp, formatMs);

            printTargets('--- LCP top 10 targets ---', lcp, formatMs, (rs) =>
                `medTTFB=${formatMs(median(rs.map((r) => r.ttfb))).padEnd(8)} medLoadDelay=${formatMs(median(rs.map((r) => r.loadDelay))).padEnd(8)} ` +
                `medLoadDuration=${formatMs(median(rs.map((r) => r.loadDuration))).padEnd(8)} medRenderDelay=${formatMs(median(rs.map((r) => r.renderDelay)))}`
            );

            const imageCount = lcp.filter((r) => !!r.url).length;
            const pct = (n: number) => `${((n / lcp.length) * 100).toFixed(1)}% (${n}/${lcp.length})`;
            console.log('--- LCP text vs image ---');
            console.log(`image: ${pct(imageCount)}`);
            console.log(`text:  ${pct(lcp.length - imageCount)}\n`);

            printBuilds('LCP', lcp, formatMs);
        }

        if (cls.length > 0) {
            printMetric('CLS', cls, formatCls);
            printTargets('--- CLS top 10 largest-shift targets ---', cls, formatCls);
            printBuilds('CLS', cls, formatCls);
        }
    } finally {
        redis.disconnect();
    }
}

main().catch((err) => {
    console.error('Błąd wykonania skryptu:', err);
    process.exit(1);
});
