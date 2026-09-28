import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BenefivoModal } from './BenefivoModal';
import { trackEvent } from '../../analytics/analytics';
import { useBrandConfig } from '../../../config/BrandContext';
import { TurnstileWidget } from '../../common/TurnstileWidget';

export interface EmployeeJourneyDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const HR_MESSAGE =
  'Cześć! Chciałbym zaproponować wprowadzenie Benefivo - programu samochodowego powered by Motolia. Łączy najem i leasing aut z benefitami motoryzacyjnymi dla pracowników. Czy możemy sprawdzić możliwości uruchomienia takiego programu w naszej firmie?';

export const EmployeeJourneyDialog: React.FC<EmployeeJourneyDialogProps> = ({ isOpen, onClose }) => {
  const { config } = useBrandConfig();
  const [status, setStatus] = useState<string | null>(null);
  const [interestCompany, setInterestCompany] = useState('');
  const [interestEmail, setInterestEmail] = useState('');
  const [interestConsent, setInterestConsent] = useState(false);
  const [interestToken, setInterestToken] = useState('');
  const [interestState, setInterestState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [interestError, setInterestError] = useState<string | null>(null);

  const handleInterestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInterestError(null);
    const company = interestCompany.trim();
    const email = interestEmail.trim();
    if (!company) {
      setInterestError('Podaj nazwę firmy.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInterestError('Podaj poprawny adres e-mail.');
      return;
    }
    if (!interestConsent) {
      setInterestError('Zaznacz zgodę na kontakt.');
      return;
    }
    setInterestState('sending');
    try {
      // Reuses the employer B2B lead pipeline (BNF- reference, B2B queue); trafficSource marks it as an employee signal.
      const response = await fetch(`${config.apiUrl}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadType: 'employer_b2b',
          trafficSource: 'benefivo_employee_interest',
          name: 'Pracownik (Powiadom mnie)',
          email,
          preferredContact: 'email',
          message: `Zainteresowanie pracownika: ${company}. Nie przekazywać firmie danych pracownika.`,
          consentPrivacy: true,
          turnstileToken: interestToken || undefined,
          metadata: {
            companyName: company,
            companyNip: '',
            teamSize: '',
            benefitModel: 'Zgłoszenie pracownika: powiadom mnie',
          },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || data.error || 'Nie udało się wysłać zgłoszenia.');
      }
      setInterestState('sent');
      trackEvent('employee_interest_submit', {}, config.apiUrl, config.analyticsEnabled);
    } catch (err: unknown) {
      setInterestState('idle');
      setInterestError(err instanceof Error ? err.message : 'Nie udało się wysłać zgłoszenia.');
    }
  };

  const handleCopy = async () => {
    trackEvent('copy_hr_message', {}, config.apiUrl, config.analyticsEnabled);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(HR_MESSAGE);
        setStatus('Skopiowano treść wiadomości. Wklej ją w e-mailu lub na Slacku do HR.');
      } else {
        setStatus('Zaznacz tekst ręcznie i skopiuj skrótem ⌘C lub Ctrl+C.');
      }
    } catch {
      setStatus('Zaznacz tekst ręcznie i skopiuj skrótem ⌘C lub Ctrl+C.');
    }
  };

  return (
    <BenefivoModal
      isOpen={isOpen}
      onClose={onClose}
      kicker="DLA PRACOWNIKA"
      title="Dobre rzeczy zaczynają się w firmie."
      description="Zapytaj swój dział HR o program samochodowy. Możesz wykorzystać przygotowaną poniżej propozycję wiadomości."
    >
      <label htmlFor="benefivo-hr-msg" className="eyebrow block mb-1">
        WIADOMOŚĆ DO HR
      </label>
      <textarea
        id="benefivo-hr-msg"
        className="benefivo-message-box"
        readOnly
        value={HR_MESSAGE}
      />
      <div className="flex flex-wrap items-center gap-3 mt-4">
        <button
          className="button button-dark"
          type="button"
          onClick={handleCopy}
        >
          Kopiuj wiadomość <span aria-hidden="true">&rarr;</span>
        </button>
        <Link
          to="/rejestracja"
          className="button button-outline text-xs"
          onClick={onClose}
        >
          Masz kod firmy? Aktywuj dostęp &rarr;
        </Link>
      </div>
      {status && (
        <p className="benefivo-dialog-status mt-3" role="status">
          {status}
        </p>
      )}
      <p className="fine-print mt-4">
        To szybka propozycja dla Twojego pracodawcy. Dostęp do katalogu otrzymasz natychmiast po uruchomieniu programu w Twojej organizacji.
      </p>

      <div className="mt-6 pt-5 border-t border-line">
        <h3 className="font-heading text-lg font-semibold">Wolisz, żebyśmy to my zapytali?</h3>
        {interestState === 'sent' ? (
          <p className="benefivo-dialog-status mt-2" role="status">
            Dziękujemy. Damy znać, gdy program ruszy w Twojej firmie.
          </p>
        ) : (
          <form onSubmit={handleInterestSubmit} className="mt-2 space-y-3" noValidate>
            <p className="text-sm text-muted">
              Podaj nazwę firmy i swój e-mail. Porozmawiamy z Twoją firmą i damy Ci znać, gdy program ruszy. Nie podamy firmie Twoich danych.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="interest-company" className="block text-xs font-bold uppercase tracking-wider mb-1">
                  Nazwa firmy
                </label>
                <input
                  id="interest-company"
                  type="text"
                  value={interestCompany}
                  onChange={(e) => setInterestCompany(e.target.value)}
                  className="w-full bg-stone-50 border border-line rounded-2xl px-4 py-3"
                />
              </div>
              <div>
                <label htmlFor="interest-email" className="block text-xs font-bold uppercase tracking-wider mb-1">
                  Twój e-mail
                </label>
                <input
                  id="interest-email"
                  type="email"
                  value={interestEmail}
                  onChange={(e) => setInterestEmail(e.target.value)}
                  className="w-full bg-stone-50 border border-line rounded-2xl px-4 py-3"
                />
              </div>
            </div>
            <label htmlFor="interest-consent" className="flex items-start gap-3 text-xs text-muted min-h-[44px] py-1">
              <input
                id="interest-consent"
                type="checkbox"
                checked={interestConsent}
                onChange={(e) => setInterestConsent(e.target.checked)}
                className="w-5 h-5 mt-0.5 accent-ink"
              />
              <span>
                Zgadzam się na kontakt Motolia Sp. z o.o. w sprawie uruchomienia programu Benefivo w mojej firmie. Zapoznałem się z{' '}
                <a href="/prywatnosc" target="_blank" className="underline text-ink">polityką prywatności</a>.
              </span>
            </label>
            <TurnstileWidget
              siteKey={config.turnstileSiteKey || '1x00000000000000000000AA'}
              onVerify={(token: string) => setInterestToken(token)}
              onError={() => setInterestToken('')}
              onExpire={() => setInterestToken('')}
            />
            {interestError && (
              <p className="text-xs text-red-700" role="alert">{interestError}</p>
            )}
            <button className="button button-lime" type="submit" disabled={interestState === 'sending'}>
              {interestState === 'sending' ? 'Wysyłanie...' : 'Powiadom mnie'}
            </button>
          </form>
        )}
      </div>
    </BenefivoModal>
  );
};
