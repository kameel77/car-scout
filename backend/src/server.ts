import dotenv from 'dotenv';
import { buildApp } from './app.js';

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
        await app.listen({ port, host: '::' });
        console.log(`🚀 Server listening on port ${port}`);

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

