import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Shield,
  Fuel,
  Award,
  Car,
  Layers,
  FileText,
  ArrowRight,
  Headphones,
  Mail,
  Clock,
  AlertCircle,
  Percent,
  Briefcase,
  BadgeCheck,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useBrandConfig } from '../../config/BrandContext';
import { PortalHeader } from '../common/PortalHeader';
import { PortalFooter } from '../common/PortalFooter';

export const ProgramDashboardPage: React.FC = () => {
  const { user, logout, sessionError } = useAuth();
  const { config } = useBrandConfig();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    setLogoutError(null);
    try {
      await logout();
      navigate('/logowanie', { replace: true });
    } catch (err: unknown) {
      setLogoutError(err instanceof Error ? err.message : 'Wystąpił błąd podczas wylogowywania');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const activeError = logoutError || sessionError;

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <PortalHeader onLogout={handleLogout} isLoggingOut={isLoggingOut} />

      {activeError && (
        <div
          role="alert"
          className="bg-red-50 border-b border-red-200 text-sm text-red-800 shadow-xs"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
              <span>{activeError}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setLogoutError(null);
                navigate('/logowanie');
              }}
              className="text-xs font-semibold text-red-900 underline hover:text-red-700"
            >
              Zaloguj ponownie
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        {/* Sekcja 1: Hero & Status Programu Partnerskiego (Zrzut 1) */}
        <section className="bg-white rounded-3xl border border-line p-6 sm:p-8 lg:p-10 shadow-xs">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-lime text-ink rounded-full text-xs font-semibold mb-4">
            <Sparkles className="h-3.5 w-3.5 text-ink" />
            Program aktywny dla organizacji {user?.company?.name || 'Twojej firmy'}
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-heading text-ink tracking-tight">
            Dedykowana oferta samochodów dla pracowników
          </h1>

          <p className="mt-3 text-sm sm:text-base text-muted max-w-3xl leading-relaxed">
            Nowe samochody w najmie długoterminowym oraz leasingu na preferencyjnych warunkach partnerskich z pakietem benefitów pracowniczych.
          </p>

          <div className="mt-8 pt-6 border-t border-line">
            <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">
              Pakiet benefitów w programie {user?.program?.name || 'partnerskim'}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3.5 p-4 bg-paper rounded-2xl border border-line shadow-xs">
                <Shield className="h-6 w-6 text-forest flex-shrink-0" />
                <div>
                  <div className="font-semibold text-sm text-ink">Specjalne warunki flotowe</div>
                  <div className="text-xs text-muted mt-0.5">Dedykowane matryce i rabaty cenowe</div>
                </div>
              </div>

              <div className="flex items-center gap-3.5 p-4 bg-paper rounded-2xl border border-line shadow-xs">
                <Fuel className="h-6 w-6 text-forest flex-shrink-0" />
                <div>
                  <div className="font-semibold text-sm text-ink">Pakiet paliwowy Moya</div>
                  <div className="text-xs text-muted mt-0.5">Karta z zasileniem i rabat na stacjach</div>
                </div>
              </div>

              <div className="flex items-center gap-3.5 p-4 bg-paper rounded-2xl border border-line shadow-xs">
                <Award className="h-6 w-6 text-forest flex-shrink-0" />
                <div>
                  <div className="font-semibold text-sm text-ink">Opieka doradcy Motolii</div>
                  <div className="text-xs text-muted mt-0.5">Indywidualny kontakt i wsparcie formalności</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Sekcja 2: Szybki dostęp do oferty i zapytań */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg sm:text-xl font-bold font-heading text-ink">
                Wybierz kategorię finansowania
              </h2>
              <p className="text-xs sm:text-sm text-muted mt-0.5">
                Przeglądaj dostępne pojazdy lub sprawdź status wcześniej złożonych zapytań.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Karta Samochody */}
            <div className="bg-white rounded-3xl border border-line p-6 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-ink/20 transition-all">
              <div>
                <div className="w-11 h-11 rounded-2xl bg-paper border border-line flex items-center justify-center text-forest mb-4">
                  <Car className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold font-heading text-ink">
                  Samochody nowe
                </h3>
                <p className="text-xs sm:text-sm text-muted mt-2 leading-relaxed">
                  Kredyt samochodowy oraz leasing operacyjny. Wynegocjowane rabaty flotowe od cen katalogowych z gwarancją stałej raty.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-line">
                <Link
                  to="/katalog"
                  className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-forest hover:text-forest/80 transition-colors group"
                >
                  <span>Przeglądaj samochody</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>

            {/* Karta Najem długoterminowy */}
            <div className="bg-white rounded-3xl border border-line p-6 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-ink/20 transition-all">
              <div>
                <div className="w-11 h-11 rounded-2xl bg-paper border border-line flex items-center justify-center text-forest mb-4">
                  <Layers className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold font-heading text-ink">
                  Najem długoterminowy
                </h3>
                <p className="text-xs sm:text-sm text-muted mt-2 leading-relaxed">
                  Abonament all-inclusive ze stałą ratą miesięczną. W cenie pełny serwis ASO, ubezpieczenie OC/AC/NNW oraz pakiet opon.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-line">
                <Link
                  to="/najem"
                  className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-forest hover:text-forest/80 transition-colors group"
                >
                  <span>Przeglądaj najem</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>

            {/* Karta Moje zapytania */}
            <div className="bg-white rounded-3xl border border-line p-6 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-ink/20 transition-all">
              <div>
                <div className="w-11 h-11 rounded-2xl bg-paper border border-line flex items-center justify-center text-forest mb-4">
                  <FileText className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold font-heading text-ink">
                  Moje zapytania
                </h3>
                <p className="text-xs sm:text-sm text-muted mt-2 leading-relaxed">
                  Śledź status zgłoszonych wniosków, sprawdzaj podsumowania kalkulacji i bądź w stałym kontakcie ze swoim doradcą.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-line">
                <Link
                  to="/zapytania"
                  className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-forest hover:text-forest/80 transition-colors group"
                >
                  <span>Zobacz zapytania</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Sekcja 3: Sposób działania programu (Filary) */}
        <section className="bg-white rounded-3xl border border-line p-6 sm:p-8 lg:p-10 shadow-xs space-y-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold font-heading text-ink">
              Jak działa program partnerski {config.brandName || 'Benefivo'}?
            </h2>
            <p className="text-xs sm:text-sm text-muted mt-1 max-w-2xl">
              Dzięki partnerstwu Twojej organizacji z Motolią otrzymujesz bezpośredni dostęp do warunków zarezerwowanych dotychczas dla największych flot korporacyjnych.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-paper rounded-2xl border border-line space-y-2">
              <div className="flex items-center gap-2 text-forest font-semibold text-sm">
                <Percent className="h-4 w-4 flex-shrink-0" />
                <span>Rabaty flotowe</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Wynegocjowane zniżki na zakup nowych aut i dedykowane matryce finansowania, nieosiągalne w standardowych ofertach salonowych.
              </p>
            </div>

            <div className="p-4 bg-paper rounded-2xl border border-line space-y-2">
              <div className="flex items-center gap-2 text-forest font-semibold text-sm">
                <Briefcase className="h-4 w-4 flex-shrink-0" />
                <span>Wybór B2B lub prywatnie</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Sam decydujesz o formie finansowania: kredyt samochodowy, pożyczka leasingowa lub leasing operacyjny na jednoosobową działalność.
              </p>
            </div>

            <div className="p-4 bg-paper rounded-2xl border border-line space-y-2">
              <div className="flex items-center gap-2 text-forest font-semibold text-sm">
                <BadgeCheck className="h-4 w-4 flex-shrink-0" />
                <span>0 zł ukrytych opłat</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Przejrzyste warunki kalkulacji, brak marż pośredników i gwarancja stałej raty przez cały okres trwania umowy.
              </p>
            </div>

            <div className="p-4 bg-paper rounded-2xl border border-line space-y-2">
              <div className="flex items-center gap-2 text-forest font-semibold text-sm">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span>Dedykowany doradca</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Osobisty opiekun z zespołu Motolii odpowiada za przygotowanie kalkulacji, weryfikację wniosku i koordynację wydania pojazdu.
              </p>
            </div>
          </div>
        </section>

        {/* Sekcja 4: Proces korzystania z oferty (Krok po kroku) */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold font-heading text-ink">
              Krok po kroku: Jak odebrać auto?
            </h2>
            <p className="text-xs sm:text-sm text-muted mt-0.5">
              Prosty, 4-etapowy proces wyboru, kalkulacji i odbioru Twojego nowego samochodu.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-line shadow-xs space-y-3 relative">
              <div className="text-2xl font-extrabold font-heading text-forest">01</div>
              <h3 className="font-bold text-sm text-ink font-heading">
                Wybór auta i kalkulacja
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                Wybierz interesujący Cię model w katalogu. Za pomocą suwaków dopasuj wpłatę wstępną, okres finansowania lub limit kilometrów.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-line shadow-xs space-y-3 relative">
              <div className="text-2xl font-extrabold font-heading text-forest">02</div>
              <h3 className="font-bold text-sm text-ink font-heading">
                Bezpłatne zapytanie online
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                Kliknij przycisk „Zapytaj o tę ofertę”. Wypełnij krótki formularz kontaktowy. Zapytanie jest w 100% bezpłatne i niezobowiązujące.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-line shadow-xs space-y-3 relative">
              <div className="text-2xl font-extrabold font-heading text-forest">03</div>
              <h3 className="font-bold text-sm text-ink font-heading">
                Rozmowa z doradcą w 24h
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                Twój dedykowany doradca flotowy skontaktuje się z Tobą telefonicznie lub mailowo, doprecyzuje szczegóły i przedstawi umowę.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-line shadow-xs space-y-3 relative">
              <div className="text-2xl font-extrabold font-heading text-forest">04</div>
              <h3 className="font-bold text-sm text-ink font-heading">
                Podpisanie umowy i odbiór
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                Podpisujesz dokumenty na partnerskich warunkach pracowniczych i odbierasz fabrycznie nowe auto w autoryzowanym salonie lub u dealera.
              </p>
            </div>
          </div>
        </section>

        {/* Sekcja 5: Pomoc i kontakt */}
        <section className="bg-white rounded-3xl border border-line p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-paper border border-line flex items-center justify-center text-forest flex-shrink-0">
                <Headphones className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold font-heading text-ink">
                  Potrzebujesz pomocy lub indywidualnej konfiguracji?
                </h3>
                <p className="text-xs sm:text-sm text-muted mt-1 max-w-xl leading-relaxed">
                  Nasi doradcy flotowi odpowiedzą na Twoje pytania dotyczące raty, doboru wyposażenia lub procedury finansowania.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <a
                href={`mailto:${config.b2bEmail || 'kontakt@benefivo.pl'}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-line bg-paper text-xs sm:text-sm font-semibold text-ink hover:bg-paper/80 transition-colors"
              >
                <Mail className="h-4 w-4 text-forest" />
                <span>{config.b2bEmail || 'kontakt@benefivo.pl'}</span>
              </a>

              <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-line bg-paper text-xs sm:text-sm text-muted">
                <Clock className="h-4 w-4 text-muted" />
                <span>Pn - Pt 9:00 - 17:00</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PortalFooter />
    </div>
  );
};
