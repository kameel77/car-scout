import React, { useState, useEffect } from 'react';
import { Phone, Mail } from 'lucide-react';
import '../landing.css';
import { LandingHeader } from '../components/LandingHeader';
import { LandingFooter } from '../components/LandingFooter';
import { AboutDialog } from '../dialogs/AboutDialog';
import { TurnstileWidget } from '../../common/TurnstileWidget';
import { useBrandConfig } from '../../../config/BrandContext';
import { trackEvent } from '../../analytics/analytics';
import { isValidNip } from '../../common/nip';

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

  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [, setTouched] = useState<Record<string, boolean>>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [referenceNumber, setReferenceNumber] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Benefivo dla Firm - Program samochodowy dla pracowników | Powered by Motolia';
    trackEvent('page_view', { page: 'employer_b2b' }, config.apiUrl, config.analyticsEnabled);
  }, [config.apiUrl, config.analyticsEnabled]);

  const validateField = (field: string, val: string | boolean): string | null => {
    let err: string | null = null;
    if (field === 'contactName') {
      if (!String(val).trim()) {
        err = 'Proszę podać imię i nazwisko osoby kontaktowej.';
      }
    } else if (field === 'companyName') {
      if (!String(val).trim()) {
        err = 'Proszę podać nazwę firmy.';
      }
    } else if (field === 'email') {
      const v = String(val).trim();
      if (!v) {
        err = 'Proszę podać służbowy adres e-mail.';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        err = 'Proszę podać poprawny adres e-mail.';
      }
    } else if (field === 'phone') {
      const v = String(val).trim();
      if (!v) {
        err = 'Proszę podać numer telefonu.';
      } else if (v.replace(/\D/g, '').length < 7) {
        err = 'Proszę podać poprawny numer telefonu (min. 7 cyfr).';
      }
    } else if (field === 'nip') {
      const v = String(val).trim();
      if (v && !isValidNip(v)) {
        err = 'Nieprawidłowy NIP (wymagane 10 cyfr i poprawna suma kontrolna).';
      }
    } else if (field === 'consentPrivacy') {
      if (!val) {
        err = 'Wymagana jest akceptacja polityki prywatności.';
      }
    }
    setErrors((prev) => ({ ...prev, [field]: err }));
    return err;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const errContactName = validateField('contactName', contactName);
    const errCompanyName = validateField('companyName', companyName);
    const errEmail = validateField('email', email);
    const errPhone = validateField('phone', phone);
    const errNip = validateField('nip', nip);
    const errConsent = validateField('consentPrivacy', consentPrivacy);

    if (errContactName || errCompanyName || errEmail || errPhone || errNip || errConsent) {
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
          name: contactName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          preferredContact: 'email',
          message: fullMessage,
          consentPrivacy: true,
          turnstileToken: turnstileToken || undefined,
          metadata: {
            companyName: companyName.trim(),
            companyNip: nip.trim(),
            teamSize,
            benefitModel: programModel
          }
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

      <main id="main">
        {/* Intro */}
        <section className="b2b-hero wrap">
          <p className="eyebrow">
            <span className="status-dot" aria-hidden="true" />
            DLA FIRM
          </p>
          <h1>
            Daj pracownikom więcej możliwości za kierownicą.<br />
            <span className="text-muted">Bez kosztów dla firmy.</span>
          </h1>
          <p className="hero-description">
            Podpisz umowę o współpracy, a Twój zespół otrzyma dostęp do specjalnych ofert na samochody i usługi motoryzacyjne. Pracownicy sami zdecydują, czy chcą z nich skorzystać. Przygotowaniem ofert i obsługą programu zajmuje się Motolia.
          </p>
          <div className="hero-actions">
            <a
              href="#kontakt-b2b"
              className="button button-lime"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('kontakt-b2b')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Porozmawiajmy o współpracy <span aria-hidden="true">&rarr;</span>
            </a>
          </div>
        </section>

        {/* Benefits Grid */}
        <section className="section wrap pt-0" aria-labelledby="b2b-benefits-title">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-3xl border border-line flex flex-col justify-start">
              <span className="step-number">01</span>
              <h3 className="mb-3">Bez kosztów po stronie firmy</h3>
              <p className="text-sm text-muted leading-relaxed">
                Udostępniasz pracownikom program na podstawie umowy o współpracy. Sam dostęp do ofert nie wymaga finansowania samochodów przez pracodawcę.
              </p>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-line flex flex-col justify-start">
              <span className="step-number">02</span>
              <h3 className="mb-3">Oferty przygotowane dla Twojego zespołu</h3>
              <p className="text-sm text-muted leading-relaxed">
                Pracownicy otrzymują dostęp do warunków i propozycji motoryzacyjnych dostępnych w programie ich firmy.
              </p>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-line flex flex-col justify-start">
              <span className="step-number">03</span>
              <h3 className="mb-3">Obsługa po naszej stronie</h3>
              <p className="text-sm text-muted leading-relaxed">
                Motolia przygotowuje ofertę, wspiera pracowników w wyborze rozwiązania i prowadzi dalszy proces związany z samochodem.
              </p>
            </div>
          </div>
        </section>

        {/* How We Start Section */}
        <section className="section wrap pt-0" aria-labelledby="b2b-steps-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">PROSTY PROCES</p>
              <h2 id="b2b-steps-title">Jak zaczynamy?</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-7 rounded-3xl border border-line flex flex-col justify-start">
              <span className="step-number">01</span>
              <p className="text-[15px] font-medium text-ink leading-snug">
                Poznajemy potrzeby Twojej firmy i zespołu.
              </p>
            </div>
            <div className="bg-white p-7 rounded-3xl border border-line flex flex-col justify-start">
              <span className="step-number">02</span>
              <p className="text-[15px] font-medium text-ink leading-snug">
                Ustalamy zakres programu i podpisujemy umowę.
              </p>
            </div>
            <div className="bg-white p-7 rounded-3xl border border-line flex flex-col justify-start">
              <span className="step-number">03</span>
              <p className="text-[15px] font-medium text-ink leading-snug">
                Przygotowujemy dostęp oraz materiały do przekazania pracownikom.
              </p>
            </div>
            <div className="bg-white p-7 rounded-3xl border border-line flex flex-col justify-start">
              <span className="step-number">04</span>
              <p className="text-[15px] font-medium text-ink leading-snug">
                Pracownicy samodzielnie przeglądają oferty i kontaktują się z Motolią.
              </p>
            </div>
          </div>
        </section>

        <section className="section wrap pt-0" aria-labelledby="kontakt-title">
          {/* Direct Contact Bar */}
          <div className="max-w-3xl mx-auto mb-10 bg-white border border-line rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xs">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-lime text-ink flex items-center justify-center flex-shrink-0 font-bold">
                <Phone className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted font-bold">Kontakt bezpośredni B2B</p>
                <p className="text-sm text-ink font-medium mt-0.5">Masz pytania? Porozmawiaj bezpośrednio z doradcą.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm font-semibold">
              <a
                href={`tel:${config.b2bPhone || '__B2B_PHONE__'}`}
                className="inline-flex items-center gap-2 text-ink hover:text-ink/80 transition-colors"
              >
                <Phone className="h-4 w-4 text-muted" />
                <span>{config.b2bPhone || '__B2B_PHONE__'}</span>
              </a>
              <span className="text-line hidden sm:inline">|</span>
              <a
                href={`mailto:${config.b2bEmail || 'b2b@benefivo.pl'}`}
                className="inline-flex items-center gap-2 text-ink hover:text-ink/80 transition-colors"
              >
                <Mail className="h-4 w-4 text-muted" />
                <span>{config.b2bEmail || 'b2b@benefivo.pl'}</span>
              </a>
            </div>
          </div>

          {/* Lead Form Box */}
          <div id="kontakt-b2b" className="bg-white rounded-3xl border border-line p-8 sm:p-12 shadow-xs max-w-3xl mx-auto scroll-mt-8">
            {referenceNumber ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-lime text-ink rounded-full flex items-center justify-center mx-auto text-2xl mb-4 font-bold">
                  ✓
                </div>
                <h2 className="!text-2xl sm:!text-3xl font-semibold text-ink mb-3">Dziękujemy za kontakt!</h2>
                <div className="inline-block bg-paper border border-line rounded-xl px-4 py-3 text-xs text-ink font-mono mb-4">
                  Numer referencyjny: <strong>{referenceNumber}</strong>
                </div>
                <div className="max-w-md mx-auto text-sm text-muted space-y-2 mb-8 text-left bg-paper border border-line p-4 rounded-xl">
                  <p className="font-semibold text-ink">Co wydarzy się dalej?</p>
                  <ul className="space-y-1.5 list-disc list-inside">
                    <li>Doradca flotowy Benefivo skontaktuje się z Państwem telefonicznie lub mailowo w ciągu 24 godzin roboczych.</li>
                    <li>Przedstawimy symulację korzyści dla pracowników oraz dopasowany model wdrożenia.</li>
                    <li>Przygotujemy dedykowany kod dostępu do portalu dla Państwa organizacji.</li>
                  </ul>
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
                  <h2 id="kontakt-title" className="!text-2xl sm:!text-3xl font-semibold text-ink mb-2">
                    Sprawdźmy, jak Benefivo może działać w Twojej firmie
                  </h2>
                  <p className="text-muted text-sm leading-relaxed">
                    Zostaw kontakt. Porozmawiamy o potrzebach zespołu i przygotujemy propozycję współpracy.
                  </p>
                </div>

              {errorMessage && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-6">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-2" htmlFor="contactName">
                      Imię i nazwisko *
                    </label>
                    <input
                      id="contactName"
                      type="text"
                      required
                      value={contactName}
                      onChange={(e) => {
                        setContactName(e.target.value);
                        if (errors.contactName) setErrors((prev) => ({ ...prev, contactName: null }));
                      }}
                      onBlur={(e) => {
                        setTouched((prev) => ({ ...prev, contactName: true }));
                        validateField('contactName', e.target.value);
                      }}
                      aria-invalid={!!errors.contactName}
                      aria-describedby={errors.contactName ? 'contactName-error' : undefined}
                      placeholder="np. Anna Kowalska"
                      className={`w-full bg-stone-50 border ${
                        errors.contactName ? 'border-red-500 ring-1 ring-red-500' : 'border-line'
                      } rounded-2xl px-4 py-3 text-ink focus:bg-white focus:border-ink transition-colors`}
                    />
                    {errors.contactName && (
                      <p id="contactName-error" className="text-xs text-red-600 mt-1.5">
                        {errors.contactName}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-2" htmlFor="companyName">
                      Nazwa firmy *
                    </label>
                    <input
                      id="companyName"
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => {
                        setCompanyName(e.target.value);
                        if (errors.companyName) setErrors((prev) => ({ ...prev, companyName: null }));
                      }}
                      onBlur={(e) => {
                        setTouched((prev) => ({ ...prev, companyName: true }));
                        validateField('companyName', e.target.value);
                      }}
                      aria-invalid={!!errors.companyName}
                      aria-describedby={errors.companyName ? 'companyName-error' : undefined}
                      placeholder="np. Kowalski Sp. z o.o."
                      className={`w-full bg-stone-50 border ${
                        errors.companyName ? 'border-red-500 ring-1 ring-red-500' : 'border-line'
                      } rounded-2xl px-4 py-3 text-ink focus:bg-white focus:border-ink transition-colors`}
                    />
                    {errors.companyName && (
                      <p id="companyName-error" className="text-xs text-red-600 mt-1.5">
                        {errors.companyName}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-2" htmlFor="email">
                      Służbowy adres e-mail *
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errors.email) setErrors((prev) => ({ ...prev, email: null }));
                      }}
                      onBlur={(e) => {
                        setTouched((prev) => ({ ...prev, email: true }));
                        validateField('email', e.target.value);
                      }}
                      aria-invalid={!!errors.email}
                      aria-describedby={errors.email ? 'email-error' : undefined}
                      placeholder="anna.kowalska@firma.pl"
                      className={`w-full bg-stone-50 border ${
                        errors.email ? 'border-red-500 ring-1 ring-red-500' : 'border-line'
                      } rounded-2xl px-4 py-3 text-ink focus:bg-white focus:border-ink transition-colors`}
                    />
                    {errors.email && (
                      <p id="email-error" className="text-xs text-red-600 mt-1.5">
                        {errors.email}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-2" htmlFor="phone">
                      Numer telefonu *
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (errors.phone) setErrors((prev) => ({ ...prev, phone: null }));
                      }}
                      onBlur={(e) => {
                        setTouched((prev) => ({ ...prev, phone: true }));
                        validateField('phone', e.target.value);
                      }}
                      aria-invalid={!!errors.phone}
                      aria-describedby={errors.phone ? 'phone-error' : undefined}
                      placeholder="+48 123 456 789"
                      className={`w-full bg-stone-50 border ${
                        errors.phone ? 'border-red-500 ring-1 ring-red-500' : 'border-line'
                      } rounded-2xl px-4 py-3 text-ink focus:bg-white focus:border-ink transition-colors`}
                    />
                    {errors.phone && (
                      <p id="phone-error" className="text-xs text-red-600 mt-1.5">
                        {errors.phone}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-2" htmlFor="teamSize">
                      Szacowana wielkość zespołu
                    </label>
                    <select
                      id="teamSize"
                      value={teamSize}
                      onChange={(e) => setTeamSize(e.target.value)}
                      className="w-full bg-stone-50 border border-line rounded-2xl px-4 py-3 text-ink focus:bg-white focus:border-ink transition-colors"
                    >
                      <option value="do 50 pracowników">do 50 pracowników</option>
                      <option value="50 - 200 pracowników">50 - 200 pracowników</option>
                      <option value="powyżej 200 pracowników">powyżej 200 pracowników</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-2" htmlFor="programModel">
                      Model programu
                    </label>
                    <select
                      id="programModel"
                      value={programModel}
                      onChange={(e) => setProgramModel(e.target.value)}
                      className="w-full bg-stone-50 border border-line rounded-2xl px-4 py-3 text-ink focus:bg-white focus:border-ink transition-colors"
                    >
                      <option value="Dostęp pracowniczy (bez kosztów firmy)">Dostęp pracowniczy (bez kosztów firmy)</option>
                      <option value="Program mieszany (z dopłatą firmy)">Program mieszany (z dopłatą firmy)</option>
                      <option value="Do ustalenia podczas rozmowy">Do ustalenia podczas rozmowy</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-2" htmlFor="nip">
                    NIP firmy (opcjonalnie)
                  </label>
                  <input
                    id="nip"
                    type="text"
                    value={nip}
                    onChange={(e) => {
                      setNip(e.target.value);
                      if (errors.nip) setErrors((prev) => ({ ...prev, nip: null }));
                    }}
                    onBlur={(e) => {
                      setTouched((prev) => ({ ...prev, nip: true }));
                      validateField('nip', e.target.value);
                    }}
                    aria-invalid={!!errors.nip}
                    aria-describedby={errors.nip ? 'nip-error' : undefined}
                    placeholder="np. 5252344078"
                    className={`w-full bg-stone-50 border ${
                      errors.nip ? 'border-red-500 ring-1 ring-red-500' : 'border-line'
                    } rounded-2xl px-4 py-3 text-ink focus:bg-white focus:border-ink transition-colors`}
                  />
                  {errors.nip && (
                    <p id="nip-error" className="text-xs text-red-600 mt-1.5">
                      {errors.nip}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-2" htmlFor="notes">
                    Dodatkowe informacje lub pytania
                  </label>
                  <textarea
                    id="notes"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="W czym możemy pomóc? Jakie marki lub formy finansowania najbardziej interesują Państwa pracowników?"
                    className="w-full bg-stone-50 border border-line rounded-2xl px-4 py-3 text-ink focus:bg-white focus:border-ink transition-colors"
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
                  <label className="flex items-start gap-3 cursor-pointer group min-h-[44px] py-1 select-none" htmlFor="consentPrivacy">
                    <span className="relative flex items-center justify-center w-5 h-5 mt-0.5 flex-shrink-0">
                      <input
                        type="checkbox"
                        id="consentPrivacy"
                        required
                        checked={consentPrivacy}
                        onChange={(e) => {
                          setConsentPrivacy(e.target.checked);
                          if (errors.consentPrivacy) {
                            setErrors((prev) => ({ ...prev, consentPrivacy: null }));
                          }
                        }}
                        onBlur={() => {
                          setTouched((prev) => ({ ...prev, consentPrivacy: true }));
                          validateField('consentPrivacy', consentPrivacy);
                        }}
                        aria-invalid={!!errors.consentPrivacy}
                        aria-describedby={errors.consentPrivacy ? 'consentPrivacy-error' : undefined}
                        className="w-5 h-5 rounded border-line text-ink accent-ink focus:ring-2 focus:ring-ink focus:ring-offset-2 cursor-pointer"
                      />
                    </span>
                    <span className="text-xs text-muted leading-relaxed">
                      Wyrażam zgodę na kontakt doradcy Benefivo (Motolia Sp. z o.o.) w celu przedstawienia oferty programu pracowniczego. Zapoznałem się z{' '}
                      <a href="/prywatnosc" target="_blank" className="underline text-ink font-medium hover:text-ink/80">
                        polityką prywatności
                      </a>.
                    </span>
                  </label>
                  {errors.consentPrivacy && (
                    <p id="consentPrivacy-error" className="text-xs text-red-600 mt-1 pl-8">
                      {errors.consentPrivacy}
                    </p>
                  )}
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="button button-dark w-full text-center justify-center font-semibold"
                  >
                    {isSubmitting ? 'Wysyłanie...' : 'Zapytaj o współpracę'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
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
