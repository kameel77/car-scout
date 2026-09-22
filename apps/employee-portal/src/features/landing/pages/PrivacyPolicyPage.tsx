import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LandingHeader } from '../components/LandingHeader';
import { LandingFooter } from '../components/LandingFooter';
import { Shield, ChevronRight, Lock, CheckCircle2 } from 'lucide-react';

export const PrivacyPolicyPage: React.FC = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Polityka prywatności | Benefivo';
  }, []);

  return (
    <div className="benefivo-landing bg-[#0f172a] text-[#f8fafc] min-h-screen flex flex-col font-sans selection:bg-[#10b981]/30 selection:text-white">
      <LandingHeader />

      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-xs text-slate-400 mb-8">
          <Link to="/" className="hover:text-white transition-colors">
            Benefivo
          </Link>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <span className="text-slate-200">Polityka prywatności</span>
        </nav>

        {/* Header */}
        <div className="border-b border-slate-800 pb-8 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <Shield className="w-3.5 h-3.5" />
            Ochrona danych osobowych i RODO
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-3">
            Polityka Prywatności i Plików Cookies
          </h1>
          <p className="text-sm text-slate-400">
            Wersja 1.0 - Data wejścia w życie: 21 września 2026 r.
          </p>
        </div>

        {/* Highlight Card */}
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5 mb-8 flex items-start gap-4">
          <Lock className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300 leading-relaxed">
            <strong className="text-white block text-sm mb-1">Podejście Privacy-First i Cookieless Telemetry</strong>
            Szanujemy Twoją prywatność. Portal Benefivo nie stosuje śledzących ciasteczek reklamowych (third-party cookies). Analityka platformy działa w oparciu o anonimowe sygnały telemetryczne, a pliki cookie wykorzystywane są wyłącznie do utrzymania bezpiecznej sesji logowania i ochrony przed atakami typu CSRF.
          </div>
        </div>

        {/* Content */}
        <div className="space-y-8 text-slate-300 text-sm leading-relaxed">
          <section className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 sm:p-8">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-emerald-400">1.</span> Administrator Danych Osobowych
            </h2>
            <p className="mb-3">
              Administratorem Twoich danych osobowych w rozumieniu Rozporządzenia Parlamentu Europejskiego i Rady (UE) 2016/679 (RODO) jest:
            </p>
            <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800 text-xs text-slate-300 mb-3 space-y-1">
              <div className="font-semibold text-white">Motolia Sp. z o.o.</div>
              <div>ul. Alternatywy 7/135, 02-775 Warszawa</div>
              <div>NIP: 9512579189, REGON: 526563977, KRS: 0001061451</div>
              <div>Adres e-mail: kontakt@benefivo.pl | kontakt@motolia.pl</div>
              <div>Infolinia: +48 22 112 09 50</div>
            </div>
            <p>
              W sprawach związanych z ochroną danych osobowych możesz skontaktować się z Administratorem pod dedykowanym adresem e-mail: <a href="mailto:kontakt@benefivo.pl" className="text-emerald-400 underline">kontakt@benefivo.pl</a>.
            </p>
          </section>

          <section className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 sm:p-8">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-emerald-400">2.</span> Cele i podstawy prawne przetwarzania danych
            </h2>
            <div className="space-y-4">
              <div className="border-l-2 border-emerald-500/50 pl-4 py-1">
                <div className="font-semibold text-white text-sm mb-1">
                  A. Obsługa konta w Portalu i realizacja programu benefitowego
                </div>
                <p className="text-xs text-slate-400">
                  <strong className="text-slate-200">Podstawa:</strong> art. 6 ust. 1 lit. b RODO (wykonanie umowy o świadczenie usług drogą elektroniczną). Dane obejmują: imię, nazwisko, służbowy e-mail, numer telefonu, przypisanie do Pracodawcy oraz historię zapytań i konfiguracji.
                </p>
              </div>

              <div className="border-l-2 border-emerald-500/50 pl-4 py-1">
                <div className="font-semibold text-white text-sm mb-1">
                  B. Przygotowanie oferty najmu lub leasingu pojazdu
                </div>
                <p className="text-xs text-slate-400">
                  <strong className="text-slate-200">Podstawa:</strong> art. 6 ust. 1 lit. b RODO (działania przed zawarciem umowy na żądanie osoby). Dane przekazywane są do partnera finansującego w celu kalkulacji raty i przygotowania umowy.
                </p>
              </div>

              <div className="border-l-2 border-emerald-500/50 pl-4 py-1">
                <div className="font-semibold text-white text-sm mb-1">
                  C. Obsługa zapytań B2B od Pracodawców (/dla-firm)
                </div>
                <p className="text-xs text-slate-400">
                  <strong className="text-slate-200">Podstawa:</strong> art. 6 ust. 1 lit. f RODO (prawnie uzasadniony interes Administratora polegający na nawiązywaniu relacji biznesowych i prezentacji programu flotowego firmom).
                </p>
              </div>

              <div className="border-l-2 border-emerald-500/50 pl-4 py-1">
                <div className="font-semibold text-white text-sm mb-1">
                  D. Bezpieczeństwo IT, zapobieganie nadużyciom i obrona przed roszczeniami
                </div>
                <p className="text-xs text-slate-400">
                  <strong className="text-slate-200">Podstawa:</strong> art. 6 ust. 1 lit. f RODO (prawnie uzasadniony interes - monitorowanie bezpieczeństwa sesji, ochrona przed atakami brute-force, blokowanie spamu Cloudflare Turnstile).
                </p>
              </div>
            </div>
          </section>

          <section className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 sm:p-8">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-emerald-400">3.</span> Odbiorcy danych
            </h2>
            <p className="mb-3">
              Twoje dane osobowe mogą być przekazywane następującym kategoriom odbiorców:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-300">
              <li>
                <strong className="text-white">Partnerzy Finansujący i Firmy Wynajmujące:</strong> banki, firmy leasingowe i operatorzy CFM w celu przygotowania i procedowania umowy najmu pojazdu.
              </li>
              <li>
                <strong className="text-white">Pracodawca:</strong> w minimalnym wymaganym zakresie (potwierdzenie aktywnego statusu uprawnionego pracownika, bez ujawniania danych o zdolności kredytowej).
              </li>
              <li>
                <strong className="text-white">Dostawcy usług IT:</strong> zaufane podmioty dostarczające infrastrukturę hostingową, systemy pocztowe oraz zabezpieczenia antyspamowe (Cloudflare).
              </li>
            </ul>
          </section>

          <section className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 sm:p-8">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-emerald-400">4.</span> Twoje prawa
            </h2>
            <p className="mb-3">
              W związku z przetwarzaniem Twoich danych osobowych przysługują Ci następujące uprawnienia:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800">
                <div className="font-semibold text-white text-xs mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Dostęp do danych
                </div>
                <p className="text-[11px] text-slate-400">Prawo do uzyskania potwierdzenia i kopii przetwarzanych danych.</p>
              </div>
              <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800">
                <div className="font-semibold text-white text-xs mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Sprostowanie danych
                </div>
                <p className="text-[11px] text-slate-400">Prawo do poprawienia nieprawidłowych lub uzupełnienia danych.</p>
              </div>
              <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800">
                <div className="font-semibold text-white text-xs mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Usunięcie danych
                </div>
                <p className="text-[11px] text-slate-400">Prawo do bycia zapomnianym w przypadkach określonych w art. 17 RODO.</p>
              </div>
              <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800">
                <div className="font-semibold text-white text-xs mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Sprzeciw i ograniczenie
                </div>
                <p className="text-[11px] text-slate-400">Prawo do sprzeciwu wobec przetwarzania opartego na prawnie uzasadnionym interesie.</p>
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Przysługuje Ci również prawo wniesienia skargi do organu nadzorczego: Prezesa Urzędu Ochrony Danych Osobowych (ul. Stawki 2, 00-193 Warszawa).
            </p>
          </section>

          <section className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 sm:p-8">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-emerald-400">5.</span> Pliki cookies i technologie telemetryczne
            </h2>
            <p className="mb-3">
              1. Serwis Benefivo stosuje wyłącznie niezbędne pliki cookies (Strictly Necessary Cookies):
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-300 mb-3">
              <li>
                <strong className="text-white">Cookie sesyjne:</strong> uwierzytelnienie zalogowanego użytkownika w portalu pracowniczym.
              </li>
              <li>
                <strong className="text-white">Token CSRF:</strong> ochrona formularzy przed nieautoryzowanym przesłaniem z zewnętrznych witryn.
              </li>
            </ul>
            <p className="mb-3">
              2. Nie używamy śledzących plików cookie stron trzecich ani sieci reklamowych. Analityka odwiedzin prowadzona jest w sposób zanonimizowany (Cookieless Telemetry), bez łączenia aktywności z tożsamością fizyczną Użytkownika przed logowaniem.
            </p>
          </section>

          <section className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 sm:p-8">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-emerald-400">6.</span> Okres przechowywania i bezpieczeństwo
            </h2>
            <p className="mb-3">
              1. Dane osobowe przechowujemy przez okres aktywności konta pracowniczego w programie lub do czasu wygaśnięcia umowy ramowej z Pracodawcą.
            </p>
            <p className="mb-3">
              2. Dane związane ze złożonymi wnioskami o najem są archiwizowane przez czas niezbędny do rozliczenia i ochrony przed ewentualnymi roszczeniami (maksymalnie 6 lat zgodnie z Kodeksem cywilnym i przepisami podatkowymi).
            </p>
            <p>
              3. Stosujemy szyfrowanie połączeń TLS/SSL, mechanizmy ochrony przed atakami siłowymi (brute-force rate limiting) oraz regularne audyty kodu źródłowego.
            </p>
          </section>
        </div>

        {/* Bottom Contact */}
        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div>
            Masz pytania o swoje dane osobowe? Skontaktuj się z nami.
          </div>
          <a
            href="mailto:kontakt@benefivo.pl"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors"
          >
            kontakt@benefivo.pl
          </a>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
};
