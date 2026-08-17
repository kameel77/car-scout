import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { faqApi } from '@/services/api';
import { useTranslation } from 'react-i18next';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useBrand } from '@/contexts/BrandContext';
import { Search, Loader2, HelpCircle, ChevronDown, MessageSquare, Phone } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatPhoneForTelLink } from '@/utils/formatters';
import { trackPhoneClick } from '@/lib/analytics';
import './home-page.css';

// ─── Brand accent helper ──────────────────────────────────────────────────────

/**
 * Kolory akcentu FAQ.
 * Brandbook Motolia rozdz. 01: żółć jest kolorem powierzchni (przyciski, plakietki),
 * granat jest kolorem liter. Dlatego `accent` (powierzchnia) i `accentInk` (litery)
 * to dwa różne tokeny — wcześniej jeden hex pełnił obie role i dawał 1,66:1.
 */
function useBrandAccent() {
  const { config } = useBrand();
  if (config.id === 'motolia') {
    return {
      accent: 'hsl(var(--mt-yellow-500))',
      accentInk: 'hsl(var(--mt-navy-700))',
      accentOn: 'hsl(var(--mt-navy-700))',        // litery na żółtej powierzchni — 7,66:1
      accentTint: 'hsl(var(--mt-yellow-500) / 0.16)',
      accentBorder: 'hsl(var(--mt-yellow-500) / 0.45)',
      accentShadow: 'hsl(var(--mt-navy-700) / 0.22)',
      isMotolia: true,
    };
  }
  return {
    accent: '#F97316',
    accentInk: '#9A3412',
    accentOn: '#FFFFFF',
    accentTint: '#FFF7ED',
    accentBorder: '#FDBA74',
    accentShadow: 'rgba(249,115,22,0.25)',
    isMotolia: false,
  };
}

// ─── FAQ Item ─────────────────────────────────────────────────────────────────

interface FaqItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onClick: () => void;
  accent: string;
  accentOn: string;
  isMotolia: boolean;
}

