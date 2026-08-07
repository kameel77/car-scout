import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Truck,
  ShieldCheck,
  Zap,
  CheckCircle2,
  ChevronDown,
  Phone,
  Mail,
  ArrowRight,
  HelpCircle,
  Award,
  Building2,
  Wrench,
  BadgeCheck,
  Compass,
  Briefcase,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { MetaHead } from '@/components/seo/MetaHead';
import { leadsApi } from '@/services/api';
import { trackLeadSubmit } from '@/lib/analytics';
import { useToast } from '@/components/ui/use-toast';

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

// ─── Data & Content (Strictly Verified with Importer Specs) ───────────────────

const FOTON_MODELS = [
  {
    id: 'tunland-g7',
    category: 'lifestyle',
    categoryLabel: 'Pickup 4x4 · Diesel',
    name: 'FOTON Tunland G7',
    tagline: 'Do pracy i na co dzień',
    engine: 'Silnik wysokoprężny AVL (119 kW / 390 Nm)',
    drivetrain: '4WD BorgWarner (2H/AUTO/4H/4L) + blokada Eatona',
    transmission: 'Automatyczna skrzynia ZF 8AT',
    highlights: [
      'Silnik wysokoprężny Common Rail Bosch (zużycie ok. 7,5 l/100 km)',
      'Wyposażenie: kamery 360°, podgrzewane fotele, ekran 10,25"',
      'Systemy bezpieczeństwa: BSD, FCW, LCA, 6 poduszek powietrznych',
      'Korzyści podatkowe dla firm: odliczenie VAT oraz kosztów eksploatacji',
    ],
    image: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'tunland-v9',
    category: 'lifestyle',
    categoryLabel: 'Pickup 4x4 · Mild Hybrid',
    name: 'FOTON Tunland V9',
    tagline: 'Pickup z układem 48V Mild Hybrid',
    engine: '2.0 turbodiesel AUCAN + 48V Mild Hybrid (163 + 12 KM, 400 + 50 Nm)',
    drivetrain: 'Napęd 4WD z 6 trybami jazdy + blokada dyferencjału na obu osiach',
    transmission: 'Automatyczna skrzynia biegów 8AT',
    highlights: [
      'Napęd 2.0 turbodiesel AUCAN wspomagany układem 48V Mild Hybrid (163 + 12 KM)',
      'Blokada dyferencjału na obu osiach oraz 6 profesjonalnych trybów terenowych',
      '5 gwiazdek w testach bezpieczeństwa C-NCAP',
      'Nowoczesny cyfrowy kokpit z bogatym wyposażeniem w standardzie',
    ],
    image: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'etoano-pro',
    category: 'fleet',
    categoryLabel: 'Dostawczy EV · Furgon',
    name: 'FOTON eToano Pro',
    tagline: 'Zeroemisyjny furgon dla logistyki miejskiej',
    engine: 'Elektryczny 184 KM',
    drivetrain: 'Bateria CATL',
    range: 'do 357 km (cykl WLTP)',
    volume: 'do 10,4 m³ przestrzeni ładunkowej',
    highlights: [
      'Silnik elektryczny o mocy 184 KM oraz wydajna bateria CATL',
      'Zasięg do 357 km w cyklu WLTP',
      'Przestrzeń ładunkowa do 10,4 m³',
      'Gwarancja na baterię trakcyjną: 8 lat / 400 000 km',
      'Swobodny wjazd do Stref Czystego Transportu (SCT, stan na 2026 r.)',
    ],
    image: 'https://images.unsplash.com/photo-1559297434-fae8a1916a79?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'cavan-c1',
    category: 'fleet',
    categoryLabel: 'Kompaktowy Van EV',
    name: 'FOTON Cavan C1',
    tagline: 'Zwinny van do dystrybucji Ostatniej Mili',
    engine: 'Napęd elektryczny e-drive',
    drivetrain: 'Ładowanie prądem stałym DC',
    highlights: [
      'Wydajny napęd elektryczny z szybkim ładowaniem DC',
      'Kompaktowa i zwrotna konstrukcja stworzona do wąskich ulic miast',
      'Ergonomiczna kabina kierowcy z nowoczesną telematyką flotową',
    ],
    image: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'eaumark',
    category: 'fleet',
    categoryLabel: 'Pojazd Ciężarowy EV · N2',
    name: 'FOTON eAumark',
    tagline: 'Elektryczne podwozie pod zabudowę',
    engine: 'Napęd elektryczny',
    drivetrain: 'Bateria CATL LFP',
    highlights: [
      'Podwozie pod dowolną zabudowę (chłodnia, kontener, wywrotka)',
      'Przystosowany do dostaw miejskich i zadań komunalnych',
      'Cicha praca umożliwiająca nocny transport',
    ],
    image: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'aumark-s',
    category: 'fleet',
    categoryLabel: 'Ciężarowy Diesel · N2/N3',
    name: 'FOTON Aumark S',
    tagline: 'Ciężarówka dystrybucyjna',
    engine: 'Silnik wysokoprężny',
    drivetrain: 'Skrzynia biegów ZF + osie Dana',
    highlights: [
      'Sprawdzony napęd z osprzętem o wysokiej trwałości',
      'Konstrukcja zoptymalizowana pod kątem eksploatacji flotowej',
      'Gwarancja fabryczna producenta: 5 lat / 200 000 km',
    ],
    image: 'https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&w=900&q=80',
  },
];

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
  const { toast } = useToast();

  // Form State
  const [selectedSegment, setSelectedSegment] = useState<'fleet' | 'lifestyle'>('fleet');
  const [selectedModel, setSelectedModel] = useState<string>('etoano-pro');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [message, setMessage] = useState('');
  const [consentPrivacy, setConsentPrivacy] = useState(true);
  const [consentMarketing, setConsentMarketing] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const formRef = useRef<HTMLDivElement>(null);

  const scrollToForm = (segment: 'fleet' | 'lifestyle', modelId?: string) => {
    setSelectedSegment(segment);
    if (modelId) setSelectedModel(modelId);
    else {
      setSelectedModel(segment === 'fleet' ? 'etoano-pro' : 'tunland-g7');
    }
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || (!email && !phone)) {
      toast({
        title: 'Błąd w formularzu',
        description: 'Podaj imię oraz numer telefonu lub adres email.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const leadType = selectedSegment === 'fleet' ? 'foton_fleet' : 'foton_lifestyle';
      const modelObj = FOTON_MODELS.find((m) => m.id === selectedModel);
      const fullMessage = [
        `Segment: ${selectedSegment === 'fleet' ? 'Flota / Użytkowe' : 'Lifestyle / Pickupy'}`,
        `Wybrany model: ${modelObj?.name || selectedModel}`,
        companyName ? `Firma: ${companyName}` : '',
        message ? `Wiadomość: ${message}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      await leadsApi.submitLead({
        name,
        email,
        phone,
        leadType,
        trafficSource: 'foton_landing',
        message: fullMessage,
        consentPrivacy,
        consentMarketing,
      });

      trackLeadSubmit({
        formId: 'foton_landing_form',
        leadType,
        brand: 'FOTON',
        model: modelObj?.name,
        phone,
      });

      setIsSubmitted(true);
      toast({
        title: 'Zapytanie zostało wysłane',
        description: 'Doradca Motolii skontaktuje się z Tobą w najbliższym czasie.',
      });
    } catch (err: any) {
      toast({
        title: 'Błąd wysyłania',
        description: err.message || 'Nie udało się wysłać formularza. Spróbuj ponownie.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
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
      <div className="bg-slate-900/90 border-b border-amber-500/30 backdrop-blur-md text-slate-300 text-xs py-2 px-4 sticky top-[72px] lg:top-[80px] z-40">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              FOTON
            </span>
            <span className="hidden sm:inline text-slate-400">•</span>
            <span className="text-slate-200">
              Pojazdy użytkowe i pickupy – Motolia działa jako <strong className="text-white">Agent Importera</strong>
            </span>
          </div>
          <a
            href="#odpowiedzialnosc"
            className="text-amber-400 hover:text-amber-300 underline underline-offset-4 flex items-center gap-1 font-medium transition-colors"
          >
            Kto za co odpowiada <ChevronDown className="w-3 h-3" />
          </a>
        </div>
      </div>

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
        <section id="odpowiedzialnosc" className="py-16 bg-slate-950 border-y border-slate-800">
          <div className="container mx-auto px-4">
            <FadeIn>
              <div className="text-center max-w-2xl mx-auto mb-10">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Przejrzyste ramy współpracy
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-white mt-1">
                  Kto za co odpowiada w transakcji?
                </h2>
                <p className="text-sm text-slate-400 mt-2">
                  Kompletny podział ról zapewnia przejrzystość procesową, bezpieczeństwo zakupu i sprawny czas realizacji.
                </p>
              </div>
            </FadeIn>

            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {/* Kolumna 1: Sprzedaż */}
              <FadeIn delay={0.1}>
                <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-3 h-full">
                  <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-white">1. Sprzedaż i Umowa</h3>
                  <p className="text-xs font-semibold text-amber-400">Power Truck Poland Sp. z o.o.</p>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Sprzedawca i wyłączny importer pojazdu. Umowa sprzedaży pojazdu zawierana jest bezpośrednio z Power Truck Poland Sp. z o.o.
                  </p>
                </div>
              </FadeIn>

              {/* Kolumna 2: Finansowanie (MOTOLIA - WYRÓŻNIONA) */}
              <FadeIn delay={0.2}>
                <div className="rounded-xl bg-gradient-to-b from-slate-900 to-slate-900/90 border-2 border-amber-500/80 p-6 space-y-3 relative shadow-lg shadow-amber-950/20 h-full">
                  <div className="absolute -top-3 right-4 bg-amber-500 text-slate-950 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wide">
                    Rola Motolii
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-white">2. Finansowanie & Dobór</h3>
                  <p className="text-xs font-bold text-amber-400">Motolia Sp. z o.o. (Agent Importera)</p>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                    Dobieramy leasing, najem długoterminowy lub kredyt z oferty instytucji partnerskich. Pomagamy uzyskać decyzję dla nowej marki i włączamy ubezpieczenie w ratę.
                  </p>
                </div>
              </FadeIn>

              {/* Kolumna 3: Serwis */}
              <FadeIn delay={0.3}>
                <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-3 h-full">
                  <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
                    <Wrench className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-white">3. Serwis i Gwarancja</h3>
                  <p className="text-xs font-semibold text-amber-400">Power Truck Poland / Partnerzy</p>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Gwarancję fabryczną (5 lat / 200 tys. km) zapewnia importer. Obsługę serwisową realizuje autoryzowana sieć partnerów w Polsce.
                  </p>
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

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
                          src={model.image}
                          alt={model.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-85"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
                        <span className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md text-amber-400 border border-amber-500/30 text-[11px] font-bold px-2.5 py-1 rounded-md">
                          {model.categoryLabel}
                        </span>
                      </div>

                      {/* Info Body */}
                      <div className="p-6 space-y-4">
                        <div>
                          <h3 className="text-xl font-bold text-white group-hover:text-amber-400 transition-colors">
                            {model.name}
                          </h3>
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

                    {/* Card Action */}
                    <div className="p-6 pt-0">
                      <button
                        onClick={() => scrollToForm(model.category as 'fleet' | 'lifestyle', model.id)}
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
        <section ref={formRef} className="py-20 bg-[#090D16] relative">
          <div className="container mx-auto px-4 max-w-3xl">
            <FadeIn>
              <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-10 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 blur-[100px] pointer-events-none" />

                <div className="text-center space-y-2 mb-8">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    Formularz Kontaktowy
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-white">
                    Zapytaj o ofertę i finansowanie FOTON
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400">
                    Wypełnij krótki formularz – doradca Motolii przygotuje kalkulację raty i odpowie na pytania.
                  </p>
                </div>

                {isSubmitted ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-8 text-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-white">Dziękujemy za przesłanie zapytania!</h3>
                    <p className="text-sm text-slate-300">
                      Twój formularz został zarejestrowany. Doradca handlowy Motolii skontaktuje się z Tobą telefonicznie lub mailowo w ciągu 24 godzin.
                    </p>
                    <button
                      onClick={() => setIsSubmitted(false)}
                      className="px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
                    >
                      Wyślij kolejne zapytanie
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Segment Selector */}
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-400 mb-2">
                        Wybierz interesujący Cię segment:
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSegment('fleet');
                            setSelectedModel('etoano-pro');
                          }}
                          className={`py-3 px-4 rounded-xl border text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                            selectedSegment === 'fleet'
                              ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <Truck className="w-4 h-4" />
                          Flota / Dostawcze
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSegment('lifestyle');
                            setSelectedModel('tunland-g7');
                          }}
                          className={`py-3 px-4 rounded-xl border text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                            selectedSegment === 'lifestyle'
                              ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <Compass className="w-4 h-4" />
                          Lifestyle / Pickupy
                        </button>
                      </div>
                    </div>

                    {/* Model Select */}
                    <div>
                      <label htmlFor="foton-model-select" className="block text-xs font-bold uppercase text-slate-400 mb-1">
                        Wybierz model pojazdu:
                      </label>
                      <select
                        id="foton-model-select"
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                      >
                        {FOTON_MODELS.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.categoryLabel})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Contact Inputs */}
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="foton-name-input" className="block text-xs font-medium text-slate-300 mb-1">
                          Imię i Nazwisko *
                        </label>
                        <input
                          id="foton-name-input"
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Jan Kowalski"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="foton-company-input" className="block text-xs font-medium text-slate-300 mb-1">
                          Nazwa firmy / NIP (opcjonalnie)
                        </label>
                        <input
                          id="foton-company-input"
                          type="text"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="Moja Firma Sp. z o.o."
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="foton-phone-input" className="block text-xs font-medium text-slate-300 mb-1">
                          Numer telefonu *
                        </label>
                        <input
                          id="foton-phone-input"
                          type="tel"
                          required
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+48 600 000 000"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="foton-email-input" className="block text-xs font-medium text-slate-300 mb-1">
                          Adres e-mail
                        </label>
                        <input
                          id="foton-email-input"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="jan@firma.pl"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="foton-message-input" className="block text-xs font-medium text-slate-300 mb-1">
                        Dodatkowe pytania / wymagania flotowe
                      </label>
                      <textarea
                        id="foton-message-input"
                        rows={3}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="np. interesuje mnie kalkulacja najmu na 36 miesięcy z przebiegiem 30 000 km/rok..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* ─── DISCLOSURE LAYER 3: INLINE LEGAL NOTICE ───────────────────── */}
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-400 leading-relaxed">
                      <p>
                        Wysyłając formularz kontaktujesz się z <strong>Motolia Sp. z o.o.</strong>, działającą jako Agent Importera marki FOTON. Umowa sprzedaży pojazdu zawierana jest z Power Truck Poland Sp. z o.o.
                      </p>
                    </div>

                    {/* Consents */}
                    <div className="space-y-2 text-xs text-slate-400">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={consentPrivacy}
                          onChange={(e) => setConsentPrivacy(e.target.checked)}
                          className="mt-0.5 rounded bg-slate-950 border-slate-800 text-amber-500 focus:ring-0"
                        />
                        <span>
                          Zapoznałem/am się z Polityką Prywatności i wyrażam zgodę na przetwarzanie moich danych osobowych w celu przygotowania oferty. *
                        </span>
                      </label>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-4 px-8 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-extrabold text-base transition-all duration-200 shadow-xl shadow-amber-950/40 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? 'Wysyłanie zapytania...' : 'Wyślij zapytanie o FOTON'}
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </form>
                )}
              </div>
            </FadeIn>
          </div>
        </section>

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
