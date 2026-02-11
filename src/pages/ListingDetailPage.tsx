import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ChevronRight, Phone, MessageSquare, MapPin, Star, ArrowLeft, ShieldCheck, BadgeCheck, Users, Banknote } from 'lucide-react';
import { Header } from '@/components/Header';
import { ImageGallery } from '@/components/ImageGallery';
import { SpecsGrid } from '@/components/SpecsGrid';
import { SpecificationsTable } from '@/components/SpecificationsTable';
import { EquipmentDisplay } from '@/components/EquipmentDisplay';
import { MarkdownText } from '@/components/MarkdownText';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from '@/components/ui/separator';
import { useListing } from '@/hooks/useListings';
import { useAppSettings } from '@/hooks/useAppSettings';
import { usePriceSettings } from '@/contexts/PriceSettingsContext';
import { useSpecialOffer } from '@/contexts/SpecialOfferContext';
import { useAuth } from '@/contexts/AuthContext';
import { listingsApi, faqApi } from '@/services/api';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import { FinancingCalculator } from '@/components/FinancingCalculator';
import { SpecialOfferTag } from '@/components/SpecialOfferTag';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/utils/formatters';
import { applySpecialOfferDiscount } from '@/utils/specialOffer';
import { getListingUrlPath } from '@/utils/url-utils';
import type { FaqEntry } from '@/types/faq';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { AlertTriangle } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { PartnerSidebarAd } from '@/components/ads/PartnerSidebarAd';
import { usePartnerAds } from '@/hooks/usePartnerAds';

import { MetaHead } from '@/components/seo/MetaHead';
import { useSeoConfig } from '@/components/seo/SeoManager';

