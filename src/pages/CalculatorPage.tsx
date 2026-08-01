import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { StandaloneFinancingCalculator } from '@/components/financing/StandaloneFinancingCalculator';
import { DEFAULT_FINANCING_PRICE } from '@/components/financing/useFinancingCalc';
import { Calculator, CheckCircle2, FileText, ArrowRight, ShieldCheck, Info, HelpCircle } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function CalculatorPage() {
    const canonicalUrl = typeof window !== 'undefined' ? `${window.location.origin}/kalkulator-rat` : 'https://motolia.pl/kalkulator-rat';

    const schemaJsonLd = {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'WebApplication',
                '@id': `${canonicalUrl}#webapp`,
                'url': canonicalUrl,
                'name': 'Kalkulator leasingu i kredytu samochodowego Motolia',
                'applicationCategory': 'FinanceApplication',
                'operatingSystem': 'All',
                'description': 'Narzędzie online do obliczania raty leasingu, kredytu i najmu samochodów nowych oraz używanych.'
            },
            {
                '@type': 'FinancialProduct',
                '@id': `${canonicalUrl}#product`,
                'name': 'Finansowanie samochodów Motolia',
                'description': 'Usługa wyliczenia i obsługi wniosków o leasing, kredyt i najem samochodowy.',
                'feesAndCommissionsSpecification': 'Brak prowizji za skorzystanie z kalkulatora.'
            }
        ]
    };

    return (
        <>
            <Helmet>
                <title>Kalkulator leasingu, kredytu i najmu samochodów | Motolia</title>
                <meta name="description" content="Oblicz ratę leasingu, kredytu samochodowego i najmu długoterminowego. Podaj cenę auta i okres — policz ratę w 1 minutę i zapytaj o finansowanie." />
                <link rel="canonical" href={canonicalUrl} />
                <meta property="og:title" content="Kalkulator leasingu, kredytu i najmu samochodów | Motolia" />
                <meta property="og:description" content="Oblicz ratę leasingu, kredytu i najmu długoterminowego dla aut nowych i używanych." />
                <meta property="og:url" content={canonicalUrl} />
                <meta property="og:type" content="website" />
                <script type="application/ld+json">
                    {JSON.stringify(schemaJsonLd)}
                </script>
            </Helmet>

            <div className="min-h-screen bg-slate-50/60 pb-16">
                {/* Header / Hero */}
                <section className="bg-slate-900 text-white py-12 md:py-16 border-b border-slate-800">
                    <div className="container mx-auto px-4 max-w-6xl">
                        {/* Breadcrumbs */}
                        <nav aria-label="Breadcrumb" className="mb-6">
                            <ol className="flex items-center gap-2 text-xs text-slate-400">
                                <li><Link to="/" className="hover:text-white transition-colors">Strona główna</Link></li>
                                <li>/</li>
                                <li aria-current="page" className="text-slate-200 font-medium">Kalkulator rat</li>
                            </ol>
                        </nav>

                        <div className="max-w-3xl space-y-4">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-semibold">
                                <Calculator className="w-4 h-4" />
                                Niezależne narzędzie finansowe
                            </div>
                            <h1 className="text-3xl md:text-5xl font-heading font-extrabold tracking-tight text-white">
                                Kalkulator leasingu, kredytu i najmu samochodów
                            </h1>
                            <p className="text-base md:text-lg text-slate-300 leading-relaxed">
                                Znalazłeś auto na OTOMOTO, u dealera lub z ogłoszenia prywatnego? Policz miesięczną ratę i sprawdź warunki finansowania w kilka sekund.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Main Calculator Section */}
                <div className="container mx-auto px-4 max-w-6xl -mt-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        {/* Calculator Widget Column */}
                        <div className="lg:col-span-7">
                            <StandaloneFinancingCalculator
                                initialPrice={DEFAULT_FINANCING_PRICE}
                                initialCategory="LEASING"
                                formId="kalkulator_rat_callback"
                            />
                        </div>

                        {/* Side Benefits Column */}
                        <div className="lg:col-span-5 space-y-6 pt-2">
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                                <h3 className="font-heading font-bold text-lg text-slate-900 flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 text-primary" />
                                    Dlaczego warto liczyć z Motolia?
                                </h3>
                                <ul className="space-y-3 text-sm text-slate-700">
                                    <li className="flex items-start gap-2.5">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                        <span><strong>Auto z dowolnego źródła:</strong> Finansujemy samochody nowe i używane od dealerów, komisów oraz osób prywatnych.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                        <span><strong>Porównanie instytucji:</strong> Dostęp do ofert wielkich banków oraz instytucji leasingowych w jednym miejscu.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                        <span><strong>Uproszczona procedura:</strong> Decyzja finansowa często wyłącznie na podstawie wniosku bez zaświadczeń.</span>
                                    </li>
                                </ul>
                            </div>

                            {/* Direct Links to Pillar Pages */}
                            <div className="bg-slate-900 text-white p-6 rounded-xl space-y-4">
                                <h3 className="font-heading font-bold text-base text-white">
                                    Szukasz konkretnego rodzaju finansowania?
                                </h3>
                                <div className="space-y-2">
                                    <Link to="/leasing" className="flex items-center justify-between p-3 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-sm font-medium text-slate-200">
                                        <span>Leasing samochodowy dla firm i JDG</span>
                                        <ArrowRight className="w-4 h-4 text-primary" />
                                    </Link>
                                    <Link to="/kredyt" className="flex items-center justify-between p-3 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-sm font-medium text-slate-200">
                                        <span>Kredyt samochodowy konsumencki</span>
                                        <ArrowRight className="w-4 h-4 text-primary" />
                                    </Link>
                                    <Link to="/wynajem-dlugoterminowy" className="flex items-center justify-between p-3 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-sm font-medium text-slate-200">
                                        <span>Wynajem długoterminowy samochodów</span>
                                        <ArrowRight className="w-4 h-4 text-primary" />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Educational Content Section (SEO-rich & Article structured) */}
                    <div className="mt-16 bg-white p-8 md:p-12 rounded-2xl border border-slate-200 shadow-sm space-y-10">
                        <section className="space-y-4">
                            <h2 className="text-2xl font-heading font-bold text-slate-900 flex items-center gap-2">
                                <FileText className="w-6 h-6 text-primary" />
                                Jak działa kalkulator rat i co wpływa na wysokość miesięcznej opłaty?
                            </h2>
                            <p className="text-slate-700 leading-relaxed text-sm md:text-base">
                                Kalkulator rat samochodowych pozwala w szybki sposób oszacować koszty finansowania pojazdu bez konieczności wychodzenia z domu. Wysokość miesięcznej raty zależy od trzech podstawowych parametrów: **wartości pojazdu**, **wysokości wpłaty własnej** (udziału własnego) oraz **okresu umowy**.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                                <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                                    <h3 className="font-semibold text-slate-900 text-base">1. Wpłata własna</h3>
                                    <p className="text-xs text-slate-600 leading-relaxed">
                                        Wyższy wkład własny obniża całkowitą kwotę kapitału do sfinansowania, co bezpośrednio redukuje miesięczną ratę oraz całkowity koszt odsetkowy.
                                    </p>
                                </div>
                                <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                                    <h3 className="font-semibold text-slate-900 text-base">2. Okres finansowania</h3>
                                    <p className="text-xs text-slate-600 leading-relaxed">
                                        Dłuższy okres (np. 60 lub 72 miesiące) rozkłada spłatę na mniejsze raty miesięczne, podnosząc komfort płynności finansowej firmy lub gospodarstwa domowego.
                                    </p>
                                </div>
                                <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                                    <h3 className="font-semibold text-slate-900 text-base">3. Wartość końcowa (Wykup)</h3>
                                    <p className="text-xs text-slate-600 leading-relaxed">
                                        W przypadku leasingu z wykupem lub najmu, wysoka wartość wykupu obniża bieżącą ratę miesięczną, pozostawiając spłatę reszty wartości na koniec umowy.
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Tax Limits Section */}
                        <section className="p-6 bg-amber-50/60 rounded-xl border border-amber-200/70 space-y-3">
                            <h3 className="font-heading font-bold text-lg text-amber-900 flex items-center gap-2">
                                <Info className="w-5 h-5 text-amber-700" />
                                Limity podatkowe zaliczania leasingu w koszty uzyskania przychodów (2026 r.)
                            </h3>
                            <p className="text-xs md:text-sm text-amber-850 leading-relaxed">
                                Przedsiębiorcy rozliczający samochód w działalności gospodarczej (JDG, spółki z o.o.) muszą pamiętać o limitach podatkowych amortyzacji i raty kapitałowej:
                            </p>
                            <ul className="list-disc pl-5 text-xs md:text-sm text-amber-850 space-y-1 font-medium">
                                <li><strong>150 000 zł</strong> — limit zaliczania w koszty dla samochodów osobowych z napędem spalinowym i hybrydowym.</li>
                                <li><strong>225 000 zł</strong> — podwyższony limit dla w pełni elektrycznych samochodów osobowych (EV).</li>
                            </ul>
                            <p className="text-xs text-amber-800 pt-1">
                                Aby zapoznać się ze szczegółowymi zasadami odliczenia VAT oraz kosztów eksploatacji, odwiedź stronę <Link to="/leasing" className="underline font-semibold hover:text-amber-950">leasing samochodowy dla firm</Link>.
                            </p>
                        </section>

                        {/* FAQ Section */}
                        <section className="space-y-6">
                            <h2 className="text-2xl font-heading font-bold text-slate-900 flex items-center gap-2">
                                <HelpCircle className="w-6 h-6 text-primary" />
                                Najczęstsze pytania dotyczące kalkulacji raty
                            </h2>
                            <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="item-1">
                                    <AccordionTrigger className="text-left font-semibold text-slate-900">
                                        Czy wyliczona w kalkulatorze rata jest ostateczna?
                                    </AccordionTrigger>
                                    <AccordionContent className="text-sm text-slate-600 leading-relaxed">
                                        Rata wyliczona w kalkulatorze ma charakter orientacyjny. Ostateczna wysokość raty zależy od dokładnej weryfikacji rocznika i stanu pojazdu oraz oceny zdolności kredytowej przez instytucję finansującą. Po wysłaniu zapytania nasz doradca przedstawia wiążącą ofertę.
                                    </AccordionContent>
                                </AccordionItem>
                                <AccordionItem value="item-2">
                                    <AccordionTrigger className="text-left font-semibold text-slate-900">
                                        Czy mogę sfinansować samochód kupowany od osoby prywatnej?
                                    </AccordionTrigger>
                                    <AccordionContent className="text-sm text-slate-600 leading-relaxed">
                                        Tak. Za pomocą kredytu samochodowego lub wyselekcjonowanych procedur leasingowych możesz sfinansować zakup pojazdu od osoby prywatnej na podstawie umowy kupna-sprzedaży.
                                    </AccordionContent>
                                </AccordionItem>
                                <AccordionItem value="item-3">
                                    <AccordionTrigger className="text-left font-semibold text-slate-900">
                                        Czym różni się leasing od kredytu samochodowego?
                                    </AccordionTrigger>
                                    <AccordionContent className="text-sm text-slate-600 leading-relaxed">
                                        W leasingu właścicielem pojazdu w trakcie trwania umowy pozostaje firma leasingowa, a Ty zaliczasz raty bezpośrednio w koszty firmy. W kredycie stajesz się właścicielem auta od dnia zakupu (z ewentualnym zastawem rejestrowym banku). Więcej dowiesz się na naszych stronach <Link to="/leasing" className="text-primary underline">Leasing</Link> oraz <Link to="/kredyt" className="text-primary underline">Kredyt</Link>.
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </section>
                    </div>
                </div>
            </div>
        </>
    );
}
