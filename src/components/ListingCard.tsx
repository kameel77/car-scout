import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { MapPin, Calendar, Gauge, Fuel, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Listing } from '@/data/mockData';

import { useAppSettings } from '@/hooks/useAppSettings';
import { usePriceSettings } from '@/contexts/PriceSettingsContext';
import { formatPrice } from '@/utils/formatters';
import { useSpecialOffer } from '@/contexts/SpecialOfferContext';
import { SpecialOfferTag } from '@/components/SpecialOfferTag';
import { ImageSwiper } from '@/components/ImageSwiper';
import { applySpecialOfferDiscount } from '@/utils/specialOffer';
import { translateTechnicalValue } from '@/utils/i18n-utils';
import { getListingUrlPath, getPreferredFinancingType, type FinancingType } from '@/utils/url-utils';

interface ListingCardProps {
  listing: Listing;
  index?: number;
  financingType?: FinancingType;
}

// Static approximations matching B2B onepager card.
// Real rates available on offer detail page.
// Kredyt: ~1.4%/mc on gross price (36mc, 10% wkład, ~9% APR)
// Leasing: ~1.2%/mc on net price (36mc, 20% wkład, ~6.5% APR)
const KREDYT_FACTOR = 0.014;
const LEASING_FACTOR = 0.012;
const VAT = 1.23;
const PLN = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 });

