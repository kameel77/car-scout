/**
 * Stałe treści stron poradnikowych /leasing (firmy), /leasing-konsumencki (osoby prywatne)
 * i /kredyt (bez twierdzeń liczbowych i prawnych). Zmiany w obietnicach dla klienta tylko po akceptacji Kamila.
 */
export type PillarType = 'leasing' | 'leasing-konsumencki' | 'kredyt';

export const PILLAR_TYPES: PillarType[] = ['leasing', 'leasing-konsumencki', 'kredyt'];

/** Jak strona liczy ratę: produkt w kalkulatorze i podstawa ceny (firma netto, osoba prywatna brutto). */
export const PILLAR_CALC: Record<PillarType, { financingType: 'leasing' | 'kredyt'; priceIsNet: boolean; hasBuyout: boolean }> = {
  leasing: { financingType: 'leasing', priceIsNet: true, hasBuyout: true },
  'leasing-konsumencki': { financingType: 'leasing', priceIsNet: false, hasBuyout: true },
  kredyt: { financingType: 'kredyt', priceIsNet: false, hasBuyout: false },
};

export const PILLAR_META: Record<PillarType, { title: string; description: string; crumb: string }> = {
  leasing: {
    title: 'Leasing samochodu dla firm — osobowe i dostawcze od ręki',
    description:
      'Leasing operacyjny samochodów osobowych i dostawczych dla JDG i spółek. Policz ratę netto i złóż wniosek na auto dostępne od ręki.',
    crumb: 'Leasing dla firm',
  },
  'leasing-konsumencki': {
    title: 'Leasing konsumencki — leasing samochodu dla osoby prywatnej',
    description:
      'Leasing samochodu dla osoby prywatnej bez firmy. Policz ratę brutto z wpłatą i wykupem i złóż wniosek na auto dostępne od ręki.',
    crumb: 'Leasing konsumencki',
  },
  kredyt: {
    title: 'Kredyt samochodowy — auta dostępne od ręki',
    description: 'Samochody dostępne od ręki na kredyt. Złóż wniosek o finansowanie i odbierz auto bez czekania.',
    crumb: 'Kredyt samochodowy',
  },
};

export const PILLAR_BENEFITS: Record<PillarType, string[]> = {
  leasing: [
    'Dla JDG i spółek, auta osobowe i dostawcze',
    'Rata netto, wpłatę, okres i wykup ustawiasz w kalkulatorze',
    'Doradca Motolii prowadzi wniosek do podpisania umowy',
  ],
  'leasing-konsumencki': [
    'Dla osoby prywatnej, bez działalności gospodarczej',
    'Rata brutto, wpłatę, okres i wykup ustawiasz w kalkulatorze',
    'Wykup lub zwrot auta, zależnie od firmy leasingowej',
  ],
  kredyt: [
    'Kredyt na auto nowe i używane',
    'Wpłatę i okres spłaty ustawiasz w kalkulatorze',
    'Doradca Motolii prowadzi wniosek do odbioru auta',
  ],
};

/**
 * Rezerwacja wysokości karty kalkulatora (Suspense fallback, SSR shell i załadowana karta), żeby
 * ładowanie lazy chunka i danych /api/financing/calculator nie przesuwało treści (CLS). Wartości =
 * zmierzona wysokość załadowanej karty (section#kalkulator, dev.motolia.pl): mobile 375-414 px,
 * md 768 px, lg 1024 px (kolumna 400 px), xl >=1280 px (kolumna 440 px). Leasing ma dodatkowy wiersz
 * wykupu (+71 px względem kredytu). Backend ma kopię w backend/src/services/pillar-shell.ts (PILLAR_CALC_MIN_H) — test pilnuje równości.
 * Pełne nazwy klas są potrzebne Tailwindowi do ich wygenerowania.
 */
