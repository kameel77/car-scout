import { FastifyInstance } from 'fastify';
import { authorizeRoles } from '../middleware/authorize.js';
import { z } from 'zod';

const FinancingProductSchema = z.object({
    category: z.string(), // 'CREDIT', 'LEASING', 'RENT'
    name: z.string().optional(),
    currency: z.string().default('PLN'),
    provider: z.string().default('OWN'),
    priority: z.number().int().default(0),
    minAmount: z.number().optional().nullable(),
    maxAmount: z.number().optional().nullable(),
    providerConfig: z.record(z.any()).optional().nullable(),
    referenceRate: z.number(),
    margin: z.number(),
    commission: z.number(),
    maxInitialPayment: z.number(),
    maxFinalPayment: z.number(),
    minInstallments: z.number().int(),
    maxInstallments: z.number().int(),
    hasBalloonPayment: z.boolean().default(true),
    isDefault: z.boolean().default(false),
});

const FinancingConnectionSchema = z.object({
    provider: z.string(),
    name: z.string(),
    apiBaseUrl: z.string().url(),
    apiKey: z.string(),
    apiSecret: z.string().optional().nullable(),
    shopUuid: z.string().optional().nullable(),
    isActive: z.boolean().default(true),
});

const FinancingCalculateSchema = z.object({
    productId: z.string(),
    price: z.number(),
    downPaymentAmount: z.number(),
    period: z.number().int(),
    initialFeePercent: z.number().optional(),
    finalPaymentPercent: z.number().optional(),
    manufacturingYear: z.number().int().optional(),
    mileageKm: z.number().int().optional(),
});

const vehisTokenCache = new Map<string, { token: string; expiresAt: number }>();
const VEHIS_TOKEN_TTL_MS = 50 * 60 * 1000;

const fetchWithTimeout = async (url: string, options: any, timeoutMs = 15000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
};

const getVehisToken = async (connection: { apiBaseUrl: string; apiKey: string; apiSecret?: string | null }) => {
    const baseUrl = connection.apiBaseUrl.replace(/\/$/, '');
    const cacheKey = `${baseUrl}:${connection.apiKey}`;
    const cached = vehisTokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.token;
    }

    if (!connection.apiKey || !connection.apiSecret) {
        throw new Error('Missing Vehis credentials');
    }

    const loginUrl = `${baseUrl}/login`;
    const body = new URLSearchParams({
        email: connection.apiKey || process.env.VEHIS_LOGIN || '',
        password: connection.apiSecret || process.env.VEHIS_PASSWORD || ''
    });

    console.log('--- VEHIS LOGIN REQUEST ---');
    console.log('URL:', loginUrl);

    const response = await fetchWithTimeout(loginUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(errorData?.message || 'Vehis authentication failed');
    }

    const result = await response.json().catch(() => ({})) as { token?: string };
    if (!result.token) {
        throw new Error('Vehis authentication failed');
    }

    vehisTokenCache.set(cacheKey, { token: result.token, expiresAt: Date.now() + VEHIS_TOKEN_TTL_MS });
    return result.token;
};

