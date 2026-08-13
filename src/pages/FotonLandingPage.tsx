import React, { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Truck,
  CheckCircle2,
  ArrowRight,
  HelpCircle,
  BadgeCheck,
  Compass,
} from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { MetaHead } from '@/components/seo/MetaHead';
import { FOTON_MODELS, type FotonSegment } from '@/data/foton-models';
import { FotonContextBar } from '@/components/foton/FotonContextBar';
import { FotonResponsibilityBlock } from '@/components/foton/FotonResponsibilityBlock';
import { FotonLeadForm } from '@/components/foton/FotonLeadForm';

// ─── Lightweight IntersectionObserver FadeIn ──────────────────────────────────
const FadeIn = ({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: '-60px' },
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
        transform: visible ? 'none' : 'translateY(24px)',
        transition: `opacity 0.6s cubic-bezier(0.21,0.47,0.32,0.98) ${delay}s, transform 0.6s cubic-bezier(0.21,0.47,0.32,0.98) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
};

const FAQ_ITEMS = [
  {
    q: 'Czy Motolia jest dealerem lub importerem marki FOTON?',
    a: 'Nie. Motolia Sp. z o.o. działa jako Agent Importera marki FOTON – firmy Power Truck Poland Sp. z o.o. Umowa sprzedaży pojazdu zawierana jest bezpośrednio z Power Truck Poland Sp. z o.o. Rola Motolii polega na profesjonalnym doborze pojazdu, przeprowadzeniu konfiguracji oraz wynegocjowaniu optymalnego finansowania w bankach i firmach leasingowych.',
  },
  {
    q: 'Dlaczego warto zamówić pojazd FOTON przez brokera finansowego Motolia?',
    a: 'FOTON to nowa marka na polskim rynku, przez co tradycyjne instytucje finansowe bywają ostrożne przy wycenie wartości rezydualnej. Motolia współpracuje z Inbank, PKO, Erste, Vehis, Masterlease, BNP Paribas i wieloma instytucjami w Polsce, dzięki czemu dobieramy finansowanie tam, gdzie warunki są najkorzystniejsze.',
  },
  {
    q: 'Jak przebiega serwis oraz realizacja gwarancji na pojazdy FOTON?',
    a: 'Gwarancji na pojazdy udziela importer Power Truck Poland Sp. z o.o. Obowiązuje gwarancja fabryczna 5 lat lub 200 000 km na cały pojazd oraz 8 lat lub 400 000 km na baterie trakcyjne w modelach elektrycznych. Obsługę serwisową i przeglądy wykonuje sieć autoryzowanych partnerów serwisowych Power Truck Poland w Polsce.',
  },
  {
    q: 'Jakie są zalety podatkowe zakupu pickupa Tunland G7 na firmę?',
    a: 'Pickup z otwartą lub zamykaną roletą skrzynią ładunkową pozwala na korzystne zaliczanie wydatków eksploatacyjnych w koszty uzyskania przychodu. Doradcy Motolii pomogą ustrukturyzować umowę leasingu operacyjnego tak, aby optymalnie wykorzystać korzyści podatkowe w Twojej działalności.',
  },
  {
    q: 'Jakie formy finansowania oferuje Motolia na pojazdy FOTON?',
    a: 'Dla klientów B2B oraz flot oferujemy elastyczny leasing operacyjny, najem długoterminowy z pełną obsługą (FSL), kredyt firmowy oraz pożyczkę leasingową. Płatność raty ubezpieczeniowej można dogodnie połączyć w jedną ratę miesięczną.',
  },
];

export default function FotonLandingPage() {
  // Seed values for the shared lead form. Changing this remounts the form
  // (via `key`) with the requested segment/model preselected.
  const [formSeed, setFormSeed] = useState<{ segment: FotonSegment; modelId: string }>({
    segment: 'fleet',
    modelId: 'etoano-pro',
  });

  const scrollToForm = (segment: FotonSegment, modelId?: string) => {
    const resolvedModelId = modelId || (segment === 'fleet' ? 'etoano-pro' : 'tunland-g7');
    setFormSeed({ segment, modelId: resolvedModelId });
    document.getElementById('foton-lead-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  // Structured Data JSON-LD
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Strona główna',
        item: 'https://motolia.pl/',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'FOTON',
        item: 'https://motolia.pl/foton',
      },
    ],
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  };

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      <MetaHead
        title="FOTON – Pojazdy Użytkowe i Pickupy 4x4 | Motolia"
        description="Zamów pojazd użytkowy FOTON przez Motolię – Agenta Importera. Pickupy Tunland G7, vany eToano i ciężarówki eAumark z doradztwem i elastycznym finansowaniem B2B."
        canonical="/foton"
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* Global Header */}
      <Header />

      {/* ─── STICKY CONTEXT BAR (DISCLOSURE LAYER 1) ─────────────────────────── */}
      <FotonContextBar />

      {/* Main Container Wrapper */}
      <main className="flex-1">
        {/* ─── HERO SECTION ─────────────────────────────────────────────────── */}
        <section className="relative pt-12 pb-20 overflow-hidden bg-gradient-to-b from-[#0B132B] via-[#090D16] to-[#090D16]">
          {/* Ambient Background Glows */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-amber-500/10 blur-[140px] pointer-events-none rounded-full" />
          <div className="absolute top-1/3 right-10 w-[400px] h-[300px] bg-cyan-500/10 blur-[120px] pointer-events-none rounded-full" />

          <div className="container relative z-10 mx-auto px-4">
            <FadeIn>
              <div className="max-w-3xl mx-auto text-center space-y-6">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 text-xs font-semibold tracking-wide uppercase">
                  <BadgeCheck className="w-4 h-4 text-amber-400" />
                  Autoryzowany Partner Handlowy Marki FOTON
                </div>

                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-none">
                  Pojazdy użytkowe <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500">FOTON</span> z pewnym finansowaniem
                </h1>

                <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto">
                  FOTON to nowa marka pojazdów w Polsce – sfinansowanie nowej marki bywa wyzwaniem dla tradycyjnych banków. Motolia jako broker finansowy <strong className="text-white">rozwiązuje ten kluczowy element transakcji</strong>, dobierając leasing i najem z oferty partnerów takich jak Inbank, PKO, Erste, Vehis, Masterlease czy BNP Paribas.
                </p>
              </div>
            </FadeIn>

            {/* ─── TWO SEGMENT BRANCHING CARDS ─────────────────────────────────── */}
            <div className="grid md:grid-cols-2 gap-6 mt-12 max-w-4xl mx-auto">
              {/* Segment 1: Flota / Użytkowe */}
              <FadeIn delay={0.1}>
                <div className="group relative rounded-2xl bg-gradient-to-b from-slate-800/90 to-slate-900/90 border border-slate-700/80 p-6 sm:p-8 hover:border-cyan-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-cyan-950/20 flex flex-col justify-between h-full">
                  <div className="space-y-4">
                    <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                      <Truck className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                        Segment Flotowy & Dostawczy
                      </span>
                      <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
                        Dostawcze, vany i ciężarówki
                      </h2>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      Modele <strong>eToano Pro, Cavan, eMiler, eAumark i Aumark S</strong>. Optymalne TCO w miejskiej logistyce, napędy zeroemisyjne oraz gwarancja baterii do 8 lat.
                    </p>
                    <ul className="space-y-2 text-xs sm:text-sm text-slate-300 pt-2">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                        Optymalne TCO i ubezpieczenie w stałej racie
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                        Swobodny wjazd do Stref Czystego Transportu (SCT, stan na 2026 r.)
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                        Dedykowany opiekun flotowy Motolii
                      </li>
                    </ul>
                  </div>
                  <div className="pt-6">
                    <button
                      onClick={() => scrollToForm('fleet')}
                      className="w-full py-3.5 px-6 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm transition-all duration-200 shadow-lg shadow-cyan-950/40 flex items-center justify-center gap-2 group-hover:gap-3"
                    >
                      Zapytaj o ofertę dla floty
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </FadeIn>

              {/* Segment 2: Lifestyle / Pickupy */}
              <FadeIn delay={0.2}>
                <div className="group relative rounded-2xl bg-gradient-to-b from-slate-800/90 to-slate-900/90 border border-slate-700/80 p-6 sm:p-8 hover:border-amber-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-amber-950/20 flex flex-col justify-between h-full">
                  <div className="space-y-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                      <Compass className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                        Segment Lifestyle & Pickupy
                      </span>
                      <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
                        Tunland G7 & V9 (4x4)
                      </h2>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      Wydajny pickup z silnikiem wysokoprężnym <strong>119 kW (390 Nm)</strong> lub układem Mild Hybrid (163+12 KM), napędem 4WD i blokadami dyferencjału. Do pracy w terenie i na weekend.
                    </p>
                    <ul className="space-y-2 text-xs sm:text-sm text-slate-300 pt-2">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                        Silnik wysokoprężny AVL lub 2.0 Mild Hybrid + automat 8AT
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                        Korzyści podatkowe dla JDG i rzemiosła
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                        Solidna konstrukcja ramowa do zastosowań specjalnych
                      </li>
                    </ul>
                  </div>
                  <div className="pt-6 space-y-2">
                    <button
                      onClick={() => scrollToForm('lifestyle', 'tunland-g7')}
                      className="w-full py-3.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-all duration-200 shadow-lg shadow-amber-950/40 flex items-center justify-center gap-2 group-hover:gap-3"
                    >
                      Policz ratę dla Tunlanda
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <div className="text-center pt-1">
                      <Link
                        to="/nowe"
                        className="text-xs text-slate-400 hover:text-amber-400 underline transition-colors"
                      >
                        Zobacz dostępne samochody nowe →
                      </Link>
                    </div>
                  </div>
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* ─── DISCLOSURE LAYER 2: KTO ZA CO ODPOWIADA (3 COLUMNS) ─────────────── */}
        <FotonResponsibilityBlock />

        {/* ─── MODEL CATALOG GRID ───────────────────────────────────────────── */}
        <section className="py-20 bg-[#090D16]">
          <div className="container mx-auto px-4">
            <FadeIn>
              <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    Portfolio Pojazdów Użytkowych
                  </span>
                  <h2 className="text-3xl sm:text-4xl font-black text-white mt-1">
                    Przegląd modeli FOTON
                  </h2>
                </div>
                <div className="text-sm text-slate-400 max-w-md">
                  Wybierz pojazd dostosowany do wymagań Twojego biznesu – od terenowego pickupa po ciężarowe podwozie pod zabudowę.
                </div>
              </div>
            </FadeIn>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {FOTON_MODELS.map((model, idx) => (
                <FadeIn key={model.id} delay={0.05 * idx}>
                  <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden hover:border-slate-700 transition-all duration-300 flex flex-col justify-between h-full group">
                    <div>
                      {/* Image Container */}
                      <div className="relative h-48 sm:h-52 overflow-hidden bg-slate-950">
                        <img
                          src={model.images[0]?.src}
                          alt={model.images[0]?.alt || model.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-85"
                          loading="lazy"
                          decoding="async"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
                        <span className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md text-amber-400 border border-amber-500/30 text-[11px] font-bold px-2.5 py-1 rounded-md">
                          {model.categoryLabel}
                        </span>
                      </div>

                      {/* Info Body */}
                      <div className="p-6 space-y-4">
                        <div>
                          <Link to={`/foton/${model.id}`}>
                            <h3 className="text-xl font-bold text-white group-hover:text-amber-400 transition-colors">
                              {model.name}
                            </h3>
                          </Link>
                          <p className="text-xs text-slate-400 mt-0.5 font-medium">{model.tagline}</p>
                        </div>

                        {/* Quick Specs */}
                        <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                          <div>
                            <span className="text-slate-400 block text-[10px]">Napęd / Silnik:</span>
                            <span className="font-semibold text-slate-200 line-clamp-1">{model.engine}</span>
                          </div>
                          {model.drivetrain && (
                            <div>
                              <span className="text-slate-400 block text-[10px]">Układ napędowy:</span>
                              <span className="font-semibold text-slate-200 line-clamp-1">{model.drivetrain}</span>
                            </div>
                          )}
                          {model.range && (
                            <div>
                              <span className="text-slate-400 block text-[10px]">Zasięg EV:</span>
                              <span className="font-semibold text-cyan-400">{model.range}</span>
                            </div>
                          )}
                          {model.volume && (
                            <div>
                              <span className="text-slate-400 block text-[10px]">Pojemność:</span>
                              <span className="font-semibold text-slate-200">{model.volume}</span>
                            </div>
                          )}
                        </div>

                        {/* Highlights */}
                        <ul className="space-y-1.5 text-xs text-slate-300 pt-1">
                          {model.highlights.map((h, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="text-amber-400 font-bold">•</span>
                              <span>{h}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="p-6 pt-0 space-y-2">
                      <Link
                        to={`/foton/${model.id}`}
                        className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-all duration-200 flex items-center justify-center gap-1.5"
                      >
                        Zobacz specyfikację
                      </Link>
                      <button
                        onClick={() => scrollToForm(model.category, model.id)}
                        className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 font-semibold text-xs transition-all duration-200 flex items-center justify-center gap-1.5"
                      >
                        Zapytaj o ten model
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ─── WHY MOTOLIA VALUE PROPOSITION ───────────────────────────────── */}
        <section className="py-16 bg-slate-950 border-t border-slate-800">
          <div className="container mx-auto px-4">
            <FadeIn>
              <div className="max-w-3xl mx-auto text-center space-y-3 mb-12">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Przewaga brokera finansowego
                </span>
                <h2 className="text-2xl sm:text-4xl font-bold text-white">
                  Dlaczego warto zamówić FOTON przez Motolię?
                </h2>
                <p className="text-sm text-slate-400">
                  Rozwiązujemy największe wyzwania przy zakupie nowej marki pojazdów użytkowych w Polsce.
                </p>
              </div>
            </FadeIn>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              <FadeIn delay={0.1}>
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
                    01
                  </div>
                  <h3 className="text-lg font-bold text-white">Dostęp do wielu banków</h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Nowe marki rzadko posiadają fabryczny bank w Polsce. Motolia jako broker współpracuje z Inbank, PKO, Erste, Vehis, Masterlease, BNP Paribas i wieloma firmami leasingowymi, pomagając sprawnie tam, gdzie standardowe procedury jednomarkowe wymagają większej elastyczności lub dopasowania wielu źródeł finansowania.
                  </p>
                </div>
              </FadeIn>

              <FadeIn delay={0.2}>
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
                    02
                  </div>
                  <h3 className="text-lg font-bold text-white">Ubezpieczenie w racie</h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Łączymy pakiet ubezpieczenia OC/AC/NNW bezpośrednio w stałą ratę leasingową. Otrzymujesz przejrzysty budżet miesięczny bez przykrych niespodzianek na koniec roku.
                  </p>
                </div>
              </FadeIn>

              <FadeIn delay={0.3}>
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
                    03
                  </div>
                  <h3 className="text-lg font-bold text-white">Dedykowana obsługa B2B</h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Twój doradca Motolii sprawnie poprowadzi cały proces – od doboru specyfikacji, przez przygotowanie dokumentów finansowych, po koordynację wydania pojazdu z importerem.
                  </p>
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* ─── LEAD GENERATION FORM (DISCLOSURE LAYER 3) ────────────────────── */}
        <FadeIn>
          <FotonLeadForm
            key={`${formSeed.segment}-${formSeed.modelId}`}
            defaultSegment={formSeed.segment}
            defaultModelId={formSeed.modelId}
            trafficSource="foton_landing"
          />
        </FadeIn>

        {/* ─── DEDICATED FAQ SECTION ────────────────────────────────────────── */}
        <section className="py-20 bg-slate-950 border-t border-slate-800">
          <div className="container mx-auto px-4 max-w-3xl">
            <FadeIn>
              <div className="text-center space-y-2 mb-12">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Pytania i Odpowiedzi
                </span>
                <h2 className="text-3xl font-bold text-white">Najczęściej zadawane pytania</h2>
              </div>
            </FadeIn>

            <div className="space-y-4">
              {FAQ_ITEMS.map((item, index) => (
                <FadeIn key={index} delay={0.05 * index}>
                  <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-2">
                    <h3 className="text-base sm:text-lg font-bold text-white flex items-start gap-3">
                      <HelpCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      {item.q}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 pl-8 leading-relaxed">
                      {item.a}
                    </p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Global Footer */}
      <Footer />
    </div>
  );
}
