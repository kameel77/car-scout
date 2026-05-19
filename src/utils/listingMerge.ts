import type { ListingFacets } from '@/components/FilterPanel';

type Model = { make: string; model: string };

function dedupCaseInsensitive(values: string[]): string[] {
  const seen: Record<string, string> = {};
  const out: string[] = [];
  for (const v of values) {
    const lower = v.toLowerCase();
    if (!seen[lower]) {
      seen[lower] = v;
      out.push(v);
    }
  }
  return out;
}

export function mergeMakes(sale: string[], rental: string[]): string[] {
  return dedupCaseInsensitive([...sale, ...rental]).sort((a, b) => a.localeCompare(b));
}

export function mergeModels(sale: Model[], rental: Model[]): Model[] {
  const seen = new Set<string>();
  const out: Model[] = [];
  for (const m of [...sale, ...rental]) {
    const key = `${m.make.toLowerCase()}|${m.model.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out.sort((a, b) => a.model.localeCompare(b.model));
}

function sumMap(a?: Record<string, number>, b?: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  const displayKey: Record<string, string> = {};
  const add = (key: string, count: number) => {
    const lower = key.toLowerCase();
    if (!displayKey[lower]) displayKey[lower] = key;
    const k = displayKey[lower];
    out[k] = (out[k] || 0) + count;
  };
  if (a) for (const [k, v] of Object.entries(a)) add(k, v);
  if (b) for (const [k, v] of Object.entries(b)) add(k, v);
  return out;
}

export function mergeFacets(
  sale?: ListingFacets,
  rental?: ListingFacets,
): ListingFacets | undefined {
  if (!sale && !rental) return undefined;
  return {
    make: sumMap(sale?.make, rental?.make),
    model: sumMap(sale?.model, rental?.model),
    fuelType: sumMap(sale?.fuelType, rental?.fuelType),
    bodyType: sumMap(sale?.bodyType, rental?.bodyType),
    transmission: sumMap(sale?.transmission, rental?.transmission),
    drive: sumMap(sale?.drive, rental?.drive),
  };
}
