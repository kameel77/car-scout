import React from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Phone, MessageSquare, MapPin, Star, ArrowLeft, ShieldCheck, BadgeCheck, Users, Banknote, HandCoins, Info, FileDown, Mail } from 'lucide-react';
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
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { useListing } from '@/hooks/useListings';
import { useAppSettings } from '@/hooks/useAppSettings';
import { usePriceSettings } from '@/contexts/PriceSettingsContext';
import { useSpecialOffer } from '@/contexts/SpecialOfferContext';
import { useAuth } from '@/contexts/AuthContext';
import { listingsApi, faqApi } from '@/services/api';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import { FinancingCalculator, type CalculatorFinancingConfig } from '@/components/FinancingCalculator';
import { isLeasingEligibleByAge } from '@/utils/financingEligibility';
import { getFinancingBasePrice, getDisplayPrice } from '@/utils/listingPrice';
import { DynamicFinancingContent } from '@/components/DynamicFinancingContent';
import { SpecialOfferTag } from '@/components/SpecialOfferTag';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { formatPrice, formatNumber, formatPhoneForTelLink } from '@/utils/formatters';
import { trackPhoneClick, trackViewItem, trackViewArchivedItem } from '@/lib/analytics';
import { applySpecialOfferDiscount } from '@/utils/specialOffer';
import { getListingUrlPath, getFinancingTypeFromPath, getFinancingLabel, getFinancingSeoLabel, getFinancingMetaTitle, getFinancingMetaDescription, type FinancingType } from '@/utils/url-utils';
import type { FaqEntry } from '@/types/faq';
import { CallbackForm } from '@/components/CallbackForm';
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
import { PurchaseProcessStepper } from '@/components/PurchaseProcessStepper';
import { CustomerTypeToggle } from '@/components/CustomerTypeToggle';
import { useBrand } from '@/contexts/BrandContext';

import { MetaHead } from '@/components/seo/MetaHead';
import { useSeoConfig } from '@/components/seo/SeoManager';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ListingCard } from '@/components/ListingCard';
import { mapBackendListingToFrontend } from '@/utils/listingMapper';
import { slugifyBrandName } from '@/utils/brand-slug';

