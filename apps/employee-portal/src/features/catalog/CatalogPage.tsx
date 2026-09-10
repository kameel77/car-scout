import React, { useState } from 'react';
import { useBrandConfig } from '../../config/BrandContext';
import { Car, Fuel, Shield, Award } from 'lucide-react';

export const CatalogPage: React.FC = () => {
  const { config, isLoading } = useBrandConfig();
  const [logoError, setLogoError] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500 text-sm">Ładowanie konfiguracji portalu...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navbar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {config.brandLogoUrl && !logoError ? (
              <img
                src={config.brandLogoUrl}
                alt={config.brandName}
                onError={() => setLogoError(true)}
                className="h-8 w-auto max-w-[140px] object-contain"
              />
            ) : (
              <div className="h-8 w-8 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                {config.brandName.charAt(0) || 'P'}
              </div>
            )}
            <span className="font-semibold text-gray-900">{config.brandName}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs px-2.5 py-1 bg-primary-50 text-primary-700 font-medium rounded-full border border-primary-200">
              Strefa Pracownicza
            </span>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <div className="bg-white border-b border-gray-100 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-600 rounded-md text-xs font-medium mb-3">
            Makieta etapu P1 - szkielet interfejsu
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            Dedykowana oferta samochodów dla pracowników
          </h1>
          <p className="mt-2 text-base text-gray-600 max-w-3xl">
            Nowe samochody w najmie długoterminowym oraz leasingu na preferencyjnych warunkach partnerskich z pakietem benefitów.
          </p>

          <div className="mt-6">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Przykładowy pakiet benefitów (szkielet makiety - szczegóły określa program danej firmy)
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
                <Shield className="h-6 w-6 text-primary-600 flex-shrink-0" />
                <div>
                  <div className="font-medium text-sm text-gray-900">Specjalne warunki flotowe</div>
                  <div className="text-xs text-gray-500">Dedykowane matryce i rabaty cenowe</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
                <Fuel className="h-6 w-6 text-primary-600 flex-shrink-0" />
                <div>
                  <div className="font-medium text-sm text-gray-900">Pakiet paliwowy Moya</div>
                  <div className="text-xs text-gray-500">Karta z zasileniem i rabat na stacjach</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
                <Award className="h-6 w-6 text-primary-600 flex-shrink-0" />
                <div>
                  <div className="font-medium text-sm text-gray-900">Opieka doradcy Motolii</div>
                  <div className="text-xs text-gray-500">Indywidualny kontakt i wsparcie formalności</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Catalog Placeholder */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="mx-auto h-16 w-16 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center">
            <Car className="h-8 w-8" />
          </div>
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            Katalog pojazdów w przygotowaniu
          </h3>
          <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
            W etapie P1 przygotowano autonomiczny szkielet aplikacji z dynamicznym brandingiem. Ochrona backendowa, filtrowanie ofert i kalkulacje rat zostaną wdrożone po migracji bazy danych.
          </p>
        </div>
      </main>
    </div>
  );
};
