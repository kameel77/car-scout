import React, { useState, useEffect } from 'react';
import { Phone, Mail, Clock, Users, ShieldCheck, Star, BadgeCheck, MessageCircle, Lock } from 'lucide-react';
import '../landing.css';
import { LandingHeader } from '../components/LandingHeader';
import { LandingFooter } from '../components/LandingFooter';
import { AboutDialog } from '../dialogs/AboutDialog';
import { TurnstileWidget } from '../../common/TurnstileWidget';
import { useBrandConfig } from '../../../config/BrandContext';
import { trackEvent } from '../../analytics/analytics';
import { useTrack } from '../../analytics/useTrack';
import { isValidNip } from '../../common/nip';
import { StatsBand } from '../components/StatsBand';
import { CostCounter } from '../components/CostCounter';
import {
  B2B_BOOKING_URL,
  B2B_CONTACT,
  B2B_DECK_PDF,
  DEFAULT_B2B_PHONE,
  EMPLOYEE_BENEFITS,
  PILOT_LINE,
  telHref,
  type FaqItem,
} from '../content/marketing';

const HR_FAQ: FaqItem[] = [
  {
    question: 'Ile to kosztuje firmę?',
    answer: 'W modelu dostępu pracowniczego nic. Firma nie finansuje samochodów. Opcjonalnie może dopłacać do raty wybranym pracownikom.',
    approved: true,
  },
  {
    question: 'Kto jest stroną umowy na samochód?',
    answer: 'Pracownik. Umowę najmu, kredytu lub leasingu zawiera z instytucją finansującą za pośrednictwem Motolii. Firma podpisuje wyłącznie umowę o współpracy.',
    approved: true,
  },
  {
    question: 'Co musi zrobić dział HR?',
    answer: 'Przekazać pracownikom kod dostępu i przygotowaną przez nas informację. Pytania o auta i umowy obsługuje doradca Motolii.',
    approved: true,
  },
  {
    question: 'Kto przetwarza dane pracowników?',
    answer: 'Administratorem danych osobowych pracowników korzystających z portalu jest Motolia Sp. z o.o.',
    approved: true,
  },
  {
    question: 'Czy program wymaga potrąceń z wynagrodzenia?',
    answer: 'W modelu dostępu pracowniczego nie. Pracownik rozlicza się bezpośrednio z instytucją finansującą.',
    approved: true,
  },
  {
    question: 'Kto obsługuje sprawy związane z autem?',
    answer: 'Doradca Motolii i firma najmu lub leasingu. Dział HR nie jest stroną tych spraw.',
    approved: true,
  },
  { question: 'Co, jeśli pracownik odejdzie z firmy?', answer: 'TODO', approved: false },
  { question: 'Jak zakończyć współpracę?', answer: 'TODO', approved: false },
  { question: 'Ile trwa wdrożenie?', answer: 'TODO', approved: false },
];

const ROLLOUT_STEPS = [
  { title: 'Rozmowa', text: 'Poznajemy firmę i potrzeby zespołu.' },
  { title: 'Umowa', text: 'Ustalamy zakres programu i podpisujemy umowę o współpracy.' },
  { title: 'Start', text: 'Dostajesz kod firmy i gotowe materiały dla pracowników.' },
  { title: 'Obsługa', text: 'Pracownicy działają w portalu, Motolia prowadzi cały proces.' },
];

