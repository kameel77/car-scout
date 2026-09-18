/**
 * Purguje cały cache Cloudflare (purge_everything). Uruchamiany w kroku deployu,
 * zaraz przed/po podmianie kontenera, żeby brzeg nie serwował HTML odwołującego się
 * do assetów z poprzedniego builda (patrz cache-invalidation.service.ts, render.ts).
 *
 * Uruchomienie:
 *   lokalnie (z katalogu backend/):  npx tsx src/scripts/purge-cdn.ts
 *   w kontenerze:                    node dist/scripts/purge-cdn.js
 *
 * Wymaga CLOUDFLARE_API_TOKEN (lub CLOUDFLARE_TOKEN) i CLOUDFLARE_ZONE_ID w env.
 */
import { invalidateOfferCache } from '../services/cache-invalidation.service.js';

async function main() {
    // invalidateOfferCache zwraca success:true bez purge'a, gdy brakuje tokena/zone id
    // (celowe zachowanie dla dev/staging) - w deployu to musi być twardy błąd, nie cichy sukces.
    const apiToken = process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_TOKEN;
    const zoneId = process.env.CLOUDFLARE_ZONE_ID;
    if (!apiToken || !zoneId) {
        const missing = [
            !apiToken && 'CLOUDFLARE_API_TOKEN/CLOUDFLARE_TOKEN',
            !zoneId && 'CLOUDFLARE_ZONE_ID',
        ].filter(Boolean).join(', ');
        console.error(`[PurgeCDN] Brak wymaganych zmiennych środowiskowych: ${missing}`);
        process.exit(1);
    }

    const result = await invalidateOfferCache(undefined, { purgeEverything: true });
    if (!result.success) {
        console.error('[PurgeCDN] Cloudflare purge failed');
        process.exit(1);
    }
    console.log('[PurgeCDN] Cloudflare cache purged successfully');
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