function dedupImages(primary: string | undefined, all: string[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  if (primary) {
    seen.add(primary);
    out.push(primary);
  }
  for (const url of all || []) {
    if (url && !seen.has(url)) {
      seen.add(url);
      out.push(url);
    }
  }
  return out;
}

/**
 * Returns the primary brand color for the given car make.
 * Falls back to the CSS accent color if the brand is not in the map.
 */
function getBrandColor(make: string | undefined): string {
  if (!make) return 'hsl(var(--primary))';
  const normalized = make.toLowerCase().trim();
  const brandColors: Record<string, string> = {
    // German
    volkswagen: '#001e50',
    vw: '#001e50',
    audi: '#bb0a30',
    bmw: '#1c69d4',
    mercedes: '#222222',
    'mercedes-benz': '#222222',
    porsche: '#d5001c',
    opel: '#f5a100',
    // French
    peugeot: '#002a5e',
    renault: '#ffcc00',
    citroen: '#d9000d',
    ds: '#a0845c',
    // Italian
    fiat: '#c8102e',
    alfa: '#8d172e',
    'alfa romeo': '#8d172e',
    ferrari: '#dc0000',
    lamborghini: '#c4a141',
    maserati: '#1f4793',
    // Japanese
    toyota: '#eb0a1e',
    honda: '#cc0000',
    mazda: '#910a0a',
    nissan: '#c3002f',
    subaru: '#0033a0',
    mitsubishi: '#e60012',
    suzuki: '#005aab',
    lexus: '#1a1a2e',
    // Korean
    hyundai: '#002c5f',
    kia: '#bb162b',
    genesis: '#1e1e1e',
    // American
    ford: '#003499',
    chevrolet: '#d4af37',
    jeep: '#4a7c59',
    dodge: '#d22630',
    tesla: '#cc0000',
    // Swedish
    volvo: '#003057',
    // Czech
    skoda: '#4ba82e',
    // Other
    seat: '#eb5f06',
    cupra: '#c8a96e',
    dacia: '#005480',
    mini: '#f50537',
    land: '#005a2b',
    'land rover': '#005a2b',
    jaguar: '#1c1c1c',
  };
  return brandColors[normalized] || 'hsl(var(--primary))';
}

export function ListingCard({ listing, index = 0, financingType }: ListingCardProps) {
  const { t } = useTranslation();
  const { data: settings } = useAppSettings();
  const { priceType } = usePriceSettings();
  const { discount, hasSpecialOffer } = useSpecialOffer();

  // Use explicit prop, or read user's cached preference (defaults to 'kredyt')
  const effectiveFinancingType = financingType || getPreferredFinancingType();

  const brandColor = getBrandColor(listing.make);

  const priceInfo = React.useMemo(() => {
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
      const primaryPrice = isNetPrimary ? Math.round(discountedPrice / VAT) : discountedPrice;
      const secondaryPrice = isNetPrimary ? discountedPrice : Math.round(discountedPrice / VAT);

      const primaryLabel = formatPrice(primaryPrice, currency);
      // Secondary price intentionally omitted on listing cards (kept in detail view)
      const secondaryLabel = null;

      return { primaryLabel, secondaryLabel };
    }

    return { primaryLabel: listing.price_display, secondaryLabel: null };
  }, [listing, settings, priceType, discount]);

  // Approximate monthly rates (PLN only — skip for EUR pricing to avoid mixing currencies)
  // priceType 'net' → show net rates (without VAT), 'gross' → show gross rates
  const monthlyRates = React.useMemo(() => {
    const currency = settings?.displayCurrency || 'PLN';
    if (currency !== 'PLN') return null;
    const grossPln = applySpecialOfferDiscount(
      listing.broker_price_pln || listing.price_pln || 0,
      discount
    );
    if (!grossPln || grossPln <= 0) return null;
    const netPln = grossPln / VAT;

    const kredytGross = Math.round(grossPln * KREDYT_FACTOR);
    const leasingNet = Math.round(netPln * LEASING_FACTOR);

    if (priceType === 'net') {
      // Show net rates: kredyt net / leasing net
      return {
        kredyt: Math.round(kredytGross / VAT),
        leasing: leasingNet,
        isNet: true,
      };
    }
    return {
      kredyt: kredytGross,
      leasing: leasingNet,
      isNet: false,
    };
  }, [listing, settings, discount, priceType]);

  const handleSpecialOfferClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    window.location.reload();
  };

  const handleListingClick = () => {
    // Store current search parameters in sessionStorage for return navigation
    const currentSearchParams = new URLSearchParams(window.location.search);
    if (currentSearchParams.toString()) {
      sessionStorage.setItem('searchParams', currentSearchParams.toString());
    }
  };

  const offerPath = getListingUrlPath({
    id: listing.listing_id,
    make: listing.make,
    model: listing.model,
    version: listing.version,
    productionYear: listing.production_year,
    bodyType: listing.body_type,
    fuelType: listing.fuel_type,
  }, effectiveFinancingType);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="listing-card group flex flex-col"
    >
      {/* Clickable area — grows to fill card */}
      <Link to={offerPath} onClick={handleListingClick} className="block flex-1 flex flex-col">
        {/* Image */}
        <div className="relative">
          <ImageSwiper
            images={dedupImages(listing.primary_image_url, listing.image_urls)}
            alt={`${listing.make} ${listing.model}`}
            aspectClassName="aspect-[16/10]"
            imgClassName="group-hover:scale-105"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-foreground/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

          {hasSpecialOffer && (
            <div className="absolute top-3 left-3">
              <SpecialOfferTag onClick={handleSpecialOfferClick} />
            </div>
          )}

          {/* Price Badge */}
          <div className="absolute top-3 right-3 px-3 py-1.5 bg-card/95 backdrop-blur-sm rounded-lg shadow-md flex flex-col md:flex-row md:items-baseline md:gap-2 items-end md:items-baseline">
            <span className="font-heading text-lg font-bold text-foreground">
              {priceInfo.primaryLabel}
            </span>
            {priceInfo.secondaryLabel && (
              <span className="text-[10px] text-muted-foreground font-medium whitespace-nowrap">
                {priceInfo.secondaryLabel}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3 flex-1 flex flex-col">
          {/* Status label + Title */}
          <div>
            <span
              className={`text-[10px] font-bold tracking-wider ${
                listing.condition === 'NEW' ? 'text-accent' : 'text-muted-foreground'
              }`}
            >
              {listing.condition === 'NEW' ? t('listing.statusNew') : t('listing.statusUsed')}
            </span>
            {/* Make + Model — larger font */}
            <h3 className="font-heading text-xl font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
              {listing.make} {listing.model}
            </h3>
            {/* Trim — always reserves space to keep card heights aligned */}
            <p className="text-sm font-medium text-muted-foreground line-clamp-1 min-h-[1.25rem]">
              {listing.version || '\u00A0'}
            </p>
          </div>

          {/* Spec pills — rok, przebieg, paliwo, skrzynia, moc */}
          <div className="flex flex-wrap gap-1.5">
            {/* Year */}
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-full font-medium">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              {listing.production_year}
            </span>

            {/* Mileage */}
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-full font-medium">
              <Gauge className="h-3.5 w-3.5 shrink-0" />
              {listing.mileage_km.toLocaleString('pl-PL')} {t('listing.km')}
            </span>

            {/* Fuel */}
            {listing.fuel_type && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-full font-medium">
                <Fuel className="h-3.5 w-3.5 shrink-0" />
                {translateTechnicalValue('fuel', listing.fuel_type, t)}
              </span>
            )}

            {/* Transmission */}
            {listing.transmission && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-full font-medium">
                <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M40 12v12H8m16-12v24M8 12v24"/>
                  <path d="M44 8a4 4 0 1 1-8 0a4 4 0 0 1 8 0M28 8a4 4 0 1 1-8 0a4 4 0 0 1 8 0M12 8a4 4 0 1 1-8 0a4 4 0 0 1 8 0m16 32a4 4 0 1 1-8 0a4 4 0 0 1 8 0m-16 0a4 4 0 1 1-8 0a4 4 0 0 1 8 0m28 4a4 4 0 1 0 0-8a4 4 0 0 0 0 8"/>
                </svg>
                {translateTechnicalValue('transmission', listing.transmission, t)}
              </span>
            )}

            {/* Power — neutral (no accent color, no bold) */}
            {listing.engine_power_hp && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-full font-medium">
                <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                {listing.engine_power_hp} {t('listing.hp')}
              </span>
            )}
          </div>

          {/* Location — only shown when not null */}
          {listing.dealer_city && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span>{listing.dealer_city}</span>
            </div>
          )}

          {/* Financing rates — no border, just spacing */}
          <div className="flex-1" />
          {monthlyRates && (
            <div className="pt-3">
              <div className="grid grid-cols-2 gap-3">
                {/* Kredyt */}
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">
                    {t('listing.kredytFrom')}
                    {monthlyRates.isNet && <span className="ml-1 text-[10px] opacity-70">netto</span>}
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className="inline-flex items-baseline gap-0.5 px-2.5 py-1.5 rounded-lg font-bold text-2xl"
                      style={{ background: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}
                    >
                      {PLN.format(monthlyRates.kredyt)}
                      <span className="text-base font-semibold ml-0.5">zł</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{t('listing.perMonth')}</span>
                  </div>
                </div>

                {/* Leasing */}
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">
                    {t('listing.leasingFrom')}
                    <span className="ml-1 text-[10px] opacity-70">netto</span>
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className="inline-flex items-baseline gap-0.5 px-2.5 py-1.5 rounded-lg font-bold text-2xl"
                      style={{ background: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}
                    >
                      {PLN.format(monthlyRates.leasing)}
                      <span className="text-base font-semibold ml-0.5">zł</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{t('listing.perMonth')}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Link>

      {/* bottom padding */}
      <div className="pb-4" />
    </motion.div>
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="listing-card flex flex-col">
      <div className="aspect-[16/10] skeleton-shimmer" />
      <div className="p-4 space-y-3 flex-1 flex flex-col">
        <div className="space-y-2">
          <div className="h-6 w-3/4 skeleton-shimmer" />
          <div className="h-4 w-1/2 skeleton-shimmer" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <div className="h-6 w-12 skeleton-shimmer rounded-full" />
          <div className="h-6 w-20 skeleton-shimmer rounded-full" />
          <div className="h-6 w-10 skeleton-shimmer rounded-full" />
          <div className="h-6 w-8 skeleton-shimmer rounded-full" />
          <div className="h-6 w-14 skeleton-shimmer rounded-full" />
        </div>
        <div className="h-4 w-20 skeleton-shimmer" />
        <div className="flex-1" />
        <div className="flex gap-3 pt-3">
          <div className="h-9 w-1/2 skeleton-shimmer rounded-lg" />
          <div className="h-9 w-1/2 skeleton-shimmer rounded-lg" />
        </div>
      </div>
      <div className="px-4 pb-4 pt-2">
        <div className="h-11 skeleton-shimmer rounded-lg" />
      </div>
    </div>
  );
}
