import { ChevronDown } from 'lucide-react';

/**
 * Disclosure layer 1 — sticky bar under the global header, present on every
 * /foton/* page. States the agent relationship up front, not buried in a footnote.
 */
export function FotonContextBar() {
  return (
    <div className="bg-slate-900/90 border-b border-amber-500/30 backdrop-blur-md text-slate-300 text-xs py-2 px-4 sticky top-[72px] lg:top-[80px] z-40">
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
            FOTON
          </span>
          <span className="hidden sm:inline text-slate-400">•</span>
          <span className="text-slate-200">
            Pojazdy użytkowe i pickupy – Motolia działa jako <strong className="text-white">Agent Importera</strong>
          </span>
        </div>
        <a
          href="#odpowiedzialnosc"
          className="text-amber-400 hover:text-amber-300 underline underline-offset-4 flex items-center gap-1 font-medium transition-colors"
        >
          Kto za co odpowiada <ChevronDown className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
