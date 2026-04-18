import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Car, ChevronRight, Loader2, Calendar, Fuel, Settings2, Gauge } from 'lucide-react';
import { Link } from 'react-router-dom';

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
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
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
                  <Car className="hidden md:block w-8 h-8 text-accent" />
                  {widget.name}
                </h2>
                <div className="h-1 w-24 bg-accent rounded mt-4"></div>
              </div>
              <Link 
                to={viewAllLink} 
                className="hidden md:flex group items-center text-sm font-medium text-accent hover:text-accent/80 transition-colors"
                target={placement === 'EXTERNAL' ? '_parent' : '_self'}
              >
                Zobacz wszystkie
                <ChevronRight className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {widget.vehicles.map((v: any) => (
                <Link to={v.url} key={v.id} target={placement === 'EXTERNAL' ? '_parent' : '_self'}>
                  <div className="group bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full flex flex-col cursor-pointer">
                    <div className="relative aspect-[16/10] bg-gray-100 overflow-hidden">
                      {v.imageUrl ? (
                        <img 
                          src={v.imageUrl} 
                          alt={v.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          Brak zdjęcia
                        </div>
                      )}
                      
                      <div className="absolute top-4 left-4 flex flex-col gap-2">
                        {v.bodyType && (
                          <span className="bg-black/60 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-full font-medium tracking-wide">
                            {v.bodyType}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="p-5 flex flex-col flex-grow">
                      <div className="mb-2">
                        <h3 className="font-bold text-lg text-gray-900 group-hover:text-accent transition-colors line-clamp-1">
                          {v.title}
                        </h3>
                        {v.version && (
                          <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{v.version}</p>
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
                      
                      <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                          {v.installment ? (
                            <>
                              {v.price && (
                                <span className="text-xs text-gray-400 font-medium tracking-wide">
                                  Cena katalogowa: {v.price.toLocaleString('pl-PL')} PLN
                                </span>
                              )}
                              <div className="flex items-baseline gap-2 mt-1">
                                <span className="inline-flex items-baseline gap-1 px-3 py-1 rounded-lg font-black text-2xl bg-accent text-white shadow-sm">
                                  {Math.round(v.installment).toLocaleString('pl-PL')} zł
                                </span>
                                <span className="text-xs font-medium text-gray-500">brutto / mies.</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Cena pojazdu</span>
                              <span className="text-lg font-bold text-gray-900">
                                {v.price?.toLocaleString('pl-PL') ?? '-'} PLN
                              </span>
                            </>
                          )}
                        </div>
                        <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center group-hover:bg-accent transition-colors shrink-0">
                          <ChevronRight className="w-4 h-4 text-accent group-hover:text-white" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-6 md:hidden">
              <Link 
                to={viewAllLink} 
                className="flex w-full items-center justify-center bg-accent text-white font-medium py-3 rounded-lg hover:bg-accent/90 transition-colors"
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
