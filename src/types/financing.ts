export interface FinancingProduct {
    id: string;
    category: 'CREDIT' | 'LEASING' | 'RENT';
    name?: string;
    currency: string;
    provider: 'OWN' | 'INBANK' | 'VEHIS';
    priority: number;
    minAmount?: number | null;
    maxAmount?: number | null;
    providerConfig?: FinancingProviderConfig | null;
    referenceRate: number;
    margin: number;
    commission: number;
    maxInitialPayment: number;
    maxFinalPayment: number;
    minInstallments: number;
    maxInstallments: number;
    hasBalloonPayment: boolean;
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
}

export type FinancingProductPayload = Omit<FinancingProduct, 'id' | 'createdAt' | 'updatedAt'>;

export interface FinancingProviderConfig {
    productCode?: string;
    apiKey?: string;
    shopUuid?: string;
    paymentDay?: number;
    responseLevel?: 'simple' | 'full';
    currency?: string;
    clientType?: 'consumer' | 'entrepreneur';
}

export interface FinancingProviderConnection {
    id: string;
    provider: 'INBANK' | 'OWN' | 'VEHIS';
    name: string;
    apiBaseUrl: string;
    hasApiKey: boolean;
    apiKeyLast4: string | null;
    hasApiSecret: boolean;
    apiSecretLast4: string | null;
    shopUuid?: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

// Write payload: apiKey/apiSecret are the raw values to set. They are omitted
// (not sent) when the admin isn't changing them, so a masked display value can
// never be written back over the real secret.
export interface FinancingProviderConnectionPayload {
    provider: 'INBANK' | 'OWN' | 'VEHIS';
    name: string;
    apiBaseUrl: string;
    apiKey?: string;
    apiSecret?: string | null;
    shopUuid?: string | null;
    isActive: boolean;
}
