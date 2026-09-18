import { Link } from 'react-router-dom';
import { trackSelectItem } from '@/lib/analytics';
import { useTranslation } from 'react-i18next';
import { Car, Calendar, Gauge, Fuel, Info } from 'lucide-react';
import { GearboxIcon } from '@/components/icons/GearboxIcon';
import { ImageSwiper } from '@/components/ImageSwiper';
import { normalizeRentalImageUrl } from '@/lib/utils';
import { getTransmissionShortLabel, translateTechnicalValue } from '@/utils/i18n-utils';
import { formatNumber } from '@/utils/formatters';
import { usePriceSettings } from '@/contexts/PriceSettingsContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

function buildRentalImageList(v: any): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw: string | null | undefined) => {
    const url = normalizeRentalImageUrl(raw, v.id);
    if (url && !seen.has(url)) { seen.add(url); out.push(url); }
  };
  push(v.primaryImageUrl);
  for (const u of v.imageUrls || []) push(u);
  if (out.length === 0) {
    return ['/motolia-placeholder.webp'];
  }
  return out;
}

export function RentalListingCard({ v, priority = false }: { v: any; priority?: boolean }) {
  const { t } = useTranslation();
  const { priceType } = usePriceSettings();
  const storedRentalType = typeof window !== 'undefined' ? localStorage.getItem('rentalClientType') : null;
  const isBusiness = storedRentalType ? storedRentalType === 'business' : priceType === 'net';
  const accent = 'hsl(var(--accent))';
  const accentText = 'hsl(var(--accent-foreground))';
  const isNew = v.condition === 'NEW';

  const handleClick = () => {
    trackSelectItem({
      id: String(v.id),
      name: `${v.make} ${v.model} ${v.version || ''}`.trim(),
      make: v.make,
      model: v.model,
      monthlyRate: v.min_rate_netto || v.rate_netto,
      financingType: 'wynajem',
      category: 'wynajem',
    });
  };

  return (
    <Link to={`/wynajem-dlugoterminowy/${v.slug || v.id}`} onClick={handleClick} className="listing-card group flex flex-col overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
      <div className="relative">
        <ImageSwiper images={buildRentalImageList(v)} alt={`${v.make} ${v.model}`} aspectClassName="aspect-[16/10]" imgClassName="group-hover:scale-105" priority={priority} fallback={<img src="/motolia-placeholder.webp" className="w-full h-full object-cover" alt="Placeholder" />} />
        <div className="absolute top-3 left-3 bg-accent text-accent-foreground text-xs font-bold tracking-wider px-2.5 py-1 rounded-full z-10">WYNAJEM</div>
      </div>
      <div className="p-4 space-y-3 flex-1 flex flex-col">
        <div>
          <span className={`text-xs font-bold tracking-wider ${isNew ? 'text-primary' : 'text-muted-foreground'}`}>{isNew ? t('listing.statusNew') : t('listing.statusUsed')}</span>
          <h3 className="font-heading text-xl font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">{v.make} {v.model}</h3>
          <p className="text-sm font-medium text-muted-foreground line-clamp-1 min-h-[1.25rem]">{v.version || ' '}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {v.productionYear && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-full font-medium tabular-nums whitespace-nowrap"><Calendar className="h-3.5 w-3.5 shrink-0" /> {v.productionYear}</span>}
          {v.enginePowerHp && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-full font-medium tabular-nums whitespace-nowrap"><Gauge className="h-3.5 w-3.5 shrink-0" /> {v.enginePowerHp} KM</span>}
          {v.fuelType && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-full font-medium whitespace-nowrap"><Fuel className="h-3.5 w-3.5 shrink-0" /> {translateTechnicalValue('fuel', v.fuelType, t)}</span>}
          {v.transmission && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-full font-medium whitespace-nowrap"><GearboxIcon className="h-3.5 w-3.5 shrink-0" /> {getTransmissionShortLabel(v.transmission, t)}</span>}
        </div>
        <div className="flex-1" />
        <div className="pt-3">
          {v.insuranceMissing ? (
            <div className="py-1">
              <span className="inline-flex items-center text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200/60 px-2.5 py-1 rounded-md">
                Wycena ubezpieczenia na zapytanie
              </span>
            </div>
          ) : v.minMonthlyRateGross ? (<div>
            <span className="text-xs text-muted-foreground block mb-1">Rata od</span>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="inline-flex items-baseline gap-0.5 px-2.5 py-1.5 rounded-lg font-bold text-2xl tabular-nums whitespace-nowrap" style={{ background: accent, color: accentText }}>
                {isBusiness
                  ? formatNumber(Math.ceil(v.minMonthlyRateNet ?? v.minMonthlyRateGross))
                  : formatNumber(Math.ceil(v.minMonthlyRateGross))}
                <span className="text-base font-semibold ml-0.5">zł</span>
              </span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <span className="text-xs text-muted-foreground">{isBusiness ? 'netto / mies.' : 'brutto / mies.'}</span>
                {v.minRateConfig && (
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild onClick={(e) => e.preventDefault()}>
                        <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent side="top" collisionPadding={16} className="z-[9999] max-w-[220px] text-xs">
                        Kalkulacja raty przy założeniu: {v.minRateConfig.contractMonths} mies. | {(v.minRateConfig.annualMileageKm / 1000).toFixed(0)} tys. km/rok
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-1 tabular-nums whitespace-nowrap">
              {isBusiness
                ? `${formatNumber(Math.ceil(v.minMonthlyRateGross))} zł brutto`
                : (v.minMonthlyRateNet ? `${formatNumber(Math.ceil(v.minMonthlyRateNet))} zł netto` : `${formatNumber(Math.ceil(v.minMonthlyRateGross))} zł brutto`)}
            </div>
          </div>) : <span className="text-sm text-muted-foreground">Zapytaj o cenę</span>}
        </div>
      </div>
    </Link>
  );
}
