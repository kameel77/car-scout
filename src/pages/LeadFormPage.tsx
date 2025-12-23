import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
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
import { getListingById } from '@/data/mockData';

const leadSchema = z.object({
  name: z.string().min(2, 'validation.required').max(100),
  email: z.string().email('validation.invalidEmail'),
  phone: z.string().optional(),
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

  const listing = id ? getListingById(id) : undefined;

  const defaultMessage = listing
    ? t('lead.messageDefault', {
        make: listing.make,
        model: listing.model,
        version: listing.version,
        listingId: listing.listing_id,
      })
    : '';

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
      message: defaultMessage,
      consentMarketing: false,
      consentPrivacy: false,
    },
  });

  const onSubmit = async (data: LeadFormData) => {
    setStatus('loading');
    
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    // Generate mock reference number
    const ref = `AF-${Date.now().toString().slice(-8)}`;
    setReferenceNumber(ref);
    setStatus('success');
  };

  if (!listing) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-16 text-center">
          <p className="text-lg">{t('empty.noResults')}</p>
          <Button asChild className="mt-4">
            <Link to="/">{t('common.back')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container max-w-lg py-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-xl shadow-card p-8 text-center space-y-6"
          >
            <div className="mx-auto w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold">{t('lead.successTitle')}</h1>
              <p className="text-muted-foreground mt-2">{t('lead.successMessage')}</p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">{t('lead.referenceNumber')}</p>
              <p className="font-heading text-lg font-bold">{referenceNumber}</p>
            </div>
            <div className="flex flex-col gap-3">
              <Button asChild variant="hero">
                <Link to="/">{t('lead.backToResults')}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to={`/listing/${listing.listing_id}`}>{t('lead.backToOffer')}</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-2xl py-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-6 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </Button>

        <div className="grid gap-6 md:grid-cols-5">
          {/* Offer Summary */}
          <div className="md:col-span-2">
            <div className="bg-card rounded-xl shadow-card p-4 sticky top-20">
              <p className="text-sm text-muted-foreground mb-3">{t('lead.offerSummary')}</p>
              <img
                src={listing.primary_image_url}
                alt={`${listing.make} ${listing.model}`}
                className="w-full aspect-video object-cover rounded-lg mb-3"
              />
              <h3 className="font-heading font-semibold">
                {listing.make} {listing.model}
              </h3>
              <p className="text-sm text-muted-foreground">{listing.version}</p>
              <p className="font-heading text-xl font-bold text-accent mt-2">
                {listing.price_display}
              </p>
              <p className="text-sm text-muted-foreground mt-2">{listing.dealer_name}</p>
            </div>
          </div>

          {/* Form */}
          <div className="md:col-span-3">
            <div className="bg-card rounded-xl shadow-card p-6">
              <h1 className="font-heading text-xl font-bold mb-2">{t('lead.title')}</h1>
              <p className="text-muted-foreground text-sm mb-6">{t('lead.subtitle')}</p>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div>
                  <Label htmlFor="name">{t('lead.name')} *</Label>
                  <Input
                    id="name"
                    {...register('name')}
                    placeholder={t('lead.namePlaceholder')}
                    className="mt-1"
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive mt-1">{t(errors.name.message || '')}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="email">{t('lead.email')} *</Label>
                  <Input
                    id="email"
                    type="email"
                    {...register('email')}
                    placeholder={t('lead.emailPlaceholder')}
                    className="mt-1"
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive mt-1">{t(errors.email.message || '')}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="phone">{t('lead.phone')}</Label>
                  <Input
                    id="phone"
                    {...register('phone')}
                    placeholder={t('lead.phonePlaceholder')}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>{t('lead.preferredContact')}</Label>
                  <RadioGroup
                    defaultValue="email"
                    onValueChange={(v) => setValue('preferredContact', v as 'email' | 'phone')}
                    className="flex gap-4 mt-2"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="email" id="contact-email" />
                      <Label htmlFor="contact-email" className="font-normal cursor-pointer">
                        {t('lead.contactEmail')}
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="phone" id="contact-phone" />
                      <Label htmlFor="contact-phone" className="font-normal cursor-pointer">
                        {t('lead.contactPhone')}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label htmlFor="message">{t('lead.message')} *</Label>
                  <Textarea
                    id="message"
                    {...register('message')}
                    rows={4}
                    className="mt-1"
                  />
                  {errors.message && (
                    <p className="text-sm text-destructive mt-1">{t(errors.message.message || '')}</p>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="consentMarketing"
                      onCheckedChange={(v) => setValue('consentMarketing', v === true)}
                    />
                    <Label htmlFor="consentMarketing" className="font-normal text-sm cursor-pointer">
                      {t('lead.consentMarketing')} *
                    </Label>
                  </div>
                  {errors.consentMarketing && (
                    <p className="text-sm text-destructive">{t('validation.required')}</p>
                  )}

                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="consentPrivacy"
                      onCheckedChange={(v) => setValue('consentPrivacy', v === true)}
                    />
                    <Label htmlFor="consentPrivacy" className="font-normal text-sm cursor-pointer">
                      {t('lead.consentPrivacy')} *
                    </Label>
                  </div>
                  {errors.consentPrivacy && (
                    <p className="text-sm text-destructive">{t('validation.required')}</p>
                  )}
                </div>

                {status === 'error' && (
                  <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-destructive text-sm">
                    <AlertCircle className="h-4 w-4" />
                    <span>{t('lead.error')}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  variant="hero"
                  size="lg"
                  className="w-full"
                  disabled={status === 'loading'}
                >
                  {status === 'loading' ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      {t('lead.sending')}
                    </>
                  ) : (
                    t('lead.submit')
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