export const PILLAR_CALC_MIN_H: Record<PillarType, string> = {
  leasing: 'min-h-[805px] md:min-h-[697px] lg:min-h-[732px] xl:min-h-[713px]',
  'leasing-konsumencki': 'min-h-[805px] md:min-h-[697px] lg:min-h-[732px] xl:min-h-[713px]',
  kredyt: 'min-h-[730px] md:min-h-[625px] lg:min-h-[661px] xl:min-h-[642px]',
};

export const PILLAR_HEADINGS: Record<PillarType, { breakdown: string; steps: string }> = {
  leasing: { breakdown: 'Jak rozkłada się cena auta w leasingu', steps: 'Jak działa leasing samochodu dla firmy' },
  'leasing-konsumencki': {
    breakdown: 'Jak rozkłada się cena auta w leasingu konsumenckim',
    steps: 'Jak działa leasing konsumencki',
  },
  kredyt: { breakdown: 'Jak rozkłada się cena auta w kredycie', steps: 'Jak działa kredyt samochodowy' },
};

export const PILLAR_STEPS: Record<PillarType, { title: string; text: string }[]> = {
  leasing: [
    { title: 'Wybierasz auto i ratę', text: 'Ustawiasz wpłatę, okres i wykup w kalkulatorze albo wybierasz ofertę.' },
    { title: 'Firma leasingowa kupuje auto', text: 'Przez czas umowy jest jego właścicielem, a Twoja firma z niego korzysta.' },
    { title: 'Płacisz raty z fakturą', text: 'Ratę i VAT rozliczasz w firmie na zasadach z umowy i przepisów.' },
    { title: 'Wykupujesz auto', text: 'Po ostatniej racie płacisz ustaloną kwotę wykupu i auto przechodzi na Ciebie.' },
  ],
  'leasing-konsumencki': [
    { title: 'Wybierasz auto i ratę', text: 'Ustawiasz wpłatę, okres i wykup w kalkulatorze albo wybierasz ofertę.' },
    { title: 'Firma leasingowa ocenia wniosek', text: 'Sprawdza dochody i zobowiązania, a doradca Motolii kompletuje dokumenty.' },
    { title: 'Jeździsz i płacisz stałe raty', text: 'Firma leasingowa jest właścicielem auta, a Ty z niego korzystasz.' },
    { title: 'Wykup albo zwrot auta', text: 'Na koniec płacisz kwotę wykupu. Część firm leasingowych pozwala też oddać auto, doradca dobierze taką ofertę.' },
  ],
  kredyt: [
    { title: 'Wybierasz auto i ratę', text: 'Ustawiasz wpłatę i okres w kalkulatorze albo wybierasz ofertę.' },
    { title: 'Doradca składa wniosek', text: 'Przygotowujemy dokumenty i przekazujemy wniosek do banku.' },
    { title: 'Bank finansuje zakup', text: 'Po pozytywnej decyzji bank przekazuje kwotę kredytu sprzedawcy.' },
    { title: 'Odbierasz auto i spłacasz raty', text: 'Liczba i wysokość rat wynikają z parametrów umowy.' },
  ],
};

export const PILLAR_OFFERS: Record<PillarType, { title: string; text: string; moreHref: string }> = {
  leasing: {
    title: 'Oferty specjalne: leasing nowych aut dla firm',
    text: 'Wybrane nowe samochody osobowe i dostawcze z rabatem, które Twoja firma może wziąć w leasing.',
    moreHref: '/nowe?clientType=business&rateType=lease&rateBasis=net',
  },
  'leasing-konsumencki': {
    title: 'Oferty specjalne: leasing konsumencki nowych aut',
    text: 'Wybrane nowe samochody z rabatem, które możesz wziąć w leasing jako osoba prywatna.',
    moreHref: '/nowe?clientType=private&rateType=lease&rateBasis=gross',
  },
  kredyt: {
    title: 'Oferty specjalne: kredyt na nowe auto',
    text: 'Wybrane nowe samochody z rabatem, które możesz kupić na kredyt.',
    moreHref: '/nowe?clientType=private&rateType=credit&rateBasis=gross',
  },
};