export async function financingRoutes(fastify: FastifyInstance) {
    // Public: Get active products for calculator
    fastify.get('/api/financing/calculator', async (request, reply) => {
        // We want all products so the calculator can switch tabs. 
        // Maybe we only want "valid" ones? For now return all.
        const products = await fastify.prisma.financingProduct.findMany({
            orderBy: [
                { category: 'asc' },
                { priority: 'desc' },
                { isDefault: 'desc' } // Default first
            ]
        });
        return { products };
    });

    // Public: Calculate installment for provider-based products
    fastify.post('/api/financing/calculate', async (request, reply) => {
        try {
            const data = FinancingCalculateSchema.parse(request.body);
            const product = await fastify.prisma.financingProduct.findUnique({
                where: { id: data.productId }
            });

            if (!product) {
                return reply.code(404).send({ error: 'Product not found' });
            }

            if (product.provider !== 'INBANK' && product.provider !== 'VEHIS') {
                return reply.code(400).send({ error: 'Unsupported provider' });
            }

            const connection = await fastify.prisma.financingProviderConnection.findFirst({
                where: { provider: product.provider, isActive: true }
            });

            if (!connection) {
                return reply.code(409).send({ error: 'Connection not configured' });
            }

            if (product.provider === 'INBANK') {
                const config = (product.providerConfig || {}) as Record<string, any>;
                if (!config.productCode || !config.paymentDay) {
                    return reply.code(422).send({ error: 'Missing provider configuration' });
                }

                // Inbank API calculation payload - strictly minimal as per docs
                const payload = {
                    product_code: config.productCode,
                    amount: data.price - data.downPaymentAmount,
                    period: data.period,
                    payment_day: config.paymentDay
                };

                // Inbank API calculation path: /partner/v2/shops/:shop_uuid/calculations
                const rawBaseUrl = (process.env.INBANK_BASE_URL || connection.apiBaseUrl).replace(/\/$/, '');
                const baseUrl = rawBaseUrl.replace(/\/partner(\/v2)?$/, '');
                const apiKey = config.apiKey || connection.apiKey;
                const shopUuid = config.shopUuid || connection.shopUuid;

                const url = `${baseUrl}/partner/v2/shops/${shopUuid}/calculations`;

                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify(payload),
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({})) as { message?: string; error?: string };
                    return reply.code(502).send({
                        error: 'Provider request failed',
                        details: errorData?.message || errorData?.error || 'Unknown provider error'
                    });
                }

                const result = await response.json().catch(() => ({}));

                // Inbank documentation says payment_amount_monthly or installment_amount
                const monthlyInstallment = Number(
                    (result as any)?.payment_amount_monthly
                    ?? (result as any)?.paymentAmountMonthly
                    ?? (result as any)?.installment_amount
                    ?? (result as any)?.installmentAmount
                    ?? (result as any)?.monthly_payment
                    ?? (result as any)?.monthlyPayment
                );

                if (!Number.isFinite(monthlyInstallment)) {
                    return reply.code(502).send({ error: 'Invalid provider response', details: result });
                }

                return { monthlyInstallment, provider: product.provider };
            }

            const config = (product.providerConfig || {}) as Record<string, any>;
            if (!data.manufacturingYear) {
                return reply.code(422).send({ error: 'Missing vehicle year' });
            }

            const clientType = config.clientType === 'consumer' ? 'consumer' : 'entrepreneur';
            const initialFeePercent = data.initialFeePercent ?? Math.round((data.downPaymentAmount / data.price) * 100);
            const finalPaymentPercent = data.finalPaymentPercent ?? 0;
            const vehicleState = data.mileageKm != null && data.mileageKm > 10 ? 1 : 0;

            // Vehis requires net price. We receive gross from frontend.
            const netPrice = Math.round(data.price / 1.23);
            const vehisPayload = {
                client: clientType,
                initialFee: Math.max(1, Math.min(50, Math.round(initialFeePercent))),
                repurchase: Math.max(1, Math.min(35, Math.round(finalPaymentPercent))),
                duration: data.period,
                cars: [
                    {
                        state: vehicleState,
                        manufacturing_year: data.manufacturingYear,
                        price: netPrice
                    }
                ]
            };

            try {
                const token = await getVehisToken({
                    apiBaseUrl: connection.apiBaseUrl,
                    apiKey: connection.apiKey,
                    apiSecret: connection.apiSecret
                });

                const vehisUrl = `${connection.apiBaseUrl.replace(/\/$/, '')}/broker/calculate`;
                console.log('--- VEHIS CALCULATE REQUEST ---');
                console.log('URL:', vehisUrl);
                console.log('Payload:', JSON.stringify(vehisPayload, null, 2));

                const response = await fetchWithTimeout(vehisUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(vehisPayload)
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({})) as { message?: string };
                    return reply.code(502).send({
                        error: 'Provider request failed',
                        details: errorData?.message || 'Unknown provider error'
                    });
                }

                const result = await response.json().catch(() => ({}));

                console.log('--- VEHIS RESPONSE ---');
                console.log('Status:', response.status);
                console.log('Body:', JSON.stringify(result, null, 2));

                // Vehis returns rich object for broker/calculate
                // We wrap it to match user's requested format for preview
                const monthlyInstallment = Number((result as any)?.cars?.[0]?.installment);
                if (!Number.isFinite(monthlyInstallment)) {
                    return reply.code(502).send({ error: 'Invalid provider response', details: result });
                }

                // Construct rich preview response
                const richResult = result as any;
                const richPreview = {
                    client: richResult.client,
                    initialFee: richResult.initialFee,
                    repurchase: richResult.repurchase,
                    duration: richResult.duration,
                    cars: (richResult.cars || []).map((car: any) => ({
                        state: car.state,
                        manufacturing_year: car.manufacturing_year,
                        price: car.price,
                        installment: car.installment,
                        initialFee: car.initialFee,
                        repurchase: car.repurchase,
                        wibor: car.wibor
                    }))
                };

                return {
                    monthlyInstallment,
                    provider: product.provider,
                    ...richPreview
                };
            } catch (error) {
                return reply.code(502).send({
                    error: 'Provider request failed',
                    details: error instanceof Error ? error.message : 'Unknown provider error'
                });
            }
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) });
        }
    });

    // Admin: List all products
    fastify.get('/api/financing/products', {
        preHandler: [fastify.authenticate, authorizeRoles(['admin', 'manager'])]
    }, async (request, reply) => {
        try {
            const products = await fastify.prisma.financingProduct.findMany({
                orderBy: [
                    { category: 'asc' },
                    { priority: 'desc' },
                    { createdAt: 'desc' }
                ]
            });
            return { products };
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) });
        }
    });

    // Admin: Create product
    fastify.post('/api/financing/products', {
        preHandler: [fastify.authenticate, authorizeRoles(['admin'])]
    }, async (request, reply) => {
        try {
            const rawData = FinancingProductSchema.parse(request.body);
            const data = {
                ...rawData,
                providerConfig: rawData.providerConfig ?? undefined
            };

            // If this is set as default, unset others in same category
            if (data.isDefault) {
                await fastify.prisma.financingProduct.updateMany({
                    where: { category: data.category },
                    data: { isDefault: false }
                });
            }

            const product = await fastify.prisma.financingProduct.create({
                data
            });

            return product;
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) });
        }
    });

    // Admin: Update product
    fastify.patch('/api/financing/products/:id', {
        preHandler: [fastify.authenticate, authorizeRoles(['admin'])]
    }, async (request, reply) => {
        try {
            const { id } = request.params as { id: string };
            const rawData = FinancingProductSchema.partial().parse(request.body);
            const data = {
                ...rawData,
                providerConfig: rawData.providerConfig ?? undefined
            };

            // If this is set as default, unset others in same category
            if (data.isDefault) {
                // Need to know category first if not provided in update
                let category = data.category;
                if (!category) {
                    const existing = await fastify.prisma.financingProduct.findUnique({ where: { id } });
                    if (!existing) return reply.code(404).send({ error: 'Not found' });
                    category = existing.category;
                }

                await fastify.prisma.financingProduct.updateMany({
                    where: { category, id: { not: id } },
                    data: { isDefault: false }
                });
            }

            const product = await fastify.prisma.financingProduct.update({
                where: { id },
                data
            });

            return product;
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) });
        }
    });

    // Admin: Delete product
    fastify.delete('/api/financing/products/:id', {
        preHandler: [fastify.authenticate, authorizeRoles(['admin'])]
    }, async (request, reply) => {
        try {
            const { id } = request.params as { id: string };

            await fastify.prisma.financingProduct.delete({
                where: { id }
            });

            return { success: true };
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) });
        }
    });

    // Admin: List all provider connections
    fastify.get('/api/financing/connections', {
        preHandler: [fastify.authenticate, authorizeRoles(['admin', 'manager'])]
    }, async (request, reply) => {
        try {
            const connections = await fastify.prisma.financingProviderConnection.findMany({
                orderBy: [{ provider: 'asc' }, { createdAt: 'desc' }]
            });
            return { connections };
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) });
        }
    });

    // Admin: Create provider connection
    fastify.post('/api/financing/connections', {
        preHandler: [fastify.authenticate, authorizeRoles(['admin'])]
    }, async (request, reply) => {
        try {
            const data = FinancingConnectionSchema.parse(request.body);
            const connection = await fastify.prisma.financingProviderConnection.create({ data });
            return connection;
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) });
        }
    });

    // Admin: Update provider connection
    fastify.patch('/api/financing/connections/:id', {
        preHandler: [fastify.authenticate, authorizeRoles(['admin'])]
    }, async (request, reply) => {
        try {
            const { id } = request.params as { id: string };
            const data = FinancingConnectionSchema.partial().parse(request.body);
            const connection = await fastify.prisma.financingProviderConnection.update({
                where: { id },
                data
            });
            return connection;
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) });
        }
    });

    // Admin: Delete provider connection
    // Admin: Submit application to provider
    fastify.post('/api/financing/apply/:leadId', {
        preHandler: [fastify.authenticate, authorizeRoles(['admin'])]
    }, async (request, reply) => {
        try {
            const { leadId } = request.params as { leadId: string };
            const lead = await fastify.prisma.lead.findUnique({
                where: { id: leadId },
                include: { financingProduct: true }
            });

            if (!lead) return reply.code(404).send({ error: 'Lead not found' });
            if (!lead.financingProduct) return reply.code(400).send({ error: 'Lead has no financing product' });
            if (lead.financingProduct.provider !== 'INBANK') {
                return reply.code(400).send({ error: 'Only INBANK provider is supported for API submission' });
            }

            const connection = await fastify.prisma.financingProviderConnection.findFirst({
                where: { provider: lead.financingProduct.provider, isActive: true }
            });

            if (!connection) return reply.code(409).send({ error: 'Connection not configured' });

            const config = (lead.financingProduct.providerConfig || {}) as Record<string, any>;

            // Construct application payload
            const payload = {
                product_code: config.productCode,
                amount: lead.financingAmount,
                period: lead.financingPeriod,
                down_payment_amount: lead.financingDownPayment,
                payment_day: config.paymentDay,
                currency: config.currency || lead.financingProduct.currency,
                customer: {
                    name: lead.name,
                    email: lead.email,
                    phone: lead.phone,
                },
                external_reference: lead.referenceNumber,
                callback_url: `${process.env.BACKEND_PUBLIC_URL || 'http://localhost:3000'}/api/financing/webhooks/inbank`,
            };

            // Inbank API application path: /partner/v2/shops/:shop_uuid/applications
            const rawBaseUrl = (process.env.INBANK_BASE_URL || connection.apiBaseUrl).replace(/\/$/, '');
            const baseUrl = rawBaseUrl.replace(/\/partner(\/v2)?$/, '');
            const apiKey = config.apiKey || connection.apiKey;
            const shopUuid = config.shopUuid || connection.shopUuid;

            const url = `${baseUrl}/partner/v2/shops/${shopUuid}/applications`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify(payload),
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                return reply.code(502).send({
                    error: 'Provider application failed',
                    details: (result as any)?.message || (result as any)?.error || 'Unknown provider error'
                });
            }

            // Update lead with external status
            await fastify.prisma.lead.update({
                where: { id: leadId },
                data: {
                    externalId: (result as any)?.id || (result as any)?.applicationId,
                    externalStatus: (result as any)?.status || 'SUBMITTED',
                    status: 'applied'
                }
            });

            return { success: true, result };
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) });
        }
    });

    // Public: Inbank Webhook
    fastify.post('/api/financing/webhooks/inbank', async (request, reply) => {
        try {
            const body = request.body as any;
            const externalId = body.id || body.applicationId;
            const status = body.status;

            if (!externalId) return reply.code(400).send({ error: 'Missing ID' });

            await fastify.prisma.lead.updateMany({
                where: { externalId },
                data: { externalStatus: status }
            });

            return { success: true };
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Internal Server Error' });
        }
    });

    // Admin: Test provider connection
    fastify.post('/api/financing/test-connection', {
        preHandler: [fastify.authenticate, authorizeRoles(['admin'])]
    }, async (request, reply) => {
        try {
            const { provider, apiBaseUrl, apiKey, apiSecret, shopUuid } = request.body as {
                provider?: string;
                apiBaseUrl: string;
                apiKey: string;
                apiSecret?: string;
                shopUuid?: string;
            };

            if (!apiBaseUrl || !apiKey) {
                return reply.code(400).send({ error: 'Missing required fields' });
            }

            if (provider === 'VEHIS') {
                if (!apiSecret) {
                    return reply.code(400).send({ error: 'Missing required fields' });
                }

                const baseUrl = apiBaseUrl.replace(/\/$/, '');
                const url = `${baseUrl}/login`;
                const body = new URLSearchParams({
                    email: apiKey || process.env.VEHIS_LOGIN || '',
                    password: apiSecret || process.env.VEHIS_PASSWORD || ''
                });

                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body
                });

                const result: any = await response.json().catch(() => ({}));

                if (response.ok && result?.token) {
                    return { success: true, details: 'Sukces' };
                }

                const errorDetail = result?.message || 'Błąd autoryzacji (Email/Hasło)';
                return { success: false, details: errorDetail };
            }

            if (!shopUuid) {
                return reply.code(400).send({ error: 'Missing required fields' });
            }

            const rawBaseUrl = (process.env.INBANK_BASE_URL || apiBaseUrl).replace(/\/$/, '');
            const baseUrl = rawBaseUrl.replace(/\/partner(\/v2)?$/, '');
            const url = `${baseUrl}/partner/v2/shops/${shopUuid}/calculations`;

            // Use a dummy calculation as a test
            const payload = {
                product_code: 'test', // We expect 422 or 401/403, but not 404 or connection error
                amount: 10000,
                period: 12
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify(payload),
            });

            const result: any = await response.json().catch(() => ({}));

            // LOGGING FOR DEBUGGING
            console.log('--- INBANK TEST CONNECTION ---');
            console.log('URL:', url);
            console.log('Payload:', JSON.stringify(payload));
            console.log('Response status:', response.status);
            console.log('Response body:', JSON.stringify(result));
            console.log('------------------------------');

            if (response.status === 401 || response.status === 403) {
                return { success: false, details: 'Błąd autoryzacji (API Key)' };
            }

            if (response.status === 404) {
                return { success: false, details: 'Nie znaleziono sklepu (Shop UUID lub URL)' };
            }

            // 422 is actually a "good" sign for connection/auth, it just means our dummy payload was invalid (which we expect)
            if (response.ok || response.status === 422) {
                return { success: true, details: response.ok ? 'Sukces' : 'Połączono (Błąd walidacji danych testowych - OK)' };
            }

            const errorDetail = Array.isArray(result.error) ? result.error.join(', ') : (result.message || result.error);

            return {
                success: false,
                details: errorDetail || `Błąd HTTP: ${response.status}`
            };
        } catch (error) {
            console.error('Inbank test connection exception:', error);
            return { success: false, details: error instanceof Error ? error.message : 'Błąd połączenia' };
        }
    });
}
