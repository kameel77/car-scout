import React from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle, AlertCircle, Loader2, MessageCircle, ShieldCheck, Zap, Car } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { rentalPublicApi } from '@/services/rental-api';
import { leadsApi } from '@/services/api';
import { useBrand } from '@/contexts/BrandContext';
import { Turnstile } from '@/components/Turnstile';
import { MetaHead } from '@/components/seo/MetaHead';

const phoneRegex = /^(\+48\s?)?[1-9]\d{2}[\s-]?\d{3}[\s-]?\d{3}$/;

const rentalLeadSchema = z.object({
    name: z.string().min(2, 'Pole wymagane').max(100),
    email: z.string().email('Nieprawidłowy adres e-mail'),
    phone: z.string().optional().refine((val) => !val || phoneRegex.test(val), {
        message: 'Nieprawidłowy numer telefonu',
    }),
    preferredContact: z.enum(['email', 'phone']),
    message: z.string().min(10, 'Minimum 10 znaków').max(2000),
    consentMarketing: z.boolean().refine((v) => v === true, 'Pole wymagane'),
    consentPrivacy: z.boolean().refine((v) => v === true, 'Pole wymagane'),
});

type RentalLeadFormData = z.infer<typeof rentalLeadSchema>;

export default function RentalLeadFormPage() {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { config } = useBrand();

    // Rental config passed via location.state from the calculator
    const rentalData = location.state?.rental as {
        companyName?: string;
        companyId?: string;
        monthlyRate?: number;
        annualMileageKm?: number;
        contractMonths?: number;
        initialPaymentPct?: number;
        initialPaymentAmountNet?: number;
        initialPaymentAmountGross?: number;
        offerType?: string;
    } | undefined;

    const [status, setStatus] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [referenceNumber, setReferenceNumber] = React.useState('');
    const [turnstileToken, setTurnstileToken] = React.useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['rental-vehicle-public', slug],
        queryFn: () => rentalPublicApi.getVehicle(slug!),
        enabled: !!slug
    });

    const vehicle = data?.vehicle;

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = useForm<RentalLeadFormData>({
        resolver: zodResolver(rentalLeadSchema),
        defaultValues: {
            preferredContact: 'email',
            message: '',
            consentMarketing: false,
            consentPrivacy: false,
        },
    });

    // Auto-fill default message
    React.useEffect(() => {
        if (vehicle && !watch('message')) {
            const lines = [
                `Dzień dobry,`,
                `Interesuje mnie oferta najmu długoterminowego pojazdu ${vehicle.make} ${vehicle.model}${vehicle.version ? ` ${vehicle.version}` : ''}.`,
            ];

            if (rentalData?.monthlyRate) {
                lines.push(`Konfiguracja kalkulatora:`);
                if (rentalData.annualMileageKm) lines.push(`  • Przebieg roczny: ${(rentalData.annualMileageKm / 1000).toFixed(0)} tys. km`);
                if (rentalData.contractMonths) lines.push(`  • Okres: ${rentalData.contractMonths} mies.`);
                
                if (rentalData.initialPaymentAmountNet || rentalData.initialPaymentAmountGross) {
                    const amount = rentalData.offerType === 'business' ? rentalData.initialPaymentAmountNet : rentalData.initialPaymentAmountGross;
                    const typeLabel = rentalData.offerType === 'business' ? 'netto' : 'brutto';
                    if (amount) {
                        lines.push(`  • Opłata wstępna: ${amount.toLocaleString('pl-PL')} zł ${typeLabel}`);
                    }
                } else if (rentalData.initialPaymentPct !== undefined) {
                    lines.push(`  • Opłata wstępna: ${rentalData.initialPaymentPct}%`);
                }
                
                lines.push(`  • Rata: ${rentalData.monthlyRate.toLocaleString('pl-PL')} zł brutto / mies.`);
            }

            lines.push('', 'Proszę o kontakt w celu omówienia szczegółów oferty.');

            setValue('message', lines.join('\n'));
        }
    }, [vehicle, rentalData]);

    const onSubmit = async (formData: RentalLeadFormData) => {
        setStatus('loading');
        try {
            if (!vehicle?.id) throw new Error('Brak pojazdu');

            const response = await leadsApi.submitRentalLead({
                rentalVehicleId: vehicle.id,
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                preferredContact: formData.preferredContact,
                message: formData.message,
                consentMarketing: formData.consentMarketing,
                consentPrivacy: formData.consentPrivacy,
                rentalCompanyName: rentalData?.companyName,
                rentalAnnualMileageKm: rentalData?.annualMileageKm,
                rentalContractMonths: rentalData?.contractMonths,
                rentalInitialPaymentPct: rentalData?.initialPaymentPct,
                rentalInitialPaymentAmountNet: rentalData?.initialPaymentAmountNet,
                rentalInitialPaymentAmountGross: rentalData?.initialPaymentAmountGross,
                rentalMonthlyRate: rentalData?.monthlyRate,
                turnstileToken,
            });

            setReferenceNumber(response.lead?.referenceNumber || response.lead?.id || '');

            // Push event to Google Tag Manager dataLayer
            if (typeof window !== 'undefined') {
                (window as any).dataLayer = (window as any).dataLayer || [];
                (window as any).dataLayer.push({
                    event: 'generate_lead',
                    lead_type: 'rental_inquiry',
                    form_id: 'rental_inquiry_form',
                    brand: config.id,
                    lead_details: {
                        name: formData.name,
                        email: formData.email,
                        phone: formData.phone || undefined,
                        preferred_contact: formData.preferredContact,
                    },
                    vehicle_details: {
                        vehicle_id: vehicle.id,
                        make: vehicle.make,
                        model: vehicle.model,
                        version: vehicle.version,
                        year: vehicle.productionYear,
                    },
                    rental_details: rentalData ? {
                        monthly_rate: rentalData.monthlyRate,
                        annual_mileage: rentalData.annualMileageKm,
                        contract_months: rentalData.contractMonths,
                        initial_payment_pct: rentalData.initialPaymentPct,
                        initial_payment_amount_net: rentalData.initialPaymentAmountNet,
                        initial_payment_amount_gross: rentalData.initialPaymentAmountGross,
                        offer_type: rentalData.offerType,
                    } : undefined
                });
            }

            setStatus('success');
        } catch {
            setStatus('error');
        }
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="min-h-screen bg-stone-50/50">
                <Header onClearFilters={() => {}} hasActiveFilters={false} />
                <div className="container py-32 flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <p className="text-gray-500 animate-pulse">Ładowanie...</p>
                </div>
                <Footer />
            </div>
        );
    }

    // Not found
    if (!vehicle) {
        return (
            <div className="min-h-screen bg-stone-50/50 text-center">
                <Header onClearFilters={() => {}} hasActiveFilters={false} />
                <div className="container py-24">
                    <Car className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold">Pojazd nie został znaleziony</h2>
                    <Button className="mt-6" onClick={() => navigate(-1)}>Wróć</Button>
                </div>
                <Footer />
            </div>
        );
    }

    // Success screen
    if (status === 'success') {
        return (
            <div className="min-h-screen bg-stone-50/50">
                <Header onClearFilters={() => {}} hasActiveFilters={false} />
                <div className="container max-w-lg py-20">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-2xl shadow-xl p-10 text-center space-y-8 border"
                    >
                        <div className="mx-auto w-20 h-20 rounded-full bg-green-50 flex items-center justify-center">
                            <CheckCircle className="h-10 w-10 text-green-600" />
                        </div>
                        <div className="space-y-2">
                            <h1 className="text-3xl font-bold">Zapytanie wysłane!</h1>
                            <p className="text-gray-500">Skontaktujemy się z Tobą w najkrótszym możliwym czasie.</p>
                        </div>
                        <div className="bg-blue-50 rounded-xl p-6 border border-dashed border-blue-200">
                            <p className="text-xs uppercase tracking-widest text-gray-500 mb-1 font-semibold">Numer zgłoszenia</p>
                            <p className="text-2xl font-black text-blue-600 tracking-tighter">{referenceNumber}</p>
                        </div>
                        <div className="flex flex-col gap-4">
                            <Button asChild className="bg-blue-600 hover:bg-blue-700 h-12 text-md font-bold shadow-lg">
                                <Link to="/wynajem-dlugoterminowy">Wróć do listy pojazdów</Link>
                            </Button>
                            <Button asChild variant="ghost">
                                <Link to={`/wynajem-dlugoterminowy/${slug}`}>Wróć do oferty</Link>
                            </Button>
                        </div>
                    </motion.div>
                </div>
                <Footer />
            </div>
        );
    }

    // Form
    return (
        <div className="min-h-screen bg-stone-50/50">
            <MetaHead
                title={`Zapytaj o ofertę - ${vehicle.make} ${vehicle.model} | Motolia`}
                description={`Formularz zapytania o wynajem długoterminowy ${vehicle.make} ${vehicle.model}${vehicle.version ? ` ${vehicle.version}` : ''}. Wypełnij formularz i otrzymaj spersonalizowaną ofertę.`}
                canonical={`/wynajem-dlugoterminowy/${slug}/zapytanie`}
            />
            <Header onClearFilters={() => {}} hasActiveFilters={false} />
            <div className="container max-w-5xl py-8">
                <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-8 gap-2 hover:bg-white">
                    <ArrowLeft className="h-4 w-4" /> Wróć
                </Button>

                <div className="grid gap-10 lg:grid-cols-12">
                    {/* Left: Offer Summary — Sticky */}
                    <div className="lg:col-span-5 order-2 lg:order-1">
                        <div className="sticky top-24 space-y-6">
                            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden p-6">
                                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">
                                    Szczegóły zapytania
                                </h2>

                                <div className="relative aspect-video rounded-xl overflow-hidden mb-4 group">
                                    {vehicle.primaryImageUrl && vehicle.primaryImageUrl !== '' ? (
                                        <img
                                            src={vehicle.primaryImageUrl}
                                            alt={`${vehicle.make} ${vehicle.model}`}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                    ) : (
                                        <img
                                            src="/motolia-placeholder.webp"
                                            alt="Placeholder"
                                            className="w-full h-full object-cover"
                                        />
                                    )}
                                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold shadow-sm border">
                                        {vehicle.productionYear}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <h3 className="text-xl font-bold tracking-tight">
                                        {vehicle.make} {vehicle.model}
                                    </h3>
                                    {vehicle.version && (
                                        <p className="text-gray-500 text-sm line-clamp-1">{vehicle.version}</p>
                                    )}

                                    {/* Calculator config summary */}
                                    {rentalData?.monthlyRate && (
                                        <div className="mt-4 pt-4 border-t space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-3xl font-black text-blue-600 tracking-tighter">
                                                    {rentalData.monthlyRate.toLocaleString('pl-PL')} zł
                                                </span>
                                                <span className="text-xs text-gray-500">/ mies. brutto</span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                                {rentalData.annualMileageKm && (
                                                    <div className="bg-gray-50 rounded-lg p-2">
                                                        <div className="text-gray-400 uppercase tracking-wider" style={{fontSize: '9px'}}>Przebieg</div>
                                                        <div className="font-semibold">{(rentalData.annualMileageKm / 1000).toFixed(0)} tys.</div>
                                                    </div>
                                                )}
                                                {rentalData.contractMonths && (
                                                    <div className="bg-gray-50 rounded-lg p-2">
                                                        <div className="text-gray-400 uppercase tracking-wider" style={{fontSize: '9px'}}>Okres</div>
                                                        <div className="font-semibold">{rentalData.contractMonths} mies.</div>
                                                    </div>
                                                )}
                                                {(rentalData.initialPaymentPct !== undefined || rentalData.initialPaymentAmountNet !== undefined || rentalData.initialPaymentAmountGross !== undefined) && (
                                                    <div className="bg-gray-50 rounded-lg p-2">
                                                        <div className="text-gray-400 uppercase tracking-wider" style={{fontSize: '9px'}}>Wpłata</div>
                                                        <div className="font-semibold">
                                                            {rentalData.initialPaymentAmountNet ? `${(rentalData.offerType === 'business' ? rentalData.initialPaymentAmountNet : rentalData.initialPaymentAmountGross)?.toLocaleString('pl-PL')} zł` : `${rentalData.initialPaymentPct}%`}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Trust section */}
                            <div className="bg-blue-50 rounded-2xl p-6 space-y-4 border border-blue-100">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center text-blue-600 shadow-sm border">
                                        <Zap className="h-5 w-5 fill-current" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-sm">Szybka odpowiedź</h4>
                                        <p className="text-xs text-gray-500">Średni czas odpowiedzi: ~45 minut</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center text-blue-600 shadow-sm border">
                                        <ShieldCheck className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-sm">Bezpieczny kontakt</h4>
                                        <p className="text-xs text-gray-500">Twoje dane są chronione i użyte tylko do tego zapytania.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Form */}
                    <div className="lg:col-span-7 order-1 lg:order-2">
                        <div className="bg-white rounded-2xl shadow-sm border p-8 lg:p-10">
                            <div className="mb-8">
                                <div className="flex items-center gap-3 mb-2">
                                    <MessageCircle className="h-6 w-6 text-blue-600" />
                                    <h1 className="text-2xl font-bold tracking-tight">Zapytaj o ofertę najmu</h1>
                                </div>
                                <p className="text-gray-500">Wypełnij formularz, a nasz doradca skontaktuje się z Tobą.</p>
                            </div>

                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                                <div className="grid gap-6 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider">Imię i nazwisko *</Label>
                                        <Input
                                            id="name"
                                            {...register('name')}
                                            placeholder="np. Jan Kowalski"
                                            className="bg-stone-50 border-stone-200 focus:bg-white transition-colors"
                                        />
                                        {errors.name && (
                                            <p className="text-xs text-red-500 mt-1 font-medium">{errors.name.message}</p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider">Adres e-mail *</Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            {...register('email')}
                                            placeholder="jan@example.pl"
                                            className="bg-stone-50 border-stone-200 focus:bg-white transition-colors"
                                        />
                                        {errors.email && (
                                            <p className="text-xs text-red-500 mt-1 font-medium">{errors.email.message}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="grid gap-6 sm:grid-cols-2 items-end">
                                    <div className="space-y-2">
                                        <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider">Numer telefonu</Label>
                                        <Input
                                            id="phone"
                                            {...register('phone')}
                                            placeholder="+48 000 000 000"
                                            className="bg-stone-50 border-stone-200 focus:bg-white transition-colors"
                                        />
                                        {errors.phone && (
                                            <p className="text-xs text-red-500 mt-1 font-medium">{errors.phone.message}</p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase tracking-wider mb-3 block">Preferowany kontakt</Label>
                                        <RadioGroup
                                            defaultValue="email"
                                            onValueChange={(v) => setValue('preferredContact', v as 'email' | 'phone')}
                                            className="flex gap-6 pb-2"
                                        >
                                            <div className="flex items-center gap-2">
                                                <RadioGroupItem value="email" id="rc-email" />
                                                <Label htmlFor="rc-email" className="text-sm cursor-pointer">E-mail</Label>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <RadioGroupItem value="phone" id="rc-phone" />
                                                <Label htmlFor="rc-phone" className="text-sm cursor-pointer">Telefon</Label>
                                            </div>
                                        </RadioGroup>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="message" className="text-xs font-bold uppercase tracking-wider">Twoja wiadomość *</Label>
                                    <Textarea
                                        id="message"
                                        {...register('message')}
                                        rows={8}
                                        className="bg-stone-50 border-stone-200 focus:bg-white transition-colors resize-none"
                                        placeholder="O co chcesz zapytać?"
                                    />
                                    {errors.message && (
                                        <p className="text-xs text-red-500 mt-1 font-medium">{errors.message.message}</p>
                                    )}
                                </div>

                                <div className="space-y-4 pt-4 border-t bg-stone-50/50 p-4 rounded-xl border">
                                    <div className="flex items-start gap-3">
                                        <Checkbox
                                            id="consentPrivacy"
                                            className="mt-1"
                                            onCheckedChange={(v) => setValue('consentPrivacy', v === true)}
                                        />
                                        <Label htmlFor="consentPrivacy" className="font-normal text-[11px] leading-relaxed cursor-pointer text-gray-500">
                                            Oświadczam, że zapoznałem się z Regulaminem oraz Polityką Prywatności i akceptuję ich postanowienia. Wyrażam zgodę na przetwarzanie moich danych osobowych w celu obsługi zapytania. *
                                        </Label>
                                    </div>
                                    {errors.consentPrivacy && (
                                        <p className="text-[10px] text-red-500 font-bold uppercase ml-7">Pole wymagane</p>
                                    )}

                                    <div className="flex items-start gap-3">
                                        <Checkbox
                                            id="consentMarketing"
                                            className="mt-1"
                                            onCheckedChange={(v) => setValue('consentMarketing', v === true)}
                                        />
                                        <Label htmlFor="consentMarketing" className="font-normal text-[11px] leading-relaxed cursor-pointer text-gray-500">
                                            Wyrażam zgodę na otrzymywanie informacji handlowych drogą elektroniczną (marketing bezpośredni) dotyczących ofert najmu i finansowania pojazdów. *
                                        </Label>
                                    </div>
                                    {errors.consentMarketing && (
                                        <p className="text-[10px] text-red-500 font-bold uppercase ml-7">Pole wymagane</p>
                                    )}
                                </div>

                                <Turnstile onVerify={setTurnstileToken} />

                                {status === 'error' && (
                                    <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">
                                        <AlertCircle className="h-5 w-5" />
                                        <span>Wystąpił błąd podczas wysyłania zgłoszenia. Spróbuj ponownie później.</span>
                                    </div>
                                )}

                                <Button
                                    type="submit"
                                    variant="hero"
                                    size="xl"
                                    className="w-full shadow-xl shadow-accent/20 text-md font-bold h-14"
                                    disabled={status === 'loading'}
                                >
                                    {status === 'loading' ? (
                                        <>
                                            <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                            Wysyłanie...
                                        </>
                                    ) : (
                                        'Wyślij zapytanie o najem'
                                    )}
                                </Button>

                                <p className="text-center text-[10px] text-gray-500 mt-4 italic">
                                    * Pola wymagane
                                </p>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}
