import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Car,
  ArrowRight,
  ChevronDown,
  CheckCircle2,
  Building2,
  Headset,
  FileText,
  Users,
  Briefcase,
  Phone,
  Mail,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { faqApi, leadsApi } from '@/services/api';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { MetaHead } from '@/components/seo/MetaHead';
import { useBrand } from '@/contexts/BrandContext';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useBusinessOfferList } from '@/hooks/useBusinessOfferList';
import { getListingUrlPath } from '@/utils/url-utils';
import { formatPhoneForTelLink } from '@/utils/formatters';
import { trackPhoneClick } from '@/lib/analytics';

// ─── Constants ───────────────────────────────────────────────────────────────

const YELLOW = 'hsl(var(--mt-yellow-500))';
const YELLOW_HOVER = 'hsl(var(--mt-yellow-600))';
// Brandbook rozdz. 01: żółć jest kolorem powierzchni, nie liter.
// Litery i ikony na jasnym tle idą w granacie (12,75:1 zamiast 1,66:1).
const ACCENT_INK = 'hsl(var(--mt-navy-700))';
const BLACK = 'hsl(var(--mt-navy-900))';

const PLN = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 });

// ─── Helpers ─────────────────────────────────────────────────────────────────

// CSS-owy odpowiednik framer-motionowego whileInView — ten sam wzorzec co
// MotoliaHomePage, żeby strona /dla-firm nie ciągnęła framer-motion do bundla.
const FadeIn = ({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: '-80px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : 'translateY(28px)',
        transition: `opacity 0.6s cubic-bezier(0.21,0.47,0.32,0.98) ${delay}s, transform 0.6s cubic-bezier(0.21,0.47,0.32,0.98) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
};

// ─── Data (copy 1:1 z docs/B2B_CONTENT_DLA_FIRM.md) ──────────────────────────

const DLA_KOGO = [
  {
    icon: Briefcase,
    title: 'Prowadzisz JDG',
    desc: 'Pierwsze auto na firmę? Leasing operacyjny od pierwszego dnia działalności — bez wymogu stażu. Cała rata w koszty, VAT do odliczenia, minimum formalności. Doradca policzy ratę netto zanim wybierzesz model.',
  },
  {
    icon: Users,
    title: 'Masz małą firmę (2–5 aut)',
    desc: 'Auta dla handlowców i serwisantów. Obsłużymy kilka wniosków naraz, wynegocjujemy warunki i dopilnujemy terminów odbioru — jeden opiekun prowadzi całość, nie każde auto osobno.',
  },
  {
    icon: Building2,
    title: 'Rozwijasz flotę (6–20 aut)',
    desc: 'Oferta flotowa z rabatami wieloautowymi i miksem leasingu oraz najmu. Przewidywalny koszt na budżet firmy, jeden opiekun do wszystkich umów — także przy kolejnych autach za rok.',
  },
];

const WYROZNIKI = [
  {
    title: 'Dedykowany opiekun firmy.',
    desc: 'Poznasz swojego doradcę z imienia i nazwiska. Jedna osoba do wszystkich aut i umów — także wtedy, gdy za rok dokupisz kolejne.',
  },
  {
    title: 'Oferty wielu finansujących = wyższa szansa na finansowanie.',
    desc: 'Jedna rozmowa, oferty wielu instytucji. Odmowa u jednej nie kończy tematu — ponawiamy wniosek u kolejnego partnera.',
  },
  {
    title: 'Od pierwszego auta po dwadzieścia.',
    desc: 'Obsługujemy jeden wniosek i kilkanaście naraz. Oferta rośnie z firmą, a rabaty wieloautowe negocjujemy pod konkretne zamówienie.',
  },
  {
    title: 'Leasing i najem pod podatki firmy.',
    desc: 'Dobieramy produkt do każdego auta z uwzględnieniem limitów kosztów 2026. Dostawczak w leasingu, auto zarządu w najmie — policzymy, co się opłaca.',
  },
  {
    title: 'JDG od pierwszego dnia działalności.',
    desc: 'Finansowanie także dla firm bez stażu, tam gdzie rynek stawia próg 12 miesięcy.',
  },
];

const JAK_PRACUJEMY = [
  {
    title: 'Rozmowa z doradcą (15 min).',
    desc: 'Potrzeby firmy, roczne kilometry, budżet, forma opodatkowania. Bez zobowiązań.',
  },
  {
    title: 'Oferta z porównaniem finansujących.',
    desc: 'Leasing czy najem, rata netto, z rekomendacją dopasowaną do Twojej firmy.',
  },
  {
    title: 'Wniosek i decyzja.',
    desc: 'Prowadzimy formalności za Ciebie; przy odmowie ponawiamy wniosek u innego partnera.',
  },
  {
    title: 'Odbiór auta u dealera.',
    desc: 'A opiekun zostaje z Tobą na kolejne auta i umowy.',
  },
];

const LEASING_VS_NAJEM = [
  {
    label: 'Własność i wykup',
    leasing: 'Auto możesz wykupić po umowie (wykup od kilku %)',
    najem: 'Bez wykupu — oddajesz auto i bierzesz nowe',
  },
  {
    label: 'Co zawiera rata',
    leasing: 'Finansowanie auta; serwis i ubezpieczenie opcjonalnie',
    najem: 'Rata all-in: serwis, ubezpieczenie, opony, assistance',
  },
  {
    label: 'Limit kilometrów',
    leasing: 'Bez limitu km',
    najem: 'Ustalany z góry roczny limit km',
  },
  {
    label: 'Korzyści podatkowe',
    leasing: 'Rata i odpisy w kosztach, VAT do odliczenia (50/100%)',
    najem: 'Cała rata w kosztach, VAT do odliczenia (50/100%)',
  },
  {
    label: 'Dla kogo',
    leasing: 'Firma, która chce mieć auto na koniec umowy',
    najem: 'Firma, która chce stały koszt i zero obsługi',
  },
];

// Social proof — placeholdery na realne dane (opinie z imieniem doradcy, liczby) nie są
// jeszcze dostępne; sekcja renderuje się tylko gdy tablica jest wypełniona (zasada z contentu).
const SOCIAL_PROOF: { quote: string; author: string }[] = [];

// ─── Component ───────────────────────────────────────────────────────────────

export default function MotoliaB2BPage() {
  const { config } = useBrand();
  const { i18n } = useTranslation();
  const { data: settings } = useAppSettings();
  const [openFaq, setOpenFaq] = React.useState<number | null>(0);
  const { data: offers, isLoading: offersLoading } = useBusinessOfferList();

  const phone = settings?.salesContactPhone || settings?.legalContactPhone || '';
  const email = settings?.legalContactEmail || '';

  const { data: faqData } = useQuery({
    queryKey: ['business-faq-motolia'],
    queryFn: async () => {
      const response = await faqApi.list({ page: 'business' });
      return (response.entries || [])
        .filter((e: any) => e.isPublished)
        .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    },
  });

  const getLocalized = (item: any, field: string) => {
    const langCode = i18n.language.slice(0, 2).toLowerCase();
    const suffix = langCode === 'pl' ? 'Pl' : langCode === 'en' ? 'En' : 'De';
    return item[`${field}${suffix}`] || '';
  };

  const dynamicFaqs = React.useMemo(() => {
    if (!faqData) return [];
    return faqData
      .filter(
        (item: any) =>
          getLocalized(item, 'question')?.trim() && getLocalized(item, 'answer')?.trim(),
      )
      .map((item: any) => ({
        id: item.id,
        q: getLocalized(item, 'question'),
        a: getLocalized(item, 'answer'),
      }));
  }, [faqData, i18n.language]);

  const faqSchema = React.useMemo(() => {
    if (dynamicFaqs.length === 0) return undefined;
    const url = typeof window !== 'undefined' ? `${window.location.origin}/dla-firm` : '/dla-firm';
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: dynamicFaqs.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    };
  }, [dynamicFaqs]);

  const [quickPhone, setQuickPhone] = React.useState('');
  const [quickStatus, setQuickStatus] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleQuickLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPhone) return;
    setQuickStatus('loading');
    try {
      await leadsApi.submitQuickLead({
        phone: quickPhone,
        message: 'Zapytanie z /dla-firm (opiekun firm)',
      });
      if (typeof window !== 'undefined') {
        (window as any).dataLayer = (window as any).dataLayer || [];
        (window as any).dataLayer.push({
          event: 'generate_lead',
          lead_type: 'quick_callback_business',
          form_id: 'b2b_page_cta_form',
          brand: config.id,
          lead_details: { phone: quickPhone.trim() },
        });
      }
      setQuickStatus('success');
      setQuickPhone('');
      setTimeout(() => setQuickStatus('idle'), 4000);
    } catch {
      setQuickStatus('error');
      setTimeout(() => setQuickStatus('idle'), 3000);
    }
  };

  return (
    <div className="bg-white min-h-screen text-foreground font-body selection:bg-yellow-200">
      {faqSchema && <MetaHead schema={faqSchema} />}
      <Header />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-background pt-14 pb-16 lg:pt-32 lg:pb-24">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, hsl(var(--mt-yellow-500) / 0.09) 0%, transparent 70%)` }} />
        <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, hsl(var(--mt-yellow-500) / 0.06) 0%, transparent 70%)` }} />

        <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold mb-8"
            style={{ background: `hsl(var(--mt-yellow-500) / 0.13)`, borderColor: `hsl(var(--mt-yellow-500) / 0.38)`, color: BLACK }}>
            <span style={{ color: ACCENT_INK }}>◆</span>
            Motolia dla firm
          </div>

          <h1 className="text-4xl lg:text-6xl font-heading font-bold tracking-tight mb-6 leading-[1.1] text-foreground">
            Auta dla Twojej firmy. Ważnej dla nas{' '}
            <span style={{ color: ACCENT_INK }}>od pierwszego samochodu</span>.
          </h1>

          <p className="text-xl text-gray-500 mb-10 leading-relaxed font-light max-w-2xl mx-auto">
            Nowe samochody w leasingu i najmie długoterminowym dla JDG i spółek — jedno auto
            czy dwadzieścia. Jeden opiekun, oferty wielu finansujących, rata policzona pod
            podatki Twojej firmy.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-4 justify-center">
            <a
              href="#kontakt-firmy"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
              style={{ background: YELLOW, color: BLACK, boxShadow: `0 4px 24px hsl(var(--mt-yellow-500) / 0.38)` }}
              onMouseEnter={e => (e.currentTarget.style.background = YELLOW_HOVER)}
              onMouseLeave={e => (e.currentTarget.style.background = YELLOW)}
            >
              Porozmawiaj z opiekunem firm
              <ArrowRight size={20} />
            </a>
            <a
              href="#oferty-dla-firm"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-lg border-2 border-gray-200 text-gray-700 hover:border-gray-400 hover:text-gray-900 transition-all duration-200"
            >
              Zobacz auta dostępne dla firm
            </a>
          </div>
          <p className="text-sm text-gray-400 mb-10">Oddzwaniamy tego samego dnia. Bez zobowiązań.</p>

          <div className="flex flex-wrap gap-x-8 gap-y-3 justify-center">
            {['Dedykowany opiekun', 'Oferty wielu finansujących', 'Od 1 do 20 aut'].map((badge) => (
              <div key={badge} className="flex items-center gap-2 text-gray-600 text-sm font-medium">
                <CheckCircle2 size={17} style={{ color: ACCENT_INK }} />
                {badge}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DLA KOGO ─────────────────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <FadeIn className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground">
              Finansujemy auta firm na{' '}
              <span style={{ color: ACCENT_INK }}>każdym etapie</span>
            </h2>
          </FadeIn>

          <div className="grid sm:grid-cols-3 gap-5">
            {DLA_KOGO.map((card, idx) => (
              <FadeIn key={card.title} delay={idx * 0.08}>
                <div className="bg-white border border-gray-100 rounded-3xl p-7 h-full hover:shadow-lg hover:border-gray-200 transition-all duration-300">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
                    style={{ background: `hsl(var(--mt-yellow-500) / 0.13)`, border: `1.5px solid hsl(var(--mt-yellow-500) / 0.31)` }}>
                    <card.icon size={24} style={{ color: ACCENT_INK }} />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2">{card.title}</h3>
                  <p className="text-gray-500 leading-relaxed text-sm">{card.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── WYRÓŻNIKI — dark section ─────────────────────────────────────── */}
      <section className="py-24 relative overflow-hidden" style={{ background: BLACK }}>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, hsl(var(--mt-yellow-500) / 0.04) 0%, transparent 70%)` }} />
        <div className="max-w-5xl mx-auto px-6 relative z-10">
          <FadeIn className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-white">
              Dlaczego firmy finansują auta{' '}
              <span style={{ color: YELLOW }}>z Motolią</span>
            </h2>
          </FadeIn>

          <div className="grid sm:grid-cols-2 gap-5">
            {WYROZNIKI.map((item, idx) => (
              <FadeIn key={item.title} delay={idx * 0.06}>
                <div className="p-7 rounded-3xl border h-full" style={{ background: 'hsl(var(--mt-navy-700))', borderColor: 'hsl(var(--mt-navy-600))' }}>
                  <h3 className="text-base font-bold mb-2 text-white">{item.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── JAK PRACUJEMY ────────────────────────────────────────────────── */}
      <section className="py-24 bg-background">
        <div className="max-w-6xl mx-auto px-6">
          <FadeIn className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground">
              Jak wygląda <span style={{ color: ACCENT_INK }}>współpraca</span>
            </h2>
          </FadeIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {JAK_PRACUJEMY.map((step, idx) => (
              <FadeIn key={step.title} delay={idx * 0.08}>
                <div className="bg-white border border-gray-100 rounded-3xl p-6 h-full">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center mb-4 font-bold text-sm"
                    style={{ background: YELLOW, color: BLACK }}>
                    {idx + 1}
                  </div>
                  <h3 className="text-base font-bold text-foreground mb-2">{step.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── OFERTY SPECJALNE DLA FIRM ────────────────────────────────────── */}
      <section className="py-24 bg-white" id="oferty-dla-firm">
        <div className="max-w-7xl mx-auto px-6">
          <FadeIn className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4 text-foreground">
              Oferty specjalne <span style={{ color: ACCENT_INK }}>dla firm</span>
            </h2>
            <p className="text-lg text-gray-500">
              Auta z ratą policzoną dla firmy - nowe modele popularne wśród naszych klientów
              firmowych, dostępne od ręki. Rata netto, w kosztach uzyskania przychodu.
            </p>
          </FadeIn>

          {offersLoading ? (
            <div className="py-8 text-center text-gray-400">Wczytywanie ofert…</div>
          ) : offers && offers.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {offers.map((offer, idx) => (
                <FadeIn key={offer.id} delay={idx * 0.06}>
                  <BusinessOfferCard offer={offer} />
                </FadeIn>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-gray-400">Wkrótce nowe oferty dla firm.</div>
          )}

          <div className="text-center mt-10">
            <Link
              to="/leasing"
              className="inline-flex items-center gap-1.5 text-sm font-bold underline underline-offset-4 decoration-2 transition-colors hover:no-underline"
              style={{ color: ACCENT_INK }}
            >
              Zobacz wszystkie auta w leasingu dla firm <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── LEASING CZY NAJEM ────────────────────────────────────────────── */}
      <section className="py-24 bg-background">
        <div className="max-w-5xl mx-auto px-6">
          <FadeIn className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground">
              Leasing czy <span style={{ color: ACCENT_INK }}>najem dla firmy</span>
            </h2>
          </FadeIn>

          <FadeIn>
            <div className="overflow-x-auto rounded-3xl border border-gray-100 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left p-4 font-semibold text-gray-500"></th>
                    <th className="text-left p-4 font-bold text-foreground">Leasing operacyjny</th>
                    <th className="text-left p-4 font-bold text-foreground">Najem długoterminowy</th>
                  </tr>
                </thead>
                <tbody>
                  {LEASING_VS_NAJEM.map((row) => (
                    <tr key={row.label} className="border-b border-gray-50 last:border-0">
                      <td className="p-4 font-semibold text-gray-500 whitespace-nowrap">{row.label}</td>
                      <td className="p-4 text-gray-600">{row.leasing}</td>
                      <td className="p-4 text-gray-600">{row.najem}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <p className="text-center text-gray-500 mt-8 max-w-2xl mx-auto">
              Nie musisz wybierać sam - doradca policzy oba warianty dla Twojej firmy i pokaże
              ratę netto obok siebie.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center mt-6 text-sm font-bold">
              <Link to="/leasing" style={{ color: ACCENT_INK }} className="inline-flex items-center gap-1.5 underline underline-offset-4 decoration-2 hover:no-underline">
                Zobacz, jak działa leasing samochodu dla firm <ArrowRight size={14} />
              </Link>
              <Link to="/wynajem-dlugoterminowy" style={{ color: ACCENT_INK }} className="inline-flex items-center gap-1.5 underline underline-offset-4 decoration-2 hover:no-underline">
                Sprawdź najem długoterminowy aut firmowych <ArrowRight size={14} />
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── PODATKI 2026 ─────────────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <FadeIn>
            <div className="rounded-3xl border border-gray-100 p-8 md:p-12">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6"
                style={{ background: `hsl(var(--mt-yellow-500) / 0.13)`, border: `1.5px solid hsl(var(--mt-yellow-500) / 0.31)` }}>
                <FileText size={24} style={{ color: ACCENT_INK }} />
              </div>
              <h2 className="text-3xl md:text-4xl font-heading font-bold mb-6 text-foreground">
                Limity kosztów 2026 —{' '}
                <span style={{ color: ACCENT_INK }}>ile realnie odliczysz</span>
              </h2>
              <p className="text-gray-600 leading-relaxed mb-6">
                Od 2026 roku limit zaliczenia auta do kosztów uzyskania przychodu zależy od
                emisji CO2 pojazdu:
              </p>
              <ul className="space-y-2 mb-6 text-gray-700">
                <li><strong>100 000 zł</strong> - auta spalinowe</li>
                <li><strong>150 000 zł</strong> - hybrydy plug-in (PHEV)</li>
                <li><strong>225 000 zł</strong> - auta elektryczne (EV)</li>
              </ul>
              <p className="text-gray-600 leading-relaxed mb-8">
                To zmienia rachunek przy wyborze modelu i formy finansowania — im wyższy limit,
                tym więcej raty realnie trafia w koszty firmy. Doradca policzy to dla
                konkretnego auta.
              </p>
              <a
                href="#kontakt-firmy"
                className="inline-flex items-center gap-2 font-bold px-6 py-3 rounded-2xl transition-all"
                style={{ background: YELLOW, color: BLACK }}
              >
                Zapytaj doradcę o limity 2026 <ArrowRight size={16} />
              </a>
              <p className="text-xs text-gray-400 mt-6">
                Powyższe ma charakter informacyjny i nie stanowi porady podatkowej. Ostateczne
                rozliczenie zależy od formy opodatkowania Twojej firmy.
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── PRACOWNICZY PROGRAM NAJMU ────────────────────────────────────── */}
      <section className="py-24 bg-background">
        <div className="max-w-4xl mx-auto px-6">
          <FadeIn>
            <div className="rounded-3xl p-8 md:p-12 text-center" style={{ background: BLACK }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6 mx-auto"
                style={{ background: `hsl(var(--mt-yellow-500) / 0.13)`, border: `1.5px solid hsl(var(--mt-yellow-500) / 0.25)` }}>
                <Headset size={24} style={{ color: YELLOW }} />
              </div>
              <h2 className="text-3xl md:text-4xl font-heading font-bold mb-6 text-white">
                Auto jako <span style={{ color: YELLOW }}>benefit dla pracowników</span>
              </h2>
              <p className="text-gray-400 leading-relaxed mb-8 max-w-2xl mx-auto">
                Twoi pracownicy wynajmują nowe auta na preferencyjnych warunkach
                wynegocjowanych dla firmy - bez angażowania kapitału firmy i z jednym
                opiekunem po stronie Motolii. Program dla firm od 10 pracowników.
              </p>
              <a
                href="#kontakt-firmy"
                className="inline-flex items-center gap-2 font-bold px-6 py-3 rounded-2xl transition-all"
                style={{ background: YELLOW, color: BLACK }}
              >
                Zapytaj o program dla swojej firmy <ArrowRight size={16} />
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── SOCIAL PROOF — tylko przy realnych danych ────────────────────── */}
      {SOCIAL_PROOF.length > 0 && (
        <section className="py-24 bg-white">
          <div className="max-w-6xl mx-auto px-6">
            <FadeIn className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground">
                Zaufały nam firmy <span style={{ color: ACCENT_INK }}>takie jak Twoja</span>
              </h2>
            </FadeIn>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {SOCIAL_PROOF.map((item) => (
                <div key={item.author} className="bg-white border border-gray-100 rounded-3xl p-7">
                  <p className="text-gray-600 text-sm leading-relaxed mb-4">„{item.quote}"</p>
                  <p className="text-sm font-bold text-foreground">{item.author}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      {dynamicFaqs.length > 0 && (
        <section className="py-24 bg-background" id="faq">
          <div className="max-w-4xl mx-auto px-6">
            <FadeIn className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-heading font-bold mb-5 text-foreground">
                Najczęściej zadawane <span style={{ color: ACCENT_INK }}>pytania</span>
              </h2>
              <p className="text-lg text-gray-500">
                Odpowiadamy na najczęstsze pytania firm o leasing, najem długoterminowy i
                finansowanie samochodów w Motolii - bez żargonu, z konkretami dla JDG i spółek.
              </p>
            </FadeIn>

            <div className="space-y-3">
              {dynamicFaqs.map((item, idx) => (
                <FadeIn key={item.id} delay={idx * 0.04}>
                  <div className="border border-gray-100 rounded-2xl overflow-hidden hover:border-gray-200 transition-all bg-white">
                    <button
                      onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                      className="w-full flex items-center justify-between p-6 text-left"
                    >
                      <h3 className="text-base font-semibold text-foreground pr-6">{item.q}</h3>
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${openFaq === idx ? 'rotate-180' : ''
                        }`}
                        style={{
                          background: openFaq === idx ? YELLOW : 'hsl(var(--mt-neutral-100))',
                          color: openFaq === idx ? BLACK : 'hsl(var(--mt-neutral-600))',
                        }}
                      >
                        <ChevronDown size={16} />
                      </div>
                    </button>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateRows: openFaq === idx ? '1fr' : '0fr',
                        opacity: openFaq === idx ? 1 : 0,
                        transition: 'grid-template-rows 0.25s, opacity 0.25s',
                      }}
                    >
                      <div className="overflow-hidden">
                        <div className="px-6 pb-6 text-gray-500 leading-relaxed border-t border-gray-100 pt-4">
                          {item.a}
                        </div>
                      </div>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA KOŃCOWE ───────────────────────────────────────────────────── */}
      <section className="py-24 px-6" id="kontakt-firmy" style={{ background: 'hsl(var(--mt-neutral-50))' }}>
        <div className="max-w-5xl mx-auto">
          <div className="relative rounded-[3rem] p-12 text-center overflow-hidden border"
            style={{ background: BLACK, borderColor: 'hsl(var(--mt-navy-700))' }}>
            <div className="absolute top-0 right-0 w-72 h-72 rounded-full pointer-events-none"
              style={{ background: `radial-gradient(circle, hsl(var(--mt-yellow-500) / 0.09) 0%, transparent 70%)` }} />

            <div className="relative z-10 max-w-2xl mx-auto">
              <FadeIn>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-8"
                  style={{ background: `hsl(var(--mt-yellow-500) / 0.13)`, border: `1.5px solid hsl(var(--mt-yellow-500) / 0.25)` }}>
                  <Car size={28} style={{ color: YELLOW }} />
                </div>

                <h2 className="text-4xl md:text-5xl font-heading font-bold text-white mb-5">
                  Porozmawiajmy o autach{' '}
                  <span style={{ color: YELLOW }}>dla Twojej firmy</span>
                </h2>
                <p className="text-lg text-gray-400 mb-10 font-light">
                  Zostaw numer - opiekun firm oddzwoni tego samego dnia i policzy ratę netto
                  dla Twojego auta. Bez zobowiązań.
                </p>

                <form className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto" onSubmit={handleQuickLead}>
                  <input
                    type="tel"
                    aria-label="Numer telefonu"
                    placeholder="Wpisz swój numer telefonu"
                    required
                    value={quickPhone}
                    onChange={e => setQuickPhone(e.target.value)}
                    className="flex-1 rounded-2xl px-6 py-4 text-white text-lg outline-none transition-all"
                    style={{ background: 'hsl(var(--mt-navy-700))', border: '2px solid hsl(var(--mt-navy-600))' }}
                    onFocus={e => (e.currentTarget.style.borderColor = YELLOW)}
                    onBlur={e => (e.currentTarget.style.borderColor = 'hsl(var(--mt-navy-600))')}
                  />
                  <button
                    type="submit"
                    disabled={quickStatus === 'loading'}
                    className="font-bold px-8 py-4 rounded-2xl transition-all duration-200 whitespace-nowrap text-foreground hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
                    style={{ background: YELLOW }}
                    onMouseEnter={e => (e.currentTarget.style.background = YELLOW_HOVER)}
                    onMouseLeave={e => (e.currentTarget.style.background = YELLOW)}
                  >
                    {quickStatus === 'loading'
                      ? 'Wysyłanie...'
                      : quickStatus === 'success'
                        ? 'Otrzymano!'
                        : quickStatus === 'error'
                          ? 'Błąd, spróbuj ponownie'
                          : 'Porozmawiaj z opiekunem firm'}
                  </button>
                </form>

                {(phone || email) && (
                  <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-gray-300 text-sm">
                    {phone && (
                      <a href={`tel:${formatPhoneForTelLink(phone)}`} onClick={() => trackPhoneClick('b2b_page_footer')} className="inline-flex items-center gap-2 font-medium hover:text-white">
                        <Phone size={15} /> {phone}
                      </a>
                    )}
                    {email && (
                      <a href={`mailto:${email}`} className="inline-flex items-center gap-2 font-medium hover:text-white">
                        <Mail size={15} /> {email}
                      </a>
                    )}
                  </div>
                )}

                <div className="mt-6 flex items-center justify-center gap-2 text-gray-500 text-sm">
                  <ShieldCheck size={15} /> Twoje dane są bezpieczne
                </div>
              </FadeIn>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

// ─── Karta oferty specjalnej dla firm ─────────────────────────────────────────

function BusinessOfferCard({ offer }: { offer: any }) {
  const image = offer.primaryImageUrl || offer.imageUrls?.[0] || '/motolia-placeholder.webp';
  // Miks form finansowania: pojazd najmu (offerKind 'rental') prowadzi na stronę najmu
  const isRental = offer.offerKind === 'rental';
  const href = isRental
    ? `/wynajem-dlugoterminowy/${offer.slug ?? offer.id}`
    : `${getListingUrlPath(offer, 'leasing')}/lead?context=business`;
  const netRate: number | null = (isRental ? offer.rentalNetRate : offer.referenceLeasingInstallment) ?? null;

  return (
    <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden hover:shadow-lg hover:border-gray-200 transition-all duration-300 flex flex-col h-full">
      <div className="aspect-[16/10] bg-gray-100 overflow-hidden">
        <img src={image} alt={`${offer.make} ${offer.model}`} className="w-full h-full object-cover" loading="lazy" />
      </div>
      <div className="p-6 flex flex-col gap-3 flex-1">
        <div className="inline-flex items-center gap-1.5 self-start px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide"
          style={{ background: `hsl(var(--mt-yellow-500) / 0.13)`, color: ACCENT_INK }}>
          {isRental ? 'Najem dla firm' : 'Oferta dla firm'}
        </div>
        <h3 className="font-bold text-lg text-foreground leading-tight">
          {offer.make} {offer.model} {offer.version ? <span className="font-normal text-gray-500">{offer.version}</span> : null}
        </h3>
        <p className="text-xs text-gray-400">{offer.productionYear}</p>

        {netRate ? (
          <div>
            <div className="text-2xl font-bold text-foreground">{PLN.format(netRate)} zł/mc</div>
            <p className="text-xs text-gray-400">
              {isRental ? 'netto - najem długoterminowy, rata w kosztach' : 'netto - dla firmy rata w kosztach'}
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Rata netto dopasowana do Twojej firmy — dopytaj doradcę.</p>
        )}

        <Link
          to={href}
          className="mt-auto inline-flex items-center justify-center gap-1.5 text-sm font-bold px-5 py-3 rounded-2xl transition-all"
          style={{ background: YELLOW, color: BLACK }}
        >
          {isRental ? 'Zobacz ofertę najmu' : 'Zapytaj o to auto na firmę'} <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
