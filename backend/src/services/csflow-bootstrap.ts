import { PrismaClient } from '@prisma/client';

/**
 * Parsuje ID auta CSFlow z legacy formatu listingId ("csflow-35203").
 * Nowy format "csflow-{slug}-{carId}" celowo NIE jest parsowany —
 * nowe rekordy mają csflowCarId zapisywany wprost przy tworzeniu.
 */
export function parseCsflowCarId(listingId: string | null): number | null {
    if (!listingId) return null;
    const m = /^csflow-(\d+)$/.exec(listingId);
    return m ? parseInt(m[1], 10) : null;
}

/**
 * Jednorazowy, idempotentny bootstrap źródeł CSFlow.
 * Gdy tabela csflow_sources jest pusta i ustawione jest CSFLOW_API_URL:
 * 1. tworzy źródło "Grupa Bemo" (slug: grupabemo) z URL-em z env,
 * 2. backfilluje csflowSourceId + csflowCarId na istniejących ofertach csflow-%,
 * 3. backfilluje csflowSourceId na dealerach z csflowDealerId.
 * Gdy tabela jest niepusta — nie robi nic.
 */
export async function bootstrapCsflowSources(prisma: PrismaClient): Promise<void> {
    const count = await prisma.csflowSource.count();
    if (count > 0) return;

    const apiUrl = process.env.CSFLOW_API_URL;
    if (!apiUrl) {
        console.log('[CSFlow Bootstrap] Brak źródeł i brak CSFLOW_API_URL — pomijam bootstrap');
        return;
    }

    const source = await prisma.csflowSource.create({
        data: { name: 'Grupa Bemo', slug: 'grupabemo', apiUrl },
    });
    console.log(`[CSFlow Bootstrap] Utworzono źródło "${source.name}" (${apiUrl})`);

    const listings = await prisma.listing.findMany({
        where: { listingId: { startsWith: 'csflow-' }, csflowSourceId: null },
        select: { id: true, listingId: true },
    });
    for (const l of listings) {
        await prisma.listing.update({
            where: { id: l.id },
            data: { csflowSourceId: source.id, csflowCarId: parseCsflowCarId(l.listingId) },
        });
    }
    console.log(`[CSFlow Bootstrap] Backfill ofert: ${listings.length}`);

    const dealers = await prisma.dealer.updateMany({
        where: { csflowDealerId: { not: null }, csflowSourceId: null },
        data: { csflowSourceId: source.id },
    });
    console.log(`[CSFlow Bootstrap] Backfill dealerów: ${dealers.count}`);
}
