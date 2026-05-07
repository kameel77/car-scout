import React from 'react';
import { Car, CreditCard, Shield } from 'lucide-react';

const benefits = [
  {
    icon: Car,
    title: 'Wybór pojazdu',
    description:
      'Pomożemy dobrać optymalny pojazd nowy lub używany — dopasowany do potrzeb i budżetu firmy.',
  },
  {
    icon: CreditCard,
    title: 'Finansowanie kredyt i leasing',
    description:
      'Zaproponujemy najlepsze warunki kredytu lub leasingu od sprawdzonych partnerów finansowych.',
  },
  {
    icon: Shield,
    title: 'Szkoda całkowita — partner Link4',
    description:
      'Po szkodzie całkowitej szybko pomożemy znaleźć i sfinansować pojazd zastępczy. Carsalon jest oficjalnym partnerem TU Link4 w tym zakresie.',
  },
];

export function B2BBenefitGrid() {
  return (
    <section className="mb-8 print:mb-3">
      <h2 className="text-2xl font-bold mb-4 print:text-base print:mb-2">Jak możemy Ci pomóc?</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:grid-cols-3 print:gap-3">
        {benefits.map((b) => (
        <div
          key={b.title}
          className="rounded-xl border border-border bg-card p-6 flex flex-col gap-3 print:p-3 print:gap-2 print:rounded-lg"
        >
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary print:h-8 print:w-8">
            <b.icon className="h-6 w-6 print:h-4 print:w-4" />
          </div>
          <h3 className="font-semibold text-lg print:text-sm">{b.title}</h3>
          <p className="text-sm text-muted-foreground print:text-xs print:leading-snug">{b.description}</p>
        </div>
      ))}
      </div>
    </section>
  );
}
