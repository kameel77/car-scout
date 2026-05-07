import React from 'react';
import { Shield } from 'lucide-react';

export function B2BHero() {
  return (
    <section className="rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-400 p-8 md:p-12 mb-8 text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.15),transparent_60%)]" />
      <div className="relative z-10 max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-semibold mb-4">
          <Shield className="h-3.5 w-3.5" />
          Partner TU Link4
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-3">
          Carsalon dla przedsiębiorców
        </h1>
        <p className="text-white/90 text-base md:text-lg">
          Kompleksowe wsparcie w wyborze pojazdu, finansowaniu i szybkim odzyskaniu auta po szkodzie całkowitej.
        </p>
      </div>
    </section>
  );
}
