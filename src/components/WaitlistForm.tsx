import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Turnstile } from '@/components/Turnstile';
import { leadsApi } from '@/services/api';

const phoneRegex = /^(\+48\s?)?[1-9]\d{2}[\s-]?\d{3}[\s-]?\d{3}$/;

const waitlistSchema = z.object({
  name: z.string().min(2, 'validation.required').max(100),
  email: z.string().email('validation.invalidEmail'),
  phone: z.string().optional().refine((val) => !val || phoneRegex.test(val), {
    message: 'validation.invalidPhone',
  }),
  consentMarketing: z.boolean().refine((v) => v === true, 'validation.required'),
  consentPrivacy: z.boolean().refine((v) => v === true, 'validation.required'),
});

type WaitlistFormData = z.infer<typeof waitlistSchema>;

interface WaitlistFormProps {
  make: string;
  model?: string;
}

// Formularz listy oczekujących na stronach marki/modelu bez aktywnych ofert (F3, spec §1).
// Pola wg najprostszej istniejącej konwencji formularzy leadowych (LeadFormPage/RentalLeadFormPage):
// imię, e-mail, telefon (opcjonalnie), zgody, Turnstile — bez pola wiadomości (marka/model
// wystarczą do otagowania leada, treść wiadomości budowana jest po stronie backendu).
export function WaitlistForm({ make, model }: WaitlistFormProps) {
  const { t } = useTranslation();
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [turnstileToken, setTurnstileToken] = React.useState('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<WaitlistFormData>({
    resolver: zodResolver(waitlistSchema),
    defaultValues: { consentMarketing: false, consentPrivacy: false },
  });

  const onSubmit = async (formData: WaitlistFormData) => {
    setStatus('loading');
    try {
      await leadsApi.submitWaitlistLead({
        make,
        model,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        consentMarketing: formData.consentMarketing,
        consentPrivacy: formData.consentPrivacy,
        turnstileToken,
      });
      setStatus('success');
    } catch (e) {
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="max-w-md mx-auto text-center py-8">
        <CheckCircle className="h-10 w-10 text-success mx-auto mb-3" />
        <p className="font-semibold text-foreground">{t('waitlist.successTitle', 'Dziękujemy!')}</p>
        <p className="text-sm text-muted-foreground mt-1">
          {t('waitlist.successMessage', 'Zgłoszenie przyjęte — damy Ci znać, gdy pojawi się taka oferta.')}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-md mx-auto space-y-4 text-left">
      <p className="text-sm text-muted-foreground text-center">
        {t('waitlist.prompt', 'Zostaw nam swoje dane, a damy Ci znać, jak pojawi się taka oferta w naszym serwisie.')}
      </p>

      <div className="space-y-2">
        <Label htmlFor="waitlist-name">{t('lead.name', 'Imię i nazwisko')} *</Label>
        <Input id="waitlist-name" {...register('name')} placeholder={t('lead.namePlaceholder', 'np. Jan Kowalski')} />
        {errors.name && <p className="text-xs text-destructive mt-1">{t(errors.name.message || '')}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="waitlist-email">{t('lead.email', 'Adres e-mail')} *</Label>
        <Input id="waitlist-email" type="email" {...register('email')} placeholder={t('lead.emailPlaceholder', 'jan@example.pl')} />
        {errors.email && <p className="text-xs text-destructive mt-1">{t(errors.email.message || '')}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="waitlist-phone">{t('lead.phone', 'Numer telefonu')}</Label>
        <Input id="waitlist-phone" {...register('phone')} placeholder="+48 000 000 000" />
        {errors.phone && <p className="text-xs text-destructive mt-1">{t(errors.phone.message || '')}</p>}
      </div>

      <div className="space-y-3 pt-3 border-t">
        <div className="flex items-start gap-3">
          <Checkbox
            id="waitlist-consentPrivacy"
            className="mt-1"
            onCheckedChange={(v) => setValue('consentPrivacy', v === true)}
          />
          <Label htmlFor="waitlist-consentPrivacy" className="font-normal text-xs leading-relaxed cursor-pointer text-muted-foreground">
            {t('lead.consentPrivacy', 'Oświadczam, że zapoznałem się z Regulaminem oraz Polityką Prywatności i akceptuję ich postanowienia. Wyrażam zgodę na przetwarzanie moich danych osobowych w celu obsługi zapytania.')} *
          </Label>
        </div>
        {errors.consentPrivacy && (
          <p className="text-overline text-destructive font-bold uppercase ml-7">{t('validation.required')}</p>
        )}

        <div className="flex items-start gap-3">
          <Checkbox
            id="waitlist-consentMarketing"
            className="mt-1"
            onCheckedChange={(v) => setValue('consentMarketing', v === true)}
          />
          <Label htmlFor="waitlist-consentMarketing" className="font-normal text-xs leading-relaxed cursor-pointer text-muted-foreground">
            {t('lead.consentMarketing', 'Wyrażam zgodę na otrzymywanie informacji handlowych drogą elektroniczną (marketing bezpośredni) dotyczących ofert finansowania i ubezpieczeń.')} *
          </Label>
        </div>
        {errors.consentMarketing && (
          <p className="text-overline text-destructive font-bold uppercase ml-7">{t('validation.required')}</p>
        )}
      </div>

      <Turnstile onVerify={setTurnstileToken} />

      {status === 'error' && (
        <p className="text-sm text-destructive text-center">
          {t('lead.error', 'Wystąpił błąd podczas wysyłania zgłoszenia. Spróbuj ponownie później.')}
        </p>
      )}

      <Button type="submit" variant="hero" className="w-full" disabled={status === 'loading'}>
        {status === 'loading' && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        {t('waitlist.submit', 'Powiadom mnie o nowej ofercie')}
      </Button>
    </form>
  );
}
