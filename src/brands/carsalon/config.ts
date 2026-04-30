import { BrandConfig } from '../../types/brand';

export const carsalonConfig: BrandConfig = {
  id: 'carsalon',
  name: 'CarSalon',
  domain: 'carsalon.pl',
  colors: {
    primary: '213 45% 22%',
    primaryHover: '213 50% 30%',
    accent: '24 95% 53%',
    accentHover: '28 95% 48%',
  },
  contactInfo: {
    phone: '+48 22 688 77 57',
    email: 'kontakt@carsalon.pl',
  },
  logo: {
    header: '/brands/carsalon/logo.png',
    footer: '/brands/carsalon/logo.png',
  },
  contactPage: {
    title: 'Porozmawiajmy o <span>Twoim nowym aucie</span>',
    subtitle: 'Zostaw kontakt, a doradca CarSalon oddzwoni i przeprowadzi Cię przez cały proces: wybór auta, finansowanie i formalności.',
    ctaTitle: 'Gotowy na <span>kolejny krok</span>?',
    ctaSubtitle: 'Przejdź do listy ofert i wybierz auto, które chcesz omówić z konsultantem.',
  },
  homePage: {
    hero: {
      badge: 'Nowy sposób na zakup auta',
      title: 'Twoje nowe auto<br />jest <span>bliżej</span> niż myślisz',
      subtitle: 'Samochody nowe i używane od sprawdzonych dealerów. Pomożemy Ci wybrać, sfinansować i kupić auto — bez zbędnych formalności.',
      ctaLabel: 'Znajdź auto',
      image: 'https://krqwvegfxnlwdhgjuflh.supabase.co/storage/v1/object/public/public-img/car-salon-hero.jpg',
      trustBadges: [
        'Bez ukrytych kosztów',
        'Gwarancja na każde auto',
        'Oddzwonimy w 15 min',
      ],
      stats: [
        { value: '500+', label: 'aut w ofercie' },
        { value: '98%', label: 'zadowolonych klientów' },
      ],
    },
    trustBar: [
      { icon: 'Shield', label: 'Sprawdzeni dealerzy' },
      { icon: 'CreditCard', label: 'Elastyczne finansowanie' },
      { icon: 'FileText', label: 'Gwarancja na każde auto' },
      { icon: 'Phone', label: 'Osobisty konsultant' },
    ],
    steps: {
      tag: 'Prosty proces',
      title: 'Jak <span>kupić auto</span> z CarSalon?',
      subtitle: 'Cały proces zakupu trwa kilka dni. Ty wybierasz - my załatwiamy formalności.',
      items: [
        { title: 'Zostaw kontakt', description: 'Podaj numer telefonu, a konsultant oddzwoni i pozna Twoje potrzeby.' },
        { title: 'Dopasujemy ofertę', description: 'Wybierzemy auta od sprawdzonych dealerów dopasowane do Ciebie.' },
        { title: 'Dobierzemy finansowanie', description: 'Leasing, kredyt lub wynajem - dobierzemy najlepszą opcję.' },
        { title: 'Odbierz kluczyki', description: 'Formalności ogarniamy za Ciebie, Ty odbierasz gotowe auto.' },
      ]
    }
  }
};