export const EmployerB2bPage: React.FC = () => {
  const { config } = useBrandConfig();
  const track = useTrack();
  const b2bPhone = config.b2bPhone || DEFAULT_B2B_PHONE;
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
  const [showDetails, setShowDetails] = useState(false);

  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [, setTouched] = useState<Record<string, boolean>>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [referenceNumber, setReferenceNumber] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Benefivo dla firm: benefit samochodowy dla pracowników | Powered by Motolia';
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
      if (errNip) setShowDetails(true);
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
        {/* Hero */}
        <section className="b2b-hero wrap" aria-labelledby="b2b-hero-title">
          <p className="eyebrow">
            <span className="status-dot" aria-hidden="true" />
            DLA FIRM
          </p>
          <h1 id="b2b-hero-title">
            Benefit samochodowy dla całego zespołu.<br />
            <span className="text-muted">Bez budżetu i bez pracy po stronie HR.</span>
          </h1>
          <p className="hero-description">
            Twoi pracownicy dostają nowe auta z rabatem od ceny katalogowej, najem z pełną obsługą, kartę Moya z 500 zł i osobistego doradcę. Firma podpisuje umowę o współpracy, a cały proces prowadzi Motolia.
          </p>
          <div className="hero-actions">
            {B2B_BOOKING_URL ? (
              <a
                href={B2B_BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="button button-lime"
                onClick={() => track('b2b_booking_click', { from: 'hero' })}
              >
                Umów 20-minutową rozmowę <span aria-hidden="true">&rarr;</span>
              </a>
            ) : (
              <a
                href="#kontakt-b2b"
                className="button button-lime"
                onClick={(e) => {
                  e.preventDefault();
                  track('b2b_booking_click', { from: 'hero' });
                  document.getElementById('kontakt-b2b')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Umów 20-minutową rozmowę <span aria-hidden="true">&rarr;</span>
              </a>
            )}
            {B2B_DECK_PDF && (
              <a
                href={B2B_DECK_PDF}
                className="button button-outline"
                download
                onClick={() => track('b2b_pdf_download')}
              >
                Pobierz prezentację (PDF)
              </a>
            )}
          </div>
          <p className="!mt-4 text-sm text-muted">
            lub zadzwoń:{' '}
            <a
              href={telHref(b2bPhone)}
              className="font-semibold text-ink underline underline-offset-4"
              onClick={() => track('b2b_cta_call_click', { from: 'hero' })}
            >
              {b2bPhone}
            </a>
          </p>
          <p className="!mt-6 inline-flex items-center gap-2 text-sm font-medium text-ink bg-white border border-line rounded-full px-4 py-2">
            <Users className="h-4 w-4 text-forest" aria-hidden="true" />
            {PILOT_LINE}
          </p>
        </section>

        <StatsBand />

        {/* Korzyści */}
        <section id="korzysci" className="section wrap scroll-mt-8" aria-labelledby="b2b-benefits-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">KORZYŚCI DLA FIRMY</p>
              <h2 id="b2b-benefits-title">Nowy benefit w pakiecie. Bez nowego kosztu.</h2>
            </div>
          </div>
          <CostCounter
            onCta={() => {
              track('b2b_booking_click', { from: 'cost_counter' });
              if (B2B_BOOKING_URL) {
                window.open(B2B_BOOKING_URL, '_blank', 'noopener,noreferrer');
              } else {
                document.getElementById('kontakt-b2b')?.scrollIntoView({ behavior: 'smooth' });
              }
            }}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { Icon: Users, title: 'Benefit dla wszystkich', text: 'Dostęp dostaje cały zespół, a nie tylko osoby z autem służbowym.' },
              { Icon: ShieldCheck, title: '0 zł, bez aut w bilansie', text: 'Firma podpisuje umowę o współpracy. Umowy na samochody zawiera pracownik.' },
              { Icon: Star, title: 'Wyróżnik w rekrutacji', text: 'Konkretny, odczuwalny benefit, o którym łatwo powiedzieć kandydatom.' },
            ].map(({ Icon, title, text }) => (
              <div key={title} className="bg-white p-8 rounded-3xl border border-line flex flex-col gap-3">
                <Icon className="h-7 w-7 text-forest" aria-hidden="true" />
                <h3>{title}</h3>
                <p className="text-sm text-muted leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Co dostają pracownicy */}
        <section className="section wrap pt-0" aria-labelledby="b2b-employees-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">DLA ZESPOŁU</p>
              <h2 id="b2b-employees-title">Co dostają Twoi pracownicy</h2>
            </div>
            <a href="/" className="text-link">
              Zobacz stronę dla pracowników <span aria-hidden="true">&rarr;</span>
            </a>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {EMPLOYEE_BENEFITS.map((b, i) => (
              <div key={b.title} className="bg-white p-7 rounded-3xl border border-line flex flex-col gap-2">
                <span className="step-number">{String(i + 1).padStart(2, '0')}</span>
                <h3>{b.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{b.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Model współpracy */}
        <section className="section wrap pt-0" aria-labelledby="b2b-model-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">MODEL WSPÓŁPRACY</p>
              <h2 id="b2b-model-title">Zaczynasz od zera złotych. Resztę decydujesz Ty.</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-lime p-8 sm:p-10 rounded-3xl flex flex-col gap-3">
              <p className="eyebrow">STANDARD</p>
              <h3>Dostęp pracowniczy</h3>
              <p className="font-heading text-5xl font-extrabold tracking-tight !text-ink">0 zł</p>
              <p className="text-sm leading-relaxed !text-ink">Pracownicy korzystają z warunków programu. Firma nie ponosi kosztów.</p>
            </div>
            <div className="bg-white p-8 sm:p-10 rounded-3xl border border-line flex flex-col gap-3">
              <p className="eyebrow text-muted">OPCJA</p>
              <h3>Program z dopłatą firmy</h3>
              <p className="font-heading text-5xl font-extrabold tracking-tight !text-forest">Ty ustalasz</p>
              <p className="text-sm text-muted leading-relaxed">Firma może dopłacać do raty wybranym grupom. Zasady i skutki podatkowe omawiamy indywidualnie.</p>
            </div>
          </div>
        </section>

        {/* Wdrożenie */}
        <section id="wdrozenie" className="section wrap pt-0 scroll-mt-8" aria-labelledby="b2b-steps-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">WDROŻENIE</p>
              <h2 id="b2b-steps-title">Cztery kroki. Po stronie HR: jeden mail.</h2>
            </div>
          </div>
          <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {ROLLOUT_STEPS.map((step, i) => (
              <li key={step.title} className="bg-white p-7 rounded-3xl border border-line flex flex-col gap-2">
                <span className="step-number">{String(i + 1).padStart(2, '0')}</span>
                <h3>{step.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* FAQ dla HR */}
        <section id="faq" className="section wrap faq-section scroll-mt-8" aria-labelledby="b2b-faq-title">
          <div>
            <p className="eyebrow">FAQ DLA HR</p>
            <h2 id="b2b-faq-title">Pytania, które zwykle padają.</h2>
          </div>
          <div className="faq-list">
            {HR_FAQ.filter((item) => item.approved).map((item) => (
              <details
                key={item.question}
                onToggle={(e) => {
                  if (e.currentTarget.open) track('faq_toggle', { question: item.question, page: 'employer_b2b' });
                }}
              >
                <summary>
                  {item.question}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Operator */}
        <section className="section wrap pt-0" aria-labelledby="b2b-operator-title">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <p className="eyebrow">KTO ZA TYM STOI</p>
              <h2 id="b2b-operator-title">Benefivo prowadzi Motolia.</h2>
              <p className="text-muted leading-relaxed !mt-4">
                Motolia Sp. z o.o. to operator programu i pośrednik finansowy. Współpracuje z importerami, grupami dealerskimi, instytucjami finansującymi i firmami najmu, obsługuje pracowników i administruje ich danymi.
              </p>
            </div>
            <ul className="flex flex-col gap-3">
              {[
                { Icon: Users, text: PILOT_LINE, highlight: true },
                { Icon: BadgeCheck, text: 'Jeden partner od oferty po odbiór auta', highlight: false },
                { Icon: Lock, text: 'Dane pracowników przetwarza Motolia', highlight: false },
                { Icon: MessageCircle, text: 'Dedykowany opiekun programu w firmie', highlight: false },
              ].map(({ Icon, text, highlight }) => (
                <li
                  key={text}
                  className={`${highlight ? 'bg-lime' : 'bg-white border border-line'} rounded-3xl px-6 py-5 flex items-center gap-4 font-medium`}
                >
                  <Icon className="h-6 w-6 text-forest flex-shrink-0" aria-hidden="true" />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="kontakt" className="section wrap pt-0 scroll-mt-8" aria-labelledby="kontakt-title">
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
            <div className="flex flex-col items-start gap-2 text-sm font-semibold">
              <a
                href={telHref(b2bPhone)}
                className="inline-flex items-center gap-2 text-ink hover:text-ink/80 transition-colors"
                onClick={() => track('b2b_cta_call_click', { from: 'contact' })}
              >
                <Phone className="h-4 w-4 text-muted" />
                <span>{b2bPhone}</span>
              </a>
              <a
                href={`mailto:${config.b2bEmail || B2B_CONTACT.email}`}
                className="inline-flex items-center gap-2 text-ink hover:text-ink/80 transition-colors"
              >
                <Mail className="h-4 w-4 text-muted" />
                <span>{config.b2bEmail || B2B_CONTACT.email}</span>
              </a>
              <span className="inline-flex items-center gap-2 text-muted font-medium">
                <Clock className="h-4 w-4" />
                {B2B_CONTACT.hours}
              </span>
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
                    Porozmawiajmy 20 minut.
                  </h2>
                  <p className="text-muted text-sm leading-relaxed">
                    Zostaw kontakt. Pokażemy, jak program działałby w Twojej firmie.
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
                  <button
                    type="button"
                    className="text-sm font-semibold text-forest underline underline-offset-4 min-h-[44px]"
                    aria-expanded={showDetails}
                    aria-controls="b2b-optional-details"
                    onClick={() => setShowDetails((v) => !v)}
                  >
                    {showDetails ? 'Ukryj szczegóły' : 'Dodaj szczegóły (opcjonalnie)'}
                  </button>
                </div>

                {showDetails && (
                <div id="b2b-optional-details" className="space-y-6">
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

                </div>
                )}

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
