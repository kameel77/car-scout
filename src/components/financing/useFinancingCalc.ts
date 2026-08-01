import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { financingApi } from '@/services/api';
import { FinancingProduct } from '@/types/financing';

export const DEFAULT_FINANCING_PRICE = 80000;

export interface UseFinancingCalcOptions {
    initialPrice?: number;
    initialCategory?: FinancingProduct['category'];
    priceIsNet?: boolean;
    vatMargin?: boolean;
}

export function useFinancingCalc(options: UseFinancingCalcOptions = {}) {
    const {
        initialPrice = DEFAULT_FINANCING_PRICE,
        initialCategory = 'LEASING',
        priceIsNet = false,
        vatMargin = false,
    } = options;

    const vatMultiplier = vatMargin ? 1 : 1.23;

    // Inputs
    const [price, setPrice] = React.useState<number>(initialPrice);
    const [condition, setCondition] = React.useState<'NEW' | 'USED'>('NEW');
    const [manufacturingYear, setManufacturingYear] = React.useState<number>(new Date().getFullYear());
    const [activeCategory, setActiveCategory] = React.useState<FinancingProduct['category']>(initialCategory);
    
    const [months, setMonths] = React.useState(60);
    const [initialPaymentPct, setInitialPaymentPct] = React.useState(20);
    const [finalPaymentPct, setFinalPaymentPct] = React.useState(25);
    const [includeInsurance, setIncludeInsurance] = React.useState(false);

    // Fetch public products
    const { data, isLoading } = useQuery({
        queryKey: ['financing-calculator-standalone'],
        queryFn: () => financingApi.listPublic(),
        staleTime: 5 * 60 * 1000,
    });

    const products = React.useMemo(
        () => (data?.products ?? []) as FinancingProduct[],
        [data?.products]
    );

    const categories = React.useMemo(() => {
        return Array.from(new Set(products.map(p => p.category))).sort();
    }, [products]);

    const [selectedProduct, setSelectedProduct] = React.useState<FinancingProduct | null>(null);
    const [failedProducts, setFailedProducts] = React.useState<Set<string>>(new Set());
    const [externalInstallment, setExternalInstallment] = React.useState<number | null>(null);
    const [externalLoading, setExternalLoading] = React.useState(false);
    const [inbankDetails, setInbankDetails] = React.useState<any | null>(null);

    const initialPaymentAmount = Math.round(price * initialPaymentPct / 100);
    const finalPaymentAmount = Math.round(price * finalPaymentPct / 100);
    const amountToFinance = Math.max(0, price - initialPaymentAmount);

    const candidateProduct = React.useMemo(() => {
        const eligibleProducts = products.filter(p => {
            if (p.category !== activeCategory) return false;
            if (failedProducts.has(p.id)) return false;
            if (p.minAmount != null && amountToFinance < p.minAmount) return false;
            if (p.maxAmount != null && amountToFinance > p.maxAmount) return false;
            return true;
        });

        const sorted = [...eligibleProducts].sort((a, b) => {
            const priorityDiff = (b.priority ?? 0) - (a.priority ?? 0);
            if (priorityDiff !== 0) return priorityDiff;
            if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
            if (a.provider !== b.provider) {
                if (a.provider === 'OWN') return 1;
                if (b.provider === 'OWN') return -1;
            }
            return 0;
        });

        if (sorted.length === 0) {
            return products.find(p => p.category === activeCategory && p.provider === 'OWN' && p.isDefault)
                || products.find(p => p.category === activeCategory && p.provider === 'OWN')
                || null;
        }

        return sorted[0] || null;
    }, [activeCategory, amountToFinance, failedProducts, products]);

    React.useEffect(() => {
        setSelectedProduct(prev => (prev?.id === candidateProduct?.id ? prev : candidateProduct));
    }, [candidateProduct]);

    const failedCountRef = React.useRef(0);
    const MAX_EXTERNAL_FAILURES = 3;

    React.useEffect(() => {
        let isCancelled = false;

        const calculateExternal = async () => {
            if (!selectedProduct || selectedProduct.provider === 'OWN') {
                setExternalInstallment(null);
                setInbankDetails(null);
                setExternalLoading(false);
                return;
            }

            if (failedCountRef.current >= MAX_EXTERNAL_FAILURES) {
                setExternalInstallment(null);
                setInbankDetails(null);
                setExternalLoading(false);
                return;
            }

            setExternalLoading(true);
            try {
                const nettoPrice = priceIsNet ? price : Math.round(price / vatMultiplier);

                const response = await financingApi.calculate({
                    productId: selectedProduct.id,
                    price: nettoPrice,
                    downPaymentAmount: Math.round(nettoPrice * initialPaymentPct / 100),
                    period: months,
                    initialFeePercent: initialPaymentPct,
                    finalPaymentPercent: finalPaymentPct,
                    manufacturingYear
                });

                if (!isCancelled) {
                    const nettoInstallment = response.monthlyInstallment;
                    const displayValue = priceIsNet
                        ? nettoInstallment
                        : Math.round(nettoInstallment * vatMultiplier);
                    setExternalInstallment(displayValue);

                    if (selectedProduct.provider === 'INBANK') {
                        setInbankDetails(response);
                    } else {
                        setInbankDetails(null);
                    }
                    failedCountRef.current = 0;
                }
            } catch {
                if (!isCancelled) {
                    failedCountRef.current += 1;
                    setFailedProducts(prev => new Set([...prev, selectedProduct.id]));
                    setExternalInstallment(null);
                    setInbankDetails(null);
                }
            } finally {
                if (!isCancelled) {
                    setExternalLoading(false);
                }
            }
        };

        const timer = setTimeout(calculateExternal, 400);
        return () => {
            isCancelled = true;
            clearTimeout(timer);
        };
    }, [selectedProduct, price, priceIsNet, initialPaymentPct, finalPaymentPct, months, manufacturingYear, vatMultiplier]);

    React.useEffect(() => {
        if (!selectedProduct) return;
        setMonths(prev => Math.max(selectedProduct.minInstallments, Math.min(selectedProduct.maxInstallments, prev)));
        setInitialPaymentPct(prev => Math.min(prev, selectedProduct.maxInitialPayment));
        setFinalPaymentPct(selectedProduct.hasBalloonPayment
            ? Math.min(25, selectedProduct.maxFinalPayment)
            : 0
        );
    }, [selectedProduct]);

    // Standard PMT interest calculation for OWN products (when referenceRate/margin provided)
    const annualRate = selectedProduct ? (selectedProduct.referenceRate + selectedProduct.margin) : 0;
    const monthlyRate = annualRate / 100 / 12;

    let monthlyInstallment = 0;
    if (monthlyRate === 0) {
        monthlyInstallment = (amountToFinance - finalPaymentAmount) / (months || 1);
    } else {
        const pow = Math.pow(1 + monthlyRate, months);
        monthlyInstallment = (amountToFinance * monthlyRate - finalPaymentAmount * monthlyRate / pow) / (1 - 1 / pow);
    }

    const commissionAmount = selectedProduct ? amountToFinance * selectedProduct.commission / 100 : 0;
    const displayInstallment = selectedProduct?.provider === 'OWN' ? monthlyInstallment : externalInstallment;

    return {
        price,
        setPrice,
        condition,
        setCondition,
        manufacturingYear,
        setManufacturingYear,
        activeCategory,
        setActiveCategory,
        categories,
        months,
        setMonths,
        initialPaymentPct,
        setInitialPaymentPct,
        finalPaymentPct,
        setFinalPaymentPct,
        includeInsurance,
        setIncludeInsurance,
        isLoading,
        selectedProduct,
        displayInstallment,
        monthlyInstallment,
        externalLoading,
        inbankDetails,
        initialPaymentAmount,
        finalPaymentAmount,
        amountToFinance,
        commissionAmount,
        annualRate,
        vatMultiplier,
    };
}
