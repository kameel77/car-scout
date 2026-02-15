import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { faqApi } from '@/services/api';
import { useTranslation } from 'react-i18next';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Search, Loader2, HelpCircle, ChevronRight, MessageSquare, Phone } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import './home-page.css';

interface FaqItemProps {
    question: string;
    answer: string;
    isOpen: boolean;
    onClick: () => void;
}

function FaqItem({ question, answer, isOpen, onClick }: FaqItemProps) {
    return (
        <div className={cn("home-faq-item", isOpen && "open")} onClick={onClick}>
            <div className="home-faq-question">
                <span>{question}</span>
                <ChevronRight className="w-5 h-5" />
            </div>
            <div className="home-faq-answer">
                <p dangerouslySetInnerHTML={{ __html: answer.replace(/\n/g, '<br/>') }} />
            </div>
        </div>
    );
}

export default function PublicFaqPage() {
    const { i18n } = useTranslation();
    const [searchQuery, setSearchQuery] = React.useState('');
    const [openId, setOpenId] = React.useState<string | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['public-faq'],
        queryFn: async () => {
            const response = await faqApi.list({});
            return response.entries.filter(e => e.isPublished);
        }
    });

    const getLocalized = (item: any, field: string) => {
        const lang = i18n.language.charAt(0).toUpperCase() + i18n.language.slice(1);
        const key = `${field}${lang}`;
        return item[key] || item[`${field}Pl`];
    };

    const filteredFaqs = React.useMemo(() => {
        if (!data) return [];
        if (!searchQuery.trim()) return data;

        const query = searchQuery.toLowerCase();
        return data.filter(item => {
            const q = getLocalized(item, 'question').toLowerCase();
            const a = getLocalized(item, 'answer').toLowerCase();
            return q.includes(query) || a.includes(query);
        });
    }, [data, searchQuery, i18n.language]);

    return (
        <div className="landing-page-root min-h-screen flex flex-col">
            <Header />

            <main className="flex-1">
                {/* Hero Section */}
                <section className="bg-gradient-to-b from-white to-slate-50 pt-32 pb-20 px-6">
                    <div className="max-width-1200 mx-auto text-center">
                        <div className="home-hero__badge mx-auto mb-6">Centrum pomocy</div>
                        <h1 className="text-4xl md:text-6xl font-extrabold text-[#2D3142] mb-6 decoration-[#F97316]">
                            Jak możemy Ci <span className="text-[#F97316]">pomóc?</span>
                        </h1>
                        <p className="text-[#4A4E69] text-lg max-w-2xl mx-auto mb-10">
                            Znajdź odpowiedzi na najczęściej zadawane pytania dotyczące procesu zakupu,
                            finansowania i gwarancji naszych samochodów.
                        </p>

                        <div className="max-w-xl mx-auto relative group">
                            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                <Search className="h-5 w-5 text-[#8D91A5] group-focus-within:text-[#F97316] transition-colors" />
                            </div>
                            <Input
                                type="text"
                                placeholder="Szukaj w najczęstszych pytaniach..."
                                className="w-full h-14 pl-12 pr-4 rounded-2xl border-slate-200 shadow-sm focus:ring-[#F97316] focus:border-[#F97316] text-lg"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </section>

                {/* FAQ Content */}
                <section className="py-20 px-6 bg-white">
                    <div className="max-width-900 mx-auto">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4 text-[#8D91A5]">
                                <Loader2 className="w-10 h-10 animate-spin text-[#F97316]" />
                                <p>Ładowanie odpowiedzi...</p>
                            </div>
                        ) : filteredFaqs.length > 0 ? (
                            <div className="space-y-4">
                                {filteredFaqs.map((faq) => (
                                    <FaqItem
                                        key={faq.id}
                                        question={getLocalized(faq, 'question')}
                                        answer={getLocalized(faq, 'answer')}
                                        isOpen={openId === faq.id}
                                        onClick={() => setOpenId(openId === faq.id ? null : faq.id)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-20">
                                <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <HelpCircle className="w-10 h-10 text-[#8D91A5]" />
                                </div>
                                <h3 className="text-2xl font-bold text-[#2D3142] mb-2">Nie znaleźliśmy odpowiedzi</h3>
                                <p className="text-[#4A4E69]">Spróbuj wpisać inne słowo kluczowe lub skontaktuj się z nami.</p>
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="mt-6 text-[#F97316] font-semibold hover:underline"
                                >
                                    Pokaż wszystkie pytania
                                </button>
                            </div>
                        )}
                    </div>
                </section>

                {/* Contact CTA */}
                <section className="py-20 px-6 bg-[#FAFBFD]">
                    <div className="max-width-1200 mx-auto">
                        <div className="bg-white rounded-[32px] p-8 md:p-16 shadow-xl border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-10">
                            <div className="text-center md:text-left">
                                <h2 className="text-3xl font-bold text-[#2D3142] mb-4">Wciąż masz pytania?</h2>
                                <p className="text-[#4A4E69] text-lg">
                                    Nasz zespół ekspertów jest gotowy, aby pomóc Ci w wyborze Twojego wymarzonego auta.
                                </p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                                <a
                                    href="mailto:kontakt@carsalon.pl"
                                    className="flex items-center justify-center gap-2 h-14 px-8 rounded-2xl bg-slate-50 text-[#2D3142] font-bold hover:bg-slate-100 transition-colors"
                                >
                                    <MessageSquare className="w-5 h-5" />
                                    Napisz do nas
                                </a>
                                <a
                                    href="tel:+48123456789"
                                    className="flex items-center justify-center gap-2 h-14 px-8 rounded-2xl bg-[#F97316] text-white font-bold hover:bg-[#EA580C] shadow-lg shadow-orange-100 transition-all hover:-translate-y-1"
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

            <style>{`
        .max-width-1200 { max-width: 1200px; }
        .max-width-900 { max-width: 900px; }
      `}</style>
        </div>
    );
}
