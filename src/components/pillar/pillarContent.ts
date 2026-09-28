/**
 * Stałe treści stron poradnikowych /leasing i /kredyt (bez twierdzeń liczbowych i prawnych).
 * Zmiany w obietnicach dla klienta tylko po akceptacji Kamila.
 */
export type PillarType = 'leasing' | 'kredyt';

export const PILLAR_META: Record<PillarType, { title: string; description: string; crumb: string }> = {
  leasing: {
    title: 'Leasing samochodu — auta dostępne od ręki',
    description: 'Samochody dostępne od ręki w leasingu. Złóż wniosek o finansowanie i odbierz auto bez czekania.',
    crumb: 'Leasing samochodu',
  },
  kredyt: {
    title: 'Kredyt samochodowy — auta dostępne od ręki',
    description: 'Samochody dostępne od ręki na kredyt. Złóż wniosek o finansowanie i odbierz auto bez czekania.',
    crumb: 'Kredyt samochodowy',
  },
};

export const PILLAR_BENEFITS: Record<PillarType, string[]> = {
  leasing: [
    'Leasing dla firm i osób prywatnych',
    'Wpłata, okres i wykup ustawiasz w kalkulatorze',
    'Doradca Motolii prowadzi wniosek do podpisania umowy',
  ],
  kredyt: [
    'Kredyt na auto nowe i używane',
    'Wpłatę i okres spłaty ustawiasz w kalkulatorze',
    'Doradca Motolii prowadzi wniosek do odbioru auta',
  ],
};

export const PILLAR_STEPS: Record<PillarType, { title: string; text: string }[]> = {
  leasing: [
    { title: 'Wybierasz auto i ratę', text: 'Ustawiasz wpłatę, okres i wykup w kalkulatorze albo wybierasz ofertę.' },
    { title: 'Firma leasingowa kupuje auto', text: 'Przez czas umowy jest jego właścicielem, a Ty z niego korzystasz.' },
    { title: 'Płacisz stałe raty', text: 'Liczba i wysokość rat wynikają z parametrów umowy.' },
    { title: 'Wykupujesz auto', text: 'Po ostatniej racie płacisz ustaloną kwotę wykupu i auto przechodzi na Ciebie.' },
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
    title: 'Oferty specjalne: leasing nowych aut',
    text: 'Wybrane nowe samochody z rabatem, które możesz wziąć w leasing.',
    moreHref: '/nowe?clientType=business&rateType=lease&rateBasis=net',
  },
  kredyt: {
    title: 'Oferty specjalne: kredyt na nowe auto',
    text: 'Wybrane nowe samochody z rabatem, które możesz kupić na kredyt.',
    moreHref: '/nowe?clientType=private&rateType=credit&rateBasis=gross',
  },
};
