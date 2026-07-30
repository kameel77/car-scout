import { BrandConfig } from '../../types/brand';
import features from './features.yml';

export const motoliaConfig: BrandConfig = {
  id: 'motolia',
  name: 'Motolia',
  domain: 'motolia.pl',
  colors: {
    // Black — primary surfaces, borders, text
    primary: '0 0% 10%',
    primaryHover: '0 0% 16%',
    primaryForeground: '0 0% 100%',       // white text on black bg
    // Golden yellow (#F5C518) — all CTAs, highlights, accents
    accent: '47 92% 53%',
    accentHover: '47 91% 44%',
    accentForeground: '0 0% 10%',         // black text on yellow bg
  },
  contactInfo: {
    phone: '+48 22 112 09 50',
    email: 'kontakt@motolia.pl',
  },
  logo: {
    header: '/brands/motolia/logo-header.svg',
    footer: '/brands/motolia/logo-footer.svg',
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
      seoH1: 'Leasing, kredyt i wynajem samochodów — nowe i używane auta w Motolia',
      subtitle: 'Niezależnie czy jesteś osobą prywatną czy firmą – dobierzemy finansowanie do Twojej sytuacji. Jedna rozmowa, wiele ofert.',
      ctaLabel: 'Sprawdź dostępne auta',
      image: 'https://images.unsplash.com/photo-1617469767053-d3b523a0b982?q=80&w=2662&auto=format&fit=crop',
      trustBadges: [
        'Rata all-in – wiesz za co płacisz',
        'Oddzwonimy w 15 minut',
      ],
      stats: [
        { value: '1000+', label: 'zrealizowanych umów' },
        { value: '98%', label: 'zadowolonych klientów' },
      ],
    },
    trustBar: [
      { icon: 'Shield', label: 'Zaufani dealerzy w całej Polsce' },
      { icon: 'CreditCard', label: 'Leasing, kredyt i wynajem' },
      { icon: 'FileText', label: 'Przejrzyste warunki w każdej ofercie' },
      { icon: 'Phone', label: 'Decyzja nawet w 60 minut' },
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
  features,
};
