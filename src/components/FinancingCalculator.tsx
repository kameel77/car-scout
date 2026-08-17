import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { financingApi } from '@/services/api';
import { FinancingProduct } from '@/types/financing';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPrice } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import { Calculator, Info, MessageSquare, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { FinancingType } from '@/utils/url-utils';
import { setPreferredFinancingType } from '@/utils/url-utils';


interface FinancingCalculatorProps {
    listingId?: string;
    price: number;
    /** True when the price prop is already netto (e.g. priceType='net' sites) */
    priceIsNet?: boolean;
    currency?: string;
    manufacturingYear?: number;
    mileageKm?: number;
    offerInitialPayment?: number;
    /** Current financing type from URL — drives which tab is active */
    financingType?: FinancingType;
    onFinancingTypeChange?: (type: FinancingType) => void;
    isDuplicateHeading?: boolean;
    /** Optional ReactNode rendered between the disclaimer and the CTA button */
    priceSlot?: React.ReactNode;
    /** When true, changes CTA button text to "Zapytaj o ofertę" */
    motoliaMode?: boolean;
    /** Jeśli przekazane, ten produkt będzie wymuszony niezależnie od innych priorytetów */
    forcedProductId?: string;
    creditAvailable?: boolean;
    leasingAvailable?: boolean;
    vatMargin?: boolean;
}

/** Maps URL financing type to product category */
const FINANCING_TO_CATEGORY: Record<string, FinancingProduct['category']> = {
    'kredyt': 'CREDIT',
    'leasing': 'LEASING',
    'wynajem': 'RENT',
    'gotowka': 'CREDIT', // /oferta/ defaults to credit tab
};

export function FinancingCalculator({
    listingId,
    price,
    priceIsNet,
    currency = 'PLN',
    manufacturingYear,
    mileageKm,
    offerInitialPayment,
    financingType,
    onFinancingTypeChange,
    isDuplicateHeading,
    priceSlot,
    motoliaMode,
    forcedProductId,
    creditAvailable = true,
    leasingAvailable = true,
    vatMargin = false,
}: FinancingCalculatorProps) {
    const navigate = useNavigate();
    const vatMultiplier = vatMargin ? 1 : 1.23;

    const { data, isLoading } = useQuery({
        queryKey: ['financing-calculator'],
        queryFn: () => financingApi.listPublic(),
        staleTime: 5 * 60 * 1000,
    });

    const products = React.useMemo(
        () => (data?.products ?? []) as FinancingProduct[],
        [data?.products]
    );
    const categories = React.useMemo(() => {
        const allCats = Array.from(new Set(products.map(p => p.category))).sort();
        return allCats.filter(cat => {
            if (cat === 'CREDIT' && creditAvailable === false) return false;
            if (cat === 'LEASING' && leasingAvailable === false) return false;
            return true;
        });
    }, [products, creditAvailable, leasingAvailable]);

    // Derive initial category from URL financing type, falling back to first available
    const urlCategory = financingType ? FINANCING_TO_CATEGORY[financingType] : undefined;
    const initialCat = (urlCategory && categories.includes(urlCategory)) 
        ? urlCategory 
        : ((categories[0] as FinancingProduct['category']) || 'CREDIT');
        
    const [activeCategory, setActiveCategory] = React.useState<FinancingProduct['category']>(initialCat);
    const [selectedProduct, setSelectedProduct] = React.useState<FinancingProduct | null>(null);
    const [failedProducts, setFailedProducts] = React.useState<Set<string>>(new Set());
    const [externalInstallment, setExternalInstallment] = React.useState<number | null>(null);
    const [externalLoading, setExternalLoading] = React.useState(false);
    const [externalIsGross, setExternalIsGross] = React.useState(false);
    const [inbankDetails, setInbankDetails] = React.useState<any | null>(null);

    // State for calculation parameters
    const [months, setMonths] = React.useState(60);
    const [initialPaymentPct, setInitialPaymentPct] = React.useState(25);
    const [finalPaymentPct, setFinalPaymentPct] = React.useState(35);

    const formatRate = React.useCallback((val: number | null | undefined) => {
        if (val == null || !Number.isFinite(val)) return '0,00';
        // If the rate is a decimal fraction (e.g. 0.18 representing 18%), multiply by 100.
        // We consider any value < 1.0 (except 0) to be a fraction that needs multiplying by 100.
        const percentageValue = (val > 0 && val < 1.0) ? val * 100 : val;
        return percentageValue.toFixed(2).replace('.', ',');
    }, []);

    const getInbankRepresentativeExample = React.useCallback(() => {
        if (!inbankDetails) return '';

        // If consumer client (priceIsNet is false), Inbank calculations must be shown in gross (brutto).
        // Since the price was passed as net internally, Inbank returns net values.
        // We multiply net values by vatMultiplier for consumers, or display net as-is for entrepreneurs.
        const multiplier = priceIsNet ? 1 : vatMultiplier;

        const rrso = formatRate(inbankDetails.creditCostRateAnnual);
        const downPayment = formatPrice(Math.round(price * initialPaymentPct / 100), currency);
        const netCredit = formatPrice(Math.round(price * (1 - initialPaymentPct / 100)), currency);
        const totalRepayments = formatPrice(Math.round((inbankDetails.repaymentsAmountTotal ?? 0) * multiplier), currency);
        const nominalRate = formatRate(inbankDetails.interestRateAnnual);
        const totalCost = formatPrice(Math.round((inbankDetails.creditCostAmountTotal ?? 0) * multiplier), currency);
        const commission = formatPrice(Math.round((inbankDetails.contractFeeAmountTotal ?? 0) * multiplier), currency);
        const interest = formatPrice(Math.round((inbankDetails.interestAmountTotal ?? 0) * multiplier), currency);
        const installmentAmount = formatPrice(externalInstallment ?? 0, currency);
        const lastInstallment = formatPrice(Math.round((inbankDetails.lastPaymentAmount ?? (inbankDetails.monthlyInstallment ?? 0)) * multiplier), currency);
        const installmentsCount = months;

        return `Dla wybranej raty kredytu Rzeczywista Roczna Stopa Oprocentowania (RRSO) wynosi ${rrso}% przy założeniach: wpłata własna ${downPayment}, całkowita kwota kredytu (bez kredytowanych kosztów kredytu) ${netCredit}, całkowita kwota do zapłaty przez konsumenta ${totalRepayments}, oprocentowanie stałe ${nominalRate}% w skali roku, całkowity koszt kredytu ${totalCost} (w tym: prowizja ${commission}, odsetki ${interest}), ${installmentsCount - 1} miesięcznych rat równych w wysokości ${installmentAmount} oraz ostatnia rata wyrównująca w wysokości ${lastInstallment}. Motolia Sp. z o.o. jest pośrednikiem Banku umocowanym w zakresie czynności faktycznych i prawnych związanych z zawieraniem umów kredytu.`;
    }, [inbankDetails, price, priceIsNet, initialPaymentPct, externalInstallment, months, currency, formatRate]);
    const offerInitialPaymentPct = React.useMemo(() => {
        if (!offerInitialPayment || !Number.isFinite(price) || price <= 0) return null;
        return Math.round((offerInitialPayment / price) * 100);
    }, [offerInitialPayment, price]);

    // Sync calculator tab with URL financing type (URL is source of truth)
    React.useEffect(() => {
        if (financingType) {
            const targetCategory = FINANCING_TO_CATEGORY[financingType];
            if (targetCategory && targetCategory !== activeCategory && categories.includes(targetCategory)) {
                setActiveCategory(targetCategory);
            }
        }
    }, [financingType, categories]);

    // Fallback: if active category is not in available categories, pick first available
    React.useEffect(() => {
        if (categories.length > 0 && !categories.includes(activeCategory)) {
            setActiveCategory(categories[0] as FinancingProduct['category']);
        }
    }, [categories, activeCategory]);

    const initialPaymentAmount = Math.round(price * initialPaymentPct / 100);
    const finalPaymentAmount = Math.round(price * finalPaymentPct / 100);
    const amountToFinance = price - initialPaymentAmount;

        const candidateProduct = React.useMemo(() => {
        // Step 1: Filter products by category, failed status, and amount
        const eligibleProducts = products.filter(p => {
            if (p.category !== activeCategory) return false;
            
            // Check listing specific availability flags
            if (p.category === 'CREDIT' && !creditAvailable) return false;
            if (p.category === 'LEASING' && !leasingAvailable) return false;

            if (failedProducts.has(p.id)) return false;

            // Priority is given to amount range (unless forced)
            if (forcedProductId !== p.id) {
                if (p.minAmount != null && amountToFinance < p.minAmount) return false;
                if (p.maxAmount != null && amountToFinance > p.maxAmount) return false;
            }

            return true;
        });

        // Step 1.5: If there is a forced product and it is eligible, pick it immediately
        if (forcedProductId) {
            const forced = eligibleProducts.find(p => p.id === forcedProductId);
            if (forced) return forced;
        }

        // Step 2: Sort by priority (desc), then isDefault (desc)
        const sorted = [...eligibleProducts].sort((a, b) => {
            const priorityDiff = (b.priority ?? 0) - (a.priority ?? 0);
            if (priorityDiff !== 0) return priorityDiff;

            // Then prefer default
            if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;

            // Then prefer OWN products as more stable fallback if all else equal
            if (a.provider !== b.provider) {
                if (a.provider === 'OWN') return 1;
                if (b.provider === 'OWN') return -1;
            }

            return 0;
        });

        // Step 3: If no eligible product matches amount range, still try to find at least one from "OWN" products
        // as a ultimate fallback, even if they don't exactly match the range (if range is not strict)
        if (sorted.length === 0) {
            return products.find(p => p.category === activeCategory && p.provider === 'OWN' && p.isDefault)
                || products.find(p => p.category === activeCategory && p.provider === 'OWN')
                || null;
        }

        return sorted[0] || null;
    }, [activeCategory, amountToFinance, failedProducts, products, forcedProductId]);

    React.useEffect(() => {
        setSelectedProduct(prev => (prev?.id === candidateProduct?.id ? prev : candidateProduct));
    }, [candidateProduct]);

    // Track how many external products have failed to prevent infinite retry loop
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

            // If too many external products have failed, skip API call and fall back silently
            if (failedCountRef.current >= MAX_EXTERNAL_FAILURES) {
                console.warn(`Skipping external calculation: ${failedCountRef.current} failures reached limit`);
                setExternalInstallment(null);
                setInbankDetails(null);
                setExternalLoading(false);
                return;
            }

            setExternalLoading(true);
            try {
                // Vehis always operates in netto internally.
                // Ensure we always send netto price regardless of priceType.
                const nettoPrice = priceIsNet ? price : Math.round(price / vatMultiplier);

                const response = await financingApi.calculate({
                    productId: selectedProduct.id,
                    price: nettoPrice,
                    downPaymentAmount: Math.round(nettoPrice * initialPaymentPct / 100),
                    period: months,
                    initialFeePercent: initialPaymentPct,
                    finalPaymentPercent: finalPaymentPct,
                    manufacturingYear,
                    mileageKm
                });
                if (!isCancelled) {
                    // Vehis returns netto installment.
                    // For consumer (priceIsNet=false): display brutto = netto * vatMultiplier
                    // For entrepreneur (priceIsNet=true): display netto as-is
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

                    // Reset failure counter on success
                    failedCountRef.current = 0;
                }
            } catch (error) {
                if (!isCancelled) {
                    console.error('External calculation failed:', error);
                    failedCountRef.current += 1;
                    // Add to failed set to trigger fallback to next candidate
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

        // Debounce external API calls to prevent rapid-fire requests
        const debounceTimer = setTimeout(calculateExternal, 500);

        return () => {
            isCancelled = true;
            clearTimeout(debounceTimer);
        };
    }, [selectedProduct, price, priceIsNet, initialPaymentAmount, initialPaymentPct, finalPaymentPct, months, manufacturingYear, mileageKm]);

    React.useEffect(() => {
        if (!selectedProduct) return;
        const vehisMinInitial = selectedProduct.provider === 'VEHIS' && selectedProduct.maxInitialPayment >= 1 ? 1 : 0;
        const vehisMinFinal = selectedProduct.provider === 'VEHIS' && selectedProduct.maxFinalPayment >= 1 ? 1 : 0;
        setMonths(Math.max(selectedProduct.minInstallments, Math.min(selectedProduct.maxInstallments, 60)));
        const initialFromOffer = offerInitialPaymentPct != null
            ? Math.max(vehisMinInitial, Math.min(offerInitialPaymentPct, selectedProduct.maxInitialPayment))
            : Math.max(vehisMinInitial, Math.min(25, selectedProduct.maxInitialPayment));
        setInitialPaymentPct(initialFromOffer);
        setFinalPaymentPct(selectedProduct.hasBalloonPayment
            ? Math.max(vehisMinFinal, Math.min(35, selectedProduct.maxFinalPayment))
            : 0
        );
    }, [offerInitialPaymentPct, selectedProduct]);

    if (isLoading) {
        return (
            <Card className="border-slate-200 shadow-none min-h-[500px] flex items-center justify-center bg-card/40">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <Calculator className="w-8 h-8 text-muted-foreground/30" />
                    <div className="h-4 w-40 bg-muted rounded"></div>
                    <div className="h-3 w-24 bg-muted/50 rounded mt-2"></div>
                </div>
            </Card>
        );
    }

    if (products.length === 0) {
        return null;
    }

    if (!selectedProduct && candidateProduct !== null) {
        // Show skeleton during the render cycle where selectedProduct is catching up to candidateProduct
        return (
            <Card className="border-slate-200 shadow-none min-h-[500px] flex items-center justify-center bg-card/40">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <Calculator className="w-8 h-8 text-muted-foreground/30" />
                    <div className="h-4 w-40 bg-muted rounded"></div>
                    <div className="h-3 w-24 bg-muted/50 rounded mt-2"></div>
                </div>
            </Card>
        );
    }

    // Calculation Logic (Simplified Leasing/Credit approximation)
    // Monthly Installment = (Capital + TotalInterest) / Months
    // Capital = Price - Initial
    // Interest is tricky without exact formula. Using standard simple interest approximation for estimation:
    // PMT = (LoanAmount * Rate/12) / (1 - (1 + Rate/12)^-Months)
    // Where LoanAmount = Price - Initial - PV(Final) ?
    // Let's use a simpler standard car leasing formula often used in calculators:
    // FinancedAmount = Price - InitialPayment
    // ResidualValue = FinalPayment
    // MonthlyInterestRate = (ReferenceRate + Margin) / 100 / 12
    // If Leasing:
    // DepreciationPart = (FinancedAmount - ResidualValue) / Months
    // InterestPart = (FinancedAmount + ResidualValue) / 2 * MonthlyInterestRate * 1.23 (VAT?) - Usually rates are net in leasing, but let's assume rates are nominal annual.
    // Let's stick to a standard PMT formula for Credit and a simplified one for Leasing.
    // Actually, to be safe and generic:
    // LoanAmount = Price * (1 - InitialPct/100)
    // Balloon = Price * FinalPct/100
    // MonthlyRate = (Ref + Margin) / 100 / 12
    // PMT = (LoanAmount - Balloon / (1+MonthlyRate)^Months) * (MonthlyRate / (1 - (1+MonthlyRate)^-Months))

    // Rate per month
    const annualRate = selectedProduct ? selectedProduct.referenceRate + selectedProduct.margin : 0;
    const monthlyRate = annualRate / 100 / 12;

    // Formula including balloon payment
    // PMT = (P * r - B * r / (1+r)^n) / (1 - (1+r)^-n)

    let monthlyInstallment = 0;
    if (monthlyRate === 0) {
        monthlyInstallment = (amountToFinance - finalPaymentAmount) / months;
    } else {
        const pow = Math.pow(1 + monthlyRate, months);
        monthlyInstallment = (amountToFinance * monthlyRate - finalPaymentAmount * monthlyRate / pow) / (1 - 1 / pow);
    }

    const commissionAmount = selectedProduct ? amountToFinance * selectedProduct.commission / 100 : 0;
    const displayInstallment = selectedProduct?.provider === 'OWN' ? monthlyInstallment : externalInstallment;


    return (
        <Card className="border-slate-200 shadow-none">
            <CardHeader className="pb-3 pt-4">
                {isDuplicateHeading ? (
                    <div className="flex items-center gap-2 text-lg font-heading font-semibold leading-none tracking-tight text-foreground">
                        <Calculator className="w-5 h-5 text-primary" />
                        Kalkulator finansowania
                    </div>
                ) : (
                    <h2 className="flex items-center gap-2 text-lg font-heading font-semibold leading-none tracking-tight text-foreground">
                        <Calculator className="w-5 h-5 text-primary" />
                        Kalkulator finansowania
                    </h2>
                )}
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
                <Tabs value={activeCategory} onValueChange={(v) => {
                    const cat = v as FinancingProduct['category'];
                    setActiveCategory(cat);
                    // Map category to financing type and persist preference
                    const typeMap: Record<string, FinancingType> = {
                        'LEASING': 'leasing',
                        'CREDIT': 'kredyt',
                        'RENTAL': 'wynajem',
                    };
                    const newType = typeMap[cat] || 'kredyt';
                    setPreferredFinancingType(newType);
                    if (onFinancingTypeChange) {
                        onFinancingTypeChange(newType);
                    }
                }} className="w-full">
                    <TabsList className={cn(
                        "w-full justify-start grid h-9",
                        categories.length === 1 ? "grid-cols-1" :
                        categories.length === 2 ? "grid-cols-2" : "grid-cols-3"
                    )}>
                        {categories.map(cat => (
                            <div className="flex-1" key={cat}>
                                <TabsTrigger 
                                    value={cat} 
                                    className="text-xs py-1 w-full"
                                >
                                    {cat === 'CREDIT' ? 'Kredyt' : cat === 'LEASING' ? 'Leasing' : 'Najem'}
                                </TabsTrigger>
                            </div>
                        ))}
                    </TabsList>
                </Tabs>

                {!selectedProduct ? (
                    <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-4 bg-slate-50/50 rounded-lg border border-slate-100 my-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <Info className="w-6 h-6 text-primary" />
                        </div>
                        <p className="text-sm text-foreground">
                            {activeCategory === 'LEASING' 
                                ? "Przepraszamy, nie jesteśmy w stanie w tym momencie zaprezentować oferty leasingu na ten pojazd. Skontaktuj się z nami bezpośrednio, abyśmy mogli przygotować ci dedykowane rozwiązanie."
                                : "Przepraszamy, nie jesteśmy w stanie w tym momencie zaprezentować oferty finansowania na ten pojazd. Skontaktuj się z nami bezpośrednio, abyśmy mogli przygotować ci dedykowane rozwiązanie."}
                        </p>
                        {listingId && (
                            <Button
                                variant="hero"
                                className="mt-2"
                                onClick={() => navigate(`/listing/${listingId}/lead`)}
                            >
                                <MessageSquare className="w-4 h-4 mr-2" />
                                Zapytaj o ofertę
                            </Button>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="space-y-4 pt-1">
                            {/* Installments Slider */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-baseline">
                                    <Label className="text-sm">Okres finansowania</Label>
                                    <span className="font-semibold text-sm">{months} mies.</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-muted-foreground w-6">{selectedProduct.provider === 'VEHIS' ? Math.max(selectedProduct.minInstallments, 36) : selectedProduct.minInstallments}</span>
                                    <Slider
                                        value={[months]}
                                        min={selectedProduct.provider === 'VEHIS' ? Math.max(selectedProduct.minInstallments, 36) : selectedProduct.minInstallments}
                                        max={selectedProduct.provider === 'VEHIS' ? Math.min(selectedProduct.maxInstallments, 60) : selectedProduct.maxInstallments}
                                        step={selectedProduct.provider === 'VEHIS' ? 12 : 12}
                                        onValueChange={v => setMonths(v[0])}
                                        className="flex-1"
                                    />
                                    <span className="text-xs text-muted-foreground w-6 text-right">{selectedProduct.provider === 'VEHIS' ? Math.min(selectedProduct.maxInstallments, 60) : selectedProduct.maxInstallments}</span>
                                </div>
                            </div>

                            {/* Initial Payment Slider */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-baseline">
                                    <Label className="text-sm">Wpłata własna</Label>
                                    <div className="text-right flex items-baseline gap-2">
                                        <span className="font-semibold text-sm">{initialPaymentPct}%</span>
                                        <span className="text-xs text-muted-foreground">{formatPrice(initialPaymentAmount, currency)}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-muted-foreground w-6">
                                        {selectedProduct.provider === 'VEHIS' && selectedProduct.maxInitialPayment >= 1 ? 1 : 0}%
                                    </span>
                                    <Slider
                                        value={[initialPaymentPct]}
                                        min={selectedProduct.provider === 'VEHIS' && selectedProduct.maxInitialPayment >= 1 ? 1 : 0}
                                        max={selectedProduct.maxInitialPayment}
                                        step={1}
                                        onValueChange={v => setInitialPaymentPct(v[0])}
                                        className="flex-1"
                                    />
                                    <span className="text-xs text-muted-foreground w-6 text-right">{selectedProduct.maxInitialPayment}%</span>
                                </div>
                            </div>

                            {/* Final Payment Slider (Balloon) */}
                            {selectedProduct.hasBalloonPayment && (
                                <div className="space-y-2">
                                    <div className="flex justify-between items-baseline">
                                        <Label className="text-sm">Wykup (Rata balonowa)</Label>
                                        <div className="text-right flex items-baseline gap-2">
                                            <span className="font-semibold text-sm">{finalPaymentPct}%</span>
                                            <span className="text-xs text-muted-foreground">{formatPrice(finalPaymentAmount, currency)}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-muted-foreground w-6">
                                            {selectedProduct.provider === 'VEHIS' && selectedProduct.maxFinalPayment >= 1 ? 1 : 0}%
                                        </span>
                                        <Slider
                                            value={[finalPaymentPct]}
                                            min={selectedProduct.provider === 'VEHIS' && selectedProduct.maxFinalPayment >= 1 ? 1 : 0}
                                            max={selectedProduct.maxFinalPayment}
                                            step={1}
                                            onValueChange={v => setFinalPaymentPct(v[0])}
                                            className="flex-1"
                                        />
                                        <span className="text-xs text-muted-foreground w-6 text-right">{selectedProduct.maxFinalPayment}%</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-slate-50 rounded-lg p-4 mt-2 border border-slate-100">
                            <div className="flex flex-col items-center justify-center text-center space-y-1">
                                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Miesięczna rata</span>
                                <div className="relative flex items-center justify-center gap-2 min-h-[40px]">
                                    <span className={cn("text-3xl font-bold text-primary transition-all duration-200", externalLoading && "opacity-40 scale-[0.98]")}>
                                        {formatPrice(displayInstallment ?? monthlyInstallment, currency)}
                                    </span>
                                    {externalLoading && (
                                        <Loader2 className="w-5 h-5 text-primary animate-spin" />
                                    )}
                                </div>
                                {selectedProduct.provider !== 'OWN' && displayInstallment == null && !externalLoading && (
                                    <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-1">
                                        <Info className="w-2.5 h-2.5" />
                                        Kalkulacja szacunkowa
                                    </div>
                                )}
                                {selectedProduct.provider === 'VEHIS' && displayInstallment != null ? (
                                    <div className="flex flex-col items-center gap-0.5">
                                        <span className="text-xs text-muted-foreground">
                                            {priceIsNet ? 'netto (bez VAT)' : 'brutto'}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {priceIsNet
                                                ? `(${formatPrice(Math.round((displayInstallment ?? 0) * vatMultiplier), currency)} brutto)`
                                                : `(${formatPrice(Math.round((displayInstallment ?? 0) / vatMultiplier), currency)} netto)`}
                                        </span>
                                    </div>
                                ) : selectedProduct.category === 'LEASING' ? (
                                    <span className="text-xs text-muted-foreground">netto (bez VAT)</span>
                                ) : null}
                            </div>

                            {selectedProduct.provider === 'INBANK' ? (
                                <div className="mt-4 pt-3 border-t border-slate-200 space-y-2">
                                    {inbankDetails?.creditCostRateAnnual != null && (
                                        <div className="flex justify-between items-center text-xs font-semibold text-slate-800">
                                            <span>RRSO dla tej raty:</span>
                                            <div className="flex items-center gap-1.5 font-bold">
                                                <span>{formatRate(inbankDetails.creditCostRateAnnual)}%</span>
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <button 
                                                            type="button" 
                                                            className="text-emerald-700 hover:text-emerald-800 transition-colors p-0.5 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                            title="Wyświetl przykład reprezentatywny"
                                                        >
                                                            <Info className="w-4 h-4 shrink-0" />
                                                        </button>
                                                    </DialogTrigger>
                                                    <DialogContent className="max-w-md p-6 bg-white rounded-lg shadow-lg border border-slate-200">
                                                        <DialogHeader>
                                                            <DialogTitle className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                                                                <Info className="w-5 h-5 text-emerald-700" />
                                                                Przykład reprezentatywny
                                                            </DialogTitle>
                                                        </DialogHeader>
                                                        <div className="mt-4 text-xs leading-relaxed text-slate-600 space-y-3">
                                                            <p className="font-normal text-justify">
                                                                {getInbankRepresentativeExample()}
                                                            </p>
                                                        </div>
                                                    </DialogContent>
                                                </Dialog>
                                            </div>
                                        </div>
                                    )}
                                    <div className="text-xs text-muted-foreground text-center pt-1.5 border-t border-slate-100">
                                        Rata wyliczana na podstawie kalkulacji partnera. Kalkulacja ma charakter poglądowy, nie stanowi oferty i może zależeć od oceny zdolności kredytowej klienta.
                                    </div>
                                </div>
                            ) : selectedProduct.provider !== 'OWN' ? (
                                <div className="mt-4 pt-3 border-t border-slate-200 text-xs text-muted-foreground text-center">
                                    Rata wyliczana na podstawie kalkulacji partnera. Kalkulacja ma charakter poglądowy, nie stanowi oferty i może zależeć od oceny zdolności kredytowej klienta.
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-4 mt-4 pt-3 border-t border-slate-200">
                                    <div>
                                        <span className="block text-xs text-muted-foreground">Prowizja</span>
                                        <span className="font-medium text-sm">{formatPrice(commissionAmount, currency)}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="block text-xs text-muted-foreground">RRSO / Oproc.</span>
                                        <span className="font-medium text-sm">{(annualRate).toFixed(2)}%</span>
                                    </div>
                                </div>
                            )}

                            {offerInitialPayment && (
                                <div className="mt-4 pt-3 border-t border-slate-200 text-xs text-muted-foreground text-center">
                                    W kalkulacji założono pierwszą wpłatę na poziomie {formatPrice(offerInitialPayment, currency)}. Możesz dokonać wyższej wpłaty zmieniając kwotę suwakiem kalkulatora.
                                </div>
                            )}
                        </div>

                        {/* Optional price slot (used by Motolia to show minimized price here) */}
                        {priceSlot}

                        {listingId && (
                            <Button
                                variant="hero"
                                size="lg"
                                className="w-full shadow-lg shadow-primary/20"
                                onClick={() => navigate(`/listing/${listingId}/lead`, {
                                    state: {
                                        financing: {
                                            productId: selectedProduct.id,
                                            amount: amountToFinance,
                                            period: months,
                                            downPayment: initialPaymentAmount,
                                            finalPayment: finalPaymentAmount,
                                            installment: displayInstallment ?? monthlyInstallment
                                        }
                                    }
                                })}
                            >
                                {motoliaMode ? (
                                    <>
                                        <MessageSquare className="h-5 w-5" />
                                        Zapytaj o ofertę
                                    </>
                                ) : (
                                    'Kontynuuj z tym finansowaniem'
                                )}
                            </Button>
                        )}
                    </>
                )}
            </CardContent>
        </Card >
    );
}
