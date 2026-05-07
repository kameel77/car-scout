import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Car } from 'lucide-react';
import type { B2BOffer } from '@/hooks/useB2BOfferList';
import { getListingUrlPath } from '@/utils/url-utils';
import { useTrackedUrl } from '@/hooks/useTrackedUrl';

const PLN = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 });

// Static approximations for marketing card. Real rates available on offer detail page.
// Kredyt: ~1.4%/mc (36mc, 10% wkład, ~9% APR)
// Leasing: ~1.2%/mc (36mc, 20% wkład, ~6.5% APR)
const KREDYT_FACTOR = 0.014;
const LEASING_FACTOR = 0.012;

export function B2BListingCard({ offer }: { offer: B2BOffer }) {
  const image = offer.primaryImageUrl || offer.imageUrls?.[0];
  const baseHref = getListingUrlPath(offer, 'gotowka');
  const href = useTrackedUrl(baseHref);

  const kredytApprox = Math.round(offer.pricePln * KREDYT_FACTOR);
  const leasingApprox = Math.round(offer.pricePln * LEASING_FACTOR);

  return (
    <article className="rounded-xl border border-border bg-card overflow-hidden flex flex-col print:rounded-md print:border-gray-200">
      <div className="aspect-[16/10] bg-muted overflow-hidden flex items-center justify-center">
        {image ? (
          <img
            src={image}
            alt={`${offer.make} ${offer.model}`}
            className="w-full h-full object-cover"
            loading="eager"
          />
        ) : (
          <Car className="h-10 w-10 text-muted-foreground/40 print:h-6 print:w-6" />
        )}
      </div>
      <div className="p-4 flex flex-col gap-2 flex-1 print:p-2 print:gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-semibold text-base leading-tight print:text-sm">
            {offer.make} {offer.model}
          </h3>
          <span className="text-xs text-muted-foreground shrink-0 print:text-[10px]">{offer.productionYear}</span>
        </div>
        <div className="text-lg font-bold print:text-base">{PLN.format(offer.pricePln)} zł</div>
        <div className="text-xs text-muted-foreground space-y-1 mt-1 print:text-[9px] print:space-y-0 print:mt-0">
          <div data-testid="kredyt-rate">Kredyt od: <strong>{PLN.format(kredytApprox)} zł/mc</strong></div>
          <div data-testid="leasing-rate">Leasing od: <strong>{PLN.format(leasingApprox)} zł/mc</strong></div>
        </div>
        <Link
          to={href}
          className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline pt-2 print:text-[9px] print:pt-1"
        >
          Zobacz ofertę <ArrowRight className="h-3.5 w-3.5 print:h-3 print:w-3" />
        </Link>
      </div>
    </article>
  );
}