function FaqItem({ question, answer, isOpen, onClick, accent, accentOn, isMotolia }: FaqItemProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border transition-all duration-200 overflow-hidden',
        isOpen ? 'border-gray-300 shadow-sm' : 'border-gray-100 hover:border-gray-200',
        isMotolia ? 'bg-white' : 'bg-white',
      )}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      <div className="flex items-center justify-between p-5 gap-4">
        <span className={cn('font-semibold text-foreground text-base leading-snug', isOpen && 'text-foreground')}>
          {question}
        </span>
        <div
          className={cn(
            'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300',
            isOpen ? 'rotate-180' : '',
          )}
          style={{
            background: isOpen ? accent : 'hsl(var(--mt-neutral-100))',
            color: isOpen ? accentOn : 'hsl(var(--mt-neutral-600))',
          }}
        >
          <ChevronDown size={16} />
        </div>
      </div>
      {isOpen && (
        <div className="px-5 pb-5 text-muted-foreground leading-relaxed text-sm border-t border-gray-100 pt-4 whitespace-pre-line">
          {answer}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PublicFaqPage() {
  const { i18n } = useTranslation();
  const { accent, accentInk, accentOn, accentTint, accentBorder, accentShadow, isMotolia } = useBrandAccent();
  const { config } = useBrand();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedPage, setSelectedPage] = React.useState<string>('all');
  const [openId, setOpenId] = React.useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['public-faq'],
    queryFn: async () => {
      const response = await faqApi.list({});
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

  const categories = [
    { id: 'all',     label: 'Wszystkie' },
    { id: 'faq',     label: 'Ogólne' },
    { id: 'offers',  label: 'Proces zakupu' },
    { id: 'home',    label: 'O nas' },
    { id: 'contact', label: 'Kontakt' },
  ];

  const filteredFaqs = React.useMemo(() => {
    if (!data) return [];
    let filtered = data;
    if (selectedPage !== 'all') {
      filtered = filtered.filter((item: any) => item.page === selectedPage);
    }
    const langCode = i18n.language.slice(0, 2).toLowerCase();
    const suffix = langCode === 'pl' ? 'Pl' : langCode === 'en' ? 'En' : 'De';
    filtered = filtered.filter((item: any) => item[`question${suffix}`]?.trim() && item[`answer${suffix}`]?.trim());
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((item: any) => {
        const question = getLocalized(item, 'question').toLowerCase();
        const answer = getLocalized(item, 'answer').toLowerCase();
        return question.includes(query) || answer.includes(query);
      });
    }
    return filtered;
  }, [data, searchQuery, selectedPage, i18n.language]);

  return (
    <div className={cn('min-h-screen flex flex-col', isMotolia ? 'bg-white' : 'landing-page-root')}>
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section
          className="pt-32 pb-20 px-6"
          style={{ background: isMotolia ? 'hsl(var(--mt-neutral-50))' : 'linear-gradient(to bottom, #fff, #f8fafc)' }}
        >
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold mb-7"
              style={{ background: accentTint, borderColor: accentBorder, color: 'hsl(var(--mt-ink-900))' }}
            >
              {isMotolia ? <span style={{ color: accentInk }}>◆</span> : null}
              Centrum pomocy
            </div>

            <h1 className="text-4xl md:text-6xl font-heading font-extrabold mb-6 text-foreground">
              Jak możemy Ci{' '}
              <span className="hl">pomóc?</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-10">
              Znajdź odpowiedzi na najczęściej zadawane pytania dotyczące finansowania,
              procesu zakupu i naszych usług.
            </p>

            <div className="max-w-xl mx-auto relative">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-subtle" />
              </div>
              <Input
                type="text"
                placeholder="Szukaj w najczęstszych pytaniach…"
                className="w-full h-14 pl-12 pr-4 rounded-2xl border-gray-200 shadow-sm text-lg"
                style={{ '--tw-ring-color': accentInk } as React.CSSProperties}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Categories & FAQ Content */}
        <section className="py-16 px-6 bg-white">
          <div className="max-w-4xl mx-auto">
            {/* Category tabs */}
            <div className="flex flex-wrap justify-center gap-2 mb-12">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => { setSelectedPage(cat.id); setOpenId(null); }}
                  className="px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200"
                  style={
                    selectedPage === cat.id
                      ? { background: accent, color: accentOn, boxShadow: `0 4px 14px ${accentShadow}` }
                      : { background: 'hsl(var(--mt-neutral-100))', color: 'hsl(var(--mt-neutral-600))' }
                  }
                  onMouseEnter={e => { if (selectedPage !== cat.id) e.currentTarget.style.background = 'hsl(var(--mt-neutral-300))'; }}
                  onMouseLeave={e => { if (selectedPage !== cat.id) e.currentTarget.style.background = 'hsl(var(--mt-neutral-100))'; }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-subtle">
                <Loader2 className="w-10 h-10 animate-spin" style={{ color: accentInk }} />
                <p>Ładowanie odpowiedzi…</p>
              </div>
            ) : filteredFaqs.length > 0 ? (
              <div className="space-y-3">
                {filteredFaqs.map((faq: any) => (
                  <FaqItem
                    key={faq.id}
                    question={getLocalized(faq, 'question')}
                    answer={getLocalized(faq, 'answer')}
                    isOpen={openId === faq.id}
                    onClick={() => setOpenId(openId === faq.id ? null : faq.id)}
                    accent={accent}
                    accentOn={accentOn}
                    isMotolia={isMotolia}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 bg-gray-100">
                  <HelpCircle className="w-10 h-10 text-subtle" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-2">Nie znaleźliśmy odpowiedzi</h3>
                <p className="text-muted-foreground">Spróbuj wpisać inne słowo kluczowe lub skontaktuj się z nami.</p>
                <button
                  onClick={() => { setSearchQuery(''); setSelectedPage('all'); }}
                  className="mt-6 font-semibold underline underline-offset-4 decoration-2 hover:no-underline"
                  style={{ color: accentInk }}
                >
                  Pokaż wszystkie pytania
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Contact CTA */}
        <section className="py-20 px-6" style={{ background: isMotolia ? 'hsl(var(--mt-navy-900))' : 'hsl(var(--mt-neutral-50))' }}>
          <div className="max-w-5xl mx-auto">
            <div
              className={cn(
                'rounded-[2rem] p-8 md:p-14 flex flex-col md:flex-row items-center justify-between gap-10',
                isMotolia ? 'border' : 'bg-white shadow-xl border border-gray-100',
              )}
              style={isMotolia ? { borderColor: 'hsl(var(--mt-navy-700))' } : {}}
            >
              <div className="text-center md:text-left">
                <h2 className={cn('text-3xl font-bold mb-4', isMotolia ? 'text-white' : 'text-foreground')}>
                  Wciąż masz pytania?
                </h2>
                <p className={cn('text-lg', isMotolia ? 'text-gray-300' : 'text-gray-300')}>
                  Nasz zespół ekspertów jest gotowy, aby pomóc Ci w wyborze finansowania.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                <a
                  href={`mailto:${config.contactInfo.email}`}
                  className={cn(
                    'flex items-center justify-center gap-2 h-14 px-8 rounded-2xl font-bold transition-all',
                    isMotolia
                      ? 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
                      : 'bg-gray-50 text-foreground hover:bg-gray-100',
                  )}
                >
                  <MessageSquare className="w-5 h-5" />
                  Napisz do nas
                </a>
                <a
                  href={`tel:${formatPhoneForTelLink(config.contactInfo.phone)}`}
                  onClick={() => trackPhoneClick('faq_cta')}
                  className="flex items-center justify-center gap-2 h-14 px-8 rounded-2xl font-bold transition-all hover:-translate-y-0.5"
                  style={{
                    background: accent,
                    color: accentOn,
                    boxShadow: `0 4px 20px ${accentShadow}`,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  <Phone className="w-5 h-5" />
                  Zadzwoń teraz
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
