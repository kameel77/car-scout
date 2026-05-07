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
    <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      {benefits.map((b) => (
        <div
          key={b.title}
          className="rounded-xl border border-border bg-card p-6 flex flex-col gap-3"
        >
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <b.icon className="h-6 w-6" />
          </div>
          <h3 className="font-semibold text-lg">{b.title}</h3>
          <p className="text-sm text-muted-foreground">{b.description}</p>
        </div>
      ))}
    </section>
  );
}
