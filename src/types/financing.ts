export interface FinancingProduct {
    id: string;
    category: 'CREDIT' | 'LEASING' | 'RENT';
    name?: string;
    currency: string;
    provider: 'OWN' | 'INBANK';
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
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
}

export type FinancingProductPayload = Omit<FinancingProduct, 'id' | 'createdAt' | 'updatedAt'>;

export interface FinancingProviderConfig {
    productCode?: string;
    paymentDay?: number;
    responseLevel?: 'simple' | 'full';
    currency?: string;
}

export interface FinancingProviderConnection {
    id: string;
    provider: 'INBANK' | 'OWN';
    name: string;
    apiBaseUrl: string;
    apiKey: string;
    apiSecret?: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export type FinancingProviderConnectionPayload = Omit<FinancingProviderConnection, 'id' | 'createdAt' | 'updatedAt'>;
