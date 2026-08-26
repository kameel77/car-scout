import { PrismaClient, PewneAutoSource } from '@prisma/client';
import cron from 'node-cron';
import { decryptSecret } from '../utils/crypto.js';
import { PewneAutoProvider } from './providers/pewneauto.provider.js';
import { StockSyncEngine } from './stock-sync-engine.service.js';
import { SyncEngineResult, DryRunReport } from '../types/stock-sync.types.js';

let isCronSyncing = false;

export async function syncPewneAutoSource(
    prisma: PrismaClient,
    source: PewneAutoSource,
    options: {
        userId?: string;
        dryRun?: boolean;
        forceSync?: boolean;
    } = {}
): Promise<SyncEngineResult | DryRunReport> {
    const plainSecret = decryptSecret(source.clientSecretEncrypted);

    const provider = new PewneAutoProvider({
        sourceId: source.id,
        sourceSlug: source.slug,
        tokenUrl: source.tokenUrl,
        apiUrl: source.apiUrl,
        domainHeader: source.domainHeader,
        clientId: source.clientId,
        clientSecret: plainSecret
    });

    const engine = new StockSyncEngine(prisma);

    return engine.executeSync(provider, {
        sourceId: source.id,
        sourceSlug: source.slug,
        providerName: 'PewneAuto',
        dealerGroupId: source.dealerGroupId,
        userId: options.userId,
        dryRun: options.dryRun,
        forceSync: options.forceSync,
        lastSuccessfulCount: source.lastSuccessfulSyncCount
    });
}

export async function syncAllPewneAutoSources(
    prisma: PrismaClient,
    userId: string = 'system-cron'
): Promise<{ totalSources: number; successful: number; failed: number; results: any[] }> {
    const sources = await prisma.pewneAutoSource.findMany({
        where: { isEnabled: true }
    });

    const results: any[] = [];
    let successful = 0;
    let failed = 0;

    for (const source of sources) {
        try {
            const res = await syncPewneAutoSource(prisma, source, { userId, dryRun: false });
            if ('success' in res && res.success) {
                successful++;
            } else {
                failed++;
                if ('circuitBreakerTriggered' in res && res.circuitBreakerTriggered) {
                    const reason = ('error' in res ? res.error : undefined) || ('circuitBreakerReason' in res ? res.circuitBreakerReason : undefined) || 'Nieznany powód';
                    console.warn(`[PewneAuto CRON] ALERT: Bezpiecznik Circuit Breaker zablokował sync dla źródła ${source.slug}: ${reason}`);
                }
            }
            results.push({ sourceId: source.id, name: source.name, slug: source.slug, result: res });
        } catch (err: any) {
            failed++;
            console.error(`[PewneAuto:${source.slug}] Błąd synchronizacji:`, err.message);
            results.push({ sourceId: source.id, name: source.name, slug: source.slug, error: err.message });
        }
    }

    return {
        totalSources: sources.length,
        successful,
        failed,
        results
    };
}

/**
 * Inicjalizacja zadania CRON dla źródeł PewneAuto.
 * Uruchamiany co 60 minut w godzinach 6:00 - 22:00 czasu polskiego (Europe/Warsaw) z blokadą mutex.
 */
export function initPewneAutoCron(prisma: PrismaClient) {
    console.log('[PewneAuto] Rejestracja zadania CRON (co godzinę w godzinach 6:00-22:00, strefa Europe/Warsaw)');
    
    // Format cron: minuta godzina dzień-miesiąca miesiąc dzień-tygodnia
    cron.schedule('0 6-22 * * *', async () => {
        if (isCronSyncing) {
            console.warn('[PewneAuto CRON] Poprzednia synchronizacja wciąż trwa. Pomijam uruchomienie kolejnego cyklu.');
            return;
        }

        isCronSyncing = true;
        console.log('[CRON] Uruchomienie automatycznej synchronizacji PewneAuto API (Europe/Warsaw)');
        try {
            const summary = await syncAllPewneAutoSources(prisma);
            console.log(`[CRON] Zakończono sync PewneAuto: ${summary.successful}/${summary.totalSources} udanych`);
        } catch (e: any) {
            console.error('[CRON] Błąd krytyczny podczas zadania PewneAuto:', e.message);
        } finally {
            isCronSyncing = false;
        }
    }, {
        timezone: 'Europe/Warsaw'
    });
}
