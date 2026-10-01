/**
 * Helpers shared by the RUM report scripts (rum-inp-report.ts, rum-vitals-report.ts).
 */

export function percentile(sorted: number[], p: number): number | null {
    if (sorted.length === 0) return null;
    const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
    return sorted[idx];
}

export function median(values: (number | null)[]): number | null {
    const nums = values.filter((v): v is number => typeof v === 'number').sort((a, b) => a - b);
    return percentile(nums, 50);
}

export function normalizePathTemplate(path: string): string {
    if (/^\/oferta\/[^/]+$/.test(path)) return '/oferta/:slug';
    if (/^\/leasing\/[^/]+$/.test(path)) return '/leasing/:slug';
    if (/^\/kredyt\/[^/]+$/.test(path)) return '/kredyt/:slug';
    if (/^\/wynajem-dlugoterminowy\/[^/]+$/.test(path)) return '/wynajem-dlugoterminowy/:slug';
    if (/^\/samochody\/[^/]+(\/[^/]+)?$/.test(path)) return '/samochody/:make[/:model]';
    return path;
}

export function formatMs(value: number | null): string {
    return value === null ? 'n/a' : `${value}ms`;
}

/** Top `limit` builds by report count, with p75 of `value`; reports without a build are grouped as `(none)`. */
export function p75PerBuild(
    reports: { build?: string | null; value: number | null }[],
    limit = 8
): { build: string; count: number; p75: number | null }[] {
    const byBuild = new Map<string, number[]>();
    for (const r of reports) {
        if (typeof r.value !== 'number') continue;
        const build = r.build || '(none)';
        if (!byBuild.has(build)) byBuild.set(build, []);
        byBuild.get(build)!.push(r.value);
    }
    return Array.from(byBuild.entries())
        .map(([build, vals]) => {
            const sorted = vals.slice().sort((a, b) => a - b);
            return { build, count: sorted.length, p75: percentile(sorted, 75) };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
}
