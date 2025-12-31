import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle, AlertCircle, Loader2, MessageCircle, ShieldCheck, Zap } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { useListing } from '@/hooks/useListings';
import { useAppSettings } from '@/hooks/useAppSettings';
import { usePriceSettings } from '@/contexts/PriceSettingsContext';
import { InquiryChips } from '@/components/InquiryChips';
import { cn } from '@/lib/utils';
import { formatPrice, formatNumber } from '@/utils/formatters';

const phoneRegex = /^(\+48\s?)?[1-9]\d{2}[\s-]?\d{3}[\s-]?\d{3}$/;

const leadSchema = z.object({
  name: z.string().min(2, 'validation.required').max(100),
  email: z.string().email('validation.invalidEmail'),
  phone: z.string().optional().refine((val) => !val || phoneRegex.test(val), {
    message: 'validation.invalidPhone',
  }),
  preferredContact: z.enum(['email', 'phone']),
  message: z.string().min(10, 'validation.required').max(1000),
  consentMarketing: z.boolean().refine((v) => v === true, 'validation.required'),
  consentPrivacy: z.boolean().refine((v) => v === true, 'validation.required'),
});

type LeadFormData = z.infer<typeof leadSchema>;

export default function LeadFormPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [referenceNumber, setReferenceNumber] = React.useState('');

  const { data, isLoading: isListingLoading } = useListing(id);
  const { data: settingsData } = useAppSettings();
  const { priceType } = usePriceSettings();
  const listing = data?.listing;

  const priceInfo = React.useMemo(() => {
    if (!listing) return { primaryLabel: '', secondaryLabel: null };
    const currency = settingsData?.displayCurrency || 'PLN';
    let basePrice = 0;

    if (currency === 'EUR' && listing.broker_price_eur) {
      basePrice = listing.broker_price_eur;
    } else if (listing.broker_price_pln) {
      basePrice = listing.broker_price_pln;
    }

    if (basePrice > 0) {
      const isNetPrimary = priceType === 'net';
      const primaryPrice = isNetPrimary ? Math.round(basePrice / 1.23) : basePrice;
      const secondaryPrice = isNetPrimary ? basePrice : Math.round(basePrice / 1.23);

      const primaryLabel = formatPrice(primaryPrice, currency);
      const secondaryLabel = isNetPrimary
        ? `(${t('listing.gross')}: ${formatPrice(secondaryPrice, currency)})`
        : `(${t('listing.net')}: ${formatPrice(secondaryPrice, currency)})`;

      return { primaryLabel, secondaryLabel };
    }

    return { primaryLabel: listing.price_display, secondaryLabel: null };
  }, [listing, settingsData, priceType]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      preferredContact: 'email',
      message: '',
      consentMarketing: false,
      consentPrivacy: false,
    },
  });

  const messageValue = watch('message');

  React.useEffect(() => {
    if (listing && !messageValue) {
      setValue('message', t('lead.messageDefault', {
        make: listing.make,
        model: listing.model,
        version: listing.version,
        listingId: listing.listing_id,
      }));
    }
  }, [listing, setValue, t, messageValue]);

  const onSubmit = async (formData: LeadFormData) => {
    setStatus('loading');
    try {
      // Simulate API call to backend/api/leads
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const ref = `AF-${Date.now().toString().slice(-8)}`;
      setReferenceNumber(ref);
      setStatus('success');
    } catch (e) {
      setStatus('error');
    }
  };

  if (isListingLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-32 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground animate-pulse">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-background text-center">
        <Header />
        <div className="container py-24">
          <div className="max-w-md mx-auto space-y-6">
            <h2 className="text-2xl font-bold">{t('empty.noResults')}</h2>
            <Button asChild onClick={() => navigate(-1)}>
              <span>{t('common.back')}</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-stone-50/50">
        <Header />
        <div className="container max-w-lg py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-2xl shadow-xl p-10 text-center space-y-8 border"
          >
            <div className="mx-auto w-20 h-20 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-success" />
            </div>
            <div className="space-y-2">
              <h1 className="font-heading text-3xl font-bold">{t('lead.successTitle', 'Zgłoszenie wysłane!')}</h1>
              <p className="text-muted-foreground">{t('lead.successMessage', 'Dziękujemy za zainteresowanie. Nasz doradca skontaktuje się z Tobą wkrótce.')}</p>
            </div>
            <div className="bg-secondary/30 rounded-xl p-6 border border-dashed border-primary/20">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1 font-semibold">{t('lead.referenceNumber', 'Numer zgłoszenia')}</p>
              <p className="font-heading text-2xl font-black text-primary tracking-tighter">{referenceNumber}</p>
            </div>
            <div className="flex flex-col gap-4">
              <Button asChild variant="hero" size="lg" className="shadow-lg shadow-primary/20">
                <Link to="/">{t('lead.backToResults', 'Wróć do wyszukiwarki')}</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link to={`/listing/${listing.listing_id}`}>{t('lead.backToOffer', 'Wróć do ogłoszenia')}</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50/50">
      <Header />
      <div className="container max-w-5xl py-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-8 gap-2 hover:bg-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </Button>

        <div className="grid gap-10 lg:grid-cols-12">
          {/* Left Side: Offer Summary - Sticky */}
          <div className="lg:col-span-5 order-2 lg:order-1">
            <div className="sticky top-24 space-y-6">
              <div className="bg-card rounded-2xl shadow-sm border overflow-hidden p-6">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                  {t('lead.offerSummary', 'Szczegóły zapytania')}
                </h2>

                <div className="relative aspect-video rounded-xl overflow-hidden mb-4 group">
                  <img
                    src={listing.primary_image_url}
                    alt={`${listing.make} ${listing.model}`}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold shadow-sm border">
                    {listing.production_year}
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-heading text-xl font-bold tracking-tight">
                    {listing.make} {listing.model}
                  </h3>
                  <p className="text-muted-foreground text-sm line-clamp-1">{listing.version}</p>

                  <div className="flex flex-col items-start mt-4">
                    <span className="font-heading text-3xl font-black text-primary tracking-tighter">
                      {priceInfo.primaryLabel}
                    </span>
                    {priceInfo.secondaryLabel && (
                      <span className="text-xs text-muted-foreground font-medium">
                        {priceInfo.secondaryLabel}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-6 border-t mt-6">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">{t('listing.mileage', 'Przebieg')}</p>
                      <p className="font-semibold text-sm">{formatNumber(listing.mileage_km)} km</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">{t('listing.location', 'Lokalizacja')}</p>
                      <p className="font-semibold text-sm line-clamp-1">{listing.dealer_city}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Trust Section */}
              <div className="bg-primary/5 rounded-2xl p-6 space-y-4 border border-primary/10">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center text-primary shadow-sm border">
                    <Zap className="h-5 w-5 fill-current" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">{t('lead.trust.fastResponse', 'Szybka odpowiedź')}</h4>
                    <p className="text-xs text-muted-foreground">{t('lead.trust.averageTime', 'Średni czas odpowiedzi: ~45 minut')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center text-primary shadow-sm border">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">{t('lead.trust.secureTitle', 'Bezpieczny kontakt')}</h4>
                    <p className="text-xs text-muted-foreground">{t('lead.trust.secureDesc', 'Twoje dane są chronione i użyte tylko do tego zapytania.')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Enhanced Form */}
          <div className="lg:col-span-7 order-1 lg:order-2">
            <div className="bg-card rounded-2xl shadow-sm border p-8 lg:p-10">
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <MessageCircle className="h-6 w-6 text-primary" />
                  <h1 className="font-heading text-2xl font-bold tracking-tight">{t('lead.title', 'Napisz do sprzedawcy')}</h1>
                </div>
                <p className="text-muted-foreground">{t('lead.subtitle', 'Zadaj pytanie, umów się na spotkanie lub poproś o ofertę finansowania.')}</p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider">{t('lead.name', 'Imię i nazwisko')} *</Label>
                    <Input
                      id="name"
                      {...register('name')}
                      placeholder={t('lead.namePlaceholder', 'np. Jan Kowalski')}
                      className="bg-stone-50 border-stone-200 focus:bg-white transition-colors"
                    />
                    {errors.name && (
                      <p className="text-xs text-destructive mt-1 font-medium">{t(errors.name.message || '')}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider">{t('lead.email', 'Adres e-mail')} *</Label>
                    <Input
                      id="email"
                      type="email"
                      {...register('email')}
                      placeholder={t('lead.emailPlaceholder', 'jan@example.pl')}
                      className="bg-stone-50 border-stone-200 focus:bg-white transition-colors"
                    />
                    {errors.email && (
                      <p className="text-xs text-destructive mt-1 font-medium">{t(errors.email.message || '')}</p>
                    )}
                  </div>
                </div>

                <div className="grid gap-6 sm:grid-cols-2 items-end">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider">{t('lead.phone', 'Numer telefonu')}</Label>
                    <Input
                      id="phone"
                      {...register('phone')}
                      placeholder="+48 000 000 000"
                      className="bg-stone-50 border-stone-200 focus:bg-white transition-colors"
                    />
                    {errors.phone && (
                      <p className="text-xs text-destructive mt-1 font-medium">{t(errors.phone.message || '')}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider mb-3 block">{t('lead.preferredContact', 'Preferowany kontakt')}</Label>
                    <RadioGroup
                      defaultValue="email"
                      onValueChange={(v) => setValue('preferredContact', v as 'email' | 'phone')}
                      className="flex gap-6 pb-2"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="email" id="contact-email" />
                        <Label htmlFor="contact-email" className="text-sm cursor-pointer">{t('lead.contactEmail', 'E-mail')}</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="phone" id="contact-phone" />
                        <Label htmlFor="contact-phone" className="text-sm cursor-pointer">{t('lead.contactPhone', 'Telefon')}</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t">
                  <Label className="text-xs font-bold uppercase tracking-wider">{t('lead.fastQuestions', 'Szybkie pytania')}</Label>
                  <InquiryChips
                    carName={`${listing.make} ${listing.model}`}
                    onSelect={(msg) => setValue('message', msg, { shouldDirty: true, shouldValidate: true })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message" className="text-xs font-bold uppercase tracking-wider">{t('lead.message', 'Twoja wiadomość')} *</Label>
                  <Textarea
                    id="message"
                    {...register('message')}
                    rows={6}
                    className="bg-stone-50 border-stone-200 focus:bg-white transition-colors resize-none"
                    placeholder={t('lead.messagePlaceholder', 'O co chcesz zapytać?')}
                  />
                  {errors.message && (
                    <p className="text-xs text-destructive mt-1 font-medium">{t(errors.message.message || '')}</p>
                  )}
                </div>

                <div className="space-y-4 pt-4 border-t bg-stone-50/50 p-4 rounded-xl border">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="consentPrivacy"
                      className="mt-1"
                      onCheckedChange={(v) => setValue('consentPrivacy', v === true)}
                    />
                    <Label htmlFor="consentPrivacy" className="font-normal text-[11px] leading-relaxed cursor-pointer text-muted-foreground">
                      {t('lead.consentPrivacy', 'Oświadczam, że zapoznałem się z Regulaminem oraz Polityką Prywatności i akceptuję ich postanowienia. Wyrażam zgodę na przetwarzanie moich danych osobowych w celu obsługi zapytania.')} *
                    </Label>
                  </div>
                  {errors.consentPrivacy && (
                    <p className="text-[10px] text-destructive font-bold uppercase ml-7">{t('validation.required')}</p>
                  )}

                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="consentMarketing"
                      className="mt-1"
                      onCheckedChange={(v) => setValue('consentMarketing', v === true)}
                    />
                    <Label htmlFor="consentMarketing" className="font-normal text-[11px] leading-relaxed cursor-pointer text-muted-foreground">
                      {t('lead.consentMarketing', 'Wyrażam zgodę na otrzymywanie informacji handlowych drogą elektroniczną (marketing bezpośredni) dotyczących ofert finansowania i ubezpieczeń.')} *
                    </Label>
                  </div>
                  {errors.consentMarketing && (
                    <p className="text-[10px] text-destructive font-bold uppercase ml-7">{t('validation.required')}</p>
                  )}
                </div>

                {status === 'error' && (
                  <div className="flex items-center gap-3 p-4 bg-destructive/5 border border-destructive/20 rounded-xl text-destructive text-sm font-medium">
                    <AlertCircle className="h-5 w-5" />
                    <span>{t('lead.error', 'Wystąpił błąd podczas wysyłania zgłoszenia. Spróbuj ponownie później.')}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  variant="hero"
                  size="xl"
                  className="w-full shadow-xl shadow-primary/20 text-md font-bold h-14"
                  disabled={status === 'loading'}
                >
                  {status === 'loading' ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      {t('lead.sending', 'Wysyłanie...')}
                    </>
                  ) : (
                    t('lead.submit', 'Wyślij zapytanie')
                  )}
                </Button>

                <p className="text-center text-[10px] text-muted-foreground mt-4 italic">
                  * Pola oznaczone gwiazdką są wymagane
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