export default function ListingDetailPage() {
  const { id, slug } = useParams<{ id?: string; slug?: string }>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user, token, isPlatformUser, can } = useAuth();
  const canManage = can('stock:write');

  const financingType = getFinancingTypeFromPath(location.pathname);

  // Use slug if available (new URL format), otherwise fall back to id (legacy format)
  const listingIdentifier = slug || id;

  const { data, isLoading } = useListing(listingIdentifier);
  const { data: adsData } = usePartnerAds('DETAIL_SIDEBAR', 'offers');
  const sidebarAds = adsData?.ads || [];
  const { data: belowEquipmentAdsData } = usePartnerAds('DETAIL_BELOW_EQUIPMENT', 'offers');
  const belowEquipmentAds = belowEquipmentAdsData?.ads || [];
  const { data: settings } = useAppSettings();
  const { data: seoConfig } = useSeoConfig();
  const { priceType } = usePriceSettings();
  const { discount, initialPayment, hasSpecialOffer } = useSpecialOffer();
  const listing = data?.listing;
  const { config } = useBrand();
  const isMotolia = config.id === 'motolia';

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

  const isRecentlySold = Boolean(data?.isRecentlySold ?? listing?.is_archived);

  React.useEffect(() => {
    if (listing) {
      const itemPayload = {
        id: String(listing.listing_id),
        name: `${listing.make} ${listing.model} ${listing.version || ''}`.trim(),
        make: listing.make,
        model: listing.model,
        price: listing.price_pln,
        monthlyRate: getFinancingBasePrice(listing, financingType),
        financingType: financingType || 'leasing',
      };

      if (isRecentlySold) {
        trackViewArchivedItem(itemPayload);
      } else {
        trackViewItem(itemPayload);
      }
    }
  }, [listing?.listing_id, financingType, isRecentlySold]);

  const [refreshing, setRefreshing] = React.useState(false);
  const [showArchiveModal, setShowArchiveModal] = React.useState(false);
  // Ostatnia konfiguracja kalkulatora — każde CTA „Zapytaj/Wyślij zapytanie” przenosi ją do formularza.
  const [financingConfig, setFinancingConfig] = React.useState<CalculatorFinancingConfig | null>(null);
  const autoRefreshTriggered = React.useRef(false);

  // Reset auto-refresh flag when navigating between listings within the same route (SPA navigation doesn't remount)
  React.useEffect(() => {
    autoRefreshTriggered.current = false;
  }, [listingIdentifier]);

  const { data: faqData } = useQuery({
    queryKey: ['faq', 'offers', financingType],
    queryFn: () => faqApi.list({ 
      page: 'offers', 
      pageContext: 'offers', 
      financingType: financingType !== 'gotowka' ? financingType : undefined 
    }),
    staleTime: 5 * 60 * 1000
  });

  const handleRefreshImages = React.useCallback(async () => {
    const listingDbId = listing?.listing_id;
    if (!listingDbId || !token) return;

    try {
      setRefreshing(true);
      await listingsApi.refreshImages(listingDbId, token);
      await queryClient.invalidateQueries({ queryKey: ['listing', listingIdentifier] });
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
  }, [listing?.listing_id, listingIdentifier, queryClient, token]);

  const handleAutoRefreshImages = React.useCallback(async () => {
    const listingDbId = listing?.listing_id;
    if (!listingDbId) return;

    try {
      // For auto-refresh, we don't show loading state or toast notifications
      await listingsApi.refreshImages(listingDbId, token);
      await queryClient.invalidateQueries({ queryKey: ['listing', listingIdentifier] });
      await queryClient.invalidateQueries({ queryKey: ['listings'] });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('Auto-archived')) {
        setShowArchiveModal(true);
      }
      // Don't show error toast for auto-refresh to avoid disturbing users
    }
  }, [listing?.listing_id, listingIdentifier, queryClient, token]);

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

    // Cena główna ("Cena pojazdu") = cena sprzedaży (gotówkowa) = price_pln + rabat Motolia, dla PLN. EUR pozostaje na broker_price_eur (osobny follow-up).
    if (currency === 'EUR') {
      basePrice = listing.broker_price_eur || 0;
    } else if (listing.price_pln) {
      basePrice = getDisplayPrice(listing);
    }

    if (basePrice > 0) {
      const discountedPrice = applySpecialOfferDiscount(basePrice, discount);
      const isNetPrimary = priceType === 'net';
      const primaryPrice = isNetPrimary ? (listing.vatMargin ? discountedPrice : Math.round(discountedPrice / 1.23)) : discountedPrice;
      const secondaryPrice = isNetPrimary ? discountedPrice : (listing.vatMargin ? discountedPrice : Math.round(discountedPrice / 1.23));

      const primaryLabel = formatPrice(primaryPrice, currency);
      // user requested to hide net price in special offer context if it was "wrong"
      // or simply: if we are in special offer mode, let's simplify the display?
      // actually, let's just make sure we don't display it if it's confusing.
      // The user said "błędnie dodałeś ceny netto". 
      // Current logic:
      // const secondaryLabel = user
      //   ? (isNetPrimary
      //       ? `(${t('listing.gross')}: ${formatPrice(secondaryPrice, currency)})`
      //       : `(${t('listing.net')}: ${formatPrice(secondaryPrice, currency)})`)
      //   : null;

      // Show alternative price (netto/brutto) for all visitors
      const secondaryLabel = !discount
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

  // Leasing tylko dla aut ≤ 5 lat: wariant /leasing/ starszego auta przekierowujemy na /kredyt/ (canonical i tak /oferta/).
  React.useEffect(() => {
    if (!listing || financingType !== 'leasing' || isLeasingEligibleByAge(listing.production_year)) return;
    navigate(getListingUrlPath({
      id: listing.listing_id,
      make: listing.make,
      model: listing.model,
      version: listing.version,
      productionYear: listing.production_year,
      bodyType: listing.body_type,
      fuelType: listing.fuel_type,
    }, 'kredyt') + location.search, { replace: true });
  }, [listing, financingType, navigate, location.search]);

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

  if (data?.isLongGone) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-24 text-center max-w-2xl mx-auto space-y-6">
          <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Info className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold font-heading text-foreground">
            Ta oferta wygasła i nie jest już dostępna
          </h1>
          <p className="text-lg text-muted-foreground">
            Pojazd został zarchiwizowany. Zapraszamy do zapoznania się z aktualną ofertą w naszym katalogu.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link to={data.redirectUrl || "/samochody"}>
              {data.redirectUrl ? 'Zobacz dostępne modele' : t('detail.backToResults')}
            </Link>
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  if (!listing) {
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
            <Link to="/samochody">{t('detail.backToResults')}</Link>
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  // CTA telefoniczne prowadzą ZAWSZE do Motolii — listing.contact_phone to numer dealera
  // i kierowanie tam ruchu z oferty omija nasz proces sprzedaży.
  const salesPhone = settings?.salesContactPhone
    || settings?.legalContactPhone
    || config.contactInfo?.phone
    || '';

  const baseTitle = `${listing.make} ${listing.model} ${listing.version}`;
  const financingSeoLabel = getFinancingSeoLabel(financingType, i18n.language);   // full: "Kredyt samochodowy"
  const title = financingType !== 'gotowka' && financingSeoLabel ? `${financingSeoLabel}: ${baseTitle}` : baseTitle;
  const discountedListingPrice = applySpecialOfferDiscount(getDisplayPrice(listing), discount);
  const formattedPrice = formatPrice(discountedListingPrice, settings?.displayCurrency || 'PLN');

  const forcedProductId = financingType === 'kredyt'
    ? listing.creditProductId || listing.dealerSettings?.defaultCreditProductId || undefined
    : financingType === 'leasing'
    ? listing.leasingProductId || listing.dealerSettings?.defaultLeasingProductId || undefined
    : undefined;

  const isLeasingAvailableLocal = listing.leasingAvailable !== false && isLeasingEligibleByAge(listing.production_year);

  const isFinancingAvailable = financingType === 'kredyt'
    ? listing.creditAvailable !== false
    : financingType === 'leasing'
    ? isLeasingAvailableLocal
    : true;

  const isCustomerTypeAvailable = priceType === 'gross'
    ? listing.availableForPrivate !== false
    : listing.availableForCompany !== false;

  const showCalculator = isCustomerTypeAvailable && (settings?.financingCalculatorEnabled ?? true);

  // --- Trzy ceny: katalogowa (przekreślona + pill -%), w finansowaniu (główna), sprzedaży (gotówka) ---
  // Ceny katalogowa/rabat/sprzedaży są w PLN; przy walucie EUR pomijamy te dodatki (osobny follow-up).
  const currencyCode = settings?.displayCurrency || 'PLN';
  const isPln = currencyCode === 'PLN';
  const toDisplayPrice = (grossPln: number) => (priceType === 'net' ? (listing.vatMargin ? grossPln : Math.round(grossPln / 1.23)) : grossPln);
  const motoliaDiscountVal = listing.motoliaDiscountPln ?? 0;
  const displayPriceVal = getDisplayPrice(listing);
  const showMotolia = isPln && !!listing.showMotoliaDiscount && (
    motoliaDiscountVal > 0 || 
    (!!listing.catalogPrice && listing.catalogPrice > displayPriceVal)
  );
  // "Cena pojazdu" zależna od flagi displaySalePrice (per pojazd). Pill katalogowy liczony względem niej.

  // If the catalog price is empty or invalid (not greater than the display price),
  // but we have a Motolia discount, we can calculate a virtual catalog price before discount
  const catalogPriceVal = listing.catalogPrice && listing.catalogPrice > displayPriceVal
    ? listing.catalogPrice
    : (motoliaDiscountVal > 0 ? displayPriceVal + motoliaDiscountVal : 0);

  const showCatalogStrike = isPln && catalogPriceVal > displayPriceVal;
  const catalogDiscountPct = showCatalogStrike
    ? Math.round(((catalogPriceVal - displayPriceVal) / catalogPriceVal) * 100)
    : 0;

  // Blok katalogowy — "Cena specjalna Motolia.pl" + linia (etykieta / przekreślona wartość + pill), układ justify-between
  const catalogLine = showCatalogStrike ? (
    <div className="w-full">
      <div className="text-xs font-semibold text-emerald-700">Cena specjalna Motolia.pl</div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">
          {t('listing.catalogPrice')} {priceType === 'net' ? 'netto:' : 'brutto:'}
        </span>
        <span className="flex items-baseline gap-2">
          <span className="text-sm text-muted-foreground line-through">
            {formatPrice(toDisplayPrice(catalogPriceVal), currencyCode)}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-xs font-bold">
            -{catalogDiscountPct}%
          </span>
        </span>
      </div>
    </div>
  ) : null;


  // Tooltip "i" przy cenie pojazdu — gdy pokazujemy cenę po rabacie (tryb B = finansowanie) i pojazd ma rabat
  const priceRabatInfo = (showMotolia && !listing.displaySalePrice) ? (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild onClick={(e) => e.preventDefault()}>
          <Info className="h-3.5 w-3.5 text-muted-foreground/70 cursor-help shrink-0" />
        </TooltipTrigger>
        <TooltipContent side="top" collisionPadding={16} className="z-[9999] max-w-[280px] text-xs">
          Cena pojazdu zawiera dodatkowy rabat z tytułu finansowania pojazdu z Motolia.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : null;

  // Financing variants (/kredyt/, /leasing/) canonicalize to /oferta/ ('gotowka' prefix)
  const canonicalPath = getListingUrlPath({
    id: listing.listing_id,
    make: listing.make,
    model: listing.model,
    version: listing.version,
    productionYear: listing.production_year,
    bodyType: listing.body_type,
    fuelType: listing.fuel_type
  }, 'gotowka');

  // Handle financing type switch from calculator tabs — updates URL without page reload
  const handleFinancingTypeChange = (newType: FinancingType) => {
    const newPath = getListingUrlPath({
      id: listing.listing_id,
      make: listing.make,
      model: listing.model,
      version: listing.version,
      productionYear: listing.production_year,
      bodyType: listing.body_type,
      fuelType: listing.fuel_type
    }, newType);
    // Only navigate if URL actually changes
    if (newPath !== location.pathname) {
      navigate(newPath, { replace: true });
    }
  };

  const lang = i18n.language;
  const suffix = lang === 'pl' ? '' : lang === 'en' ? 'En' : 'De';

  // Prepare SEO values
  const listingTitleTemplate = (seoConfig ? (seoConfig as any)[`listingTitle${suffix}`] : undefined) || seoConfig?.listingTitle;
  const listingDescriptionTemplate = (seoConfig ? (seoConfig as any)[`listingDescription${suffix}`] : undefined) || seoConfig?.listingDescription;

  // Default meta title from SEO config template (for gotowka / no financing context).
  // Fallback (no CMS template configured) matches the backend SSR title format
  // (buildListingMeta in backend/src/services/seo-meta.ts) so hydration doesn't overwrite
  // the correct SSR <title> with a degraded one missing year/price/brand.
  const defaultMetaTitle = listing && listingTitleTemplate
    ? listingTitleTemplate
      .replace('{{make}}', listing.make)
      .replace('{{model}}', listing.model)
      .replace('{{year}}', listing.production_year.toString())
      .replace('{{price}}', formattedPrice)
      .replace('{{fuel}}', listing.fuel_type || '')
    : `${baseTitle} ${listing.production_year} — ${formatNumber(discountedListingPrice)} zł | ${config.name}`;


  // Use keyword-rich financing-specific title or fall back to default
  const financingMetaTitle = getFinancingMetaTitle(
    financingType, listing.make, listing.model, listing.version, listing.production_year, lang
  );
  const metaTitle = isRecentlySold
    ? `${baseTitle} (Oferta archiwalna) — ${formatNumber(discountedListingPrice)} zł | ${config.name}`
    : (financingMetaTitle || defaultMetaTitle);

  // Default meta description from SEO config template
  const defaultMetaDesc = listing && listingDescriptionTemplate
    ? listingDescriptionTemplate
      .replace('{{make}}', listing.make)
      .replace('{{model}}', listing.model)
      .replace('{{year}}', listing.production_year.toString())
      .replace('{{price}}', formattedPrice)
      .replace('{{fuel}}', listing.fuel_type || '')
    : '';

  // Use keyword-rich financing-specific description or fall back to default
  const financingMetaDesc = getFinancingMetaDescription(
    financingType, listing.make, listing.model, listing.production_year, formattedPrice, lang
  );
  const metaDesc = isRecentlySold
    ? `Oferta archiwalna: ${baseTitle}. Samochód został sprzedany lub wycofany z oferty. Zobacz podobne dostępne samochody na ${config.name}.`
    : (financingMetaDesc || defaultMetaDesc);

  // Prepare Schema.org JSON-LD
  const siteUrl = window.location.origin;
  const canonicalFullUrl = `${siteUrl}${canonicalPath}`;

  const baseProductSchema = listing ? {
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
      "url": canonicalFullUrl,
      "priceCurrency": "PLN",
      "price": discountedListingPrice,
      "itemCondition": "https://schema.org/UsedCondition",
      "availability": isRecentlySold ? "https://schema.org/Discontinued" : "https://schema.org/InStock"
    }
  } : undefined;

  let schema: any = undefined;
  if (baseProductSchema) {
    const graph: any[] = [baseProductSchema];
    
    if (financingType !== 'gotowka') {
      const financialProduct = {
        "@type": "FinancialProduct",
        "@id": `${canonicalFullUrl}#financing`,
        "name": financingSeoLabel ? `${financingSeoLabel} na ${listing.make} ${listing.model}` : title,
        "description": metaDesc,
        "feesAndCommissionsSpecification": "Wpłata własna od 0%", 
        "url": canonicalFullUrl
      };
      graph.push(financialProduct);
    }
    
    if (faqs.length > 0) {
      const faqSchema = {
        "@type": "FAQPage",
        "@id": `${canonicalFullUrl}#faq`,
        "mainEntity": faqs.map(faq => {
          const { question, answer } = getLocalizedQA(faq);
          return {
            "@type": "Question",
            "name": question,
            "acceptedAnswer": {
              "@type": "Answer",
              "text": answer // In production, we might need to strip markdown tags if strict plain-text is required, but markdown strings are generally acceptable
            }
          };
        })
      };
      graph.push(faqSchema);
    }

    schema = {
      "@context": "https://schema.org/",
      "@graph": graph
    };
  }

  // Breadcrumb level 2 — variant-aware (must match backend SSR breadcrumb + BreadcrumbList schema)
  const breadcrumbLevel2 = financingType === 'leasing'
    ? { label: getFinancingLabel('leasing', lang), path: '/leasing' }
    : financingType === 'kredyt'
    ? { label: getFinancingLabel('kredyt', lang), path: '/kredyt' }
    : financingType === 'wynajem'
    ? { label: getFinancingLabel('wynajem', lang), path: '/wynajem-dlugoterminowy' }
    : { label: t('breadcrumb.cars'), path: '/samochody' };

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      {listing && (
        <MetaHead
          title={metaTitle}
          description={metaDesc}
          image={listing.primary_image_url || listing.image_urls?.[0]}
          canonical={canonicalPath}
          schema={schema}
          noindex={isRecentlySold}
        />
      )}
      <Header />

      <main className="container py-6 relative">
        {/* Archival Notice Banner */}
        {isRecentlySold && (
          <div className="mb-6 p-5 sm:p-6 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700/60 rounded-2xl shadow-sm space-y-3">
            <div className="flex items-center gap-2.5 text-amber-900 dark:text-amber-200 font-bold text-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Oferta archiwalna — pojazd niedostępny</span>
            </div>
            <p className="text-amber-800 dark:text-amber-300/90 text-sm leading-relaxed">
              Ten samochód został sprzedany lub wycofany z oferty u dealera. Poniżej zachowaliśmy specyfikację techniczną tego egzemplarza oraz przygotowaliśmy propozycje podobnych, aktualnie dostępnych samochodów.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Button asChild className="bg-amber-600 hover:bg-amber-700 text-white font-semibold">
                <Link to={`/samochody/${slugifyBrandName(listing.make)}/${slugifyBrandName(listing.model)}`}>
                  Zobacz dostępne {listing.make} {listing.model} &rarr;
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-amber-300 dark:border-amber-700 font-medium">
                <Link to="/kalkulator-rat">
                  Oblicz ratę w kalkulatorze &rarr;
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* Reservation Notice Banner */}
        {!isRecentlySold && Boolean(listing.is_reserved || listing.isReserved) && (
          <div className="mb-6 p-5 sm:p-6 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700/60 rounded-2xl shadow-sm space-y-3">
            <div className="flex items-center gap-2.5 text-amber-900 dark:text-amber-200 font-bold text-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Pojazd zarezerwowany u dealera</span>
            </div>
            <p className="text-amber-800 dark:text-amber-300/90 text-sm leading-relaxed">
              Ten egzemplarz jest obecnie zarezerwowany przez innego klienta. Skontaktuj się z nami, aby potwierdzić aktualny status dostępności lub otrzymać dedykowaną propozycję podobnego samochodu.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Button asChild className="bg-amber-600 hover:bg-amber-700 text-white font-semibold">
                <Link to={`/samochody/${slugifyBrandName(listing.make)}/${slugifyBrandName(listing.model)}`}>
                  Zobacz dostępne {listing.make} {listing.model} &rarr;
                </Link>
              </Button>
            </div>
          </div>
        )}
        {/* Sole semantic <h1> for the page — includes production year to match the SSR <h1>/<title>.
            Visible titles below (desktop/mobile) are non-heading elements to avoid duplicate <h1>s. */}
        <h1 className="sr-only">{baseTitle} {listing.production_year}</h1>
        {/* Breadcrumb */}
        <Breadcrumb className="text-sm text-muted-foreground mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">{t('nav.home')}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={breadcrumbLevel2.path}>{breadcrumbLevel2.label}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{baseTitle}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Title for Motolia (Desktop only, since mobile has it below gallery) — not a real <h1>,
            the sr-only <h1> above is the sole semantic heading (avoids duplicate <h1>s in the DOM) */}
        {isMotolia && (
          <div className="hidden lg:block mb-6">
            <div role="heading" aria-level={2} className="text-3xl font-bold font-heading text-foreground tracking-tight">
              {baseTitle}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Gallery */}
            <div className="relative">
              {(hasSpecialOffer || showMotolia || (listing.marketing_tags?.length ?? 0) > 0 || Boolean(listing.is_reserved || listing.isReserved)) && (
                <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5 items-start pointer-events-none">
                  {Boolean(listing.is_reserved || listing.isReserved) && (
                    <span className="px-2.5 py-1 bg-amber-500 text-white text-xs font-bold rounded-lg shadow-md flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      Zarezerwowane
                    </span>
                  )}
                  {(listing.marketing_tags ?? []).map((tag) => (
                    <span key={tag} className="px-2.5 py-1 bg-accent text-accent-foreground text-xs font-bold rounded-lg shadow-md">
                      {tag}
                    </span>
                  ))}
                  {hasSpecialOffer && <SpecialOfferTag className="pointer-events-auto" />}
                  {showMotolia && (
                    <div className="px-2.5 py-1 bg-green-600 text-white text-xs font-bold rounded-lg shadow-md">
                      {t('listing.motoliaDiscount')}: {catalogPriceVal ? Math.round((catalogPriceVal - listing.price_pln) / catalogPriceVal * 100) : 0}%
                    </div>
                  )}
                </div>
              )}
              <div className="absolute top-3 right-3 z-10 px-2.5 py-1 bg-white/90 backdrop-blur-sm border text-slate-800 text-xs font-bold rounded-lg shadow-sm pointer-events-none">
                {listing.vatMargin ? 'VAT Marża' : 'Faktura VAT 23%'}
              </div>
              <ImageGallery
                images={listing.image_urls}
                title={title}
                isReserved={Boolean(listing.is_reserved || listing.isReserved)}
              />
            </div>

            {/* Title & Price - Mobile */}
            <div className="lg:hidden">
              <div role="heading" aria-level={2} className="font-heading text-2xl font-bold text-foreground">{baseTitle}</div>
              {isMotolia ? (
                /* Motolia mobile: minimized price */
                <div className="mt-2">
                  {catalogLine}
                  <span className="inline-flex items-center gap-1 text-sm text-muted-foreground tabular-nums whitespace-nowrap">
                    Cena pojazdu {priceType === 'net' ? 'netto:' : 'brutto:'} {priceInfo.primaryLabel}
                    {priceRabatInfo}
                  </span>
                  {priceInfo.secondaryLabel && (
                    <span className="text-xs text-muted-foreground ml-2 tabular-nums whitespace-nowrap">
                      {priceInfo.secondaryLabel}
                    </span>
                  )}
                  {hasSpecialOffer && (
                    <div className="flex items-center gap-2 mt-1">
                      <SpecialOfferTag className="" />
                      <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        (rabat: {formatPrice(discount, settings?.displayCurrency || 'PLN')})
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                /* Carsalon mobile: original prominent price */
                <>
                  {catalogLine && <div className="mt-2">{catalogLine}</div>}
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex flex-col md:flex-row md:items-baseline md:gap-3 mt-2">
                      <span className="price-display text-foreground inline-flex items-center gap-1.5">
                        {priceInfo.primaryLabel}
                        {priceRabatInfo}
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
                  {hasSpecialOffer && (
                    <div className="text-xs text-muted-foreground mt-1">
                      (rabat specjalny: {formatPrice(discount, settings?.displayCurrency || 'PLN')})
                    </div>
                  )}
                  {initialPayment != null && (
                    <div className="text-xs text-muted-foreground mt-1 mb-4">
                      (pierwsza wpłata: {formatPrice(initialPayment, settings?.displayCurrency || 'PLN')})
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Financing Calculator — on mobile shown above key parameters (desktop sidebar config hides it here) */}
            <section className={cn(settings?.financingCalculatorLocation === 'sidebar' && "lg:hidden")}>
              {isMotolia && <CustomerTypeToggle className="w-full mb-4 lg:hidden" />}
              
              {!isCustomerTypeAvailable ? (
                <div className="bg-secondary/50 rounded-xl p-6 text-center text-muted-foreground">
                  {t('financing.notAvailableForCustomerType', 'Ta oferta nie jest dostępna dla wybranego typu klienta (Prywatnie / Firma).')}
                </div>
              ) : showCalculator ? (
                <FinancingCalculator
                  onConfigChange={setFinancingConfig}
                  creditAvailable={listing.creditAvailable !== false}
                  leasingAvailable={isLeasingAvailableLocal}
                  forcedProductId={forcedProductId}
                  listingId={listing.listing_id}
                  price={
                    priceType === 'net'
                      ? Math.round(
                          applySpecialOfferDiscount(
                            getFinancingBasePrice(
                              listing as any,
                              financingType,
                              priceType
                            ),
                            discount
                          ) / (listing.vatMargin ? 1 : 1.23)
                        )
                      : applySpecialOfferDiscount(
                          getFinancingBasePrice(
                            listing as any,
                            financingType,
                            priceType
                          ),
                          discount
                        )
                  }
                  priceIsNet={priceType === 'net'}
                  vatMargin={listing.vatMargin ?? false}
                  currency={settings?.displayCurrency || 'PLN'}
                  manufacturingYear={listing.production_year}
                  mileageKm={listing.mileage_km}
                  offerInitialPayment={initialPayment ?? undefined}
                  financingType={financingType}
                  onFinancingTypeChange={handleFinancingTypeChange}
                />
              ) : null}
            </section>

            {/* Key Parameters */}
            <section>
              <h2 className="font-heading text-xl font-semibold mb-4">{t('detail.keyParameters')}</h2>
              <SpecsGrid
                year={listing.specification?.manufacturingYear || listing.production_year || undefined}
                mileage={listing.mileage_km}
                fuelType={listing.specification?.fuelType || listing.fuel_type}
                transmission={listing.specification?.transmission || listing.transmission}
                drive={listing.specification?.drive || listing.drive}
                power={listing.specification?.enginePowerHp || listing.engine_power_hp}
                capacity={listing.specification?.engineCapacityCm3 || listing.engine_capacity_cm3}
                bodyType={listing.specification?.bodyType || listing.body_type}
              />
            </section>

            <Separator />

            {/* Specifications */}
            <section>
              <h2 className="font-heading text-xl font-semibold mb-4">{t('detail.specifications')}</h2>
              <SpecificationsTable specifications={listing.specifications} />
            </section>

            {/* Technical Specification PDF */}
            {listing.specification?.specificationPdfUrl && (
              <>
                <Separator />
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-heading text-xl font-semibold">Dokumentacja</h2>
                    <Button variant="outline" size="sm" asChild>
                      <a href={listing.specification.specificationPdfUrl} target="_blank" rel="noopener noreferrer">
                        <FileDown className="w-4 h-4 mr-2" />
                        Pobierz specyfikację (PDF)
                      </a>
                    </Button>
                  </div>
                </section>
              </>
            )}

            {/* Equipment */}
            <section>
              <h2 className="font-heading text-xl font-semibold mb-4">{t('detail.equipment')}</h2>
              <EquipmentDisplay 
                equipment={
                  listing.specification ? {
                    audioMultimedia: (listing.specification.equipmentAudioMultimedia as string[]) || [],
                    safety: (listing.specification.equipmentSafety as string[]) || [],
                    comfort: (listing.specification.equipmentComfortExtras as string[]) || [],
                    performance: [],
                    driverAssist: [],
                    other: (listing.specification.equipmentOther as string[]) || []
                  } : listing.equipment
                } 
              />
            </section>

            {/* Below Equipment Ads */}
            {belowEquipmentAds.filter(a => a.isActive).length > 0 && (
              <div className="mt-4">
                {belowEquipmentAds.filter(a => a.isActive).map(ad => (
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
                    className="my-4"
                  />
                ))}
              </div>
            )}

            <Separator />

            {/* Mobile Partner Ad */}
            {sidebarAds.filter(a => a.isActive).length > 0 && (
              <>
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
              </>
            )}

            {/* Purchase Process Steps */}
            <PurchaseProcessStepper variant="compact" />

            {showCalculator && (
              <>
                <Separator />
                <DynamicFinancingContent
                  financingType={financingType}
                  listing={{
                    listing_id: listing.listing_id,
                    make: listing.make,
                    model: listing.model,
                    production_year: listing.production_year,
                    body_type: listing.body_type,
                    fuel_type: listing.fuel_type,
                    transmission: listing.transmission,
                    engine_power_hp: listing.engine_power_hp
                  }}
                />
              </>
            )}

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
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-primary">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">{t('detail.whyUs.item1.title')}</p>
                    <p className="text-sm text-muted-foreground">{t('detail.whyUs.item1.description')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-background/70 p-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-primary">
                    <BadgeCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">{t('detail.whyUs.item2.title')}</p>
                    <p className="text-sm text-muted-foreground">{t('detail.whyUs.item2.description')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-background/70 p-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-primary">
                    <Users className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">{t('detail.whyUs.item3.title')}</p>
                    <p className="text-sm text-muted-foreground">{t('detail.whyUs.item3.description')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-background/70 p-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-primary">
                    <Banknote className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">{t('detail.whyUs.item4.title')}</p>
                    <p className="text-sm text-muted-foreground">{t('detail.whyUs.item4.description')}</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Podobne dostępne samochody dla ofert archiwalnych */}
            {isRecentlySold && data?.similarListings && data.similarListings.length > 0 && (
              <section className="space-y-6 p-6 md:p-8 bg-card border rounded-2xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="font-heading text-2xl font-bold text-foreground">
                      Podobne dostępne samochody
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Aktualne oferty pojazdów o zbliżonych parametrach i cenie
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/samochody/${slugifyBrandName(listing.make)}/${slugifyBrandName(listing.model)}`}>
                      Wszystkie {listing.make} {listing.model} &rarr;
                    </Link>
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {data.similarListings.map((simListing: any, idx: number) => {
                    const mappedSim = mapBackendListingToFrontend(simListing);
                    return mappedSim ? (
                      <ListingCard key={mappedSim.listing_id || idx} listing={mappedSim} index={idx} />
                    ) : null;
                  })}
                </div>
              </section>
            )}

            <Separator />

            {/* FAQ */}
            {faqs.length > 0 && (
              <section className="space-y-3">
                <h2 className="font-heading text-xl font-semibold">
                  {lang === 'pl' ? (
                    financingType === 'leasing' ? `FAQ: ${listing.make} ${listing.model} w leasingu na ${window.location.hostname.replace('www.', '')}` :
                    financingType === 'kredyt' ? `FAQ: ${listing.make} ${listing.model} w kredycie na ${window.location.hostname.replace('www.', '')}` :
                    financingType === 'wynajem' ? `FAQ: ${listing.make} ${listing.model} w wynajmie długoterminowym na ${window.location.hostname.replace('www.', '')}` :
                    `FAQ: ${listing.make} ${listing.model} na ${window.location.hostname.replace('www.', '')}`
                  ) : (
                    t('nav.faq', 'FAQ')
                  )}
                </h2>
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
            {/* Motolia: toggle scrolls with page, not sticky */}
            {isMotolia && (
              <CustomerTypeToggle className="w-full mb-6" />
            )}
            <div className={cn("sticky space-y-6", isMotolia ? "top-24" : "top-20")}>

              {/* Motolia sidebar: Calculator-first layout */}
              {isMotolia && (
                <>

                  {/* Financing Calculator — primary element with price inside */}
                  {(settings?.financingCalculatorEnabled ?? true) && (
                    !isCustomerTypeAvailable ? (
                      <div className="bg-secondary/50 rounded-xl p-6 text-center text-muted-foreground">
                        {t('financing.notAvailableForCustomerType', 'Ta oferta nie jest dostępna dla wybranego typu klienta (Prywatnie / Firma).')}
                      </div>
                    ) : showCalculator ? (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <FinancingCalculator
                          onConfigChange={setFinancingConfig}
                          creditAvailable={listing.creditAvailable !== false}
                          leasingAvailable={isLeasingAvailableLocal}
                          forcedProductId={forcedProductId}
                          listingId={listing.listing_id}
                          price={
                            priceType === 'net'
                              ? Math.round(
                                  applySpecialOfferDiscount(
                                    getFinancingBasePrice(
                                      listing as any,
                                      financingType,
                                      priceType
                                    ),
                                    discount
                                  ) / (listing.vatMargin ? 1 : 1.23)
                                )
                              : applySpecialOfferDiscount(
                                  getFinancingBasePrice(
                                    listing as any,
                                    financingType,
                                    priceType
                                  ),
                                  discount
                                )
                          }
                          priceIsNet={priceType === 'net'}
                          vatMargin={listing.vatMargin ?? false}
                          currency={settings?.displayCurrency || 'PLN'}
                          manufacturingYear={listing.production_year}
                          mileageKm={listing.mileage_km}
                          offerInitialPayment={initialPayment ?? undefined}
                          financingType={financingType}
                          onFinancingTypeChange={handleFinancingTypeChange}
                          motoliaMode={true}
                          isDuplicateHeading={true}
                          priceSlot={
                            <div className="pt-2 border-t border-slate-200 mt-2">
                              {catalogLine}
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  Cena pojazdu {priceType === 'net' ? 'netto:' : 'brutto:'}
                                </span>
                                <span className="inline-flex items-center gap-1 text-sm text-muted-foreground font-medium tabular-nums whitespace-nowrap">
                                  {priceInfo.primaryLabel}
                                  {priceRabatInfo}
                                </span>
                              </div>
                              {priceInfo.secondaryLabel && (
                                <div className="text-right">
                                  <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                                    {priceInfo.secondaryLabel}
                                  </span>
                                </div>
                              )}
                              {hasSpecialOffer && (
                                <div className="flex items-center justify-end gap-1.5 mt-1">
                                  <SpecialOfferTag />
                                  <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                                    (rabat: {formatPrice(discount, settings?.displayCurrency || 'PLN')})
                                  </span>
                                </div>
                              )}
                            </div>
                          }
                        />
                      </motion.div>
                    ) : null
                  )}

                  {/* Micro-conversions: call now or leave a number (CRO P1.1) */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="bg-card rounded-xl shadow-card p-6 space-y-4"
                  >
                    <h3 className="font-heading font-semibold text-foreground">
                      {isRecentlySold ? 'Szukasz podobnego auta?' : 'Zapytaj o ten samochód'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {isRecentlySold
                        ? 'Ten egzemplarz został sprzedany. Skontaktuj się z nami — sprawdzimy dostępność identycznych modeli w sieci dealerskiej.'
                        : 'Zadzwoń do naszego doradcy lub zostaw numer — oddzwonimy z ofertą dopasowaną do Twoich potrzeb.'}
                    </p>

                    {salesPhone && (
                      <a
                        href={`tel:${formatPhoneForTelLink(salesPhone)}`}
                        onClick={() => trackPhoneClick('offer_sidebar')}
                        className="flex items-center justify-center gap-2 h-11 w-full rounded-xl border border-border bg-card shadow-card text-foreground font-semibold text-sm hover:bg-secondary transition-colors"
                      >
                        <Phone className="h-4 w-4 text-primary" />
                        Zadzwoń: {salesPhone}
                      </a>
                    )}
                    <CallbackForm
                      compact
                      listingId={listing.listing_id}
                      formId="offer_sidebar_callback"
                      title="Wolisz, żebyśmy"
                      titleHighlight="oddzwonili?"
                      description="Zostaw numer – doradca oddzwoni w sprawie tego auta."
                      message={`Prośba o kontakt ws. oferty: ${listing.make} ${listing.model} ${listing.production_year ?? ''}`.trim()}
                    />
                  </motion.div>

                  {/* Secondary CTA — commented out, may be needed in the future */}
                  {/* <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-card rounded-xl shadow-card p-6 space-y-3"
                  >
                    <Button asChild variant="hero" className="w-full" size="lg">
                      <Link to={`${getListingUrlPath({
                        id: listing.listing_id,
                        make: listing.make,
                        model: listing.model,
                        version: listing.version,
                        productionYear: listing.production_year,
                        bodyType: listing.body_type,
                        fuelType: listing.fuel_type
                      }, financingType)}/lead`} state={financingConfig ? { financing: financingConfig } : undefined}>
                        <MessageSquare className="h-5 w-5" />
                        {t('detail.askAbout')}
                      </Link>
                    </Button>
                    {settings?.negotiatePriceEnabled !== false && (
                      <Button asChild variant="secondary" className="w-full btn-negotiate" size="lg">
                        <Link to={`${getListingUrlPath({
                          id: listing.listing_id,
                          make: listing.make,
                          model: listing.model,
                          version: listing.version,
                          productionYear: listing.production_year,
                          bodyType: listing.body_type,
                          fuelType: listing.fuel_type
                        }, financingType)}/negotiate`}>
                          <HandCoins className="h-5 w-5" />
                          {t('detail.negotiatePrice', 'Zaproponuj swoją cenę')}
                        </Link>
                      </Button>
                    )}
                  </motion.div> */}

                  {canManage && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="bg-card rounded-xl shadow-card p-4"
                    >
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
                    </motion.div>
                  )}
                </>
              )}

              {/* Carsalon sidebar: Original price-first layout */}
              {!isMotolia && (
                <>
                  {/* Price Card */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card rounded-xl shadow-card p-6 space-y-4"
                  >
                  <div role="heading" aria-level={2} className="font-heading text-xl font-bold text-foreground">{baseTitle}</div>
                  <div className="flex flex-col gap-1 items-start">
                    {catalogLine && <div className="w-full">{catalogLine}</div>}
                    <div className="flex items-center gap-2">
                      <span className="price-display text-foreground inline-flex items-center gap-1.5">
                        {priceInfo.primaryLabel}
                        {priceRabatInfo}
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
                    {hasSpecialOffer && (
                      <span className="text-xs text-muted-foreground mt-0.5">
                        (rabat specjalny: {formatPrice(discount, settings?.displayCurrency || 'PLN')})
                      </span>
                    )}
                    {initialPayment != null && (
                      <span className="text-xs text-muted-foreground mt-0.5">
                        (pierwsza wpłata: {formatPrice(initialPayment, settings?.displayCurrency || 'PLN')})
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
                      }, financingType)}/lead`} state={financingConfig ? { financing: financingConfig } : undefined}>
                        <MessageSquare className="h-5 w-5" />
                        {t('detail.askAbout')}
                      </Link>
                    </Button>
                    {settings?.negotiatePriceEnabled !== false && (
                      <Button asChild variant="secondary" className="w-full btn-negotiate" size="lg">
                        <Link to={`${getListingUrlPath({
                          id: listing.listing_id,
                          make: listing.make,
                          model: listing.model,
                          version: listing.version,
                          productionYear: listing.production_year,
                          bodyType: listing.body_type,
                          fuelType: listing.fuel_type
                        }, financingType)}/negotiate`}>
                          <HandCoins className="h-5 w-5" />
                          {t('detail.negotiatePrice', 'Zaproponuj swoją cenę')}
                        </Link>
                      </Button>
                    )}
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

              {/* Financing Calculator - Sidebar Widget (Carsalon) */}
              {(settings?.financingCalculatorEnabled ?? true) && settings?.financingCalculatorLocation === 'sidebar' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  {!isCustomerTypeAvailable ? (
                    <div className="bg-secondary/50 rounded-xl p-6 text-center text-muted-foreground">
                      {t('financing.notAvailableForCustomerType', 'Ta oferta nie jest dostępna dla wybranego typu klienta (Prywatnie / Firma).')}
                    </div>
                  ) : showCalculator ? (
                    <FinancingCalculator
                      onConfigChange={setFinancingConfig}
                      creditAvailable={listing.creditAvailable !== false}
                      leasingAvailable={isLeasingAvailableLocal}
                      forcedProductId={forcedProductId}
                      listingId={listing.listing_id}
                      price={
                        priceType === 'net'
                        ? Math.round(
                            applySpecialOfferDiscount(
                              getFinancingBasePrice(
                                listing as any,
                                financingType,
                                priceType
                              ),
                              discount
                            ) / (listing.vatMargin ? 1 : 1.23)
                          )
                        : applySpecialOfferDiscount(
                            getFinancingBasePrice(
                              listing as any,
                              financingType,
                              priceType
                            ),
                            discount
                          )
                    }
                    priceIsNet={priceType === 'net'}
                    vatMargin={listing.vatMargin ?? false}
                    currency={settings?.displayCurrency || 'PLN'}
                    manufacturingYear={listing.production_year}
                    mileageKm={listing.mileage_km}
                    offerInitialPayment={initialPayment ?? undefined}
                    financingType={financingType}
                    onFinancingTypeChange={handleFinancingTypeChange}
                    isDuplicateHeading={true}
                  />
                  ) : null}
                </motion.div>
              )}
                </>
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
                  isDuplicateHeading={true}
                />
              ))}

              {/* Dealer Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-card rounded-xl shadow-card p-6 space-y-4"
              >
                <h3 className="font-heading font-semibold">
                  {isPlatformUser ? t('detail.dealerInfo') : t('detail.vehicleLocation')}
                </h3>
                {isPlatformUser ? (
                  <div className="space-y-2">
                    <p className="font-medium text-foreground">{listing.dealer_name}</p>
                    <div className="flex items-start gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>
                        {(() => {
                          const parts: string[] = [];
                          if (listing.dealer_address_line1) parts.push(listing.dealer_address_line1);
                          if (listing.dealer_address_line2) parts.push(listing.dealer_address_line2);
                          if (listing.dealer_address_line3) parts.push(listing.dealer_address_line3);
                          // Dla dealerów CSFlow: city i postalCode są osobnymi polami
                          if (!listing.dealer_address_line2) {
                            const postalCity = [listing.dealer_postal_code, listing.dealer_city].filter(Boolean).join(' ');
                            if (postalCity) parts.push(postalCity);
                          } else if (listing.dealer_city && !parts.some(p => p.includes(listing.dealer_city!))) {
                            parts.push(listing.dealer_city);
                          }
                          return parts.join(', ') || '—';
                        })()}
                      </span>
                    </div>
                    {/* Kontakt do dealera ws. tego auta — widoczne tylko dla zalogowanych */}
                    {(listing.dealer_contact_phone || listing.dealer_contact_email || listing.dealer_contact_email_service) && (
                      <div className="space-y-1 text-sm pt-1 border-t">
                        {listing.dealer_contact_phone && (
                          <a
                            href={`tel:${formatPhoneForTelLink(listing.dealer_contact_phone)}`}
                            className="flex items-center gap-1.5 text-foreground hover:text-primary transition-colors"
                          >
                            <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            {listing.dealer_contact_phone}
                          </a>
                        )}
                        {listing.dealer_contact_email && (
                          <a
                            href={`mailto:${listing.dealer_contact_email}`}
                            className="flex items-center gap-1.5 text-foreground hover:text-primary transition-colors break-all"
                          >
                            <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            {listing.dealer_contact_email}
                          </a>
                        )}
                        {listing.dealer_contact_email_service && (
                          <p className="text-xs text-muted-foreground break-all">serwis: {listing.dealer_contact_email_service}</p>
                        )}
                        {listing.dealer_nip && (
                          <p className="text-xs text-muted-foreground">NIP: {listing.dealer_nip}</p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-foreground font-medium">
                    <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>{listing.dealer_city || '—'}</span>
                  </div>
                )}
                {isPlatformUser && listing.google_rating && (
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
            </div>
          </div>
        </div>
      </main >

      {/* Callback CTA */}
      <div className="container py-10">
        <CallbackForm
          title={isRecentlySold ? "Szukasz podobnego samochodu?" : "Masz dodatkowe pytania?"}
          titleHighlight={isRecentlySold ? "Zostaw numer, pomożemy" : "Zostaw numer, oddzwonimy"}
          description={isRecentlySold
            ? "Ten pojazd został sprzedany, ale nasz doradca bezpłatnie pomoże Ci znaleźć identyczny lub podobny egzemplarz u dealerów."
            : "Nasz doradca skontaktuje się z Tobą w ciągu 24h i pomoże dobrać najlepsze finansowanie."}
          listingId={listing.listing_id}
          formId="offer_bottom_callback"
          message={isRecentlySold
            ? `Prośba o kontakt ws. auta podobnego do archiwalnej oferty: ${listing.make} ${listing.model} ${listing.production_year ?? ''}`.trim()
            : `Prośba o kontakt ws. oferty: ${listing.make} ${listing.model} ${listing.production_year ?? ''}`.trim()}
        />
      </div>

      <Footer />

      {/* Mobile Sticky CTA */}
      <div className="sticky-cta">
        {isRecentlySold ? (
          <div className="flex gap-3 items-center">
            <a
              href={`tel:${formatPhoneForTelLink(salesPhone)}`}
              aria-label="Kontakt telefoniczny"
              onClick={() => trackPhoneClick('offer_sticky_mobile')}
              className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl border border-border bg-background text-foreground font-semibold text-sm hover:bg-secondary transition-colors"
            >
              <Phone className="h-4 w-4" />
              Zadzwoń do nas
            </a>
            <Button asChild variant="hero" size="lg" className="flex-1">
              <Link to={`/samochody/${slugifyBrandName(listing.make)}/${slugifyBrandName(listing.model)}`}>
                Dostępne {listing.model} &rarr;
              </Link>
            </Button>
          </div>
        ) : (
          <div className="flex gap-3 items-center">
            {/* Phone CTA — replaces the mobile-only Thulium chat widget on small screens */}
            <a
              href={`tel:${formatPhoneForTelLink(salesPhone)}`}
              aria-label="Kontakt telefoniczny"
              onClick={() => trackPhoneClick('offer_sticky_mobile')}
              className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl border border-border bg-background text-foreground font-semibold text-sm hover:bg-secondary transition-colors"
            >
              <Phone className="h-4 w-4" />
              Kontakt
            </a>
            <Button asChild variant="hero" size="lg" className="flex-1">
              <Link to={`${getListingUrlPath({
                id: listing.listing_id,
                make: listing.make,
                model: listing.model,
                version: listing.version,
                productionYear: listing.production_year,
                bodyType: listing.body_type,
                fuelType: listing.fuel_type
              }, financingType)}/lead`} state={financingConfig ? { financing: financingConfig } : undefined}>
                {t('detail.sendInquiry')}
              </Link>
            </Button>
            {settings?.negotiatePriceEnabled !== false && (
              <Button asChild variant="secondary" size="lg" className="flex-1 btn-negotiate">
                <Link to={`${getListingUrlPath({
                  id: listing.listing_id,
                  make: listing.make,
                  model: listing.model,
                  version: listing.version,
                  productionYear: listing.production_year,
                  bodyType: listing.body_type,
                  fuelType: listing.fuel_type
                }, financingType)}/negotiate`}>
                  {t('detail.negotiateShort', 'Negocjuj cenę')}
                </Link>
              </Button>
            )}
          </div>
        )}
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
                const targetUrl = searchParams ? `/samochody?${searchParams}` : '/samochody';
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
    </div >
  );
}