export default function ListingDetailPage() {
  const { id, slug } = useParams<{ id?: string; slug?: string }>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, token } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'manager';

  // Use slug if available (new URL format), otherwise fall back to id (legacy format)
  const listingIdentifier = slug || id;
  const { data, isLoading } = useListing(listingIdentifier);
  const { data: adsData } = usePartnerAds('DETAIL_SIDEBAR');
  const sidebarAds = adsData?.ads || [];
  const { data: settings } = useAppSettings();
  const { data: seoConfig } = useSeoConfig();
  const { priceType } = usePriceSettings();
  const { discount, hasSpecialOffer } = useSpecialOffer();
  const listing = data?.listing;

  // Store search parameters for return navigation
  const [searchParams, setSearchParams] = React.useState<string>('');

  React.useEffect(() => {
    // Check if there are search parameters in the current URL (from search page)
    const urlSearchParams = new URLSearchParams(window.location.search);
    if (urlSearchParams.toString()) {
      setSearchParams(urlSearchParams.toString());
    } else {
      // If no search params in URL, try to get from sessionStorage
      const stored = sessionStorage.getItem('searchParams');
      if (stored) {
        setSearchParams(stored);
      }
    }
  }, []);

  const [refreshing, setRefreshing] = React.useState(false);
  const [showArchiveModal, setShowArchiveModal] = React.useState(false);
  const autoRefreshTriggered = React.useRef(false);

  const { data: faqData } = useQuery({
    queryKey: ['faq', 'offers'],
    queryFn: () => faqApi.list({ page: 'offers' }),
    staleTime: 5 * 60 * 1000
  });

  const handleRefreshImages = React.useCallback(async () => {
    if (!id || !token) return;

    try {
      setRefreshing(true);
      await listingsApi.refreshImages(id, token);
      await queryClient.invalidateQueries({ queryKey: ['listing', id] });
      await queryClient.invalidateQueries({ queryKey: ['listings'] });
      toast.success('Zdjęcia zostały zaktualizowane');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('Auto-archived')) {
        setShowArchiveModal(true);
      } else {
        toast.error(message || 'Błąd podczas odświeżania zdjęć');
      }
    } finally {
      setRefreshing(false);
    }
  }, [id, queryClient, token]);

  const handleAutoRefreshImages = React.useCallback(async () => {
    if (!id) return;

    try {
      // For auto-refresh, we don't show loading state or toast notifications
      await listingsApi.refreshImages(id, token);
      await queryClient.invalidateQueries({ queryKey: ['listing', id] });
      await queryClient.invalidateQueries({ queryKey: ['listings'] });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('Auto-archived')) {
        setShowArchiveModal(true);
      }
      // Don't show error toast for auto-refresh to avoid disturbing users
    }
  }, [id, queryClient, token]);

  // Auto-check images and refresh if broken (when enabled in settings)
  React.useEffect(() => {
    if (!listing || !settings?.autoRefreshImages) return;
    if (autoRefreshTriggered.current) return;

    const urls = listing.image_urls || [];
    if (urls.length === 0) return;

    const checkImages = async () => {
      let failed = 0;
      await Promise.all(
        urls.map((url) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            const timer = setTimeout(() => {
              failed++;
              resolve();
            }, 4000);
            img.onload = () => {
              clearTimeout(timer);
              resolve();
            };
            img.onerror = () => {
              clearTimeout(timer);
              failed++;
              resolve();
            };
            img.src = url;
          })
        )
      );

      if (failed > 0) {
        autoRefreshTriggered.current = true;
        await handleAutoRefreshImages();
      }
    };

    checkImages();
  }, [listing, settings?.autoRefreshImages, handleAutoRefreshImages]);

  const priceInfo = React.useMemo(() => {
    if (!listing) return { primaryLabel: '', secondaryLabel: null };
    const currency = settings?.displayCurrency || 'PLN';
    let basePrice = 0;

    if (currency === 'EUR' && listing.broker_price_eur) {
      basePrice = listing.broker_price_eur;
    } else if (listing.broker_price_pln) {
      basePrice = listing.broker_price_pln;
    }

    if (basePrice === 0 && currency === 'PLN' && listing.price_pln) {
      basePrice = listing.price_pln;
    }

    if (basePrice > 0) {
      const discountedPrice = applySpecialOfferDiscount(basePrice, discount);
      const isNetPrimary = priceType === 'net';
      const primaryPrice = isNetPrimary ? Math.round(discountedPrice / 1.23) : discountedPrice;
      const secondaryPrice = isNetPrimary ? discountedPrice : Math.round(discountedPrice / 1.23);

      const primaryLabel = formatPrice(primaryPrice, currency);
      const secondaryLabel = user
        ? (isNetPrimary
          ? `(${t('listing.gross')}: ${formatPrice(secondaryPrice, currency)})`
          : `(${t('listing.net')}: ${formatPrice(secondaryPrice, currency)})`)
        : null;

      return { primaryLabel, secondaryLabel };
    }

    return { primaryLabel: listing.price_display, secondaryLabel: null };
  }, [listing, settings, priceType, t, discount]);

  const faqs = React.useMemo(() => {
    const entries = (faqData?.entries || []) as FaqEntry[];
    return entries
      .filter((entry) => entry.isPublished)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [faqData]);

  const getLocalizedQA = (entry: FaqEntry) => {
    const lang = (i18n.language || 'pl').slice(0, 2);
    switch (lang) {
      case 'en':
        return { question: entry.questionEn, answer: entry.answerEn };
      case 'de':
        return { question: entry.questionDe, answer: entry.answerDe };
      default:
        return { question: entry.questionPl, answer: entry.answerPl };
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-16 flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (!listing || (listing.is_archived && !canManage)) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-24 text-center max-w-2xl mx-auto space-y-6">
          <div className="bg-destructive/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold font-heading text-foreground">
            {t('detail.notFoundTitle')}
          </h1>
          <p className="text-lg text-muted-foreground">
            {t('detail.notFoundDescription')}
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link to="/">{t('detail.backToResults')}</Link>
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  const title = `${listing.make} ${listing.model} ${listing.version}`;
  const discountedListingPrice = applySpecialOfferDiscount(listing.price_pln, discount);

  const lang = i18n.language;
  const suffix = lang === 'pl' ? '' : lang === 'en' ? 'En' : 'De';

  // Prepare SEO values
  const listingTitleTemplate = (seoConfig ? (seoConfig as any)[`listingTitle${suffix}`] : undefined) || seoConfig?.listingTitle;
  const listingDescriptionTemplate = (seoConfig ? (seoConfig as any)[`listingDescription${suffix}`] : undefined) || seoConfig?.listingDescription;

  const metaTitle = listing && listingTitleTemplate
    ? listingTitleTemplate
      .replace('{{make}}', listing.make)
      .replace('{{model}}', listing.model)
      .replace('{{year}}', listing.production_year.toString())
      .replace('{{price}}', formatPrice(discountedListingPrice, 'PLN'))
      .replace('{{fuel}}', listing.fuel_type || '')
    : title;

  const metaDesc = listing && listingDescriptionTemplate
    ? listingDescriptionTemplate
      .replace('{{make}}', listing.make)
      .replace('{{model}}', listing.model)
      .replace('{{year}}', listing.production_year.toString())
      .replace('{{price}}', formatPrice(discountedListingPrice, 'PLN'))
      .replace('{{fuel}}', listing.fuel_type || '')
    : '';

  // Prepare Schema.org
  const schema = listing ? {
    "@context": "https://schema.org/",
    "@type": "Car",
    "name": title,
    "image": listing.primary_image_url || listing.image_urls?.[0],
    "description": metaDesc,
    "brand": {
      "@type": "Brand",
      "name": listing.make
    },
    "model": listing.model,
    "vehicleModelDate": listing.production_year,
    "mileageFromOdometer": {
      "@type": "QuantitativeValue",
      "value": listing.mileage_km,
      "unitCode": "KMT"
    },
    "vehicleEngine": {
      "@type": "EngineSpecification",
      "fuelType": listing.fuel_type
    },
    "offers": {
      "@type": "Offer",
      "url": window.location.href,
      "priceCurrency": "PLN",
      "price": discountedListingPrice,
      "itemCondition": "https://schema.org/UsedCondition",
      "availability": "https://schema.org/InStock"
    }
  } : undefined;

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      {listing && (
        <MetaHead
          title={metaTitle}
          description={metaDesc}
          image={listing.primary_image_url || listing.image_urls?.[0]}
          schema={schema}
        />
      )}
      <Header />

      <main className="container py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:text-foreground transition-colors">
            {t('nav.search')}
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span>{listing.make}</span>
          <ChevronRight className="h-4 w-4" />
          <span>{listing.model}</span>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">{listing.version}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Gallery */}
            <ImageGallery images={listing.image_urls} title={title} />

            {/* Title & Price - Mobile */}
            <div className="lg:hidden">
              <h1 className="font-heading text-2xl font-bold text-foreground">{title}</h1>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex flex-col md:flex-row md:items-baseline md:gap-3 mt-2">
                  <span className="font-heading text-3xl font-bold text-accent">
                    {priceInfo.primaryLabel}
                  </span>
                  {priceInfo.secondaryLabel && (
                    <span className="text-sm text-muted-foreground font-medium">
                      {priceInfo.secondaryLabel}
                    </span>
                  )}
                  {hasSpecialOffer && (
                    <SpecialOfferTag className="mt-2 md:mt-0" />
                  )}
                </div>
              </div>
            </div>

            {/* Key Parameters */}
            <section>
              <h2 className="font-heading text-xl font-semibold mb-4">{t('detail.keyParameters')}</h2>
              <SpecsGrid
                year={listing.production_year}
                mileage={listing.mileage_km}
                fuelType={listing.fuel_type}
                transmission={listing.transmission}
                drive={listing.drive}
                power={listing.engine_power_hp}
                capacity={listing.engine_capacity_cm3}
                bodyType={listing.body_type}
              />
            </section>

            <Separator />

            {/* Specifications */}
            <section>
              <h2 className="font-heading text-xl font-semibold mb-4">{t('detail.specifications')}</h2>
              <SpecificationsTable specifications={listing.specifications} />
            </section>

            {/* Equipment */}
            <section>
              <h2 className="font-heading text-xl font-semibold mb-4">{t('detail.equipment')}</h2>
              <EquipmentDisplay equipment={listing.equipment} />
            </section>

            <Separator />

            {/* Financing Calculator - Main Content area (Always visible on mobile, conditional on desktop) */}
            {(settings?.financingCalculatorEnabled ?? true) && (
              <section className={cn(settings?.financingCalculatorLocation === 'sidebar' && "lg:hidden")}>
                <FinancingCalculator
                  listingId={listing.listing_id}
                  price={applySpecialOfferDiscount(
                    priceType === 'net' ? (listing.dealer_price_net_pln || listing.price_pln) : (listing.broker_price_pln || listing.price_pln),
                    discount
                  )}
                  currency={settings?.displayCurrency || 'PLN'}
                  manufacturingYear={listing.production_year}
                  mileageKm={listing.mileage_km}
                />
              </section>
            )}

            {/* Mobile Partner Ad */}
            <div className="lg:hidden">
              {sidebarAds.filter(a => a.isActive).map(ad => (
                <PartnerSidebarAd
                  key={ad.id}
                  title={(ad as any)[`title${suffix}`] || ad.title}
                  description={(ad as any)[`description${suffix}`] || ad.description || ''}
                  ctaText={(ad as any)[`ctaText${suffix}`] || ad.ctaText}
                  url={ad.url}
                  brandName={ad.brandName}
                  imageUrl={ad.imageUrl}
                  features={ad.features}
                  overlayOpacity={ad.overlayOpacity}
                  hideUiElements={ad.hideUiElements}
                  className="my-6"
                />
              ))}
            </div>

            <Separator />

            {/* Why Us */}
            <section className="rounded-2xl border border-border bg-card/60 p-6 shadow-card space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('detail.whyUs.overline')}</p>
                <h2 className="font-heading text-xl font-semibold text-foreground">
                  {t('detail.whyUs.title')}
                </h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3 rounded-xl bg-background/70 p-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">{t('detail.whyUs.item1.title')}</p>
                    <p className="text-sm text-muted-foreground">{t('detail.whyUs.item1.description')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-background/70 p-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
                    <BadgeCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">{t('detail.whyUs.item2.title')}</p>
                    <p className="text-sm text-muted-foreground">{t('detail.whyUs.item2.description')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-background/70 p-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
                    <Users className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">{t('detail.whyUs.item3.title')}</p>
                    <p className="text-sm text-muted-foreground">{t('detail.whyUs.item3.description')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-background/70 p-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
                    <Banknote className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">{t('detail.whyUs.item4.title')}</p>
                    <p className="text-sm text-muted-foreground">{t('detail.whyUs.item4.description')}</p>
                  </div>
                </div>
              </div>
            </section>

            <Separator />

            {/* FAQ */}
            {faqs.length > 0 && (
              <section className="space-y-3">
                <h2 className="font-heading text-xl font-semibold">{t('nav.faq', 'FAQ')}</h2>
                <div className="space-y-3">
                  <Accordion type="multiple" className="w-full space-y-3">
                    {faqs.map((faq) => {
                      const { question, answer } = getLocalizedQA(faq);
                      return (
                        <AccordionItem
                          key={faq.id}
                          value={faq.id}
                          className="rounded-lg border border-border bg-card shadow-sm px-4"
                        >
                          <AccordionTrigger className="text-lg font-semibold text-foreground hover:no-underline text-left py-4">
                            {question}
                          </AccordionTrigger>
                          <AccordionContent className="pb-4 text-muted-foreground whitespace-pre-line">
                            <MarkdownText text={answer} />
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="hidden lg:block">
            <div className="sticky top-20 space-y-6">
              {/* Price Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card rounded-xl shadow-card p-6 space-y-4"
              >
                <h1 className="font-heading text-xl font-bold text-foreground">{title}</h1>
                <div className="flex flex-col gap-1 items-start">
                  <div className="flex items-center gap-2">
                    <span className="font-heading text-3xl font-bold text-accent">
                      {priceInfo.primaryLabel}
                    </span>
                    {hasSpecialOffer && (
                      <SpecialOfferTag />
                    )}
                  </div>
                  {priceInfo.secondaryLabel && (
                    <span className="text-sm text-muted-foreground font-medium">
                      {priceInfo.secondaryLabel}
                    </span>
                  )}
                </div>

                <div className="space-y-3 pt-2">
                  <Button asChild variant="hero" className="w-full" size="lg">
                    <Link to={`${getListingUrlPath({
                      id: listing.listing_id,
                      make: listing.make,
                      model: listing.model,
                      version: listing.version,
                      productionYear: listing.production_year,
                      bodyType: listing.body_type,
                      fuelType: listing.fuel_type
                    })}/lead`}>
                      <MessageSquare className="h-5 w-5" />
                      {t('detail.askAbout')}
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    size="lg"
                    onClick={() => window.open(`tel:${listing.contact_phone}`)}
                  >
                    <Phone className="h-5 w-5" />
                    {t('detail.call')}
                  </Button>
                </div>

                {canManage && (
                  <div className="pt-2 border-t mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 text-xs"
                      onClick={handleRefreshImages}
                      disabled={refreshing}
                    >
                      <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
                      {refreshing ? 'Odświeżanie...' : 'Odśwież zdjęcia (Admin)'}
                    </Button>
                  </div>
                )}
              </motion.div>

              {/* Financing Calculator - Sidebar Widget */}
              {(settings?.financingCalculatorEnabled ?? true) && settings?.financingCalculatorLocation === 'sidebar' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <FinancingCalculator
                    listingId={listing.listing_id}
                    price={applySpecialOfferDiscount(
                      priceType === 'net' ? (listing.dealer_price_net_pln || listing.price_pln) : (listing.broker_price_pln || listing.price_pln),
                      discount
                    )}
                    currency={settings?.displayCurrency || 'PLN'}
                    manufacturingYear={listing.production_year}
                    mileageKm={listing.mileage_km}
                  />
                </motion.div>
              )}

              {/* Sidebar Ad Placement */}
              {sidebarAds.filter(a => a.isActive).map(ad => (
                <PartnerSidebarAd
                  key={ad.id}
                  title={(ad as any)[`title${suffix}`] || ad.title}
                  description={(ad as any)[`description${suffix}`] || ad.description || ''}
                  ctaText={(ad as any)[`ctaText${suffix}`] || ad.ctaText}
                  url={ad.url}
                  brandName={ad.brandName}
                  imageUrl={ad.imageUrl}
                  features={ad.features}
                  overlayOpacity={ad.overlayOpacity}
                  hideUiElements={ad.hideUiElements}
                />
              ))}

              {/* Dealer Card */}
              {canManage && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-card rounded-xl shadow-card p-6 space-y-4"
                >
                  <h3 className="font-heading font-semibold">{t('detail.dealerInfo')}</h3>
                  <div>
                    <p className="font-medium text-foreground">{listing.dealer_name}</p>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <MapPin className="h-4 w-4" />
                      <span>{listing.dealer_address_line1}, {listing.dealer_city}</span>
                    </div>
                  </div>
                  {listing.google_rating && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-warning">
                        <Star className="h-4 w-4 fill-current" />
                        <span className="font-medium">{listing.google_rating}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        ({listing.google_reviews_count} opinii)
                      </span>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* Mobile Sticky CTA */}
      <div className="sticky-cta">
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={() => window.open(`tel:${listing.contact_phone}`)}
          >
            <Phone className="h-5 w-5" />
            {t('detail.call')}
          </Button>
          <Button asChild variant="hero" size="lg" className="flex-1">
            <Link to={`${getListingUrlPath({
              id: listing.listing_id,
              make: listing.make,
              model: listing.model,
              version: listing.version,
              productionYear: listing.production_year,
              bodyType: listing.body_type,
              fuelType: listing.fuel_type
            })}/lead`}>
              {t('detail.sendInquiry')}
            </Link>
          </Button>
        </div>
      </div>

      <Dialog open={showArchiveModal} onOpenChange={setShowArchiveModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-destructive/10 rounded-full">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <DialogTitle className="text-xl">{t('detail.archivedTitle')}</DialogTitle>
            </div>
            <DialogDescription className="text-base pt-2">
              {t('detail.archivedDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6">
            <Button
              onClick={() => {
                const targetUrl = searchParams ? `/?${searchParams}` : '/';
                navigate(targetUrl);
              }}
              className="w-full gap-2"
              size="lg"
            >
              {t('detail.returnToSearch')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
