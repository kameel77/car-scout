import { useParams, Navigate, Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, ChevronRight, HelpCircle } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { MetaHead } from '@/components/seo/MetaHead';
import { getFotonModelById, getFotonSiblingModels } from '@/data/foton-models';
import { FotonContextBar } from '@/components/foton/FotonContextBar';
import { FotonResponsibilityBlock } from '@/components/foton/FotonResponsibilityBlock';
import { FotonLeadForm } from '@/components/foton/FotonLeadForm';
import { FotonGallery } from '@/components/foton/FotonGallery';

export default function FotonModelPage() {
  const { slug } = useParams<{ slug: string }>();
  const model = slug ? getFotonModelById(slug) : undefined;

  if (!model) {
    return <Navigate to="/foton" replace />;
  }

  const siblings = getFotonSiblingModels(model, 2);
  const heroImage = model.images[0];

  // Contextual link to a financing pillar with an entity-bearing anchor
  // (never a bare "leasing") — per docs/SEO_LINKING_STRATEGY_MOTOLIA.md.
  const financingLink =
    model.category === 'lifestyle'
      ? { to: '/leasing', label: `leasing FOTON ${model.name.replace('FOTON ', '')} dla firm i JDG` }
      : { to: '/wynajem-dlugoterminowy', label: `wynajem długoterminowy FOTON ${model.name.replace('FOTON ', '')} dla floty` };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Strona główna', item: 'https://motolia.pl/' },
      { '@type': 'ListItem', position: 2, name: 'FOTON', item: 'https://motolia.pl/foton' },
      { '@type': 'ListItem', position: 3, name: model.name, item: `https://motolia.pl/foton/${model.id}` },
    ],
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: model.faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      <MetaHead
        title={`${model.name} – Specyfikacja, Zdjęcia i Finansowanie | Motolia`}
        description={`${model.name}: ${model.tagline}. Sprawdź specyfikację techniczną, galerię zdjęć i zapytaj o finansowanie przez Motolię – Agenta Importera marki FOTON.`}
        canonical={`/foton/${model.id}`}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {model.faq.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}

      <Header />
      <FotonContextBar />

      <main className="flex-1">
        {/* ─── BREADCRUMB ────────────────────────────────────────────────── */}
        <div className="container mx-auto px-4 pt-6">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
            <Link to="/" className="hover:text-amber-400 transition-colors">Strona główna</Link>
            <ChevronRight className="w-3 h-3" />
            <Link to="/foton" className="hover:text-amber-400 transition-colors">FOTON</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-slate-200 font-medium">{model.name}</span>
          </nav>
        </div>

        {/* ─── HERO ──────────────────────────────────────────────────────── */}
        <section className="relative pt-8 pb-16 overflow-hidden bg-gradient-to-b from-[#0B132B] via-[#090D16] to-[#090D16]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-amber-500/10 blur-[140px] pointer-events-none rounded-full" />

          <div className="container relative z-10 mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-10 items-center">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 text-xs font-semibold tracking-wide uppercase">
                  <BadgeCheck className="w-4 h-4 text-amber-400" />
                  {model.categoryLabel}
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
                  {model.name}
                </h1>

                <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
                  {model.tagline}
                </p>

                <div className="flex flex-wrap gap-2 pt-2">
                  {model.heroParams.map((param) => (
                    <span
                      key={param}
                      className="text-xs sm:text-sm font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg"
                    >
                      {param}
                    </span>
                  ))}
                </div>

                <div className="pt-4">
                  <a
                    href="#foton-lead-form"
                    className="inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-sm transition-all duration-200 shadow-lg shadow-amber-950/40"
                  >
                    Zapytaj o {model.name}
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {heroImage && (
                <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 aspect-[4/3]">
                  <img
                    src={heroImage.src}
                    alt={heroImage.alt}
                    loading="eager"
                    decoding="async"
                    {...({ fetchpriority: 'high' } as object)}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ─── SPECIFICATION TABLE ───────────────────────────────────────── */}
        <section className="py-16 bg-[#090D16]">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6">
              Specyfikacja techniczna {model.name}
            </h2>
            <div className="rounded-2xl border border-slate-800 overflow-hidden">
              {model.specs.map((row, i) => (
                <div
                  key={row.label}
                  className={`grid sm:grid-cols-[240px_1fr] gap-1 sm:gap-4 px-5 py-4 text-sm ${
                    i % 2 === 0 ? 'bg-slate-900/60' : 'bg-slate-950/60'
                  }`}
                >
                  <span className="font-semibold text-amber-400">{row.label}</span>
                  <span className="text-slate-200 leading-relaxed">{row.value}</span>
                </div>
              ))}
            </div>

            <p className="text-sm text-slate-400 mt-6 leading-relaxed">
              Interesuje Cię {model.category === 'lifestyle' ? 'finansowanie na firmę lub JDG' : 'kalkulacja dla floty'}?{' '}
              Sprawdź{' '}
              <Link to={financingLink.to} className="text-amber-400 hover:text-amber-300 underline underline-offset-4">
                {financingLink.label}
              </Link>{' '}
              dostępne przez Motolię.
            </p>
          </div>
        </section>

        {/* ─── GALLERY ───────────────────────────────────────────────────── */}
        <section className="py-16 bg-slate-950 border-t border-slate-800">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6">
              Galeria zdjęć {model.name}
            </h2>
            <FotonGallery images={model.images} />
          </div>
        </section>

        {/* ─── DISCLOSURE LAYER 2: KTO ZA CO ODPOWIADA ──────────────────────── */}
        <FotonResponsibilityBlock />

        {/* ─── SIBLING MODELS ────────────────────────────────────────────── */}
        {siblings.length > 0 && (
          <section className="py-16 bg-[#090D16]">
            <div className="container mx-auto px-4 max-w-4xl">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6">
                Inne modele w tym segmencie
              </h2>
              <div className="grid sm:grid-cols-2 gap-6">
                {siblings.map((sibling) => (
                  <Link
                    key={sibling.id}
                    to={`/foton/${sibling.id}`}
                    className="group rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 transition-colors overflow-hidden flex flex-col"
                  >
                    <div className="h-40 overflow-hidden bg-slate-950">
                      <img
                        src={sibling.images[0]?.src}
                        alt={sibling.images[0]?.alt || sibling.name}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div className="p-5 space-y-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                        {sibling.categoryLabel}
                      </span>
                      <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors">
                        {sibling.name}
                      </h3>
                      <p className="text-xs text-slate-400">{sibling.tagline}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ─── LEAD GENERATION FORM (DISCLOSURE LAYER 3) ────────────────────── */}
        <FotonLeadForm
          defaultSegment={model.category}
          defaultModelId={model.id}
          trafficSource={`foton_model_${model.id}`}
        />

        {/* ─── FAQ ───────────────────────────────────────────────────────── */}
        {model.faq.length > 0 && (
          <section className="py-20 bg-slate-950 border-t border-slate-800">
            <div className="container mx-auto px-4 max-w-3xl">
              <div className="text-center space-y-2 mb-12">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Pytania i Odpowiedzi
                </span>
                <h2 className="text-3xl font-bold text-white">
                  Najczęściej zadawane pytania o {model.name}
                </h2>
              </div>

              <div className="space-y-4">
                {model.faq.map((item, index) => (
                  <div key={index} className="rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-2">
                    <h3 className="text-base sm:text-lg font-bold text-white flex items-start gap-3">
                      <HelpCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      {item.q}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 pl-8 leading-relaxed">
                      {item.a}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
