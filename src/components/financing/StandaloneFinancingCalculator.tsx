import React from 'react';
import { Calculator, Info, MessageSquare, Loader2, ShieldCheck, CheckSquare, Square } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { formatPrice } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import { useFinancingCalc, DEFAULT_FINANCING_PRICE } from './useFinancingCalc';
import { CallbackForm } from '@/components/CallbackForm';
import { FinancingProduct } from '@/types/financing';
import { useAppSettings } from '@/hooks/useAppSettings';

export interface StandaloneFinancingCalculatorProps {
    initialPrice?: number;
    initialCategory?: FinancingProduct['category'];
    /** Unique form identifier for analytics (snake_case), e.g. 'kalkulator_rat_callback' */
    formId?: string;
    className?: string;
    isDuplicateHeading?: boolean;
    motoliaMode?: boolean;
}

export function StandaloneFinancingCalculator({
    initialPrice = DEFAULT_FINANCING_PRICE,
    initialCategory = 'LEASING',
    formId = 'kalkulator_rat_callback',
    className = '',
    isDuplicateHeading = false,
}: StandaloneFinancingCalculatorProps) {
    const calc = useFinancingCalc({
        initialPrice,
        initialCategory,
    });

    const { data: appSettings } = useAppSettings();
    const repExampleText = appSettings?.creditRepresentativeExample?.trim() || '';

    const [isLeadDialogOpen, setIsLeadDialogOpen] = React.useState(false);

    const formatRate = React.useCallback((val: number | null | undefined) => {
        if (val == null || !Number.isFinite(val)) return '0,00';
        const percentageValue = (val > 0 && val < 1.0) ? val * 100 : val;
        return percentageValue.toFixed(2).replace('.', ',');
    }, []);

    const leadSummaryMessage = `Kalkulator rat: ${calc.activeCategory === 'LEASING' ? 'Leasing' : calc.activeCategory === 'CREDIT' ? 'Kredyt' : 'Najem'}, Auto: ${calc.condition === 'NEW' ? 'Nowe' : `Używane (${calc.manufacturingYear})`}, Cena auta: ${formatPrice(calc.price, 'PLN')}, Wpłata własna: ${calc.initialPaymentPct}% (${formatPrice(calc.initialPaymentAmount, 'PLN')}), Okres: ${calc.months} mies., Szacowana rata: ${formatPrice(calc.displayInstallment ?? calc.monthlyInstallment, 'PLN')}/mies.${calc.includeInsurance ? ' [Zgłoszono chęć wyceny ubezpieczenia OC/AC/GAP]' : ''}`;

    const hasInbankRrso = calc.selectedProduct?.provider === 'INBANK' && calc.inbankDetails?.creditCostRateAnnual != null;

    return (
        <Card className={cn("border-slate-200 shadow-md bg-white overflow-hidden", className)}>
            <CardHeader className="pb-3 pt-5 border-b border-slate-100 bg-slate-50/50">
                {isDuplicateHeading ? (
                    <div className="flex items-center gap-2 text-lg font-heading font-semibold text-foreground">
                        <Calculator className="w-5 h-5 text-primary" />
                        Kalkulator finansowania samochodu
                    </div>
                ) : (
                    <CardTitle className="flex items-center gap-2 text-lg font-heading font-semibold text-foreground">
                        <Calculator className="w-5 h-5 text-primary" />
                        Kalkulator finansowania samochodu
                    </CardTitle>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                    Masz auto u dealera lub z ogłoszenia? Policz ratę leasingu, kredytu lub najmu i zapytaj o ofertę.
                </p>
            </CardHeader>

            <CardContent className="space-y-5 pt-4">
                {/* Condition and Manufacturing Year selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div>
                        <Label className="text-xs text-muted-foreground mb-1.5 block">Stan pojazdu</Label>
                        <div className="grid grid-cols-2 gap-1.5">
                            <button
                                type="button"
                                onClick={() => calc.setCondition('NEW')}
                                className={cn(
                                    "px-3 py-1.5 text-xs font-medium rounded-md border transition-colors text-center",
                                    calc.condition === 'NEW'
                                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                                )}
                            >
                                Nowy
                            </button>
                            <button
                                type="button"
                                onClick={() => calc.setCondition('USED')}
                                className={cn(
                                    "px-3 py-1.5 text-xs font-medium rounded-md border transition-colors text-center",
                                    calc.condition === 'USED'
                                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                                )}
                            >
                                Używany
                            </button>
                        </div>
                    </div>

                    {calc.condition === 'USED' && (
                        <div>
                            <Label className="text-xs text-muted-foreground mb-1.5 block">Rocznik produkcji</Label>
                            <select
                                value={calc.manufacturingYear}
                                onChange={(e) => calc.setManufacturingYear(Number(e.target.value))}
                                className="w-full h-8 px-2.5 rounded-md border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                                {[2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016].map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* Price input & slider */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <Label className="text-sm font-medium text-slate-800">Wartość samochodu (brutto)</Label>
                        <div className="flex items-center gap-1">
                            <input
                                type="number"
                                min={5000}
                                max={500000}
                                step={1000}
                                value={calc.price}
                                onChange={(e) => {
                                    const val = Number(e.target.value);
                                    if (!isNaN(val)) calc.setPrice(Math.max(5000, Math.min(500000, val)));
                                }}
                                className="w-32 h-8 text-right font-bold text-sm text-primary px-2 rounded border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            <span className="text-xs font-semibold text-slate-500">zł</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-12">5 000 zł</span>
                        <Slider
                            value={[calc.price]}
                            min={5000}
                            max={500000}
                            step={1000}
                            onValueChange={v => calc.setPrice(v[0])}
                            className="flex-1"
                        />
                        <span className="text-xs text-muted-foreground w-14 text-right">500 000 zł</span>
                    </div>
                </div>

                {/* Category tabs */}
                <Tabs value={calc.activeCategory} onValueChange={(v) => calc.setActiveCategory(v as FinancingProduct['category'])} className="w-full">
                    <TabsList className="w-full grid grid-cols-3 h-9 bg-slate-100">
                        <TabsTrigger value="LEASING" className="text-xs py-1">Leasing</TabsTrigger>
                        <TabsTrigger value="CREDIT" className="text-xs py-1">Kredyt</TabsTrigger>
                        <TabsTrigger value="RENTAL" className="text-xs py-1">Najem</TabsTrigger>
                    </TabsList>
                </Tabs>

                {/* Calculation parameters */}
                <div className="space-y-4 pt-1">
                    {/* Period slider */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-baseline">
                            <Label className="text-sm text-slate-700">Okres finansowania</Label>
                            <span className="font-semibold text-sm text-slate-900">{calc.months} mies.</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground w-6">12</span>
                            <Slider
                                value={[calc.months]}
                                min={12}
                                max={calc.selectedProduct?.maxInstallments || 84}
                                step={12}
                                onValueChange={v => calc.setMonths(v[0])}
                                className="flex-1"
                            />
                            <span className="text-xs text-muted-foreground w-6 text-right">{calc.selectedProduct?.maxInstallments || 84}</span>
                        </div>
                    </div>

                    {/* Initial Payment Slider */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-baseline">
                            <Label className="text-sm text-slate-700">Wpłata własna</Label>
                            <div className="text-right flex items-baseline gap-2">
                                <span className="font-semibold text-sm text-slate-900">{calc.initialPaymentPct}%</span>
                                <span className="text-xs text-muted-foreground">{formatPrice(calc.initialPaymentAmount, 'PLN')}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground w-6">0%</span>
                            <Slider
                                value={[calc.initialPaymentPct]}
                                min={0}
                                max={calc.selectedProduct?.maxInitialPayment || 45}
                                step={1}
                                onValueChange={v => calc.setInitialPaymentPct(v[0])}
                                className="flex-1"
                            />
                            <span className="text-xs text-muted-foreground w-6 text-right">{calc.selectedProduct?.maxInitialPayment || 45}%</span>
                        </div>
                    </div>

                    {/* Balloon Final Payment Slider (if available) */}
                    {calc.selectedProduct?.hasBalloonPayment && (
                        <div className="space-y-2">
                            <div className="flex justify-between items-baseline">
                                <Label className="text-sm text-slate-700">Wykup (Rata balonowa)</Label>
                                <div className="text-right flex items-baseline gap-2">
                                    <span className="font-semibold text-sm text-slate-900">{calc.finalPaymentPct}%</span>
                                    <span className="text-xs text-muted-foreground">{formatPrice(calc.finalPaymentAmount, 'PLN')}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground w-6">0%</span>
                                <Slider
                                    value={[calc.finalPaymentPct]}
                                    min={0}
                                    max={calc.selectedProduct?.maxFinalPayment || 35}
                                    step={1}
                                    onValueChange={v => calc.setFinalPaymentPct(v[0])}
                                    className="flex-1"
                                />
                                <span className="text-xs text-muted-foreground w-6 text-right">{calc.selectedProduct?.maxFinalPayment || 35}%</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Insurance checkbox option (v1 intent capture) */}
                <div 
                    onClick={() => calc.setIncludeInsurance(!calc.includeInsurance)}
                    className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                    {calc.includeInsurance ? (
                        <CheckSquare className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    ) : (
                        <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    )}
                    <div className="text-xs">
                        <span className="font-semibold text-slate-800 block">Dołącz bezpłatną wycenę pakietu OC/AC/GAP</span>
                        <span className="text-muted-foreground text-xs">Nasi eksperci dobiorą optymalną stawkę ubezpieczenia dla tego pojazdu.</span>
                    </div>
                </div>

                {/* Rate Display Box */}
                <div className="bg-slate-900 text-white rounded-xl p-5 border border-slate-800 shadow-inner">
                    <div className="flex flex-col items-center justify-center text-center space-y-1">
                        <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Szacowana miesięczna rata</span>
                        <div className="relative flex items-center justify-center gap-2 min-h-[44px]">
                            <span className={cn("text-3xl sm:text-4xl font-extrabold text-primary-foreground tracking-tight transition-all duration-200", calc.externalLoading && "opacity-40 scale-[0.98]")}>
                                {formatPrice(calc.displayInstallment ?? calc.monthlyInstallment, 'PLN')}
                            </span>
                            {calc.externalLoading && (
                                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                            )}
                        </div>
                        <span className="text-xs text-slate-300">
                            {calc.activeCategory === 'LEASING' ? 'netto (bez VAT)' : 'brutto'}
                        </span>
                    </div>

                    {/* RRSO is ONLY shown when returned by partner API (Inbank) */}
                    {calc.activeCategory === 'CREDIT' && hasInbankRrso && (
                        <div className="mt-4 pt-3 border-t border-slate-800 space-y-2">
                            <div className="flex justify-between items-center text-xs text-slate-300">
                                <span>RRSO dla tej raty:</span>
                                <div className="flex items-center gap-1.5 font-bold text-white">
                                    <span>{formatRate(calc.inbankDetails.creditCostRateAnnual)}%</span>
                                    {repExampleText && (
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <button 
                                                    type="button" 
                                                    className="text-emerald-400 hover:text-emerald-300 transition-colors p-0.5 rounded focus:outline-none focus:ring-1 focus:ring-emerald-400"
                                                    title="Wyświetl przykład reprezentatywny"
                                                >
                                                    <Info className="w-4 h-4 shrink-0" />
                                                </button>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-md p-6 bg-white text-slate-900 rounded-lg shadow-xl border border-slate-200">
                                                <DialogHeader>
                                                    <DialogTitle className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                                                        <Info className="w-5 h-5 text-emerald-700" />
                                                        Przykład reprezentatywny
                                                    </DialogTitle>
                                                </DialogHeader>
                                                <div className="mt-4 text-xs leading-relaxed text-slate-600 space-y-3 whitespace-pre-wrap">
                                                    {repExampleText}
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Generic disclaimer */}
                    <div className="mt-3 pt-2 border-t border-slate-800 text-xs text-slate-400 text-center">
                        Wyliczenie ma charakter orientacyjny i nie stanowi oferty w rozumieniu Art. 66 § 1 KC. Ostateczna rata zależy od oceny zdolności kredytowej klienta.
                    </div>
                </div>

                {/* CTA Button opening CallbackForm Modal */}
                <Dialog open={isLeadDialogOpen} onOpenChange={setIsLeadDialogOpen}>
                    <DialogTrigger asChild>
                        <Button
                            variant="hero"
                            size="lg"
                            className="w-full shadow-lg shadow-primary/20 text-base font-semibold py-6"
                        >
                            <MessageSquare className="h-5 w-5 mr-2" />
                            Zapytaj o finansowanie tego auta
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md p-6 bg-white rounded-xl border border-slate-200">
                        <DialogHeader className="pb-2 border-b border-slate-100">
                            <DialogTitle className="text-lg font-heading font-bold text-slate-900 flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5 text-primary" />
                                Bezpłatna wycena finansowania
                            </DialogTitle>
                        </DialogHeader>
                        <div className="mt-2 space-y-3">
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs space-y-1">
                                <div className="flex justify-between text-slate-600">
                                    <span>Typ:</span>
                                    <span className="font-semibold text-slate-900">{calc.activeCategory === 'LEASING' ? 'Leasing' : calc.activeCategory === 'CREDIT' ? 'Kredyt' : 'Najem'} ({calc.condition === 'NEW' ? 'Nowe' : 'Używane'})</span>
                                </div>
                                <div className="flex justify-between text-slate-600">
                                    <span>Cena auta:</span>
                                    <span className="font-semibold text-slate-900">{formatPrice(calc.price, 'PLN')}</span>
                                </div>
                                <div className="flex justify-between text-slate-600">
                                    <span>Rata miesięczna:</span>
                                    <span className="font-bold text-primary">{formatPrice(calc.displayInstallment ?? calc.monthlyInstallment, 'PLN')}/mies.</span>
                                </div>
                                {calc.includeInsurance && (
                                    <div className="text-emerald-700 font-medium pt-1 border-t border-slate-200">
                                        + Dołączona prośba o wycenę OC/AC/GAP
                                    </div>
                                )}
                            </div>

                            <CallbackForm
                                compact={true}
                                title="Zostaw numer telefonu"
                                titleHighlight="– oddzwonimy"
                                description="Doradca Motolia skontaktuje się w celu weryfikacji oferty i przedstawienia decyzji finansowej."
                                formId={formId}
                                message={leadSummaryMessage}
                                submitLabel="Wyślij zapytanie"
                                financingParams={{
                                    productId: calc.selectedProduct?.id,
                                    amount: calc.amountToFinance,
                                    period: calc.months,
                                    downPayment: calc.initialPaymentAmount,
                                    installment: calc.displayInstallment ?? calc.monthlyInstallment,
                                    finalPayment: calc.finalPaymentAmount,
                                }}
                            />
                        </div>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}
