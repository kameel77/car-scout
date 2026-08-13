import { useState } from 'react';
import { ArrowRight, CheckCircle2, Compass, Truck } from 'lucide-react';
import { leadsApi } from '@/services/api';
import { trackLeadSubmit } from '@/lib/analytics';
import { useToast } from '@/components/ui/use-toast';
import { Turnstile } from '@/components/Turnstile';
import { FOTON_MODELS, type FotonSegment } from '@/data/foton-models';

interface FotonLeadFormProps {
  /** Segment pre-selected when the form first mounts. */
  defaultSegment: FotonSegment;
  /** Model pre-selected when the form first mounts. */
  defaultModelId: string;
  /** GA4 / CRM traffic source — differentiates the hub from each model page. */
  trafficSource: string;
}

/**
 * Shared FOTON lead-gen form (segment + model + contact fields + Turnstile).
 * Used by both the /foton hub and every /foton/:slug model page so the form
 * markup, validation and legal notice stay in one place. Anchor target for
 * "scroll to form" CTAs is the wrapping section's id="foton-lead-form".
 */
export function FotonLeadForm({ defaultSegment, defaultModelId, trafficSource }: FotonLeadFormProps) {
  const { toast } = useToast();

  const [selectedSegment, setSelectedSegment] = useState<FotonSegment>(defaultSegment);
  const [selectedModel, setSelectedModel] = useState<string>(defaultModelId);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [message, setMessage] = useState('');
  const [consentPrivacy, setConsentPrivacy] = useState(true);
  const [turnstileToken, setTurnstileToken] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || (!email && !phone)) {
      toast({
        title: 'Błąd w formularzu',
        description: 'Podaj imię oraz numer telefonu lub adres email.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const leadType = selectedSegment === 'fleet' ? 'foton_fleet' : 'foton_lifestyle';
      const modelObj = FOTON_MODELS.find((m) => m.id === selectedModel);
      const fullMessage = [
        `Segment: ${selectedSegment === 'fleet' ? 'Flota / Użytkowe' : 'Lifestyle / Pickupy'}`,
        `Wybrany model: ${modelObj?.name || selectedModel}`,
        companyName ? `Firma: ${companyName}` : '',
        message ? `Wiadomość: ${message}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      await leadsApi.submitLead({
        name,
        email,
        phone,
        leadType,
        trafficSource,
        message: fullMessage,
        consentPrivacy,
        consentMarketing: false,
        turnstileToken,
      });

      trackLeadSubmit({
        formId: trafficSource,
        leadType,
        brand: 'FOTON',
        model: modelObj?.name,
        phone,
      });

      setIsSubmitted(true);
      toast({
        title: 'Zapytanie zostało wysłane',
        description: 'Doradca Motolii skontaktuje się z Tobą w najbliższym czasie.',
      });
    } catch (err: any) {
      toast({
        title: 'Błąd wysyłania',
        description: err.message || 'Nie udało się wysłać formularza. Spróbuj ponownie.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="foton-lead-form" className="py-20 bg-[#090D16] relative scroll-mt-24">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 blur-[100px] pointer-events-none" />

          <div className="text-center space-y-2 mb-8">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Formularz Kontaktowy
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              Zapytaj o ofertę i finansowanie FOTON
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Wypełnij krótki formularz – doradca Motolii przygotuje kalkulację raty i odpowie na pytania.
            </p>
          </div>

          {isSubmitted ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">Dziękujemy za przesłanie zapytania!</h3>
              <p className="text-sm text-slate-300">
                Twój formularz został zarejestrowany. Doradca handlowy Motolii skontaktuje się z Tobą telefonicznie lub mailowo w ciągu 24 godzin.
              </p>
              <button
                onClick={() => setIsSubmitted(false)}
                className="px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
              >
                Wyślij kolejne zapytanie
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Segment Selector */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-2">
                  Wybierz interesujący Cię segment:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSegment('fleet');
                      setSelectedModel('etoano-pro');
                    }}
                    className={`py-3 px-4 rounded-xl border text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                      selectedSegment === 'fleet'
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Truck className="w-4 h-4" />
                    Flota / Dostawcze
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSegment('lifestyle');
                      setSelectedModel('tunland-g7');
                    }}
                    className={`py-3 px-4 rounded-xl border text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                      selectedSegment === 'lifestyle'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Compass className="w-4 h-4" />
                    Lifestyle / Pickupy
                  </button>
                </div>
              </div>

              {/* Model Select */}
              <div>
                <label htmlFor="foton-model-select" className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Wybierz model pojazdu:
                </label>
                <select
                  id="foton-model-select"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  {FOTON_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.categoryLabel})
                    </option>
                  ))}
                </select>
              </div>

              {/* Contact Inputs */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="foton-name-input" className="block text-xs font-medium text-slate-300 mb-1">
                    Imię i Nazwisko *
                  </label>
                  <input
                    id="foton-name-input"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jan Kowalski"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label htmlFor="foton-company-input" className="block text-xs font-medium text-slate-300 mb-1">
                    Nazwa firmy / NIP (opcjonalnie)
                  </label>
                  <input
                    id="foton-company-input"
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Moja Firma Sp. z o.o."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="foton-phone-input" className="block text-xs font-medium text-slate-300 mb-1">
                    Numer telefonu *
                  </label>
                  <input
                    id="foton-phone-input"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+48 600 000 000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label htmlFor="foton-email-input" className="block text-xs font-medium text-slate-300 mb-1">
                    Adres e-mail
                  </label>
                  <input
                    id="foton-email-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jan@firma.pl"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="foton-message-input" className="block text-xs font-medium text-slate-300 mb-1">
                  Dodatkowe pytania / wymagania flotowe
                </label>
                <textarea
                  id="foton-message-input"
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="np. interesuje mnie kalkulacja najmu na 36 miesięcy z przebiegiem 30 000 km/rok..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* DISCLOSURE LAYER 3: INLINE LEGAL NOTICE */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-400 leading-relaxed">
                <p>
                  Wysyłając formularz kontaktujesz się z <strong>Motolia Sp. z o.o.</strong>, działającą jako Agent Importera marki FOTON. Umowa sprzedaży pojazdu zawierana jest z Power Truck Poland Sp. z o.o.
                </p>
              </div>

              {/* Consents */}
              <div className="space-y-2 text-xs text-slate-400">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentPrivacy}
                    onChange={(e) => setConsentPrivacy(e.target.checked)}
                    className="mt-0.5 rounded bg-slate-950 border-slate-800 text-amber-500 focus:ring-0"
                  />
                  <span>
                    Zapoznałem/am się z Polityką Prywatności i wyrażam zgodę na przetwarzanie moich danych osobowych w celu przygotowania oferty. *
                  </span>
                </label>
              </div>

              <Turnstile onVerify={setTurnstileToken} />

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !turnstileToken}
                className="w-full py-4 px-8 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-extrabold text-base transition-all duration-200 shadow-xl shadow-amber-950/40 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? 'Wysyłanie zapytania...' : 'Wyślij zapytanie o FOTON'}
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
