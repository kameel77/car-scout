import { FastifyInstance } from 'fastify';

async function recalculateAllPrices(fastify: FastifyInstance) {
    const settings = await fastify.prisma.appSettings.findUnique({
        where: { id: 'default' }
    });

    if (!settings) return 0;

    const listings = await fastify.prisma.listing.findMany({
        where: { isArchived: false }
    });

    const updates = listings.map(listing => {
        const dealerPriceNetPln = listing.pricePln / 1.23;
        const dealerPriceNetEur = dealerPriceNetPln / settings.eurExRate;

        // Rounded to full 10s (normal rounding), GROSS
        const brokerPricePln = Math.round((dealerPriceNetPln * (1 + settings.brokerFeePctPln / 100)) * 1.23 / 10) * 10;

        // Rounded UP to full 10s, GROSS
        const brokerPriceEur = Math.ceil((dealerPriceNetEur * (1 + settings.brokerFeePctEur / 100)) * 1.23 / 10) * 10;

        return fastify.prisma.listing.update({
            where: { id: listing.id },
            data: {
                dealerPriceNetPln,
                dealerPriceNetEur,
                brokerPricePln,
                brokerPriceEur
            }
        });
    });

    // Run batch updates
    if (updates.length > 0) {
        await fastify.prisma.$transaction(updates);
    }

    return updates.length;
}

export async function settingsRoutes(fastify: FastifyInstance) {
    // Get current settings
    fastify.get('/api/settings', async (request, reply) => {
        let settings = await fastify.prisma.appSettings.findUnique({
            where: { id: 'default' }
        });

        // If no settings exist yet, create default entry
        if (!settings) {
            settings = await fastify.prisma.appSettings.create({
                data: { id: 'default' }
            });
        }

        return settings;
    });

    // Update settings
    fastify.post('/api/settings', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const data = request.body as any;

        const settings = await fastify.prisma.appSettings.upsert({
            where: { id: 'default' },
            update: {
                enabledLanguages: data.enabledLanguages,
                displayCurrency: data.displayCurrency,
                eurExRate: parseFloat(data.eurExRate),
                brokerFeePctPln: parseFloat(data.brokerFeePctPln),
                brokerFeePctEur: parseFloat(data.brokerFeePctEur)
            },
            create: {
                id: 'default',
                enabledLanguages: data.enabledLanguages || ['pl'],
                displayCurrency: data.displayCurrency || 'PLN',
                eurExRate: parseFloat(data.eurExRate) || 4.30,
                brokerFeePctPln: parseFloat(data.brokerFeePctPln) || 3.5,
                brokerFeePctEur: parseFloat(data.brokerFeePctEur) || 3.5
            }
        });

        // AUTOMATIC RECALCULATION
        const updatedCount = await recalculateAllPrices(fastify);
        fastify.log.info({ updatedCount }, 'Automatic price recalculation triggered by settings change');

        return { ...settings, recalculatedCount: updatedCount };
    });

    // Recalculate all listing prices based on current settings (Manual Trigger)
    fastify.post('/api/settings/recalculate', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const updatedCount = await recalculateAllPrices(fastify);

        return {
            success: true,
            updatedCount
        };
    });
}
