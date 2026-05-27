import React from 'react';
import { Link } from 'react-router-dom';
import {
  Phone,
  Mail,
  Clock,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Car,
  CreditCard,
  FileText,
  MapPin,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { useBrand } from '@/contexts/BrandContext';
import { useAppSettings } from '@/hooks/useAppSettings';
import { leadsApi } from '@/services/api';

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
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-60px' }}
    transition={{ duration: 0.55, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
    className={className}
  >
    {children}
  </motion.div>
);

// ─── Data ─────────────────────────────────────────────────────────────────────

const PRODUCTS_QUICK = [
  { icon: CreditCard, label: 'Kredyt samochodowy', href: '/samochody?finansowanie=kredyt' },
  { icon: FileText,   label: 'Pożyczka na samochód', href: '/samochody?finansowanie=pozyczka' },
  { icon: Car,        label: 'Wynajem długoterminowy', href: '/wynajem-dlugoterminowy' },
  { icon: FileText,   label: 'Leasing samochodu', href: '/samochody?finansowanie=leasing' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function MotoliaContactPage() {
  const { config } = useBrand();
  const { data: settings } = useAppSettings();
  const salesPhone = settings?.salesContactPhone || settings?.legalContactPhone || config.contactInfo.phone;

  const [form, setForm] = React.useState({ name: '', phone: '', message: '' });
  const [status, setStatus] = React.useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.phone) return;
    setStatus('sending');
    try {
      await leadsApi.submitQuickLead({ phone: form.phone, name: form.name, message: form.message });

      // Push event to Google Tag Manager dataLayer
      if (typeof window !== 'undefined') {
        (window as any).dataLayer = (window as any).dataLayer || [];
        (window as any).dataLayer.push({
          event: 'generate_lead',
          lead_type: 'general_contact',
          form_id: 'contact_page_form',
          brand: config.id,
          lead_details: {
            name: form.name || undefined,
            phone: form.phone,
            message_length: form.message ? form.message.length : 0,
          }
        });
      }

      setStatus('success');
      setForm({ name: '', phone: '', message: '' });
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 4000);
    }
  };

  return (
    <div className="bg-white min-h-screen text-[#1A1A1A] font-inter selection:bg-yellow-200">
      <Header />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative pt-28 pb-20 lg:pt-40 lg:pb-28 bg-[#FAFAF8] overflow-hidden">
        <div
          className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${YELLOW}15 0%, transparent 70%)` }}
        />

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <FadeIn>
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold mb-8"
                style={{ background: `${YELLOW}20`, borderColor: `${YELLOW}60`, color: BLACK }}
              >
                <span style={{ color: YELLOW_DARK }}>◆</span>
                Kontakt
              </div>
            </FadeIn>

            <FadeIn delay={0.1}>
              <h1
                className="text-4xl lg:text-6xl font-outfit font-bold tracking-tight mb-6 leading-[1.1] text-[#1A1A1A]"
                dangerouslySetInnerHTML={{
                  __html: config.contactPage.title.replace(
                    '<span>',
                    `<span style="color:${YELLOW_DARK}">`,
                  ),
                }}
              />
            </FadeIn>

            <FadeIn delay={0.2}>
              <p className="text-xl text-gray-500 mb-10 leading-relaxed font-light">
                {config.contactPage.subtitle}
              </p>
            </FadeIn>

            {/* Direct contact buttons */}
            <FadeIn delay={0.3} className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
              <a
                href={`tel:${salesPhone.replace(/\s+/g, '')}`}
                className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-200 hover:-translate-y-0.5"
                style={{ background: YELLOW, color: BLACK, boxShadow: `0 4px 24px ${YELLOW}50` }}
                onMouseEnter={e => (e.currentTarget.style.background = YELLOW_DARK)}
                onMouseLeave={e => (e.currentTarget.style.background = YELLOW)}
              >
                <Phone size={20} />
                {salesPhone}
              </a>
              <a
                href={`mailto:${config.contactInfo.email}`}
                className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-semibold text-lg border-2 border-gray-200 text-gray-700 hover:border-gray-400 hover:text-gray-900 transition-all duration-200"
              >
                <Mail size={20} />
                {config.contactInfo.email}
              </a>
            </FadeIn>

            <FadeIn delay={0.4} className="flex items-center justify-center gap-2 text-sm text-gray-400 font-medium">
              <Clock size={14} />
              Pon–Pt, 9:00–17:00
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── LEAD FORM + INFO ─────────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-start">

            {/* Left — form */}
            <FadeIn>
              <div className="bg-[#FAFAF8] border border-gray-100 rounded-3xl p-8 lg:p-10">
                <h2 className="text-2xl font-outfit font-bold mb-2 text-[#1A1A1A]">
                  Zostaw kontakt
                </h2>
                <p className="text-gray-500 mb-8">
                  Oddzwonimy w ciągu 15 minut w godzinach pracy.
                </p>

                {status === 'success' ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center text-center py-12 gap-4"
                  >
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center mb-2"
                      style={{ background: `${YELLOW}25` }}
                    >
                      <CheckCircle2 size={32} style={{ color: YELLOW_DARK }} />
                    </div>
                    <h3 className="text-xl font-bold text-[#1A1A1A]">Otrzymaliśmy Twój kontakt!</h3>
                    <p className="text-gray-500">Doradca oddzwoni wkrótce i przedstawi dostępne opcje finansowania.</p>
                    <button
                      onClick={() => setStatus('idle')}
                      className="mt-4 text-sm font-semibold underline underline-offset-2"
                      style={{ color: YELLOW_DARK }}
                    >
                      Wyślij kolejne zgłoszenie
                    </button>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Imię <span className="text-gray-400 font-normal">(opcjonalnie)</span>
                      </label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Jan Kowalski"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-[#1A1A1A] placeholder:text-gray-400 outline-none transition-all text-base bg-white"
                        onFocus={e => (e.currentTarget.style.borderColor = YELLOW)}
                        onBlur={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Numer telefonu <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={form.phone}
                        onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="+48 500 000 000"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-[#1A1A1A] placeholder:text-gray-400 outline-none transition-all text-base bg-white"
                        onFocus={e => (e.currentTarget.style.borderColor = YELLOW)}
                        onBlur={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Czego szukasz? <span className="text-gray-400 font-normal">(opcjonalnie)</span>
                      </label>
                      <textarea
                        rows={3}
                        value={form.message}
                        onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                        placeholder="np. Toyota Corolla, leasing, budżet do 1500 zł/mies."
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-[#1A1A1A] placeholder:text-gray-400 outline-none transition-all text-base resize-none bg-white"
                        onFocus={e => (e.currentTarget.style.borderColor = YELLOW)}
                        onBlur={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={status === 'sending'}
                      className="w-full py-4 rounded-2xl font-bold text-lg transition-all duration-200 disabled:opacity-60 hover:-translate-y-0.5 active:translate-y-0"
                      style={{ background: YELLOW, color: BLACK }}
                      onMouseEnter={e => { if (status !== 'sending') e.currentTarget.style.background = YELLOW_DARK; }}
                      onMouseLeave={e => (e.currentTarget.style.background = YELLOW)}
                    >
                      {status === 'sending' ? 'Wysyłanie…' : status === 'error' ? 'Błąd – spróbuj ponownie' : 'Zadzwoń do mnie'}
                    </button>

                    <p className="flex items-center gap-1.5 text-xs text-gray-400 justify-center pt-1">
                      <ShieldCheck size={13} />
                      Twoje dane są bezpieczne i nie będą udostępniane
                    </p>
                  </form>
                )}
              </div>
            </FadeIn>

            {/* Right — info */}
            <div className="space-y-8">
              <FadeIn delay={0.1}>
                <div className="space-y-5">
                  <h2 className="text-2xl font-outfit font-bold text-[#1A1A1A]">
                    Dane kontaktowe
                  </h2>

                  {/* Phone — sales */}
                  <a
                    href={`tel:${salesPhone.replace(/\s+/g, '')}`}
                    className="flex items-center gap-4 p-5 rounded-2xl border border-gray-100 bg-[#FAFAF8] hover:border-gray-300 transition-all group"
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform"
                      style={{ background: `${YELLOW}20` }}
                    >
                      <Phone size={22} style={{ color: YELLOW_DARK }} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Telefon — Sprzedaż</p>
                      <p className="text-lg font-bold text-[#1A1A1A]">{salesPhone}</p>
                    </div>
                  </a>

                  {/* Phone — legal/general */}
                  {settings?.legalContactPhone && (
                    <a
                      href={`tel:${settings.legalContactPhone.replace(/\s+/g, '')}`}
                      className="flex items-center gap-4 p-5 rounded-2xl border border-gray-100 bg-[#FAFAF8] hover:border-gray-300 transition-all group"
                    >
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform"
                        style={{ background: `${YELLOW}20` }}
                      >
                        <Phone size={22} style={{ color: YELLOW_DARK }} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Telefon</p>
                        <p className="text-lg font-bold text-[#1A1A1A]">{settings.legalContactPhone}</p>
                      </div>
                    </a>
                  )}

                  {/* Email */}
                  <a
                    href={`mailto:${config.contactInfo.email}`}
                    className="flex items-center gap-4 p-5 rounded-2xl border border-gray-100 bg-[#FAFAF8] hover:border-gray-300 transition-all group"
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform"
                      style={{ background: `${YELLOW}20` }}
                    >
                      <Mail size={22} style={{ color: YELLOW_DARK }} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">E-mail</p>
                      <p className="text-lg font-bold text-[#1A1A1A]">{config.contactInfo.email}</p>
                    </div>
                  </a>

                  {/* Hours */}
                  <div className="flex items-center gap-4 p-5 rounded-2xl border border-gray-100 bg-[#FAFAF8]">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${YELLOW}20` }}
                    >
                      <Clock size={22} style={{ color: YELLOW_DARK }} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Godziny pracy</p>
                      <p className="text-lg font-bold text-[#1A1A1A]">Pon–Pt, 9:00–17:00</p>
                    </div>
                  </div>

                  {/* Address */}
                  <div className="flex items-center gap-4 p-5 rounded-2xl border border-gray-100 bg-[#FAFAF8]">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${YELLOW}20` }}
                    >
                      <MapPin size={22} style={{ color: YELLOW_DARK }} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Adres</p>
                      <p className="text-base font-semibold text-[#1A1A1A]">ul. Jagielońska 88</p>
                      <p className="text-sm text-gray-500">03-215 Warszawa</p>
                    </div>
                  </div>
                </div>
              </FadeIn>

              {/* Quick links */}
              <FadeIn delay={0.2}>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">
                    Interesuje Cię konkretny produkt?
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {PRODUCTS_QUICK.map((p, idx) => (
                      <Link
                        key={idx}
                        to={p.href}
                        className="flex items-center gap-2.5 p-3.5 rounded-xl border border-gray-100 bg-[#FAFAF8] hover:border-gray-300 hover:shadow-sm transition-all group text-sm font-semibold text-[#1A1A1A]"
                      >
                        <p.icon size={16} style={{ color: YELLOW_DARK }} className="flex-shrink-0 group-hover:scale-110 transition-transform" />
                        {p.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </FadeIn>
            </div>

          </div>
        </div>
      </section>

      {/* ── CTA — explore cars ────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-[#FAFAF8] border-t border-gray-100">
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <div
              className="relative rounded-[3rem] p-10 md:p-14 overflow-hidden border text-center"
              style={{ background: BLACK, borderColor: '#2A2A2A' }}
            >
              <div
                className="absolute top-0 right-0 w-64 h-64 rounded-full pointer-events-none"
                style={{ background: `radial-gradient(circle, ${YELLOW}15 0%, transparent 70%)` }}
              />
              <div className="relative z-10 max-w-2xl mx-auto">
                <h2
                  className="text-3xl md:text-4xl font-outfit font-bold text-white mb-4"
                  dangerouslySetInnerHTML={{
                    __html: config.contactPage.ctaTitle.replace(
                      '<span>',
                      `<span style="color:${YELLOW}">`,
                    ),
                  }}
                />
                <p className="text-gray-400 text-lg mb-8 font-light">
                  {config.contactPage.ctaSubtitle}
                </p>
                <Link
                  to="/samochody"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-200 hover:-translate-y-0.5"
                  style={{ background: YELLOW, color: BLACK }}
                  onMouseEnter={e => (e.currentTarget.style.background = YELLOW_DARK)}
                  onMouseLeave={e => (e.currentTarget.style.background = YELLOW)}
                >
                  Przeglądaj dostępne auta
                  <ArrowRight size={20} />
                </Link>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      <Footer />
    </div>
  );
}
