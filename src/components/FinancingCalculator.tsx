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
import { Calculator, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useCrmTracking } from '@/contexts/CrmTrackingContext';

interface FinancingCalculatorProps {
    listingId?: string;
    price: number;
    currency?: string;
    manufacturingYear?: number;
    mileageKm?: number;
    offerInitialPayment?: number;
}

export function FinancingCalculator({
    listingId,
    price,
    currency = 'PLN',
    manufacturingYear,
    mileageKm,
    offerInitialPayment
}: FinancingCalculatorProps) {
    const navigate = useNavigate();
    const { offerDiscount } = useCrmTracking();
    const { data, isLoading } = useQuery({
        queryKey: ['financing-calculator'],
        queryFn: () => financingApi.listPublic(),
        staleTime: 5 * 60 * 1000,
    });

    const products = React.useMemo(
        () => (data?.products ?? []) as FinancingProduct[],
        [data?.products]
    );
    const categories = React.useMemo(
        () => Array.from(new Set(products.map(p => p.category))).sort(),
        [products]
    );

    const [activeCategory, setActiveCategory] = React.useState<FinancingProduct['category']>(
        (categories[0] as FinancingProduct['category']) || 'LEASING'
    );
    const [selectedProduct, setSelectedProduct] = React.useState<FinancingProduct | null>(null);
    const [failedProducts, setFailedProducts] = React.useState<Set<string>>(new Set());
    const [externalInstallment, setExternalInstallment] = React.useState<number | null>(null);
    const [externalLoading, setExternalLoading] = React.useState(false);

    // State for calculation parameters
    const [months, setMonths] = React.useState(36);
    const [initialPaymentPct, setInitialPaymentPct] = React.useState(10);
    const [finalPaymentPct, setFinalPaymentPct] = React.useState(20);
    const offerInitialPaymentPct = React.useMemo(() => {
        if (!offerDiscount || !Number.isFinite(price) || price <= 0) return null;
        return Math.round((offerDiscount / price) * 100);
    }, [offerDiscount, price]);

    // Update selected product when category changes
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
            if (failedProducts.has(p.id)) return false;

            // Priority is given to amount range
            if (p.minAmount != null && amountToFinance < p.minAmount) return false;
            if (p.maxAmount != null && amountToFinance > p.maxAmount) return false;

            return true;
        });

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
    }, [activeCategory, amountToFinance, failedProducts, products]);

    React.useEffect(() => {
        setSelectedProduct(prev => (prev?.id === candidateProduct?.id ? prev : candidateProduct));
    }, [candidateProduct]);

    React.useEffect(() => {
        let isCancelled = false;
        const calculateExternal = async () => {
            if (!selectedProduct || selectedProduct.provider === 'OWN') {
                setExternalInstallment(null);
                setExternalLoading(false);
                return;
            }

            setExternalLoading(true);
            try {
                const response = await financingApi.calculate({
                    productId: selectedProduct.id,
                    price,
                    downPaymentAmount: initialPaymentAmount,
                    period: months,
                    initialFeePercent: initialPaymentPct,
                    finalPaymentPercent: finalPaymentPct,
                    manufacturingYear,
                    mileageKm
                });
                if (!isCancelled) {
                    setExternalInstallment(response.monthlyInstallment);
                    // We could also store more info here if needed for UI, 
                    // but for compatibility with existing code we just use monthlyInstallment.
                }
            } catch (error) {
                if (!isCancelled) {
                    console.error('External calculation failed:', error);
                    // Add to failed set to trigger fallback to next candidate
                    setFailedProducts(prev => new Set([...prev, selectedProduct.id]));
                    setExternalInstallment(null);
                }
            } finally {
                if (!isCancelled) {
                    setExternalLoading(false);
                }
            }
        };

        calculateExternal();

        return () => {
            isCancelled = true;
        };
    }, [selectedProduct, price, initialPaymentAmount, initialPaymentPct, finalPaymentPct, months, manufacturingYear, mileageKm]);

    React.useEffect(() => {
        if (!selectedProduct) return;
        // User requested 0% min initial payment (previously was 1% for Vehis)
        const vehisMinInitial = 0;
        const vehisMinFinal = selectedProduct.provider === 'VEHIS' && selectedProduct.maxFinalPayment >= 1 ? 1 : 0;
        setMonths(Math.max(selectedProduct.minInstallments, Math.min(selectedProduct.maxInstallments, 36)));

        // If there is a special offer initial payment (discount used as initial),
        // we set the calculator's 'Wpłata własna' slider to 0 by default.
        let initialFromOffer: number;
        if (offerInitialPayment && offerInitialPayment > 0) {
            initialFromOffer = 0;
        } else {
            // Fallback to CRM tracking offer or default 10%
            initialFromOffer = offerInitialPaymentPct != null
                ? Math.max(vehisMinInitial, Math.min(offerInitialPaymentPct, selectedProduct.maxInitialPayment))
                : Math.max(vehisMinInitial, Math.min(10, selectedProduct.maxInitialPayment));
        }

        setInitialPaymentPct(initialFromOffer);
        setFinalPaymentPct(selectedProduct.hasBalloonPayment
            ? Math.max(vehisMinFinal, Math.min(20, selectedProduct.maxFinalPayment))
            : 0
        );
    }, [offerInitialPaymentPct, selectedProduct, offerInitialPayment]);

    if (isLoading || products.length === 0) {
        return null;
    }

    if (!selectedProduct) return null;

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
    const annualRate = selectedProduct.referenceRate + selectedProduct.margin;
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

    // Add commission? Usually commission is upfront or added to financing.
    // Spec says: "prowizja za uruchomienie kredytu w procetach". Usually upfront.
    const commissionAmount = amountToFinance * selectedProduct.commission / 100;
    const displayInstallment = selectedProduct.provider === 'OWN' ? monthlyInstallment : externalInstallment;

    return (
        <Card className="border-slate-200 shadow-none">
            <CardHeader className="pb-3 pt-4">
                <CardTitle className="flex items-center gap-2 text-lg font-heading">
                    <Calculator className="w-5 h-5 text-primary" />
                    Kalkulator finansowania
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
                <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as FinancingProduct['category'])} className="w-full">
                    <TabsList className="w-full justify-start grid grid-cols-3 h-9">
                        {categories.map(cat => (
                            <TabsTrigger key={cat} value={cat} className="text-xs py-1">
                                {cat === 'CREDIT' ? 'Kredyt' : cat === 'LEASING' ? 'Leasing' : 'Najem'}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>

                <div className="space-y-4 pt-1">
                    {/* Installments Slider */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-baseline">
                            <Label className="text-sm">Okres finansowania</Label>
                            <span className="font-semibold text-sm">{months} mies.</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] text-muted-foreground w-4">{selectedProduct.minInstallments}</span>
                            <Slider
                                value={[months]}
                                min={selectedProduct.minInstallments}
                                max={selectedProduct.maxInstallments}
                                step={12}
                                onValueChange={v => setMonths(v[0])}
                                className="flex-1"
                            />
                            <span className="text-[10px] text-muted-foreground w-4">{selectedProduct.maxInstallments}</span>
                        </div>
                    </div>

                    {/* Initial Payment Slider */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-baseline">
                            <Label className="text-sm">Wpłata własna</Label>
                            <div className="text-right flex items-baseline gap-2">
                                <span className="font-semibold text-sm">{initialPaymentPct}%</span>
                                <span className="text-[10px] text-muted-foreground">{formatPrice(initialPaymentAmount, currency)}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] text-muted-foreground w-4">
                                0%
                            </span>
                            <Slider
                                value={[initialPaymentPct]}
                                min={0}
                                max={selectedProduct.maxInitialPayment}
                                step={1}
                                onValueChange={v => setInitialPaymentPct(v[0])}
                                className="flex-1"
                            />
                            <span className="text-[10px] text-muted-foreground w-4">{selectedProduct.maxInitialPayment}%</span>
                        </div>
                    </div>

                    {/* Final Payment Slider (Balloon) */}
                    {selectedProduct.hasBalloonPayment && (
                        <div className="space-y-2">
                            <div className="flex justify-between items-baseline">
                                <Label className="text-sm">Wykup (Rata balonowa)</Label>
                                <div className="text-right flex items-baseline gap-2">
                                    <span className="font-semibold text-sm">{finalPaymentPct}%</span>
                                    <span className="text-[10px] text-muted-foreground">{formatPrice(finalPaymentAmount, currency)}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] text-muted-foreground w-4">
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
                                <span className="text-[10px] text-muted-foreground w-4">{selectedProduct.maxFinalPayment}%</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-slate-50 rounded-lg p-4 mt-2 border border-slate-100">
                    <div className="flex flex-col items-center justify-center text-center space-y-1">
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Miesięczna rata</span>
                        <span className="text-3xl font-bold text-primary">
                            {selectedProduct.provider === 'INBANK' && externalLoading && displayInstallment == null
                                ? '...'
                                : formatPrice(displayInstallment ?? monthlyInstallment, currency)}
                        </span>
                        {selectedProduct.provider !== 'OWN' && displayInstallment == null && !externalLoading && (
                            <div className="flex items-center gap-1 text-[9px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-1">
                                <Info className="w-2.5 h-2.5" />
                                Kalkulacja szacunkowa
                            </div>
                        )}
                        {selectedProduct.category === 'LEASING' && (
                            <span className="text-[10px] text-muted-foreground">netto (bez VAT)</span>
                        )}
                    </div>

                    {selectedProduct.provider !== 'OWN' ? (
                        <div className="mt-4 pt-3 border-t border-slate-200 text-[11px] text-muted-foreground text-center">
                            Rata wyliczana na podstawie kalkulacji partnera.
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4 mt-4 pt-3 border-t border-slate-200">
                            <div>
                                <span className="block text-[10px] text-muted-foreground">Prowizja</span>
                                <span className="font-medium text-xs">{formatPrice(commissionAmount, currency)}</span>
                            </div>
                            <div className="text-right">
                                <span className="block text-[10px] text-muted-foreground">RRSO / Oproc.</span>
                                <span className="font-medium text-xs">{(annualRate).toFixed(2)}%</span>
                            </div>
                        </div>
                    )}

                    {offerInitialPayment && (
                        <div className="mt-4 pt-3 border-t border-slate-200 text-[11px] text-muted-foreground text-center">
                            W kalkulacji założono pierwszą wpłatę na poziomie {formatPrice(offerInitialPayment, currency)}. Możesz dokonać wyższej wpłaty zmieniając kwotę suwakiem kalkulatora.
                        </div>
                    )}
                </div>

                <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground bg-blue-50/50 p-2.5 rounded text-blue-800">
                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <p>
                        Kalkulacja ma charakter poglądowy i nie stanowi oferty.
                    </p>
                </div>

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
                                    installment: displayInstallment ?? monthlyInstallment
                                }
                            }
                        })}
                    >
                        Kontynuuj z tym finansowaniem
                    </Button>
                )}
            </CardContent>
        </Card >
    );
}
