import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, Navigate } from 'react-router-dom';
import { Phone, ShieldCheck, CheckCircle2, ArrowRight, ChevronDown, AlertTriangle } from 'lucide-react';
import { useLandingPage } from '@/hooks/useLandingPage';
import { useBrand } from '@/contexts/BrandContext';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useSpecialOffer } from '@/contexts/SpecialOfferContext';
import { writeSpecialOfferDiscount } from '@/utils/specialOffer';
import { CallbackForm } from '@/components/CallbackForm';
import { ListingCard } from '@/components/ListingCard';
import { RentalListingCard } from '@/components/RentalListingCard';
import { trackLpView, trackPhoneClick } from '@/lib/analytics';
import { formatPhoneForTelLink } from '@/utils/formatters';

const ACCENT = 'hsl(var(--mt-yellow-500))';
const ACCENT_HOVER = 'hsl(var(--mt-yellow-600))';
const ACCENT_INK = 'hsl(var(--mt-navy-700))';

/** Klasy motywu — landing bywa wysyłany do różnych grup, część kampanii wymaga jasnej wersji. */
const THEMES = {
    dark: {
        page: 'bg-brand-navy-deep text-white',
        header: 'bg-brand-navy-deep/95 border-white/10',
        heroSection: 'bg-gradient-to-b from-brand-navy-deep to-brand-navy-deep border-white/5',
        band: 'bg-brand-navy border-white/5',
        card: 'bg-brand-navy border-white/5',
        callbackCard: 'bg-brand-navy border-accent/40',
        heading: 'text-white',
        body: 'text-gray-300',
        muted: 'text-gray-400',
        footer: 'bg-brand-navy-deep border-white/10 text-gray-500',
        stickyBar: 'bg-brand-navy-deep/95 border-white/10',
        loader: 'bg-brand-navy-deep text-white',
        accentText: 'text-brand-yellow',
        faqItem: 'border-white/10 hover:border-white/20 bg-brand-navy',
        faqIconBg: 'rgba(255,255,255,0.08)',
        faqIconColor: 'rgba(255,255,255,0.85)',
        faqBody: 'border-white/10 text-gray-300',
    },
    light: {
        page: 'bg-white text-gray-900',
        header: 'bg-white/95 border-gray-200',
        heroSection: 'bg-gradient-to-b from-gray-50 to-white border-gray-200',
        band: 'bg-gray-50 border-gray-200',
        card: 'bg-white border-gray-200',
        callbackCard: 'bg-white border-accent',
        heading: 'text-gray-900',
        body: 'text-gray-600',
        muted: 'text-gray-500',
        footer: 'bg-gray-50 border-gray-200 text-gray-500',
        stickyBar: 'bg-white/95 border-gray-200',
        loader: 'bg-white text-gray-900',
        accentText: 'text-brand-yellow-ink',
        faqItem: 'border-gray-100 hover:border-gray-200 bg-white',
        faqIconBg: 'hsl(var(--mt-neutral-100))',
        faqIconColor: 'hsl(var(--mt-neutral-600))',
        faqBody: 'border-gray-100 text-gray-500',
    },
} as const;

