import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Car, ChevronRight, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';
// Normalize URL
const apiBase = API_BASE_URL.endsWith('/api') ? API_BASE_URL.slice(0, -4) : (API_BASE_URL.endsWith('/api/') ? API_BASE_URL.slice(0, -5) : API_BASE_URL);

export function DynamicWidget({ placement, widgetId }: { placement?: string, widgetId?: string }) {
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
    return (
      <div className="w-full flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!widgets || widgets.length === 0) return null;

  return (
    <div className="space-y-16">
      {widgets.map((widget) => {
        if (!widget.vehicles || widget.vehicles.length === 0) return null;
        
        return (
          <div key={widget.id} className="w-full">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                  <Car className="w-8 h-8 text-blue-600" />
                  {widget.name}
                </h2>
                <div className="h-1 w-24 bg-blue-600 rounded mt-4"></div>
              </div>
              <Link 
                to="/samochody" 
                className="group flex items-center text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                target={placement === 'EXTERNAL' ? '_parent' : '_self'}
              >
                Zobacz wszystkie
                <ChevronRight className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {widget.vehicles.map((v: any) => (
                <Link to={v.url} key={v.id} target={placement === 'EXTERNAL' ? '_parent' : '_self'}>
                  <div className="group bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full flex flex-col cursor-pointer">
                    <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
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
                        <h3 className="font-bold text-lg text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                          {v.title}
                        </h3>
                        <p className="text-gray-500 text-sm">
                          {v.year} • {v.fuelType} • {v.transmission}
                        </p>
                      </div>
                      
                      <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-500 font-medium">Cena / Rata</span>
                          <span className="text-lg font-bold text-gray-900">
                            {v.price.toLocaleString('pl-PL')} PLN
                          </span>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                          <ChevronRight className="w-4 h-4 text-blue-600 group-hover:text-white" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
