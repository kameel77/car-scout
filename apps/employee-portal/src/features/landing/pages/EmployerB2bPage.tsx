import React, { useState, useEffect } from 'react';
import '../landing.css';
import { LandingHeader } from '../components/LandingHeader';
import { LandingFooter } from '../components/LandingFooter';
import { AboutDialog } from '../dialogs/AboutDialog';
import { TurnstileWidget } from '../../common/TurnstileWidget';
import { useBrandConfig } from '../../../config/BrandContext';
import { trackEvent } from '../../analytics/analytics';

export const EmployerB2bPage: React.FC = () => {
  const { config } = useBrandConfig();
  const [aboutOpen, setAboutOpen] = useState(false);

  // Form states
  const [contactName, setContactName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [nip, setNip] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [teamSize, setTeamSize] = useState('50 - 200 pracowników');
  const [programModel, setProgramModel] = useState('Dostęp pracowniczy (bez kosztów firmy)');
  const [notes, setNotes] = useState('');
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [referenceNumber, setReferenceNumber] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Benefivo dla Firm - Program samochodowy dla pracowników | Powered by Motolia';
    trackEvent('page_view', { page: 'employer_b2b' }, config.apiUrl, config.analyticsEnabled);
  }, [config.apiUrl, config.analyticsEnabled]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!contactName.trim()) {
      setErrorMessage('Proszę podać imię i nazwisko osoby kontaktowej.');
      return;
    }
    if (!companyName.trim()) {
      setErrorMessage('Proszę podać nazwę firmy.');
      return;
    }
    if (!email.trim()) {
      setErrorMessage('Proszę podać służbowy adres e-mail.');
      return;
    }
    if (!phone.trim()) {
      setErrorMessage('Proszę podać numer telefonu.');
      return;
    }
    if (!consentPrivacy) {
      setErrorMessage('Wymagana jest akceptacja polityki prywatności.');
      return;
    }

    trackEvent('b2b_lead_submit_attempt', { company: companyName, teamSize }, config.apiUrl, config.analyticsEnabled);
    setIsSubmitting(true);

    try {
      const fullMessage = [
        `Firma: ${companyName.trim()}${nip.trim() ? ` (NIP: ${nip.trim()})` : ''}`,
        `Osoba kontaktowa: ${contactName.trim()}`,
        `Wielkość zespołu: ${teamSize}`,
        `Model programu: ${programModel}`,
        notes.trim() ? `Uwagi / zapotrzebowanie: ${notes.trim()}` : ''
      ].filter(Boolean).join('\n');

      const response = await fetch(`${config.apiUrl}/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          leadType: 'employer_b2b',
          trafficSource: 'benefivo_b2b',
          name: `${companyName.trim()} - ${contactName.trim()}`,
          email: email.trim(),
          phone: phone.trim(),
          preferredContact: 'email',
          message: fullMessage,
          consentPrivacy: true,
          turnstileToken: turnstileToken || undefined
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Wystąpił problem podczas przesyłania formularza.');
      }

      setReferenceNumber(data.lead?.referenceNumber || 'Zgłoszenie przyjęte');
      trackEvent('b2b_lead_success', { referenceNumber: data.lead?.referenceNumber }, config.apiUrl, config.analyticsEnabled);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Wystąpił błąd podczas wysyłki zgłoszenia.';
      setErrorMessage(message);
      trackEvent('b2b_lead_error', { error: message }, config.apiUrl, config.analyticsEnabled);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="benefivo-landing">
      <LandingHeader />

      <main className="wrap py-12">
        {/* Intro */}
        <section className="mb-14">
          <p className="eyebrow mb-3">DLA PRACODAWCÓW I ZARZĄDU</p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-stone-900 mb-6">
            Nowoczesny benefit motoryzacyjny.<br />
            <span className="text-stone-600 font-normal">Zero kosztów wdrożenia dla Twojej firmy.</span>
          </h1>
          <p className="text-lg text-stone-600 max-w-2xl leading-relaxed">
            Benefivo łączy Twój zespół z preferencyjną ofertą najmu i leasingu aut oraz pakietem usług towarzyszących. Obsługę operacyjną, doradztwo i procesy finansowe realizuje doświadczony zespół Motolii.
          </p>
        </section>

        {/* Benefits Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white p-7 rounded-2xl border border-stone-200">
            <div className="w-10 h-10 rounded-full bg-[#d5f478] flex items-center justify-center font-bold text-stone-900 mb-4">
              01
            </div>
            <h3 className="text-xl font-semibold mb-2">Brak ryzyka i obciążeń</h3>
            <p className="text-sm text-stone-600 leading-relaxed">
              Program nie obciąża bilansu ani zdolności kredytowej pracodawcy. Umowy mogą być zawierane bezpośrednio z pracownikiem lub w modelu dofinansowania przez firmę.
            </p>
          </div>

          <div className="bg-white p-7 rounded-2xl border border-stone-200">
            <div className="w-10 h-10 rounded-full bg-[#d5f478] flex items-center justify-center font-bold text-stone-900 mb-4">
              02
            </div>
            <h3 className="text-xl font-semibold mb-2">Preferencyjne stawki</h3>
            <p className="text-sm text-stone-600 leading-relaxed">
              Pracownicy zyskują dostęp do stawek korporacyjnych, rabatów flotowych i pakietów serwisowych niedostępnych w standardowych salonach dealerskich.
            </p>
          </div>

          <div className="bg-white p-7 rounded-2xl border border-stone-200">
            <div className="w-10 h-10 rounded-full bg-[#d5f478] flex items-center justify-center font-bold text-stone-900 mb-4">
              03
            </div>
            <h3 className="text-xl font-semibold mb-2">Kompleksowa obsługa</h3>
            <p className="text-sm text-stone-600 leading-relaxed">
              Dedykowany opiekun floty, portal pracowniczy z ofertami i pełne wsparcie administracyjne w przygotowaniu dokumentów - bez angażowania Twojego działu kadr.
            </p>
          </div>
        </section>

        {/* Lead Form Box */}
        <section className="bg-white rounded-3xl border border-stone-200 p-8 sm:p-12 shadow-xs max-w-3xl mx-auto">
          {referenceNumber ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto text-2xl mb-4 font-bold">
                ✓
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 mb-3">Dziękujemy za kontakt!</h2>
              <p className="text-stone-600 mb-6 max-w-md mx-auto">
                Zgłoszenie programu pracowniczego zostało przyjęte. Doradca flotowy zespołu Benefivo (Motolia) skontaktuje się z Państwem w ciągu 24 godzin.
              </p>
              <div className="inline-block bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-xs text-stone-700 font-mono mb-6">
                Numer referencyjny: <strong>{referenceNumber}</strong>
              </div>
              <div>
                <a href="/" className="button button-dark text-sm">
                  Wróć do strony głównej &rarr;
                </a>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 mb-2">
                  Porozmawiajmy o programie dla Twojej firmy
                </h2>
                <p className="text-stone-600 text-sm">
                  Wypełnij krótki formularz, a przygotujemy dopasowaną propozycję wdrożenia programu w Twojej organizacji.
                </p>
              </div>

              {errorMessage && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-6">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-1.5" htmlFor="contactName">
                      Imię i nazwisko *
                    </label>
                    <input
                      id="contactName"
                      type="text"
                      required
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="np. Anna Kowalska"
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-stone-900 focus:bg-white transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-1.5" htmlFor="companyName">
                      Nazwa firmy *
                    </label>
                    <input
                      id="companyName"
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="np. Action S.A."
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-stone-900 focus:bg-white transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-1.5" htmlFor="email">
                      Służbowy adres e-mail *
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="anna.kowalska@firma.pl"
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-stone-900 focus:bg-white transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-1.5" htmlFor="phone">
                      Numer telefonu *
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+48 123 456 789"
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-stone-900 focus:bg-white transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-1.5" htmlFor="teamSize">
                      Szacowana wielkość zespołu
                    </label>
                    <select
                      id="teamSize"
                      value={teamSize}
                      onChange={(e) => setTeamSize(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-stone-900 focus:bg-white transition-colors"
                    >
                      <option value="do 50 pracowników">do 50 pracowników</option>
                      <option value="50 - 200 pracowników">50 - 200 pracowników</option>
                      <option value="powyżej 200 pracowników">powyżej 200 pracowników</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-1.5" htmlFor="programModel">
                      Model programu
                    </label>
                    <select
                      id="programModel"
                      value={programModel}
                      onChange={(e) => setProgramModel(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-stone-900 focus:bg-white transition-colors"
                    >
                      <option value="Dostęp pracowniczy (bez kosztów firmy)">Dostęp pracowniczy (bez kosztów firmy)</option>
                      <option value="Program mieszany (z dopłatą firmy)">Program mieszany (z dopłatą firmy)</option>
                      <option value="Do ustalenia podczas rozmowy">Do ustalenia podczas rozmowy</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-1.5" htmlFor="nip">
                    NIP firmy (opcjonalnie)
                  </label>
                  <input
                    id="nip"
                    type="text"
                    value={nip}
                    onChange={(e) => setNip(e.target.value)}
                    placeholder="np. 5250000000"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-stone-900 focus:bg-white transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-1.5" htmlFor="notes">
                    Dodatkowe informacje lub pytania
                  </label>
                  <textarea
                    id="notes"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="W czym możemy pomóc? Jakie marki lub formy finansowania najbardziej interesują Państwa pracowników?"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-stone-900 focus:bg-white transition-colors"
                  />
                </div>

                <div className="pt-2">
                  <TurnstileWidget
                    siteKey={config.turnstileSiteKey || '1x00000000000000000000AA'}
                    onVerify={(token: string) => setTurnstileToken(token)}
                    onError={() => setTurnstileToken('')}
                    onExpire={() => setTurnstileToken('')}
                  />
                </div>

                <div className="pt-2">
                  <label className="flex items-start gap-3 cursor-pointer text-xs text-stone-600 leading-normal">
                    <input
                      type="checkbox"
                      required
                      checked={consentPrivacy}
                      onChange={(e) => setConsentPrivacy(e.target.checked)}
                      className="mt-0.5 rounded border-stone-300 text-stone-900 focus:ring-stone-500"
                    />
                    <span>
                      Wyrażam zgodę na kontakt doradcy Benefivo (Motolia Sp. z o.o.) w celu przedstawienia oferty programu pracowniczego. Zapoznałem się z{' '}
                      <a href="/prywatnosc" target="_blank" className="underline text-stone-900 font-medium">
                        polityką prywatności
                      </a>.
                    </span>
                  </label>
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="button button-dark w-full text-center justify-center font-bold"
                  >
                    {isSubmitting ? 'Wysyłanie...' : 'Wyślij zapytanie o program dla firm →'}
                  </button>
                </div>
              </form>
            </>
          )}
        </section>
      </main>

      <LandingFooter onOpenAbout={() => setAboutOpen(true)} />

      <AboutDialog
        isOpen={aboutOpen}
        onClose={() => setAboutOpen(false)}
      />
    </div>
  );
};

export default EmployerB2bPage;
