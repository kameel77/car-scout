import { useState } from 'react';
import { Car, Phone, ShieldCheck } from 'lucide-react';
import { leadsApi } from '@/services/api';
import { useBrand } from '@/contexts/BrandContext';
import { trackLeadSubmit } from '@/lib/analytics';

interface CallbackFormProps {
    title?: string;
    titleHighlight?: string;
    description?: string;
    className?: string;
    /** Attaches the lead to a specific vehicle so the CRM sees which car the caller was viewing */
    listingId?: string;
    /** Custom message stored with the lead (e.g. vehicle summary) */
    message?: string;
    /** dataLayer form identifier, defaults to 'callback_form' */
    formId?: string;
    /** Compact, light card variant for sidebars (default is the full dark section) */
    compact?: boolean;
    financingType?: string;
    brand?: string;
    model?: string;
    landingPageSlug?: string;
    src?: string;
    /** Etykieta przycisku wysyłki (wariant compact) */
    submitLabel?: string;
    /** Opcjonalne parametry kalkulacji finansowania */
    financingParams?: {
        productId?: string;
        amount?: number;
        period?: number;
        downPayment?: number;
        installment?: number;
        finalPayment?: number;
    };
}

export function CallbackForm({
    title = 'Masz dodatkowe pytania?',
    titleHighlight = 'Oddzwonimy do Ciebie',
    description = 'Zostaw numer – doradca oddzwoni i w kilka minut przedstawi oferty z kredytu, leasingu lub wynajmu.',
    className = '',
    listingId,
    message,
    formId = 'callback_form',
    compact = false,
    financingType,
    brand,
    model,
    landingPageSlug,
    src,
    submitLabel = 'Zadzwoń do mnie',
    financingParams,
}: CallbackFormProps) {
    const [phone, setPhone] = useState('');
    const [honeypot, setHoneypot] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const { config } = useBrand();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!phone.trim() || status === 'loading') return;
        setStatus('loading');
        try {
            await leadsApi.submitQuickLead({
                phone: phone.trim(),
                listingId,
                message,
                company: honeypot,
                landingPageSlug,
                src,
                financingProductId: financingParams?.productId,
                financingAmount: financingParams?.amount,
                financingPeriod: financingParams?.period,
                financingDownPayment: financingParams?.downPayment,
                financingInstallment: financingParams?.installment,
                financingFinalPayment: financingParams?.finalPayment,
            });

            // Push event to Google Tag Manager dataLayer
            trackLeadSubmit({
                formId,
                leadType: 'quick_callback',
                brand: brand || config.id,
                model,
                listingId,
                financingType: financingType || 'general',
                phone: phone.trim(),
                landing_page_slug: landingPageSlug,
                traffic_source: src,
            } as any);

            setStatus('success');
            setPhone('');
        } catch {
            setStatus('error');
        }
    };

    const honeypotField = (
        <input
            type="text"
            name="company"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="hidden"
        />
    );

    if (compact) {
        return (
            <div className={`rounded-xl bg-card shadow-card border-2 border-accent/40 p-4 ${className}`}>
                {status === 'success' ? (
                    <div className="flex items-center gap-2 text-green-600 font-semibold text-sm">
                        <ShieldCheck className="w-4 h-4 shrink-0" />
                        Dziękujemy! Oddzwonimy wkrótce.
                    </div>
                ) : (
                    <>
                        {(title || titleHighlight) && (
                            <p className="font-heading font-bold text-base text-foreground mb-1 flex items-center gap-2">
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-accent/15 shrink-0">
                                    <Phone className="w-4 h-4 text-accent" />
                                </span>
                                <span>{title} <span className="text-accent">{titleHighlight}</span></span>
                            </p>
                        )}
                        <p className="text-sm text-muted-foreground mb-3">{description}</p>
                        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                            {honeypotField}
                            <input
                                type="tel"
                                aria-label="Numer telefonu"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="Twój numer telefonu"
                                required
                                className="h-10 px-3 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                            />
                            <button
                                type="submit"
                                disabled={status === 'loading'}
                                className="h-10 px-4 rounded-lg bg-accent text-accent-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
                            >
                                {status === 'loading' ? 'Wysyłam...' : submitLabel}
                            </button>
                        </form>
                        {status === 'error' && (
                            <p className="text-destructive text-xs mt-2">Coś poszło nie tak. Spróbuj ponownie.</p>
                        )}
                    </>
                )}
            </div>
        );
    }

    return (
        <section className={`rounded-2xl bg-brand-navy-deep px-6 py-10 md:px-12 md:py-14 text-center ${className}`}>
            {/* Icon */}
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-navy mb-6 mx-auto">
                <Car className="w-7 h-7 text-accent" />
            </div>

            {/* Heading */}
            <h2 className="font-heading text-2xl md:text-3xl font-bold text-white mb-3">
                {title}{' '}
                <span className="text-accent">{titleHighlight}</span>
            </h2>
            <p className="text-gray-400 text-sm md:text-base max-w-md mx-auto mb-8">
                {description}
            </p>

            {status === 'success' ? (
                <div className="flex items-center justify-center gap-2 text-green-400 font-semibold text-lg">
                    <ShieldCheck className="w-5 h-5" />
                    Dziękujemy! Zadzwonimy do Ciebie w ciągu 24h.
                </div>
            ) : (
                <>
                    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
                        {honeypotField}
                        <input
                            type="tel"
                            aria-label="Numer telefonu"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="Wpisz swój numer telefonu"
                            required
                            className="flex-1 h-12 px-5 rounded-xl bg-brand-navy border border-white/15 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                        />
                        <button
                            type="submit"
                            disabled={status === 'loading'}
                            className="h-12 px-6 rounded-xl bg-accent text-accent-foreground font-semibold text-sm whitespace-nowrap hover:opacity-90 transition-opacity disabled:opacity-60"
                        >
                            {status === 'loading' ? 'Wysyłam...' : 'Zadzwoń do mnie'}
                        </button>
                    </form>
                    {status === 'error' && (
                        <p className="text-red-400 text-sm mt-3">Coś poszło nie tak. Spróbuj ponownie.</p>
                    )}
                    <p className="text-gray-500 text-xs mt-4 flex items-center justify-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Twoje dane są bezpieczne
                    </p>
                </>
            )}
        </section>
    );
}
