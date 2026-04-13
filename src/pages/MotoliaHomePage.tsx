import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  Car, 
  CreditCard, 
  ArrowRight, 
  Star, 
  ChevronDown, 
  CheckCircle2, 
  PlayCircle,
  Gem,
  Headset,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { faqApi, leadsApi } from '@/services/api';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { useBrand } from '@/contexts/BrandContext';

// Background patterns
const GridPattern = () => (
  <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M0 40L40 0H20L0 20M40 40V20L20 40" stroke="currentColor" strokeWidth="1" fill="none" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid-pattern)" />
  </svg>
);

const FadeIn = ({ children, delay = 0, className = "" }: { children: React.ReactNode, delay?: number, className?: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-100px" }}
    transition={{ duration: 0.7, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
    className={className}
  >
    {children}
  </motion.div>
);

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
    }
  });

  const getLocalized = (item: any, field: string) => {
    const langCode = i18n.language.slice(0, 2).toLowerCase();
    const suffix = langCode === 'pl' ? 'Pl' : langCode === 'en' ? 'En' : 'De';
    return item[`${field}${suffix}`] || '';
  };

  const dynamicFaqs = React.useMemo(() => {
    if (!faqData) return [];
    return faqData.filter((item: any) => getLocalized(item, 'question')?.trim() && getLocalized(item, 'answer')?.trim())
      .map((item: any) => ({
        id: item.id,
        q: getLocalized(item, 'question'),
        a: getLocalized(item, 'answer')
      }));
  }, [faqData, i18n.language]);

  return (
    <div className="bg-[#0f172a] min-h-screen text-slate-100 font-inter selection:bg-emerald-500/30">
      <Header />

      {/* HERO SECTION */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        {/* Abstract glowing orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-[120px] -translate-y-1/2 pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[30rem] h-[30rem] bg-teal-600/10 rounded-full blur-[120px] translate-y-1/2 pointer-events-none" />
        
        <GridPattern />

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            
            <div className="max-w-2xl">
              <FadeIn>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-8 backdrop-blur-md">
                  <Star size={14} className="fill-emerald-500/50" />
                  {config.homePage.hero.badge}
                </div>
              </FadeIn>
              
              <FadeIn delay={0.1}>
                <h1 
                  className="text-5xl lg:text-7xl font-outfit font-bold tracking-tight text-white mb-6 leading-[1.1]"
                  dangerouslySetInnerHTML={{ __html: config.homePage.hero.title.replace('<span>', '<span class="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">') }} 
                />
              </FadeIn>
              
              <FadeIn delay={0.2}>
                <p className="text-xl text-slate-400 mb-10 leading-relaxed font-light">
                  {config.homePage.hero.subtitle}
                </p>
              </FadeIn>
              
              <FadeIn delay={0.3} className="flex flex-col sm:flex-row gap-4 mb-12">
                <Link 
                  to="/samochody" 
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-semibold text-lg transition-all duration-300 shadow-[0_0_40px_rgba(16,185,129,0.3)] hover:shadow-[0_0_60px_rgba(16,185,129,0.5)] hover:-translate-y-1"
                >
                  {config.homePage.hero.ctaLabel}
                  <ArrowRight size={20} />
                </Link>
                <a 
                  href="#faq"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-medium text-lg border border-white/10 transition-all duration-300 backdrop-blur-sm"
                >
                  Działanie platformy
                </a>
              </FadeIn>

              <FadeIn delay={0.4} className="flex flex-wrap gap-x-8 gap-y-4">
                {config.homePage.hero.trustBadges.map((badge, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-slate-300 text-sm font-medium">
                    <CheckCircle2 size={18} className="text-emerald-400" />
                    {badge}
                  </div>
                ))}
              </FadeIn>
            </div>

            <FadeIn delay={0.5} className="relative hidden lg:block">
              <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/20 to-transparent rounded-[2.5rem] blur-2xl transform rotate-3" />
              <img 
                src="https://images.unsplash.com/photo-1617469767053-d3b523a0b982?q=80&w=2662&auto=format&fit=crop" 
                alt="Motolia Premium Auto" 
                className="relative z-10 rounded-[2.5rem] w-full object-cover aspect-[4/3] shadow-2xl border border-white/10"
              />
              {/* Floating Stats Card 1 */}
              <motion.div 
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -bottom-8 -left-8 z-20 bg-slate-900/90 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-2xl"
              >
                <div className="text-4xl font-outfit font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400 mb-1">
                  {config.homePage.hero.stats[0].value}
                </div>
                <div className="text-slate-400 text-sm font-medium uppercase tracking-wider">
                  {config.homePage.hero.stats[0].label}
                </div>
              </motion.div>

              {/* Floating Stats Card 2 */}
              <motion.div 
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-8 -right-8 z-20 bg-emerald-500 p-6 rounded-3xl shadow-2xl shadow-emerald-500/20"
              >
                <div className="text-4xl font-outfit font-bold text-white mb-1">
                  {config.homePage.hero.stats[1].value}
                </div>
                <div className="text-emerald-100 text-sm font-medium uppercase tracking-wider">
                  {config.homePage.hero.stats[1].label}
                </div>
              </motion.div>
            </FadeIn>

          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <section className="border-y border-white/5 bg-slate-900/50 backdrop-blur-md relative z-20">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {config.homePage.trustBar.map((item, idx) => (
              <FadeIn key={idx} delay={idx * 0.1} className="flex flex-col items-center text-center group">
                <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mb-4 group-hover:bg-emerald-500/10 group-hover:scale-110 transition-all duration-300 border border-white/5 group-hover:border-emerald-500/30">
                  {item.icon === 'Shield' && <ShieldCheck size={28} className="text-emerald-400" />}
                  {item.icon === 'CreditCard' && <CreditCard size={28} className="text-emerald-400" />}
                  {item.icon === 'FileText' && <FileText size={28} className="text-emerald-400" />}
                  {item.icon === 'Phone' && <Headset size={28} className="text-emerald-400" />}
                </div>
                <h3 className="text-slate-300 font-medium">{item.label}</h3>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* STEPS SECTION */}
      <section className="py-32 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <FadeIn>
              <h2 className="text-4xl md:text-5xl font-outfit font-bold mb-6" dangerouslySetInnerHTML={{ __html: config.homePage.steps.title.replace('<span>', '<span class="text-emerald-400">') }} />
              <p className="text-xl text-slate-400 font-light">{config.homePage.steps.subtitle}</p>
            </FadeIn>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {config.homePage.steps.items.map((item, index) => (
              <FadeIn key={index} delay={index * 0.15} className="relative">
                <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-8 h-full hover:bg-slate-800/50 transition-colors backdrop-blur-sm">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-2xl font-outfit font-bold text-emerald-400 mb-6 border border-emerald-500/20">
                    {index + 1}
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-white">{item.title}</h3>
                  <p className="text-slate-400 leading-relaxed">{item.description}</p>
                </div>
                {index < 3 && (
                  <div className="hidden md:block absolute top-14 -right-3 w-6 border-t border-dashed border-slate-700" />
                )}
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* WHY US - Premium Cards */}
      <section className="py-32 bg-slate-900 relative border-y border-white/5 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-900/20 blur-[150px] rounded-full pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="flex flex-col lg:flex-row gap-16 items-center">
            <div className="lg:w-1/3">
              <FadeIn>
                <div className="text-emerald-400 font-semibold tracking-wider uppercase mb-4 text-sm">Nowy standard</div>
                <h2 className="text-4xl md:text-5xl font-outfit font-bold mb-6 text-white">Dlaczego <br/><span className="text-emerald-400">Motolia?</span></h2>
                <p className="text-lg text-slate-400 mb-8 leading-relaxed">
                  Zrywamy z tradycyjnymi, uciążliwymi procesami zakupowymi. U nas proces jest digitalowy, transparentny i szyty na miarę.
                </p>
                <Link to="/samochody" className="inline-flex items-center gap-2 text-emerald-400 font-medium hover:text-emerald-300 transition-colors">
                  Przeglądaj ofertę <ArrowRight size={20} />
                </Link>
              </FadeIn>
            </div>
            
            <div className="lg:w-2/3 grid sm:grid-cols-2 gap-6">
              {[
                { icon: ShieldCheck, title: 'Weryfikacja 360°', desc: 'Każde auto przechodzi rygorystyczne testy przed wystawieniem.' },
                { icon: Gem, title: 'Oferty Premium', desc: 'Wyselekcjonowane pakiety wyposażenia i ekskluzywne modele.' },
                { icon: Headset, title: 'Dedykowany Doradca', desc: 'Twój osobisty przewodnik w świecie finansowania aut.' },
                { icon: Car, title: 'Dostawa Home-to-Home', desc: 'Podpisujesz umowę online, my dostarczamy auto pod Twoje drzwi.' },
              ].map((feature, idx) => (
                <FadeIn key={idx} delay={idx * 0.1}>
                  <div className="bg-slate-800/40 border border-white/5 p-8 rounded-3xl hover:border-emerald-500/30 transition-all duration-300 group">
                    <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <feature.icon className="text-emerald-400" size={24} />
                    </div>
                    <h3 className="text-xl font-semibold mb-3 text-white">{feature.title}</h3>
                    <p className="text-slate-400">{feature.desc}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      {dynamicFaqs.length > 0 && (
        <section className="py-32 relative" id="faq">
          <div className="max-w-4xl mx-auto px-6">
            <FadeIn className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-outfit font-bold mb-6 text-white">Najczęściej zadawane <span className="text-emerald-400">pytania</span></h2>
              <p className="text-xl text-slate-400">Rozwiewamy wszelkie wątpliwości przed zakupem.</p>
            </FadeIn>

            <div className="space-y-4">
              {dynamicFaqs.map((item, idx) => (
                <FadeIn key={item.id} delay={idx * 0.05}>
                  <div className="bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden transition-all hover:border-white/10">
                    <button
                      onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                      className="w-full flex items-center justify-between p-6 text-left"
                    >
                      <h3 className="text-lg font-medium text-slate-200 pr-8">{item.q}</h3>
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center transition-transform duration-300 ${openFaq === idx ? 'rotate-180 bg-emerald-500 text-white' : 'text-slate-400'}`}>
                        <ChevronDown size={18} />
                      </div>
                    </button>
                    <AnimatePresence>
                      {openFaq === idx && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <div className="px-6 pb-6 pt-0 text-slate-400 leading-relaxed border-t border-white/5 mt-2 pt-4">
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

      {/* CTA SECTION */}
      <section className="py-24 px-6 relative z-10" id="kontakt">
        <div className="max-w-5xl mx-auto">
          <div className="relative bg-gradient-to-br from-emerald-900 to-slate-900 rounded-[3rem] p-12 text-center overflow-hidden border border-emerald-500/20 shadow-2xl">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 blur-[80px]" />
            
            <div className="relative z-10 max-w-2xl mx-auto">
              <FadeIn>
                <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-8 backdrop-blur-xl border border-white/20">
                  <Car size={32} className="text-emerald-400" />
                </div>
                <h2 className="text-4xl md:text-5xl font-outfit font-bold text-white mb-6">Rozpocznij drogę po <span className="text-emerald-400">nowe auto</span></h2>
                <p className="text-xl text-emerald-100/80 mb-10 font-light">Zostaw numer telefonu — nasz ekspert oddzwoni bezzwłocznie i zaprezentuje opcje dedykowane dla Ciebie.</p>
                
                <form
                  className="flex flex-col sm:flex-row gap-4 max-w-xl mx-auto"
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

                      button.innerHTML = 'Otrzymano pomyślnie!';
                      button.style.background = '#10b981';
                      phoneInput.value = '';

                      setTimeout(() => {
                        button.disabled = false;
                        button.innerHTML = originalText;
                        button.style.background = '';
                      }, 4000);
                    } catch (error) {
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
                    className="flex-1 bg-white/10 border-2 border-white/20 focus:border-emerald-400 rounded-2xl px-6 py-4 text-white placeholder:text-emerald-200/50 outline-none transition-colors text-lg backdrop-blur-md"
                  />
                  <button 
                    type="submit" 
                    className="bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-8 py-4 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-emerald-500/25 whitespace-nowrap"
                  >
                    Oddzwońcie
                  </button>
                </form>
                <div className="mt-6 flex items-center justify-center gap-2 text-emerald-200/60 text-sm">
                  <ShieldCheck size={16} /> Twoje dane są bezpieczne
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
