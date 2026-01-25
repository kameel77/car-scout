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

interface FinancingCalculatorProps {
    listingId?: string;
    price: number;
    currency?: string;
}

export function FinancingCalculator({ listingId, price, currency = 'PLN' }: FinancingCalculatorProps) {
    const navigate = useNavigate();
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
            if (!selectedProduct || selectedProduct.provider !== 'INBANK') {
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
                });
                if (!isCancelled) {
                    setExternalInstallment(response.monthlyInstallment);
                }
            } catch (error) {
                if (!isCancelled) {
                    console.error('Inbank calculation failed:', error);
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
    }, [selectedProduct, price, initialPaymentAmount, months]);

    React.useEffect(() => {
        if (!selectedProduct) return;
        setMonths(Math.max(selectedProduct.minInstallments, Math.min(selectedProduct.maxInstallments, 36)));
        setInitialPaymentPct(Math.min(10, selectedProduct.maxInitialPayment));
        setFinalPaymentPct(selectedProduct.hasBalloonPayment
            ? Math.min(20, selectedProduct.maxFinalPayment)
            : 0
        );
    }, [selectedProduct]);

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
    const displayInstallment = selectedProduct.provider === 'INBANK' ? externalInstallment : monthlyInstallment;

    return (
        <Card className="border-slate-200">
            <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-xl font-heading">
                    <Calculator className="w-5 h-5 text-primary" />
                    Kalkulator finansowania
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as FinancingProduct['category'])} className="w-full">
                    <TabsList className="w-full justify-start grid grid-cols-3">
                        {categories.map(cat => (
                            <TabsTrigger key={cat} value={cat}>
                                {cat === 'CREDIT' ? 'Kredyt' : cat === 'LEASING' ? 'Leasing' : 'Najem'}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>

                <div className="space-y-6 pt-2">
                    {/* Installments Slider */}
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <Label>Okres finansowania (miesiące)</Label>
                            <span className="font-semibold">{months} mies.</span>
                        </div>
                        <Slider
                            value={[months]}
                            min={selectedProduct.minInstallments}
                            max={selectedProduct.maxInstallments}
                            step={12}
                            onValueChange={v => setMonths(v[0])}
                            className="py-2"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{selectedProduct.minInstallments}</span>
                            <span>{selectedProduct.maxInstallments}</span>
                        </div>
                    </div>

                    {/* Initial Payment Slider */}
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <Label>Wpłata własna</Label>
                            <div className="text-right">
                                <span className="font-semibold block">{initialPaymentPct}%</span>
                                <span className="text-xs text-muted-foreground">{formatPrice(initialPaymentAmount, currency)}</span>
                            </div>
                        </div>
                        <Slider
                            value={[initialPaymentPct]}
                            min={0}
                            max={selectedProduct.maxInitialPayment}
                            step={5}
                            onValueChange={v => setInitialPaymentPct(v[0])}
                            className="py-2"
                        />
                    </div>

                    {/* Final Payment Slider (Balloon) */}
                    {selectedProduct.hasBalloonPayment && (
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <Label>Wykup (Rata balonowa)</Label>
                                <div className="text-right">
                                    <span className="font-semibold block">{finalPaymentPct}%</span>
                                    <span className="text-xs text-muted-foreground">{formatPrice(finalPaymentAmount, currency)}</span>
                                </div>
                            </div>
                            <Slider
                                value={[finalPaymentPct]}
                                min={0}
                                max={selectedProduct.maxFinalPayment}
                                step={5}
                                onValueChange={v => setFinalPaymentPct(v[0])}
                                className="py-2"
                            />
                        </div>
                    )}
                </div>

                <div className="bg-slate-50 rounded-lg p-6 mt-6 border border-slate-100">
                    <div className="flex flex-col items-center justify-center text-center space-y-2">
                        <span className="text-sm text-muted-foreground font-medium uppercase tracking-wide">Miesięczna rata</span>
                        <span className="text-4xl font-bold text-primary">
                            {selectedProduct.provider === 'INBANK' && externalLoading && displayInstallment == null
                                ? '...'
                                : formatPrice(displayInstallment ?? monthlyInstallment, currency)}
                        </span>
                        {selectedProduct.provider === 'INBANK' && displayInstallment == null && !externalLoading && (
                            <div className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-1">
                                <Info className="w-3 h-3" />
                                Kalkulacja szacunkowa
                            </div>
                        )}
                        {selectedProduct.category === 'LEASING' && (
                            <span className="text-xs text-muted-foreground">netto (bez VAT)</span>
                        )}
                    </div>

                    {selectedProduct.provider === 'INBANK' ? (
                        <div className="mt-6 pt-4 border-t border-slate-200 text-sm text-muted-foreground text-center">
                            Rata wyliczana na podstawie kalkulacji banku.
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-slate-200">
                            <div>
                                <span className="block text-xs text-muted-foreground">Prowizja (jednorazowo)</span>
                                <span className="font-medium">{formatPrice(commissionAmount, currency)}</span>
                            </div>
                            <div className="text-right">
                                <span className="block text-xs text-muted-foreground">RRSO / Oprocentowanie</span>
                                <span className="font-medium">{(annualRate).toFixed(2)}%</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-blue-50/50 p-3 rounded text-blue-800">
                    <Info className="w-4 h-4 mt-0.5 shrink-0" />
                    <p>
                        Kalkulacja ma charakter poglądowy i nie stanowi oferty w rozumieniu kodeksu cywilnego.
                        Ostateczna oferta zależy od oceny zdolności kredytowej.
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
        </Card>
    );
}
