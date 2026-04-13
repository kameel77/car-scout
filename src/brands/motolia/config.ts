import { BrandConfig } from '../../types/brand';

export const motoliaConfig: BrandConfig = {
  id: 'motolia',
  name: 'Motolia',
  domain: 'motolia.pl',
  colors: {
    primary: '160 60% 15%',
    primaryHover: '160 60% 20%',
    accent: '160 70% 35%',
    accentHover: '160 70% 30%',
  },
  contactInfo: {
    phone: '+48 519 188 087',
    email: 'kontakt@motolia.pl',
  },
  contactPage: {
    title: 'Znajdź swoje <span>wymarzone auto</span>',
    subtitle: 'Nasi doradcy dobiorą dla Ciebie najlepsze finansowanie – kredyt, leasing lub wynajem. Zostaw kontakt, odezwiemy się w ciągu 24h.',
    ctaTitle: 'Szukasz <span>konkretnego modelu</span>?',
    ctaSubtitle: 'Przewertuj naszą bazę dostępnych aut i zgłoś zapotrzebowanie na wybrany pojazd.',
  },
  homePage: {
    hero: {
      badge: 'Leasing · Kredyt · Wynajem · Pożyczka',
      title: 'Szeroki wybór aut.<br /><span>Proste finansowanie.</span>',
      subtitle: 'Niezależnie czy jesteś osobą prywatną czy firmą – dobierzemy finansowanie do Twojej sytuacji. Jedna rozmowa, wiele ofert.',
      ctaLabel: 'Sprawdź dostępne auta',
      image: 'https://images.unsplash.com/photo-1617469767053-d3b523a0b982?q=80&w=2662&auto=format&fit=crop',
      trustBadges: [
        'Rata all-in – wiesz za co płacisz',
        'Decyzja nawet w 1 godzinę',
        'Zawsze odbiór osobisty',
      ],
      stats: [
        { value: '1000+', label: 'zrealizowanych umów' },
        { value: '5', label: 'partnerów finansowych' },
      ],
    },
    trustBar: [
      { icon: 'Shield', label: 'Zaufani dealerzy w całej Polsce' },
      { icon: 'CreditCard', label: 'Leasing, kredyt i wynajem' },
      { icon: 'FileText', label: 'Przejrzyste warunki w każdej ofercie' },
      { icon: 'Phone', label: 'Decyzja od 1 do 24 godzin' },
    ],
    steps: {
      tag: 'Krok po kroku',
      title: 'Z nami <span>zrealizujesz</span> marzenie o aucie',
      subtitle: 'Przygotowaliśmy prosty, trzyetapowy proces – od wyboru auta do odbioru kluczyków.',
      items: [
        {
          title: 'Wybierz markę i model',
          description: 'Powiedz nam jakiego auta szukasz i jaką formę finansowania preferujesz. Pomożemy dopasować produkt do Twojej sytuacji.',
        },
        {
          title: 'Podpisz umowę online',
          description: 'Nasz doradca przygotuje oferty od partnerów finansowych i omówi warunki. Całość zazwyczaj bez wychodzenia z domu.',
        },
        {
          title: 'Odbierz samochód',
          description: 'Wskazujemy konkretny salon dealerski w Twoim mieście – odbiór osobisty w umówionym terminie.',
        },
      ],
    },
  },
};
