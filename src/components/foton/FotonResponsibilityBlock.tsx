import { Building2, ShieldCheck, Wrench } from 'lucide-react';

/**
 * Disclosure layer 2 — "Kto za co odpowiada" three-column block. Required on
 * the hub AND on every model page, above the lead form. This is a sales
 * element, not fine print: it pre-answers the question every fleet buyer asks.
 */
export function FotonResponsibilityBlock() {
  return (
    <section id="odpowiedzialnosc" className="py-16 bg-slate-950 border-y border-slate-800">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
            Przejrzyste ramy współpracy
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mt-1">
            Kto za co odpowiada w transakcji?
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            Kompletny podział ról zapewnia przejrzystość procesową, bezpieczeństwo zakupu i sprawny czas realizacji.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Kolumna 1: Sprzedaż */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-3 h-full">
            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
              <Building2 className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">1. Sprzedaż i Umowa</h3>
            <p className="text-xs font-semibold text-amber-400">Power Truck Poland Sp. z o.o.</p>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Sprzedawca i wyłączny importer pojazdu. Umowa sprzedaży pojazdu zawierana jest bezpośrednio z Power Truck Poland Sp. z o.o.
            </p>
          </div>

          {/* Kolumna 2: Finansowanie (MOTOLIA - WYRÓŻNIONA) */}
          <div className="rounded-xl bg-gradient-to-b from-slate-900 to-slate-900/90 border-2 border-amber-500/80 p-6 space-y-3 relative shadow-lg shadow-amber-950/20 h-full">
            <div className="absolute -top-3 right-4 bg-amber-500 text-slate-950 text-xs font-black uppercase px-2.5 py-0.5 rounded-full tracking-wide">
              Rola Motolii
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">2. Finansowanie & Dobór</h3>
            <p className="text-xs font-bold text-amber-400">Motolia Sp. z o.o. (Agent Importera)</p>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              Dobieramy leasing, najem długoterminowy lub kredyt z oferty instytucji partnerskich. Pomagamy uzyskać decyzję dla nowej marki i włączamy ubezpieczenie w ratę.
            </p>
          </div>

          {/* Kolumna 3: Serwis */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-3 h-full">
            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
              <Wrench className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">3. Serwis i Gwarancja</h3>
            <p className="text-xs font-semibold text-amber-400">Power Truck Poland / Partnerzy</p>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Gwarancję fabryczną (5 lat / 200 tys. km) zapewnia importer. Obsługę serwisową realizuje autoryzowana sieć partnerów w Polsce.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
