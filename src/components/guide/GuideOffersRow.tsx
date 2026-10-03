import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { OptimizedImage } from '@/components/OptimizedImage';
import { usePillarSpecialOffers } from '@/components/pillar/PillarSpecialOffers';
import { PILLAR_OFFERS, type PillarType } from '@/components/pillar/pillarContent';
import { getListingUrlPath, type FinancingType } from '@/utils/url-utils';
import { isLeasingEligibleByAge } from '@/utils/financingEligibility';
import { getDisplayPrice } from '@/utils/listingPrice';
import { trackSelectItem } from '@/lib/analytics';

const ROW_COUNT = 3;
// Separator tysięcy także dla 4 cyfr ("1 146 zł"), jak na kartach ofert; Intl pl-PL grupuje dopiero od 5 cyfr.
const formatPln = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');

const COPY: Record<PillarType, { title: string; cta: string; financing: FinancingType }> = {
  leasing: { title: 'Auta, które Twoja firma może wziąć w leasing', cta: 'Sprawdź wszystkie oferty pojazdów w leasingu', financing: 'leasing' },
  'leasing-konsumencki': { title: 'Auta w leasingu konsumenckim', cta: 'Sprawdź wszystkie oferty pojazdów w leasingu', financing: 'leasing' },
  kredyt: { title: 'Auta, które kupisz na kredyt', cta: 'Sprawdź wszystkie oferty pojazdów na kredyt', financing: 'kredyt' },
};

/** Kompaktowa karta oferty do kolumny tekstu (~220 px): zdjęcie, model, rata lub cena. */
function GuideOfferCard({ listing, financing }: { listing: any; financing: FinancingType }) {
  const leasingOk = financing !== 'leasing' || isLeasingEligibleByAge(listing.production_year);
  const effective: FinancingType = leasingOk ? financing : 'kredyt';
  const rate = effective === 'leasing' ? listing.referenceLeasingInstallment : listing.referenceCreditInstallment;
  const price = getDisplayPrice(listing);
  const href = getListingUrlPath({
    id: listing.listing_id,
    make: listing.make,
    model: listing.model,
    version: listing.version,
    productionYear: listing.production_year,
    bodyType: listing.body_type,
    fuelType: listing.fuel_type,
  }, effective);
  const name = `${listing.make} ${listing.model}`;
  const image = listing.primary_image_url || listing.image_urls?.[0];

  return (
    <Link
      to={href}
      onClick={() =>
        trackSelectItem({
          id: String(listing.listing_id),
          name: `${name} ${listing.version || ''}`.trim(),
          make: listing.make,
          model: listing.model,
          price: listing.price_pln,
          monthlyRate: rate ?? undefined,
          financingType: effective,
        }, 'Guide Offers')
      }
      className="group flex h-full flex-col overflow-hidden rounded-xl border bg-card transition-colors hover:border-primary"
    >
      <div className="aspect-[16/10] overflow-hidden bg-muted">
        {image && (
          <OptimizedImage src={image} alt={name} ladder="card" sizes="(min-width: 640px) 230px, 78vw" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <p className="font-bold leading-tight text-foreground">{name}</p>
        {listing.version && <p className="mt-0.5 truncate text-sm text-muted-foreground">{listing.version}</p>}
        <div className="mt-auto pt-3">
          {rate ? (
            <p className="text-sm text-muted-foreground">
              {effective === 'leasing' ? 'Leasing od' : 'Kredyt od'}{' '}
              <span className="text-lg font-bold text-foreground">{formatPln(rate)} zł</span>
              {effective === 'leasing' ? ' netto/mies.' : '/mies.'}
            </p>
          ) : (
            <p className="text-lg font-bold text-foreground">{formatPln(price)} zł</p>
          )}
        </div>
      </div>
    </Link>
  );
}

/**
 * Jeden rząd promowanych ofert wtrącony w treść poradnika (te same oferty i ten sam link
 * „wszystkie oferty” co na stronie huba). Mobile: przewijany poziomo rząd, od sm: 3 karty.
 */
export function GuideOffersRow({ type }: { type: PillarType }) {
  const { listings, isLoading } = usePillarSpecialOffers(type);
  const items = listings.slice(0, ROW_COUNT);
  if (!isLoading && items.length === 0) return null;
  const copy = COPY[type];

  return (
    <aside aria-labelledby="guide-offers-title" className="my-10 rounded-2xl border bg-muted/40 p-4 sm:p-5">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">Oferty dealerów</p>
      {/* Nie H2: oferty nie wchodzą do konspektu nagłówków artykułu */}
      <p id="guide-offers-title" className="mt-1 text-lg font-bold text-foreground">{copy.title}</p>
      <ul className="-mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0">
        {isLoading
          ? Array.from({ length: ROW_COUNT }).map((_, i) => (
              <li key={i} className="w-[78%] shrink-0 snap-start sm:w-auto">
                <div className="h-[16.5rem] rounded-xl border bg-card skeleton-shimmer" />
              </li>
            ))
          : items.map((listing: any) => (
              <li key={listing.listing_id} className="w-[78%] shrink-0 snap-start sm:w-auto">
                <GuideOfferCard listing={listing} financing={copy.financing} />
              </li>
            ))}
      </ul>
      <Link to={PILLAR_OFFERS[type].moreHref} className="mt-4 inline-flex items-center gap-1 font-semibold text-primary hover:underline">
        {copy.cta} <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </aside>
  );
}
