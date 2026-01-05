export interface FinancingProduct {
    id: string;
    category: 'CREDIT' | 'LEASING' | 'RENT';
    name?: string;
    currency: string;
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
