import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Car,
  CreditCard,
  ArrowRight,
  ChevronDown,
  CheckCircle2,
  Zap,
  Building2,
  Headset,
  FileText,
  Clock,
  Users,
  Briefcase,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { faqApi, leadsApi } from '@/services/api';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { useBrand } from '@/contexts/BrandContext';

// ─── Constants ───────────────────────────────────────────────────────────────

const YELLOW = '#F5C518';
const YELLOW_DARK = '#D4A90A';
const BLACK = '#1A1A1A';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FadeIn = ({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 28 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-80px' }}
    transition={{ duration: 0.6, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
    className={className}
  >
    {children}
  </motion.div>
);

// ─── Data ─────────────────────────────────────────────────────────────────────

const PRODUCTS = [
  {
    audience: 'Dla Ciebie i firm',
    audienceIcon: Users,
    popular: true,
    icon: Car,
    title: 'Wynajem długoterminowy',
    desc: 'Miesięczna rata obejmuje ubezpieczenie i serwis. Bez angażowania kapitału, od 12 miesięcy.',
    time: 'Decyzja do 24h',
    href: '/wynajem-dlugoterminowy',
  },
  {
    audience: 'Dla Ciebie',
    audienceIcon: Users,
    popular: true,
    icon: CreditCard,
    title: 'Kredyt samochodowy',
    desc: 'Kup auto na własność. Niskie raty, długi okres spłaty, decyzja nawet w 1 godzinę.',
    time: 'Decyzja do 1h',
    href: '/samochody?finansowanie=kredyt',
  },
  {
    audience: 'Dla firm',
    audienceIcon: Briefcase,
    popular: true,
    icon: Briefcase,
    title: 'Leasing samochodu',
    desc: 'Optymalizacja kosztów podatkowych dla przedsiębiorców. Szeroki wybór marek i modeli.',
    time: 'Decyzja 2–3h',
    href: '/samochody?finansowanie=leasing',
  },
  {
    audience: 'Dla Ciebie',
    audienceIcon: Users,
    popular: false,
    icon: FileText,
    title: 'Pożyczka na samochód',
    desc: 'Szybkie finansowanie bez zastawu. Elastyczne warunki dopasowane do Twojego budżetu.',
    time: 'Decyzja do 1h',
    href: '/samochody?finansowanie=pozyczka',
  },
];

const WHY_US = [
  {
    icon: ShieldCheck,
    title: 'Przejrzyste raty all-in',
    desc: 'Zawsze wiesz co wchodzi w zakres oferty. Żadnych niespodzianek po podpisaniu umowy.',
  },
  {
    icon: Zap,
    title: 'Szybka decyzja',
    desc: 'Kredyt nawet w 1 godzinę. Leasing w 2–3h. Wynajem do 24h. Bez zbędnej biurokracji.',
  },
  {
    icon: Building2,
    title: 'Sieć dealerów w Polsce',
    desc: 'Dostęp do salonu w Twoim mieście – wskazujemy lokalizację i umawiamy wizytę.',
  },
  {
    icon: Headset,
    title: 'Dedykowany doradca',
    desc: 'Jeden opiekun prowadzi Cię od wyboru auta do odbioru kluczyków.',
  },
];

const FINANCIAL_PARTNERS = ['Inbank', 'Santander', 'Vehis', 'PKO Leasing', 'Masterlease'];

const CAR_BRANDS_EU = [
  'Volkswagen', 'BMW', 'Mercedes', 'Audi', 'Toyota', 'Kia',
  'Hyundai', 'Škoda', 'Ford', 'Volvo', 'Renault', 'Peugeot',
  'Seat', 'Opel', 'Nissan',
];

const CAR_BRANDS_CN = ['BYD', 'Chery', 'MG', 'Geely', 'Omoda', 'Jaecoo', 'Leapmotor'];

// ─── Component ───────────────────────────────────────────────────────────────

export default function MotoliaHomePage() {
  const { config } = useBrand();
  const [openFaq, setOpenFaq] = React.useState<number | null>(0);
  const { i18n } = useTranslation();

  const { data: faqData } = useQuery({
    queryKey: ['home-faq-motolia'],
    queryFn: async () => {
      const response = await faqApi.list({ page: 'home' });
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

  return (
    <div className="bg-white min-h-screen text-[#1A1A1A] font-inter selection:bg-yellow-200">
      <Header />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative pt-14 pb-16 lg:pt-40 lg:pb-28 overflow-hidden bg-[#FAFAF8]">
        {/* Subtle yellow glow */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${YELLOW}18 0%, transparent 70%)` }} />
        <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${YELLOW}10 0%, transparent 70%)` }} />

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Left col */}
            <div className="max-w-2xl">
              <FadeIn>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold mb-8"
                  style={{ background: `${YELLOW}20`, borderColor: `${YELLOW}60`, color: BLACK }}>
                  <span style={{ color: YELLOW_DARK }}>◆</span>
                  {config.homePage.hero.badge}
                </div>
              </FadeIn>

              <FadeIn delay={0.1}>
                <h1
                  className="text-5xl lg:text-7xl font-outfit font-bold tracking-tight mb-6 leading-[1.08] text-[#1A1A1A]"
                  dangerouslySetInnerHTML={{
                    __html: config.homePage.hero.title.replace(
                      '<span>',
                      `<span style="color:${YELLOW_DARK}">`,
                    ),
                  }}
                />
              </FadeIn>

              <FadeIn delay={0.2}>
                <p className="text-xl text-gray-500 mb-10 leading-relaxed font-light">
                  {config.homePage.hero.subtitle}
                </p>
              </FadeIn>

              <FadeIn delay={0.3} className="flex flex-col sm:flex-row gap-4 mb-12">
                <Link
                  to="/samochody"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
                  style={{
                    background: YELLOW,
                    color: BLACK,
                    boxShadow: `0 4px 24px ${YELLOW}60`,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = YELLOW_DARK)}
                  onMouseLeave={e => (e.currentTarget.style.background = YELLOW)}
                >
                  {config.homePage.hero.ctaLabel}
                  <ArrowRight size={20} />
                </Link>
                <a
                  href="#jak-to-dziala"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-lg border-2 border-gray-200 text-gray-700 hover:border-gray-400 hover:text-gray-900 transition-all duration-200"
                >
                  Jak to działa?
                </a>
              </FadeIn>

              <FadeIn delay={0.4} className="flex flex-wrap gap-x-8 gap-y-3">
                {config.homePage.hero.trustBadges.map((badge, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-gray-600 text-sm font-medium">
                    <CheckCircle2 size={17} style={{ color: YELLOW_DARK }} />
                    {badge}
                  </div>
                ))}
              </FadeIn>
            </div>

            {/* Right col — image + floating stats */}
            <FadeIn delay={0.4} className="relative hidden lg:block">
              <div className="absolute inset-0 rounded-[2.5rem] rotate-2"
                style={{ background: `linear-gradient(135deg, ${YELLOW}30, transparent)`, filter: 'blur(20px)' }} />
              <img
                src="https://images.unsplash.com/photo-1617469767053-d3b523a0b982?q=80&w=2662&auto=format&fit=crop"
                alt="Motolia – szeroki wybór aut"
                className="relative z-10 rounded-[2.5rem] w-full object-cover aspect-[4/3] shadow-2xl border border-gray-100"
              />

              {/* Stat card 1 */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -bottom-6 -left-8 z-20 bg-white border border-gray-100 p-5 rounded-3xl shadow-xl"
              >
                <div className="text-3xl font-outfit font-bold mb-0.5" style={{ color: YELLOW_DARK }}>
                  {config.homePage.hero.stats[0].value}
                </div>
                <div className="text-gray-500 text-xs font-medium uppercase tracking-wider">
                  {config.homePage.hero.stats[0].label}
                </div>
              </motion.div>

              {/* Stat card 2 */}
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -top-6 -right-8 z-20 p-5 rounded-3xl shadow-xl text-white"
                style={{ background: BLACK }}
              >
                <div className="text-3xl font-outfit font-bold mb-0.5" style={{ color: YELLOW }}>
                  {config.homePage.hero.stats[1].value}
                </div>
                <div className="text-gray-400 text-xs font-medium uppercase tracking-wider">
                  {config.homePage.hero.stats[1].label}
                </div>
              </motion.div>
            </FadeIn>

          </div>
        </div>
      </section>

      {/* ── TRUST BAR ────────────────────────────────────────────────────── */}
      <section className="border-y border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {config.homePage.trustBar.map((item, idx) => (
              <FadeIn key={idx} delay={idx * 0.08} className="flex flex-col items-center text-center group">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110"
                  style={{ background: `${YELLOW}18`, border: `1.5px solid ${YELLOW}40` }}>
                  {item.icon === 'Shield'     && <ShieldCheck size={26} style={{ color: YELLOW_DARK }} />}
                  {item.icon === 'CreditCard' && <CreditCard  size={26} style={{ color: YELLOW_DARK }} />}
                  {item.icon === 'FileText'   && <FileText    size={26} style={{ color: YELLOW_DARK }} />}
                  {item.icon === 'Phone'      && <Clock       size={26} style={{ color: YELLOW_DARK }} />}
                </div>
                <h3 className="text-gray-800 font-bold text-base leading-snug">{item.label}</h3>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRODUKTY ─────────────────────────────────────────────────────── */}
      <section className="py-28 bg-[#FAFAF8]" id="produkty">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <FadeIn>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: YELLOW_DARK }}>
                Co oferujemy
              </p>
              <h2 className="text-4xl md:text-5xl font-outfit font-bold mb-5 text-[#1A1A1A]">
                Jeden serwis,{' '}
                <span style={{ color: YELLOW_DARK }}>cztery produkty</span>
              </h2>
              <p className="text-lg text-gray-500">
                Obsługujemy zarówno osoby prywatne, jak i firmy – każdy znajdzie tu coś dla siebie.
              </p>
            </FadeIn>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PRODUCTS.map((product, idx) => {
              const Icon = product.icon;
              const AudienceIcon = product.audienceIcon;
              return (
                <FadeIn key={idx} delay={idx * 0.08}>
                  <div className="relative bg-white border border-gray-100 rounded-3xl p-7 h-full flex flex-col hover:shadow-lg hover:border-gray-200 transition-all duration-300 group">
                    {product.popular && (
                      <div className="absolute -top-3 left-6 px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wide text-[#1A1A1A]"
                        style={{ background: YELLOW }}>
                        Popularne
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 mb-5">
                      <AudienceIcon size={11} />
                      {product.audience}
                    </div>

                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform"
                      style={{ background: `${YELLOW}20`, border: `1.5px solid ${YELLOW}50` }}>
                      <Icon size={24} style={{ color: YELLOW_DARK }} />
                    </div>

                    <h3 className="text-lg font-bold text-[#1A1A1A] mb-2">{product.title}</h3>
                    <p className="text-gray-500 leading-relaxed text-sm flex-1">{product.desc}</p>

                    <div className="flex items-center gap-2 mt-5 text-xs font-semibold text-gray-400">
                      <Clock size={12} />
                      {product.time}
                    </div>

                    <Link
                      to={product.href}
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold transition-colors"
                      style={{ color: YELLOW_DARK }}
                      onMouseEnter={e => (e.currentTarget.style.color = BLACK)}
                      onMouseLeave={e => (e.currentTarget.style.color = YELLOW_DARK)}
                    >
                      Sprawdź ofertę <ArrowRight size={14} />
                    </Link>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── JAK TO DZIAŁA ────────────────────────────────────────────────── */}
      <section className="py-28 bg-white" id="jak-to-dziala">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <FadeIn>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: YELLOW_DARK }}>
                {config.homePage.steps.tag}
              </p>
              <h2
                className="text-4xl md:text-5xl font-outfit font-bold mb-5 text-[#1A1A1A]"
                dangerouslySetInnerHTML={{
                  __html: config.homePage.steps.title.replace(
                    '<span>',
                    `<span style="color:${YELLOW_DARK}">`,
                  ),
                }}
              />
              <p className="text-lg text-gray-500">{config.homePage.steps.subtitle}</p>
            </FadeIn>
          </div>

          <div className="grid md:grid-cols-3 gap-6 relative">
            {config.homePage.steps.items.map((item, index) => (
              <FadeIn key={index} delay={index * 0.12} className="relative">
                <div className="bg-[#FAFAF8] border border-gray-100 rounded-3xl p-8 h-full hover:shadow-md transition-all duration-300">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-outfit font-bold mb-6 text-[#1A1A1A]"
                    style={{ background: YELLOW }}>
                    {index + 1}
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-[#1A1A1A]">{item.title}</h3>
                  <p className="text-gray-500 leading-relaxed">{item.description}</p>
                </div>
                {index < config.homePage.steps.items.length - 1 && (
                  <div className="hidden md:block absolute top-12 -right-3 w-6 border-t-2 border-dashed border-gray-200" />
                )}
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── MARKI I PARTNERZY ─────────────────────────────────────────────── */}
      <section className="py-24 bg-[#FAFAF8] border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <FadeIn>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: YELLOW_DARK }}>
                Oferta
              </p>
              <h2 className="text-4xl md:text-5xl font-outfit font-bold mb-4 text-[#1A1A1A]">
                Praktycznie{' '}
                <span style={{ color: YELLOW_DARK }}>każda marka</span>
              </h2>
              <p className="text-lg text-gray-500 max-w-2xl mx-auto">
                Współpracujemy z dealerami wszystkich liczących się producentów –
                od europejskich klasyków po najlepsze marki chińskie.
              </p>
            </FadeIn>
          </div>

          {/* EU & JP brands */}
          <FadeIn delay={0.1}>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 text-center mb-4">
              Marki europejskie i japońskie
            </p>
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {CAR_BRANDS_EU.map((brand) => (
                <span key={brand}
                  className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-600 text-sm font-medium hover:border-gray-400 hover:text-[#1A1A1A] transition-all cursor-default">
                  {brand}
                </span>
              ))}
            </div>
          </FadeIn>

          {/* Chinese brands */}
          <FadeIn delay={0.15}>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 text-center mb-4">
              Topowe marki chińskie
            </p>
            <div className="flex flex-wrap justify-center gap-2 mb-14">
              {CAR_BRANDS_CN.map((brand) => (
                <span key={brand}
                  className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-600 text-sm font-medium hover:border-gray-400 hover:text-[#1A1A1A] transition-all cursor-default">
                  {brand}
                </span>
              ))}
            </div>
          </FadeIn>

          {/* Financial partners */}
          <FadeIn delay={0.2}>
            <div className="border-t border-gray-200 pt-10">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 text-center mb-6">
                Partnerzy finansowi
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                {FINANCIAL_PARTNERS.map((partner) => (
                  <div key={partner}
                    className="px-6 py-3 rounded-2xl bg-white border-2 border-gray-200 text-[#1A1A1A] font-bold text-sm hover:border-gray-400 transition-all cursor-default">
                    {partner}
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── DLACZEGO MOTOLIA — dark section ──────────────────────────────── */}
      <section className="py-28 relative overflow-hidden" style={{ background: BLACK }}>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${YELLOW}0a 0%, transparent 70%)` }} />

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="flex flex-col lg:flex-row gap-16 items-center">

            <div className="lg:w-1/3">
              <FadeIn>
                <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: YELLOW }}>
                  Nowy standard
                </p>
                <h2 className="text-4xl md:text-5xl font-outfit font-bold mb-6 text-white">
                  Dlaczego <br />
                  <span style={{ color: YELLOW }}>Motolia?</span>
                </h2>
                <p className="text-lg text-gray-400 mb-8 leading-relaxed">
                  Finansowanie auta powinno być proste. Bez zbędnej biurokracji,
                  bez ukrytych kosztów. Jeden doradca, wiele możliwości.
                </p>
                <Link
                  to="/samochody"
                  className="inline-flex items-center gap-2 font-bold transition-colors text-white hover:opacity-80"
                  style={{ color: YELLOW }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  Przeglądaj ofertę <ArrowRight size={18} />
                </Link>
              </FadeIn>
            </div>

            <div className="lg:w-2/3 grid sm:grid-cols-2 gap-5">
              {WHY_US.map((feature, idx) => (
                <FadeIn key={idx} delay={idx * 0.08}>
                  <div className="p-7 rounded-3xl border transition-all duration-300 group hover:border-opacity-60"
                    style={{ background: '#262626', borderColor: '#333' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = `${YELLOW}60`)}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#333')}
                  >
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform"
                      style={{ background: `${YELLOW}20` }}>
                      <feature.icon style={{ color: YELLOW }} size={22} />
                    </div>
                    <h3 className="text-lg font-bold mb-2 text-white">{feature.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
                  </div>
                </FadeIn>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      {dynamicFaqs.length > 0 && (
        <section className="py-28 bg-white" id="faq">
          <div className="max-w-4xl mx-auto px-6">
            <FadeIn className="text-center mb-14">
              <h2 className="text-4xl md:text-5xl font-outfit font-bold mb-5 text-[#1A1A1A]">
                Najczęściej zadawane{' '}
                <span style={{ color: YELLOW_DARK }}>pytania</span>
              </h2>
              <p className="text-lg text-gray-500">
                Odpowiadamy na najczęstsze pytania dotyczące finansowania aut.
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
                      <h3 className="text-base font-semibold text-[#1A1A1A] pr-6">{item.q}</h3>
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                        openFaq === idx ? 'rotate-180' : ''
                      }`}
                        style={{
                          background: openFaq === idx ? YELLOW : '#F3F4F6',
                          color: openFaq === idx ? BLACK : '#6B7280',
                        }}
                      >
                        <ChevronDown size={16} />
                      </div>
                    </button>
                    <AnimatePresence>
                      {openFaq === idx && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                        >
                          <div className="px-6 pb-6 text-gray-500 leading-relaxed border-t border-gray-100 pt-4">
                            {item.a}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6" id="kontakt" style={{ background: '#FAFAF8' }}>
        <div className="max-w-5xl mx-auto">
          <div className="relative rounded-[3rem] p-12 text-center overflow-hidden border"
            style={{ background: BLACK, borderColor: '#2A2A2A' }}>
            {/* Yellow glow top-right */}
            <div className="absolute top-0 right-0 w-72 h-72 rounded-full pointer-events-none"
              style={{ background: `radial-gradient(circle, ${YELLOW}18 0%, transparent 70%)` }} />

            <div className="relative z-10 max-w-2xl mx-auto">
              <FadeIn>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-8"
                  style={{ background: `${YELLOW}20`, border: `1.5px solid ${YELLOW}40` }}>
                  <Car size={28} style={{ color: YELLOW }} />
                </div>

                <h2 className="text-4xl md:text-5xl font-outfit font-bold text-white mb-5">
                  Znajdź auto i dobierz{' '}
                  <span style={{ color: YELLOW }}>finansowanie</span>
                </h2>
                <p className="text-lg text-gray-400 mb-10 font-light">
                  Zostaw numer – doradca oddzwoni i w kilka minut przedstawi oferty z kredytu, leasingu lub wynajmu.
                </p>

                <form
                  className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.target as HTMLFormElement;
                    const phoneInput = form.querySelector('input[type="tel"]') as HTMLInputElement;
                    const button = form.querySelector('button[type="submit"]') as HTMLButtonElement;
                    const phone = phoneInput.value;
                    if (!phone) return;
                    try {
                      button.disabled = true;
                      const originalText = button.innerHTML;
                      button.innerHTML = 'Wysyłanie...';
                      await leadsApi.submitQuickLead({ phone });
                      button.innerHTML = 'Otrzymano!';
                      phoneInput.value = '';
                      setTimeout(() => {
                        button.disabled = false;
                        button.innerHTML = originalText;
                      }, 4000);
                    } catch {
                      button.innerHTML = 'Błąd, spróbuj ponownie';
                      setTimeout(() => {
                        button.disabled = false;
                        button.innerHTML = 'Zadzwoń do mnie';
                      }, 3000);
                    }
                  }}
                >
                  <input
                    type="tel"
                    placeholder="Wpisz swój numer telefonu"
                    required
                    className="flex-1 rounded-2xl px-6 py-4 text-white text-lg outline-none transition-all"
                    style={{
                      background: '#262626',
                      border: '2px solid #333',
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = YELLOW)}
                    onBlur={e => (e.currentTarget.style.borderColor = '#333')}
                  />
                  <button
                    type="submit"
                    className="font-bold px-8 py-4 rounded-2xl transition-all duration-200 whitespace-nowrap text-[#1A1A1A] hover:-translate-y-0.5 active:translate-y-0"
                    style={{ background: YELLOW }}
                    onMouseEnter={e => (e.currentTarget.style.background = YELLOW_DARK)}
                    onMouseLeave={e => (e.currentTarget.style.background = YELLOW)}
                  >
                    Zadzwoń do mnie
                  </button>
                </form>

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
