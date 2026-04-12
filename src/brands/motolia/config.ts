import { BrandConfig } from '../../types/brand';

export const motoliaConfig: BrandConfig = {
  id: 'motolia',
  name: 'Motolia',
  domain: 'motolia.pl',
  colors: {
    // Elegant deep bottle green as primary
    primary: '160 60% 15%',
    primaryHover: '160 60% 20%',
    // Accent vibrant green/emerald
    accent: '160 70% 35%',
    accentHover: '160 70% 30%',
  },
  homePage: {
    hero: {
      badge: 'Twój samochód, Twoje zasady',
      title: 'Finansowanie auta<br /><span>bez stresu</span>',
      subtitle: 'Znajdź nowoczesne sposoby na sfinansowanie Twojego kolejnego pojazdu. My zajmiemy się resztą.',
      ctaLabel: 'Odkryj samochody',
      image: 'https://krqwvegfxnlwdhgjuflh.supabase.co/storage/v1/object/public/public-img/car-salon-hero.jpg', // Placeholder, should be updated for motolia
      trustBadges: [
        'Przejrzyste warunki',
        'Zaufani partnerzy',
        'Szybka decyzja',
      ],
      stats: [
        { value: '1000+', label: 'zrealizowanych umów' },
        { value: '24h', label: 'średni czas decyzji' },
      ],
    },
    trustBar: [
      { icon: 'Shield', label: 'Eksperckie doradztwo' },
      { icon: 'CreditCard', label: 'Leasing i Kredyt' },
      { icon: 'FileText', label: 'Przejrzyste umowy' },
      { icon: 'Phone', label: 'Wsparcie 24/7' },
    ],
    steps: {
      tag: 'Krok po kroku',
      title: 'Z nami <span>zrealizujesz</span> marzenie o aucie',
      subtitle: 'Przygotowaliśmy proces tak, abyś mógł cieszyć się nowym samochodem bez zbędnego stresu.',
      items: [
        { title: 'Zostaw zapytanie', description: 'Podaj nam szczegóły auta, którego szukasz.' },
        { title: 'Konsultacja konfiguracji', description: 'Nasz ekspert przeanalizuje Twój przypadek i doradzi najlepsze rozwiązanie finansowe.' },
        { title: 'Wybór opcji', description: 'Przedstawimy najkorzystniejsze oferty z banków i firm leasingowych.' },
        { title: 'Odbiór pojazdu', description: 'Sfinalizujemy umowy, a Ty po prostu odbierasz kluczyki do wymarzonego samochodu.' },
      ]
    }
  }
};
