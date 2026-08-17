import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Car, ChevronRight, Loader2, Calendar, Fuel, Settings2, Gauge, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatNumber } from '@/utils/formatters';
import { OptimizedImage } from '@/components/OptimizedImage';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/** Etykieta brutto/netto z tooltipem (i) — spójna z kartami na listingach */
function RateNote({ label, text }: { label: string; text: string }) {
  return (
    <span className="flex items-center gap-1 mt-0.5">
      <span className="text-xs text-subtle">{label}</span>
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild onClick={(e) => e.preventDefault()}>
            <Info className="h-3 w-3 text-subtle cursor-help shrink-0" />
          </TooltipTrigger>
          <TooltipContent side="top" collisionPadding={16} className="z-[9999] max-w-[220px] text-xs">
            {text}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </span>
  );
}

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';
// Normalize URL
const apiBase = API_BASE_URL.endsWith('/api') ? API_BASE_URL.slice(0, -4) : (API_BASE_URL.endsWith('/api/') ? API_BASE_URL.slice(0, -5) : API_BASE_URL);

export function DynamicWidget({ 
  placement, 
  widgetId,
  className,
  innerClassName
}: { 
  placement?: string, 
  widgetId?: string,
  className?: string,
  innerClassName?: string
}) {
  const { data: widgets, isLoading } = useQuery<any[]>({
    queryKey: ['public-widgets', placement, widgetId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (placement) params.append('placement', placement);
      if (widgetId) params.append('widgetId', widgetId);
      
      const res = await fetch(`${apiBase}/api/widgets/render?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch widgets');
      
      return res.json();
    }
  });

  if (isLoading) {
    const loader = (
      <div className="w-full flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-subtle" />
      </div>
    );
    if (className) {
      return (
        <section className={className}>
          <div className={innerClassName || ''}>
            {loader}
          </div>
        </section>
      );
    }
    return loader;
  }

  const hasVehicles = widgets?.some((w) => w.vehicles && w.vehicles.length > 0);
  if (!widgets || widgets.length === 0 || !hasVehicles) return null;

  const content = (
    <div className="space-y-16">
      {widgets.map((widget) => {
        if (!widget.vehicles || widget.vehicles.length === 0) return null;
        
        const isRentalOnly = widget.vehicleSources?.includes('RENTAL') && widget.vehicleSources?.length === 1;
        const viewAllLink = isRentalOnly ? '/wynajem-dlugoterminowy' : '/samochody';

        return (
          <div key={widget.id} className="w-full">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                  <Car className="hidden md:block w-8 h-8 text-primary" />
                  {widget.name}
                </h2>
                <div className="h-1 w-24 bg-accent rounded mt-4"></div>
              </div>
              <Link 
                to={viewAllLink} 
                className="hidden md:flex group items-center text-sm font-medium text-primary hover:text-primary/80 underline underline-offset-4 decoration-2 hover:no-underline transition-colors"
                target={placement === 'EXTERNAL' ? '_parent' : '_self'}
              >
                Zobacz wszystkie
                <ChevronRight className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {widget.vehicles.map((v: any) => {
                const hasDiscount = !!(v.showMotoliaDiscount && v.catalogPrice && v.catalogPrice > v.price);
                const rates = (!v.installment && (v.creditInstallment != null || v.leasingInstallment != null))
                  ? { kredytGross: v.creditInstallment as number | null, leasingNet: v.leasingInstallment as number | null }
                  : null;
                return (
                <Link to={v.url} key={v.id} target={placement === 'EXTERNAL' ? '_parent' : '_self'}>
                  <div className="group bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full flex flex-col cursor-pointer">
                    <div className="relative aspect-[16/10] bg-gray-100 overflow-hidden">
                      {v.imageUrl ? (
                        <OptimizedImage
                          src={v.imageUrl}
                          alt={v.title}
                          width="800"
                          height="500"
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-subtle">
                          Brak zdjęcia
                        </div>
                      )}

                      <div className="absolute top-4 left-4 flex flex-col gap-2 items-start">
                        {/* Tagi marketingowe (backoffice) zamiast nadwozia/stanu — te widać na zdjęciu i w danych karty */}
                        {(v.marketingTags || []).slice(0, 2).map((tag: string) => (
                          <span key={tag} className="bg-accent text-gray-900 text-xs px-3 py-1.5 rounded-full font-semibold shadow-sm">
                            {tag}
                          </span>
                        ))}
                        {hasDiscount && (
                          <span className="bg-green-600 text-white text-sm font-bold px-3 py-1.5 rounded-lg shadow-md">
                            Oszczędzasz {formatNumber(v.catalogPrice - v.price)} zł
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-5 flex flex-col flex-grow">
                      <div className="mb-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold text-lg text-gray-900 group-hover:text-primary transition-colors line-clamp-1">
                            {v.title}
                          </h3>
                          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center group-hover:bg-accent transition-colors shrink-0">
                            <ChevronRight className="w-4 h-4 text-primary group-hover:text-white" />
                          </div>
                        </div>
                        {v.version && (
                          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{v.version}</p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-3">
                          {v.year && (
                              <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                  <Calendar className="w-3 h-3" /> {v.year}
                              </span>
                          )}
                          {v.enginePowerHp && (
                              <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                  <Gauge className="w-3 h-3" /> {v.enginePowerHp} KM
                              </span>
                          )}
                          {v.condition === 'USED' && v.mileage > 0 && (
                              <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                  <Gauge className="w-3 h-3" /> {formatNumber(v.mileage)} km
                              </span>
                          )}
                          {v.fuelType && (
                              <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                  <Fuel className="w-3 h-3" /> {v.fuelType}
                              </span>
                          )}
                          {v.transmission && (
                              <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                  <Settings2 className="w-3 h-3" /> {v.transmission}
                              </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-auto pt-4 border-t border-gray-100">
                        {v.installment ? (
                          <>
                            {v.price && (
                              <span className="text-xs text-gray-600 font-medium tracking-wide">
                                Cena katalogowa: {formatNumber(v.price)} PLN
                              </span>
                            )}
                            <div className="flex items-baseline gap-2 mt-1">
                              <span className="inline-flex items-baseline gap-1 px-3 py-1 rounded-lg font-black text-2xl bg-accent text-gray-900 shadow-sm">
                                {formatNumber(Math.round(v.installment))} zł
                              </span>
                              <span className="text-xs font-medium text-gray-600">brutto / mies.</span>
                            </div>
                          </>
                        ) : (
                          <>
                            {hasDiscount ? (
                              <div className="flex flex-col">
                                <span className="text-xs text-subtle line-through">{formatNumber(v.catalogPrice)} PLN</span>
                                <span className="text-xl font-black text-gray-900">{formatNumber(v.price)} PLN</span>
                                <span className="text-xs font-semibold text-green-600">
                                  Rabat {Math.round((v.catalogPrice - v.price) / v.catalogPrice * 100)}%
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col">
                                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Cena pojazdu</span>
                                <span className="text-lg font-bold text-gray-900">
                                  {v.price ? formatNumber(v.price) : '-'} PLN
                                </span>
                              </div>
                            )}
                            {rates && (
                              <>
                                <div className="grid grid-cols-2 gap-2 mt-3">
                                  {rates.kredytGross != null && (
                                    <div>
                                      <span className="text-xs text-muted-foreground block mb-0.5">Kredyt od</span>
                                      <span className="inline-flex items-baseline gap-0.5 bg-accent text-gray-900 rounded-lg px-2.5 py-1 font-black text-lg">
                                        {formatNumber(rates.kredytGross)} zł<span className="text-xs font-semibold">/mc</span>
                                      </span>
                                      <RateNote label="brutto" text="Miesięczna rata kredytu zależy od wybrania przez Ciebie parametrów finansowania." />
                                    </div>
                                  )}
                                  {rates.leasingNet != null && (
                                    <div>
                                      <span className="text-xs text-muted-foreground block mb-0.5">Leasing od</span>
                                      <span className="inline-flex items-baseline gap-0.5 bg-accent text-gray-900 rounded-lg px-2.5 py-1 font-black text-lg">
                                        {formatNumber(rates.leasingNet)} zł<span className="text-xs font-semibold">/mc</span>
                                      </span>
                                      <RateNote label="netto" text="Miesięczna rata leasingu zależy od wybrania przez Ciebie parametrów finansowania." />
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
                );
              })}
            </div>

            <div className="mt-6 md:hidden">
              <Link 
                to={viewAllLink} 
                className="flex w-full items-center justify-center bg-accent text-gray-900 font-medium py-3 rounded-lg hover:bg-accent/90 transition-colors"
                target={placement === 'EXTERNAL' ? '_parent' : '_self'}
              >
                Zobacz wszystkie oferty
              </Link>
            </div>
          </div>

        );
      })}
    </div>
  );

  if (className) {
    return (
      <section className={className}>
        <div className={innerClassName || ''}>
          {content}
        </div>
      </section>
    );
  }

  return content;
}
