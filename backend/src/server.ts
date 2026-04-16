import dotenv from 'dotenv';
import { buildApp } from './app.js';
import { initCSFlowCron } from './services/csflow.service.js';

dotenv.config();

// Helper for timing out long operations
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
    const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    );
    return Promise.race([promise, timeout]);
}

// Start server
const start = async () => {
    try {
        const app = await buildApp();

        // Test connections before starting server
        try {
            console.log('Testing associations (Prisma)...');
            await withTimeout(app.prisma.$queryRaw`SELECT 1`, 5000, 'Database connection timeout (5s)');
            console.log('✅ Database connected');

            console.log('Testing Redis connection...');
            await withTimeout(app.redis.ping(), 5000, 'Redis connection timeout (5s)');
            console.log('✅ Redis connected');
        } catch (error) {
            console.error('⚠️ Connection test failed:', error instanceof Error ? error.message : error);
        }

        const port = parseInt(process.env.PORT || '3000');
        await app.listen({ port, host: process.env.HOST || '0.0.0.0' });
        console.log(`🚀 Server listening on port ${port}`);

        // Data Migration to fix importSource and accidental archives
        try {
            console.log('[Migration] Checking for listings with null importSource...');
            const nullSourcesCount = await app.prisma.listing.count({ where: { importSource: null } });
            if (nullSourcesCount > 0) {
                console.log(`[Migration] Found ${nullSourcesCount} listings to migrate.`);
                
                // Set 'csflow' as source and unarchive for CSFlow vehicles
                const csflowUpdated = await app.prisma.listing.updateMany({
                    where: { importSource: null, listingId: { startsWith: 'csflow-' } },
                    data: { importSource: 'csflow', isArchived: false, archivedAt: null, archivedReason: null }
                });
                console.log(`[Migration] Migrated ${csflowUpdated.count} CSFlow listings.`);

                // Set 'Otomoto' as source and unarchive for remaining imported vehicles
                const othersUpdated = await app.prisma.listing.updateMany({
                    where: { importSource: null },
                    data: { importSource: 'Otomoto', isArchived: false, archivedAt: null, archivedReason: null }
                });
                console.log(`[Migration] Migrated ${othersUpdated.count} Otomoto/Other listings.`);
                
                console.log('[Migration] Data migration completed successfully.');
            }
        } catch (error) {
            console.error('[Migration] Failed to run data migration:', error);
        }

        initCSFlowCron(app.prisma);

        // Graceful shutdown
        const signals = ['SIGINT', 'SIGTERM'];
        signals.forEach((signal) => {
            process.on(signal, async () => {
                await app.close();
                process.exit(0);
            });
        });

    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

// Prevent process from crashing on unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

start();

import { debugRoutes } from './routes/debug.js';
