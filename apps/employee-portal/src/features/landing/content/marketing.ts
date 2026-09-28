/**
 * Shared marketing copy and example figures for the public landing (/) and /dla-firm.
 * Figures are examples from the program catalog; update them together with PROGRAM_FIGURES_AS_OF.
 * Discounts are always shown against the manufacturer's catalog price and always with a named model.
 */

export const PROGRAM_FIGURES_AS_OF = 'wrzesień 2026';

export interface ProgramStat {
  value: string;
  label: string;
}

export const PROGRAM_STATS: ProgramStat[] = [
  { value: '−31,6%', label: 'od ceny katalogowej: Hyundai Tucson N Line za 134 338 zł zamiast 196 400 zł' },
  { value: 'od 1 281 zł', label: 'brutto miesięcznie za najem z ubezpieczeniem i serwisem' },
  { value: '500 zł', label: 'na karcie Moya do każdego auta' },
];

export const PROGRAM_STATS_FOOTNOTE = `Przykłady z oferty programu, ${PROGRAM_FIGURES_AS_OF}. Rabat liczony od ceny katalogowej. Ceny i dostępność się zmieniają; finansowanie wymaga pozytywnej oceny zdolności.`;

export interface Benefit {
  title: string;
  text: string;
}

export const EMPLOYEE_BENEFITS: Benefit[] = [
  { title: 'Rabat od ceny katalogowej', text: 'Przy każdej ofercie widzisz cenę katalogową i swoją cenę po rabacie.' },
  { title: 'Wszystko w jednej racie', text: 'W najmie: ubezpieczenie OC/AC/NNW, serwis ASO i assistance 24/7.' },
  { title: 'Karta Moya', text: '500 zł doładowania oraz zniżki na paliwo i zakupy w sklepach Moya. Wydawana po odbiorze auta.' },
  { title: 'Osobisty doradca', text: 'Kontakt w 24 godziny i pomoc od kalkulacji do odbioru kluczyków.' },
];

export const DEFAULT_B2B_PHONE = '+48 22 112 09 50';

export const B2B_CONTACT = {
  email: 'b2b@benefivo.pl',
  hours: 'pn.–pt., 9:00–17:00',
};

export function telHref(phone: string): string {
  return `tel:${phone.replace(/\s/g, '')}`;
}

/** Sales deck PDF placed in /public. Null hides the download button. */
export const B2B_DECK_PDF: string | null = null;

/** Scheduling link (Cal.com / Calendly / Google). Null sends the CTA to the contact form. */
export const B2B_BOOKING_URL: string | null = null;

export const PILOT_LINE = 'Program działa pilotażowo w firmie zatrudniającej ok. 700 osób.';

export interface SampleOffer {
  kind: 'rental' | 'financing';
  offerPath: string;
  imageUrl: string;
  title: string;
  subtitle: string;
  tag: string;
  priceLabel: string;
  price: string;
  note: string;
}

export const SAMPLE_OFFERS: SampleOffer[] = [
  {
    kind: 'rental',
    offerPath: '/najem/rental-cmsrl95j80010y0ljadtlxqts',
    imageUrl: '/uploads/rental-images/cmsrl95j80010y0ljadtlxqts/1786631158093-13ca2eadb2436308.webp',
    title: 'Hyundai i20',
    subtitle: '1.0 T-GDI 90 KM · automat',
    tag: 'Najem',
    priceLabel: 'Rata najmu brutto',
    price: 'od 1 281 zł/mies.',
    note: 'ubezpieczenie i serwis w racie',
  },
  {
    kind: 'rental',
    offerPath: '/najem/rental-cmtb9h9dc00979s4hjy7y95jc',
    imageUrl: '/uploads/specification-images/cmt9vtfor001q9s4hq0w9vmyq/img-1787739108170-637475758.webp',
    title: 'Jeep Avenger',
    subtitle: 'Summit 1.2 HEV · automat',
    tag: 'Najem',
    priceLabel: 'Rata najmu brutto',
    price: 'od 1 579 zł/mies.',
    note: 'ubezpieczenie i serwis w racie',
  },
  {
    kind: 'financing',
    offerPath: '/katalog/listing-cmtkaf5ll002pcyk6fd9l1uwr',
    imageUrl: '/uploads/listing-images/cmq24h8s80001egnxaomq1zk6/1780737057590-abefbd06098d523d.webp',
    title: 'Hyundai Tucson N Line',
    subtitle: '1.6 T-GDI 150 KM · automat',
    tag: '−31,6%',
    priceLabel: 'Twoja cena brutto',
    price: '134 338 zł',
    note: 'cena katalogowa 196 400 zł',
  },
];

/** Hero price-drop example (catalog → program price). */
export const HERO_PRICE_EXAMPLE = {
  imageUrl: '/uploads/listing-images/cmq24h8s80001egnxaomq1zk6/1780737057590-abefbd06098d523d.webp',
  title: 'Hyundai Tucson N Line',
  subtitle: '1.6 T-GDI 150 KM · automat · 2026',
  tag: 'Kredyt / leasing',
  catalogPrice: 196400,
  programPrice: 134338,
  discountLabel: '−31,6%',
};

export interface FaqItem {
  question: string;
  answer: string;
  /** Only approved answers are rendered. */
  approved: boolean;
}
