import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LandingHeader } from '../components/LandingHeader';
import { LandingFooter } from '../components/LandingFooter';
import { FileText, ChevronRight } from 'lucide-react';

export const TermsPage: React.FC = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Regulamin programu | Benefivo';
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
          <span className="text-slate-200">Regulamin</span>
        </nav>

        {/* Header */}
        <div className="border-b border-slate-800 pb-8 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <FileText className="w-3.5 h-3.5" />
            Dokument formalny
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-3">
            Regulamin Programu Samochodowego Benefivo
          </h1>
          <p className="text-sm text-slate-400">
            Wersja 1.0 - Data wejścia w życie: 21 września 2026 r.
          </p>
        </div>

        {/* Content */}
        <div className="space-y-8 text-slate-300 text-sm leading-relaxed">
          <section className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 sm:p-8">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-emerald-400">§ 1.</span> Postanowienia ogólne i definicje
            </h2>
            <p className="mb-3">
              1. Niniejszy Regulamin określa zasady korzystania z platformy internetowej benefivo.pl oraz uczestnictwa w programie benefitów motoryzacyjnych Benefivo.
            </p>
            <p className="mb-3">
              2. Operatorem technologicznym i zarządcą platformy Benefivo jest:
            </p>
            <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800 text-xs text-slate-300 mb-3 space-y-1">
              <div className="font-semibold text-white">Motolia Sp. z o.o.</div>
              <div>ul. Alternatywy 7/135, 02-775 Warszawa</div>
              <div>NIP: 9512579189, REGON: 526563977, KRS: 0001061451</div>
              <div>Adres e-mail: kontakt@benefivo.pl | kontakt@motolia.pl</div>
              <div>Infolinia: +48 22 112 09 50</div>
            </div>
            <p className="mb-2">3. Ilekroć w niniejszym Regulaminie mowa o:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-300">
              <li>
                <strong className="text-white">Programie Benefivo:</strong> programie pozapłacowych benefitów motoryzacyjnych dedykowanym pracownikom i współpracownikom firm partnerskich.
              </li>
              <li>
                <strong className="text-white">Operatorze:</strong> Motolia Sp. z o.o. odpowiedzialnej za platformę technologiczną, weryfikację uprawnień, doradztwo oraz koordynację procesu ofertowego.
              </li>
              <li>
                <strong className="text-white">Pracodawcy:</strong> podmiocie gospodarczym, który zawarł z Operatorem porozumienie o udostępnieniu Programu Benefivo swoim pracownikom i otrzymał unikalny kod firmy.
              </li>
              <li>
                <strong className="text-white">Użytkowniku (Pracowniku):</strong> osobie fizycznej zatrudnionej na podstawie umowy o pracę, umowy cywilnoprawnej lub współpracującej w formule B2B z Pracodawcą, posiadającej zarejestrowane konto w Serwisie.
              </li>
              <li>
                <strong className="text-white">Partnerze Finansującym (Finansującym / Wynajmującym):</strong> zewnętrznej instytucji finansowej, banku, firmie leasingowej lub CFM (Car Fleet Management), która jest bezpośrednią stroną docelowej umowy najmu długoterminowego lub leasingu pojazdu.
              </li>
            </ul>
          </section>

          <section className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 sm:p-8">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-emerald-400">§ 2.</span> Struktura relacji prawnych i rola stron
            </h2>
            <p className="mb-3">
              1. Platforma Benefivo pełni funkcję serwisu benefitowego i technologicznego pośrednictwa informacyjnego.
            </p>
            <p className="mb-3">
              2. Użytkownik przyjmuje do wiadomości, że:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-300 mb-3">
              <li>
                Motolia Sp. z o.o. nie jest stroną docelowej umowy finansowania ani najmu pojazdu, chyba że w odrębnym regulaminie promocji wskazano inaczej.
              </li>
              <li>
                Docelowa umowa najmu lub leasingu zawierana jest bezpośrednio pomiędzy Użytkownikiem (lub Użytkownikiem prowadzącym działalność B2B) a wybranym Partnerem Finansującym, na warunkach określonych przez tego Partnera.
              </li>
              <li>
                Pracodawca Użytkownika nie ponosi odpowiedzialności finansowej za zobowiązania Użytkownika wynikające z umów najmu lub leasingu zawartych w ramach programu, chyba że strony ustaliły odrębny model dopłat pracowniczych.
              </li>
            </ul>
            <p>
              3. Złożenie zapytania w Portalu nie stanowi zawarcia umowy najmu ani wiążącej oferty w rozumieniu art. 66 Kodeksu cywilnego, a zaproszenie do zawarcia umowy (art. 71 k.c.).
            </p>
          </section>

          <section className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 sm:p-8">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-emerald-400">§ 3.</span> Rejestracja i dostęp do Portalu
            </h2>
            <p className="mb-3">
              1. Dostęp do pełnego katalogu pojazdów, kalkulatora rat oraz składania wniosków rezerwacyjnych przysługuje wyłącznie uprawnionym Użytkownikom po dokonaniu rejestracji.
            </p>
            <p className="mb-3">
              2. Warunkiem rejestracji konta jest podanie ważnego kodu firmy przekazanego przez dział HR/Payroll Pracodawcy, służbowego adresu e-mail oraz ustanowienie bezpiecznego hasła.
            </p>
            <p className="mb-3">
              3. Użytkownik zobowiązany jest do zachowania w poufności danych logowania i nieudostępniania konta osobom trzecim.
            </p>
            <p>
              4. W przypadku ustania stosunku pracy lub współpracy z Pracodawcą, Użytkownik zachowuje prawa wynikające z zawartych wcześniej umów najmu zgodnie z warunkami Finansującego, jednak jego konto w portalu benefitowym może zostać zdezaktualizowane.
            </p>
          </section>

          <section className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 sm:p-8">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-emerald-400">§ 4.</span> Opłaty i koszty korzystania
            </h2>
            <p className="mb-3">
              1. Korzystanie z platformy internetowej Benefivo, rejestracja konta, przeglądanie katalogu oraz doradztwo w wyborze pojazdu są dla Użytkownika całkowicie bezpłatne.
            </p>
            <p className="mb-3">
              2. Koszty związane z eksploatacją i finansowaniem pojazdu (np. miesięczny czynsz najmu, ewentualna wpłata wstępna, kaucja) regulowane są na zasadach określonych w umowie z wybranym Partnerem Finansującym.
            </p>
            <p>
              3. Prezentowane w Serwisie raty miesięczne mają charakter szacunkowy i kalkulacyjny. Ostateczna wysokość raty uzależniona jest od weryfikacji zdolności finansowej Użytkownika przez Finansującego oraz wybranych parametrów (przebieg roczny, czas trwania umowy, pakiety ubezpieczeń i serwisu).
            </p>
          </section>

          <section className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 sm:p-8">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-emerald-400">§ 5.</span> Reklamacje i kontakt
            </h2>
            <p className="mb-3">
              1. Wszelkie reklamacje dotyczące działania platformy Benefivo Użytkownik może zgłaszać drogą elektroniczną na adres: <a href="mailto:kontakt@benefivo.pl" className="text-emerald-400 underline">kontakt@benefivo.pl</a>.
            </p>
            <p className="mb-3">
              2. Zgłoszenie reklamacyjne powinno zawierać: opis problemu, dane kontaktowe Użytkownika oraz datę wystąpienia nieprawidłowości.
            </p>
            <p className="mb-3">
              3. Operator rozpatruje reklamacje w terminie 14 dni roboczych od daty ich doręczenia i informuje Użytkownika o wyniku drogą mailową.
            </p>
            <p>
              4. Reklamacje dotyczące parametrów technicznych pojazdów, realizacji napraw gwarancyjnych lub decyzji kredytowych rozpatrywane są bezpośrednio przez autoryzowane stacje dealerskie lub odpowiedniego Partnera Finansującego.
            </p>
          </section>

          <section className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 sm:p-8">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-emerald-400">§ 6.</span> Postanowienia końcowe
            </h2>
            <p className="mb-3">
              1. W sprawach nieuregulowanych niniejszym Regulaminem zastosowanie mają powszechnie obowiązujące przepisy prawa polskiego, w szczególności Kodeksu cywilnego oraz ustawy o świadczeniu usług drogą elektroniczną.
            </p>
            <p className="mb-3">
              2. Operator zastrzega sobie prawo do wprowadzania zmian w Regulaminie z ważnych przyczyn prawnych lub organizacyjnych. O planowanych zmianach Użytkownicy zostaną powiadomieni drogą elektroniczną z co najmniej 14-dniowym wyprzedzeniem.
            </p>
            <p>
              3. Szczegółowe zasady przetwarzania danych osobowych określa <Link to="/prywatnosc" className="text-emerald-400 underline">Polityka Prywatności</Link>.
            </p>
          </section>
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div>
            Masz pytania dotyczące regulaminu? Skontaktuj się z naszym zespołem prawnym.
          </div>
          <a
            href="mailto:kontakt@benefivo.pl"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors"
          >
            Napisz do nas
          </a>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
};
