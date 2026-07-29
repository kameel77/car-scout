import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams, Navigate } from 'react-router-dom';
import { Phone, ShieldCheck, CheckCircle2, ArrowRight, HelpCircle, AlertTriangle } from 'lucide-react';
import { useLandingPage } from '@/hooks/useLandingPage';
import { useBrand } from '@/contexts/BrandContext';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useSpecialOffer } from '@/contexts/SpecialOfferContext';
import { CallbackForm } from '@/components/CallbackForm';
import { ListingCard } from '@/components/ListingCard';
import { trackLpView, trackPhoneClick } from '@/lib/analytics';
import { formatPhoneForTelLink } from '@/utils/formatters';

export default function CampaignLandingPage() {
    const { slug } = useParams<{ slug: string }>();
    const [searchParams] = useSearchParams();
    const src = searchParams.get('src') || undefined;

    const { data, isLoading, error } = useLandingPage(slug);
    const { config } = useBrand();
    const { data: settings } = useAppSettings();
    const { setProgrammaticOffer } = useSpecialOffer();

    const lp = data?.landingPage;
    const lpSlug = lp?.slug;
    const lpDiscount = lp?.discount;
    const lpInitialPayment = lp?.initialPayment;

    // Contact phone: prioritize brand/settings phone
    const contactPhone = useMemo(() => {
        return settings?.salesContactPhone || settings?.legalContactPhone || config.contactInfo?.phone || '+48 000 000 000';
    }, [settings, config]);

    // Programmatic discount injection in SpecialOfferContext
    useEffect(() => {
        if (lpSlug) {
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

    // Redirect to /samochody if LP is expired (410)
    if (error && (error.status === 410 || error.message?.includes('expired'))) {
        return <Navigate to="/samochody" replace />;
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#1a1a1a] text-white flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-[#F5C518] border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-gray-400">Ładowanie oferty...</p>
                </div>
            </div>
        );
    }

    if (error || !lp) {
        return (
            <div className="min-h-screen bg-[#1a1a1a] text-white flex items-center justify-center p-4">
                <div className="max-w-md text-center bg-[#242424] p-8 rounded-2xl border border-white/10">
                    <h1 className="text-2xl font-bold mb-2">Oferta jest niedostępna</h1>
                    <p className="text-gray-400 text-sm mb-6">
                        Strona, której szukasz, wygasła lub została przeniesiona.
                    </p>
                    <a
                        href="/samochody"
                        className="inline-flex items-center justify-center h-11 px-6 rounded-xl bg-[#F5C518] text-[#1a1a1a] font-semibold text-sm hover:opacity-90 transition-opacity"
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

    const handleCallClick = (location: string) => {
        trackPhoneClick(location, lp.slug, src);
    };

    const scrollToCallback = () => {
        const el = document.getElementById('lp-callback');
        if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <div className="min-h-screen bg-[#121212] text-white flex flex-col font-sans antialiased pb-20 md:pb-0">
            {/* Top Navigation Bar — Zero conversion leak, no main navigation links */}
            <header className="sticky top-0 z-40 bg-[#1a1a1a]/95 backdrop-blur border-b border-white/10 px-4 py-3">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <img
                            src={settings?.headerLogoUrl || '/motolia-placeholder.webp'}
                            alt={config.name || 'Motolia'}
                            className="h-8 md:h-9 object-contain"
                            onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                            }}
                        />
                        <span className="font-heading text-lg md:text-xl font-bold tracking-tight text-white">
                            {config.name || 'Motolia'}
                        </span>
                    </div>

                    <a
                        href={`tel:${formatPhoneForTelLink(contactPhone)}`}
                        onClick={() => handleCallClick('lp_top_header')}
                        className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#F5C518] text-[#1a1a1a] font-bold text-xs md:text-sm hover:opacity-90 transition-opacity"
                    >
                        <Phone className="w-4 h-4 shrink-0" />
                        <span>{contactPhone}</span>
                    </a>
                </div>
            </header>

            {/* Urgency Banner */}
            {showUrgency && (
                <div className="bg-[#F5C518] text-[#1a1a1a] px-4 py-2.5 text-center text-xs md:text-sm font-semibold flex items-center justify-center gap-2 shadow-inner">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{sections.urgency?.text}</span>
                </div>
            )}

            <main className="flex-1">
                {/* Hero & Callback Section */}
                <section className="bg-gradient-to-b from-[#1a1a1a] to-[#121212] pt-8 pb-12 px-4 border-b border-white/5">
                    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                        {/* Hero Left Content */}
                        <div className="lg:col-span-7 space-y-4 text-left">
                            {lp.heroBadge && (
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F5C518]/15 border border-[#F5C518]/30 text-[#F5C518] text-xs font-semibold uppercase tracking-wider">
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    <span>{lp.heroBadge}</span>
                                </div>
                            )}

                            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white leading-tight">
                                {lp.heroTitle}
                            </h1>

                            {lp.heroSubtitle && (
                                <p className="text-gray-300 text-base md:text-lg leading-relaxed max-w-2xl">
                                    {lp.heroSubtitle}
                                </p>
                            )}

                            {lp.heroImageUrl && (
                                <div className="pt-2 overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
                                    <img
                                        src={lp.heroImageUrl}
                                        alt={lp.heroTitle}
                                        fetchPriority="high"
                                        className="w-full h-auto max-h-[320px] object-cover"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Callback Form (Right / Above the fold) */}
                        {showCallback && (
                            <div id="lp-callback" className="lg:col-span-5 scroll-mt-20">
                                <div className="bg-[#222222] border-2 border-[#F5C518]/40 p-6 rounded-2xl shadow-2xl space-y-4">
                                    <div className="text-left space-y-1">
                                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#F5C518]/20 text-[#F5C518] shrink-0">
                                                <Phone className="w-4 h-4" />
                                            </span>
                                            <span>{sections.callback?.title || lp.ctaLabel || 'Oddzwońcie do mnie'}</span>
                                        </h2>
                                        {sections.callback?.description && (
                                            <p className="text-xs text-gray-400 leading-normal">
                                                {sections.callback.description}
                                            </p>
                                        )}
                                    </div>

                                    <CallbackForm
                                        compact
                                        title=""
                                        description={sections.callback?.description || 'Zostaw numer – doradca oddzwoni i w kilka minut przedstawi szczeóły oferty.'}
                                        landingPageSlug={lp.slug}
                                        src={src}
                                        formId={`lp_${lp.slug}`}
                                        className="bg-transparent border-0 p-0 shadow-none"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* Optional Trust Bar */}
                {showTrustBar && (
                    <section className="bg-[#181818] border-b border-white/5 py-6 px-4">
                        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                            {sections.trustBar?.items?.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-center gap-2 bg-[#222] p-3 rounded-xl border border-white/5">
                                    <CheckCircle2 className="w-4 h-4 text-[#F5C518] shrink-0" />
                                    <span className="text-xs md:text-sm font-medium text-gray-200">{item}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Listings Section */}
                {showListings && (
                    <section className="py-12 px-4 max-w-6xl mx-auto">
                        <div className="mb-8 text-center md:text-left">
                            <h2 className="text-2xl md:text-3xl font-extrabold text-white">
                                {sections.listings?.title || 'Dostępne samochody w ofercie'}
                            </h2>
                            <p className="text-sm text-gray-400 mt-1">
                                Sprawdź wybrane pojazdy z naszej aktualnej floty i poproś o ratę dopasowaną do Ciebie.
                            </p>
                        </div>

                        {lp.listings && lp.listings.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {lp.listings.map((listing) => (
                                    <ListingCard key={listing.listing_id} listing={listing} />
                                ))}
                            </div>
                        ) : (
                            <div className="bg-[#222] p-8 rounded-2xl text-center border border-white/5">
                                <p className="text-gray-400 text-sm">
                                    Brak samochodów spełniających kryteria w tym momencie. Skontaktuj się z nami telefonicznie.
                                </p>
                            </div>
                        )}
                    </section>
                )}

                {/* Optional How It Works */}
                {showHowItWorks && (
                    <section className="bg-[#181818] py-12 px-4 border-t border-b border-white/5">
                        <div className="max-w-4xl mx-auto space-y-8">
                            <div className="text-center">
                                <h2 className="text-2xl md:text-3xl font-bold text-white">Jak to działa?</h2>
                                <p className="text-sm text-gray-400 mt-1">Prosty proces odbioru nowego auta w 3 krokach</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {sections.howItWorks?.steps?.map((step, idx) => (
                                    <div key={idx} className="bg-[#222] p-6 rounded-2xl border border-white/5 space-y-3 text-left relative">
                                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-[#F5C518] text-[#1a1a1a] font-bold text-sm">
                                            {idx + 1}
                                        </div>
                                        <h3 className="font-bold text-white text-base">{step.title}</h3>
                                        <p className="text-xs text-gray-400 leading-relaxed">{step.text}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                {/* Optional FAQ Section */}
                {showFaq && (
                    <section className="py-12 px-4 max-w-4xl mx-auto space-y-8">
                        <div className="text-center">
                            <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center justify-center gap-2">
                                <HelpCircle className="w-6 h-6 text-[#F5C518]" />
                                Najczęściej zadawane pytania
                            </h2>
                        </div>

                        <div className="space-y-4">
                            {sections.faq?.items?.map((item, idx) => (
                                <div key={idx} className="bg-[#222] p-5 rounded-2xl border border-white/5 space-y-2 text-left">
                                    <h3 className="font-semibold text-white text-sm md:text-base">{item.q}</h3>
                                    <p className="text-xs md:text-sm text-gray-400 leading-relaxed">{item.a}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </main>

            {/* Minimal Footer — No site navigation links */}
            <footer className="bg-[#0e0e0e] border-t border-white/10 py-8 px-4 text-center text-xs text-gray-500 space-y-3">
                <div className="max-w-4xl mx-auto space-y-2">
                    <p className="font-semibold text-gray-400">{settings?.legalCompanyName || config.name || 'Motolia'}</p>
                    {settings?.legalAddress && <p>{settings.legalAddress}</p>}
                    <p>NIP: {settings?.legalVatId || '—'} | REGON/KRS: {settings?.legalRegisterNumber || '—'}</p>
                    <p className="text-[11px] text-gray-600 max-w-2xl mx-auto">
                        Wysyłając formularz zgadzasz się na kontakt ze strony doradcy w celu przedstawienia spersonalizowanej oferty. Rezygnacja z kontaktu jest możliwa w każdej chwili.
                    </p>
                </div>
            </footer>

            {/* Mobile Bottom Sticky Bar */}
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#1a1a1a]/95 backdrop-blur border-t border-white/10 p-3 flex md:hidden items-center gap-3">
                <a
                    href={`tel:${formatPhoneForTelLink(contactPhone)}`}
                    onClick={() => handleCallClick('lp_sticky_bar')}
                    className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-[#2a2a2a] text-white font-bold text-xs border border-white/10 active:scale-95 transition-transform"
                >
                    <Phone className="w-4 h-4 text-[#F5C518]" />
                    <span>Zadzwoń</span>
                </a>
                <button
                    onClick={scrollToCallback}
                    className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-[#F5C518] text-[#1a1a1a] font-bold text-xs shadow-lg active:scale-95 transition-transform"
                >
                    <span>Oddzwońcie do mnie</span>
                    <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