export default function CampaignLandingPage() {
    const { slug } = useParams<{ slug: string }>();
    const [searchParams] = useSearchParams();
    const src = searchParams.get('src') || undefined;

    const { data, isLoading, error } = useLandingPage(slug);
    const { config } = useBrand();
    const { data: settings } = useAppSettings();
    const { setProgrammaticOffer } = useSpecialOffer();
    const [openFaq, setOpenFaq] = useState<number | null>(0);
    // Gdy formularz jest na ekranie, powtarzanie go w pasku nie ma sensu —
    // wtedy jedyną sensowną alternatywą jest telefon, i odwrotnie.
    const [callbackOnScreen, setCallbackOnScreen] = useState(false);

    const lp = data?.landingPage;
    const lpSlug = lp?.slug;
    const lpDiscount = lp?.discount;
    const lpInitialPayment = lp?.initialPayment;

    const theme = THEMES[lp?.theme === 'light' ? 'light' : 'dark'];

    // Numer z landingu ma pierwszeństwo — kampanie bywają rozliczane po osobnej linii.
    const contactPhone = useMemo(() => {
        return lp?.contactPhone
            || settings?.salesContactPhone
            || settings?.legalContactPhone
            || config.contactInfo?.phone
            || '+48 22 112 09 50';
    }, [lp?.contactPhone, settings, config]);

    // Programmatic discount injection in SpecialOfferContext + persist to cookie
    useEffect(() => {
        if (lpSlug) {
            if (lpDiscount && lpDiscount > 0) {
                writeSpecialOfferDiscount(lpDiscount);
            }
            setProgrammaticOffer({
                discount: lpDiscount || 0,
                initialPayment: lpInitialPayment || null,
            });
        }

        return () => {
            setProgrammaticOffer(null);
        };
    }, [lpSlug, lpDiscount, lpInitialPayment, setProgrammaticOffer]);

    // Track LP view once per page view
    useEffect(() => {
        if (lpSlug) {
            trackLpView(lpSlug, src);
        }
    }, [lpSlug, src]);

    useEffect(() => {
        const section = document.getElementById('lp-callback');
        if (!section || typeof IntersectionObserver === 'undefined') return;

        const observer = new IntersectionObserver(
            ([entry]) => setCallbackOnScreen(entry.isIntersecting),
            { threshold: 0.35 }
        );
        observer.observe(section);
        return () => observer.disconnect();
    }, [lpSlug]);

    // Redirect to /samochody if LP is expired (410)
    if (error && (error.status === 410 || error.message?.includes('expired'))) {
        return <Navigate to="/samochody" replace />;
    }

    if (isLoading) {
        return (
            <div className={`min-h-screen ${theme.loader} flex items-center justify-center`}>
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
                    <p className={`text-sm ${theme.muted}`}>Ładowanie oferty...</p>
                </div>
            </div>
        );
    }

    if (error || !lp) {
        return (
            <div className={`min-h-screen ${theme.loader} flex items-center justify-center p-4`}>
                <div className={`max-w-md text-center p-8 rounded-2xl border ${theme.card}`}>
                    <h1 className="text-2xl font-bold mb-2">Oferta jest niedostępna</h1>
                    <p className={`text-sm mb-6 ${theme.muted}`}>
                        Strona, której szukasz, wygasła lub została przeniesiona.
                    </p>
                    <a
                        href="/samochody"
                        className="inline-flex items-center justify-center h-11 px-6 rounded-xl bg-accent text-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
                    >
                        Zobacz wszystkie samochody
                    </a>
                </div>
            </div>
        );
    }

    const sections = lp.sections || {};
    const showCallback = sections.callback?.enabled !== false;
    const showListings = sections.listings?.enabled !== false;
    const showTrustBar = sections.trustBar?.enabled && sections.trustBar.items && sections.trustBar.items.length > 0;
    const showHowItWorks = sections.howItWorks?.enabled && sections.howItWorks.steps && sections.howItWorks.steps.length > 0;
    const showFaq = sections.faq?.enabled && sections.faq.items && sections.faq.items.length > 0;
    const showUrgency = sections.urgency?.enabled && sections.urgency.text;

    const rentalVehicles = lp.rentalVehicles || [];
    const hasVehicles = (lp.listings && lp.listings.length > 0) || rentalVehicles.length > 0;
    const heroFirst = lp.heroPosition !== 'after';

    const handleCallClick = (location: string) => {
        trackPhoneClick(location, lp.slug, src);
    };

    const scrollToCallback = () => {
        const el = document.getElementById('lp-callback');
        if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const heroSection = (
        <section className={`pt-8 pb-12 px-4 border-b ${theme.heroSection}`}>
            <div className="max-w-5xl mx-auto">
                <div className="space-y-4 text-left">
                    {lp.heroBadge && (
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/15 border border-accent/30 text-xs font-semibold uppercase tracking-wider ${theme.accentText}`}>
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>{lp.heroBadge}</span>
                        </div>
                    )}

                    <h1 className={`text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight ${theme.heading}`}>
                        {lp.heroTitle}
                    </h1>

                    {lp.heroSubtitle && (
                        <p className={`text-base md:text-lg leading-relaxed max-w-2xl ${theme.body}`}>
                            {lp.heroSubtitle}
                        </p>
                    )}

                    {lp.heroImageUrl && (
                        <div className={`pt-2 overflow-hidden rounded-2xl border shadow-2xl ${theme.card}`}>
                            <img
                                src={lp.heroImageUrl}
                                alt={lp.heroTitle}
                                fetchPriority="high"
                                className="w-full h-auto max-h-[320px] object-cover"
                                onError={(e) => {
                                    const container = (e.target as HTMLElement).closest('div');
                                    if (container) container.style.display = 'none';
                                }}
                            />
                        </div>
                    )}
                </div>

            </div>
        </section>
    );

    // Formularz stoi pod listą pojazdów: użytkownik najpierw widzi konkretne auta i raty,
    // a prośba o numer pada dopiero wtedy, gdy jest po co dzwonić.
    const callbackSection = showCallback ? (
        <section id="lp-callback" className={`py-10 px-4 border-t ${theme.band}`}>
            <div className="max-w-xl mx-auto scroll-mt-20">
                <CallbackForm
                    compact
                    title={sections.callback?.title || 'Oddzwonimy do Ciebie'}
                    titleHighlight=""
                    description={sections.callback?.description || 'Zostaw numer – doradca oddzwoni i w kilka minut przedstawi szczegóły oferty.'}
                    submitLabel={lp.ctaLabel || 'Zadzwoń do mnie'}
                    landingPageSlug={lp.slug}
                    src={src}
                    formId={`lp_${lp.slug}`}
                />
            </div>
        </section>
    ) : null;

    const listingsSection = showListings ? (
        <section className="py-12 px-4 max-w-6xl mx-auto">
            <div className="mb-8 text-center md:text-left">
                <h2 className={`text-2xl md:text-3xl font-extrabold ${theme.heading}`}>
                    {sections.listings?.title || 'Dostępne samochody w ofercie'}
                </h2>
                <p className={`text-sm mt-1 ${theme.muted}`}>
                    Sprawdź wybrane pojazdy z naszej aktualnej floty i poproś o ratę dopasowaną do Ciebie.
                </p>
            </div>

            {hasVehicles ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {(lp.listings || []).map((listing) => (
                            <ListingCard key={listing.listing_id} listing={listing} />
                        ))}
                        {rentalVehicles.map((vehicle: any) => (
                            <RentalListingCard key={vehicle.id} v={vehicle} />
                        ))}
                    </div>
                    {sections.listings?.ctaEnabled !== false && (
                        <div className="mt-8 text-center">
                            <a
                                href={sections.listings?.ctaUrl || '/samochody'}
                                onClick={() => {
                                    if (typeof window !== 'undefined' && (window as any).dataLayer) {
                                        (window as any).dataLayer.push({
                                            event: 'lp_offer_cta',
                                            landing_page_slug: lp.slug,
                                            traffic_source: src || 'direct',
                                        });
                                    }
                                }}
                                className="inline-flex items-center justify-center h-12 px-8 rounded-xl bg-accent text-foreground font-bold text-sm hover:opacity-90 transition-opacity shadow-md"
                            >
                                <span>{sections.listings?.ctaLabel || 'Sprawdź całą ofertę'}</span>
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </a>
                        </div>
                    )}
                </>
            ) : (
                <div className={`p-8 rounded-2xl text-center border ${theme.card}`}>
                    <p className={`text-sm ${theme.muted}`}>
                        Brak samochodów spełniających kryteria w tym momencie. Skontaktuj się z nami telefonicznie.
                    </p>
                </div>
            )}
        </section>
    ) : null;

    const howItWorksSteps = sections.howItWorks?.steps || [];
    const howItWorksGridCols = howItWorksSteps.length === 4 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3';

    return (
        <div className={`min-h-screen flex flex-col font-sans antialiased pb-20 md:pb-0 ${theme.page}`}>
            {/* Top Navigation Bar — Zero conversion leak, no main navigation links */}
            <header className={`sticky top-0 z-40 backdrop-blur border-b px-4 py-3 ${theme.header}`}>
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <a
                        href={`https://${config.domain}`}
                        className="flex items-center gap-2"
                        aria-label={`${config.name} — strona główna`}
                    >
                        <img
                            src={settings?.headerLogoUrl || config.logo?.header || ''}
                            alt={config.name || 'Motolia'}
                            className="h-8 md:h-9 w-auto object-contain"
                            onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                            }}
                        />
                    </a>

                    <a
                        href={`tel:${formatPhoneForTelLink(contactPhone)}`}
                        onClick={() => handleCallClick('lp_top_header')}
                        className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-accent text-foreground font-bold text-xs md:text-sm hover:opacity-90 transition-opacity"
                    >
                        <Phone className="w-4 h-4 shrink-0" />
                        <span>{contactPhone}</span>
                    </a>
                </div>
            </header>

            {/* Urgency Banner */}
            {showUrgency && (
                <div className="bg-accent text-foreground px-4 py-2.5 text-center text-xs md:text-sm font-semibold flex items-center justify-center gap-2 shadow-inner">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{sections.urgency?.text}</span>
                </div>
            )}

            <main className="flex-1">
                {heroFirst ? heroSection : listingsSection}

                {/* Optional Trust Bar */}
                {showTrustBar && (
                    <section className={`border-b py-6 px-4 ${theme.band}`}>
                        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                            {(sections.trustBar?.items && sections.trustBar.items.length > 0
                                ? sections.trustBar.items
                                : ['Zaufani dealerzy w całej Polsce', 'Leasing, kredyt i wynajem', 'Przejrzyste warunki', 'Decyzja nawet w 60 minut']
                            ).map((item, idx) => (
                                <div key={idx} className={`flex items-center justify-center gap-2 p-3 rounded-xl border ${theme.card}`}>
                                    <CheckCircle2 className={`w-4 h-4 shrink-0 ${theme.accentText}`} />
                                    <span className={`text-xs md:text-sm font-medium ${theme.body}`}>{item}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {heroFirst ? listingsSection : heroSection}

                {callbackSection}

                {/* Optional How It Works */}
                {showHowItWorks && (
                    <section className={`py-12 px-4 border-t border-b ${theme.band}`}>
                        <div className="max-w-5xl mx-auto space-y-8">
                            <div className="text-center">
                                <h2 className={`text-2xl md:text-3xl font-bold ${theme.heading}`}>Jak to działa?</h2>
                                <p className={`text-sm mt-1 ${theme.muted}`}>Prosty proces odbioru nowego auta</p>
                            </div>

                            <div className={`grid grid-cols-1 ${howItWorksGridCols} gap-6`}>
                                {howItWorksSteps.map((step, idx) => (
                                    <div key={idx} className={`p-6 rounded-2xl border space-y-3 text-left relative ${theme.card}`}>
                                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-accent text-foreground font-bold text-sm">
                                            {idx + 1}
                                        </div>
                                        <h3 className={`font-bold text-base ${theme.heading}`}>{step.title}</h3>
                                        <p className={`text-xs leading-relaxed ${theme.muted}`}>{step.text}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                {/* Optional FAQ Section — akordeon spójny z FAQ na pozostałych stronach serwisu */}
                {showFaq && (
                    <section className="py-16 px-4 max-w-4xl mx-auto" id="faq">
                        <div className="text-center mb-10">
                            <h2 className={`text-3xl md:text-4xl font-heading font-bold ${theme.heading}`}>
                                Najczęściej zadawane{' '}
                                <span style={{ color: ACCENT_INK }}>pytania</span>
                            </h2>
                        </div>

                        <div className="space-y-3">
                            {sections.faq?.items?.map((item, idx) => (
                                <div
                                    key={idx}
                                    className={`border rounded-2xl overflow-hidden transition-all ${theme.faqItem}`}
                                >
                                    <button
                                        onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                                        aria-expanded={openFaq === idx}
                                        className="w-full flex items-center justify-between p-6 text-left"
                                    >
                                        <h3 className={`text-base font-semibold pr-6 ${theme.heading}`}>{item.q}</h3>
                                        <div
                                            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                                                openFaq === idx ? 'rotate-180' : ''
                                            }`}
                                            style={{
                                                background: openFaq === idx ? ACCENT : theme.faqIconBg,
                                                color: openFaq === idx ? 'hsl(var(--mt-navy-900))' : theme.faqIconColor,
                                            }}
                                        >
                                            <ChevronDown size={16} />
                                        </div>
                                    </button>
                                    <div
                                        style={{
                                            display: 'grid',
                                            gridTemplateRows: openFaq === idx ? '1fr' : '0fr',
                                            opacity: openFaq === idx ? 1 : 0,
                                            transition: 'grid-template-rows 0.25s, opacity 0.25s',
                                        }}
                                    >
                                        <div className="overflow-hidden">
                                            <div className={`px-6 pb-6 leading-relaxed border-t pt-4 ${theme.faqBody}`}>
                                                {item.a}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </main>

            {/* Minimal Footer — No site navigation links */}
            <footer className={`border-t py-8 px-4 text-center text-xs space-y-3 ${theme.footer}`}>
                <div className="max-w-4xl mx-auto space-y-2">
                    {lp.termsFileUrl && (
                        <div className="pb-2">
                            <a
                                href={lp.termsFileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`text-sm font-medium underline hover:opacity-80 transition-opacity ${theme.body}`}
                            >
                                {lp.termsLabel || 'Regulamin promocji (PDF)'}
                            </a>
                        </div>
                    )}
                    <p className="font-semibold">
                        {settings?.legalCompanyName || config.companyInfo?.legalName || config.name}
                    </p>
                    {(settings?.legalAddress || config.companyInfo?.address) && (
                        <p>{settings?.legalAddress || config.companyInfo?.address}</p>
                    )}
                    <p>
                        NIP: {settings?.legalVatId || config.companyInfo?.vatId || '—'}
                        {' | '}
                        {settings?.legalRegisterNumber || config.companyInfo?.registerNumber || '—'}
                    </p>
                    <p className="text-[11px] max-w-2xl mx-auto opacity-80">
                        Wysyłając formularz zgadzasz się na kontakt ze strony doradcy w celu przedstawienia spersonalizowanej oferty. Rezygnacja z kontaktu jest możliwa w każdej chwili.
                    </p>
                </div>
            </footer>

            {/* Mobile Bottom Sticky Bar — jedna akcja, zawsze ta, której nie ma pod ręką.
                Numer telefonu jest stale widoczny w przyklejonym nagłówku, więc powielanie
                go tutaj obok drugiego CTA tylko rozpraszało. */}
            <div className={`fixed bottom-0 left-0 right-0 z-50 backdrop-blur border-t px-3 py-2.5 md:hidden ${theme.stickyBar}`}>
                {callbackOnScreen ? (
                    <a
                        href={`tel:${formatPhoneForTelLink(contactPhone)}`}
                        onClick={() => handleCallClick('lp_sticky_bar')}
                        className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-accent text-foreground font-bold text-sm shadow-lg active:scale-[0.98] transition-transform"
                    >
                        <Phone className="w-4 h-4 shrink-0" />
                        <span>Zadzwoń: {contactPhone}</span>
                    </a>
                ) : (
                    <button
                        onClick={scrollToCallback}
                        className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-accent text-foreground font-bold text-sm shadow-lg active:scale-[0.98] transition-transform"
                    >
                        <span>Zostaw numer — oddzwonimy w 15 minut</span>
                        <ArrowRight className="w-4 h-4 shrink-0" />
                    </button>
                )}
            </div>
        </div>
    );
}
