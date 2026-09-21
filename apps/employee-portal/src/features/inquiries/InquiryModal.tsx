import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useBrandConfig } from '../../config/BrandContext';
import { useAuth } from '../auth/AuthContext';
import { EmployeeOffer } from '../catalog/catalog-api';
import {
  submitEmployeeInquiry,
  ContractPartyOption,
  CreateInquiryPayload,
  RentalSelection
} from './inquiries-api';

export interface RentalDisplayInfo {
  contractMonths: number;
  annualMileage: number;
  downPaymentPct: number;
  monthlyRateNet: number;
  monthlyRateGross: number;
  isConsumer?: boolean;
  rentalCompanyName?: string;
}

export interface InquiryOfferItem {
  id: string;
  sourceType?: string;
  vehicle: {
    make: string;
    model: string;
    version?: string | null;
  };
  pricing?: {
    employeePricePln: number;
  } | null;
}

interface InquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  offer: InquiryOfferItem | EmployeeOffer | null;
  rentalSelection?: RentalSelection | null;
  rentalDisplay?: RentalDisplayInfo | null;
  initialContractParty?: ContractPartyOption;
  initialNotes?: string;
  onViewMyInquiries?: () => void;
}

export const InquiryModal: React.FC<InquiryModalProps> = ({
  isOpen,
  onClose,
  offer,
  rentalSelection,
  rentalDisplay,
  initialContractParty,
  initialNotes,
  onViewMyInquiries
}) => {
  const { config } = useBrandConfig();
  const { user } = useAuth();

  const [idempotencyKey, setIdempotencyKey] = useState<string>('');
  const [contractParty, setContractParty] = useState<ContractPartyOption>(initialContractParty || 'CONSUMER');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [nip, setNip] = useState('');
  const [notes, setNotes] = useState('');
  const [consentPrivacy, setConsentPrivacy] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdReferenceNumber, setCreatedReferenceNumber] = useState<string | null>(null);

  // Inicjalizacja formularza i klucza idempotencji dokładnie raz przy otwarciu modalu
  useEffect(() => {
    if (isOpen && offer) {
      setIdempotencyKey(crypto.randomUUID());
      setContractParty(initialContractParty || 'CONSUMER');
      setContactName(user ? `${user.firstName} ${user.lastName}`.trim() : '');
      setContactEmail(user ? user.email : '');
      setContactPhone(user?.phone || '');
      setNip('');
      setNotes(initialNotes || '');
      setConsentPrivacy(false);
      setIsSubmitting(false);
      setErrorMessage(null);
      setCreatedReferenceNumber(null);
    }
  }, [isOpen, offer, user, initialContractParty, initialNotes]);

  if (!isOpen || !offer) return null;

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Walidacja po stronie klienta
    if (!contactName.trim()) {
      setErrorMessage('Imię i nazwisko jest wymagane');
      return;
    }
    if (!contactEmail.trim()) {
      setErrorMessage('Adres e-mail jest wymagany');
      return;
    }
    if (!contactPhone.trim()) {
      setErrorMessage('Numer telefonu jest wymagany');
      return;
    }
    if ((contractParty === 'EMPLOYEE_B2B' || contractParty === 'EMPLOYER_COMPANY') && (!nip.trim() || nip.trim().length < 10 || nip.trim().length > 15)) {
      setErrorMessage('Podaj poprawny numer NIP (10-15 znaków)');
      return;
    }
    if (!consentPrivacy) {
      setErrorMessage('Wymagana jest zgoda na przetwarzanie danych osobowych');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: CreateInquiryPayload = {
        offerId: offer.id,
        idempotencyKey,
        contractParty,
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
        consentPrivacy,
        ...(contractParty !== 'CONSUMER' && nip.trim() ? { nip: nip.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(rentalSelection ? { rentalSelection } : {})
      };

      const response = await submitEmployeeInquiry(config.apiUrl, payload);
      setCreatedReferenceNumber(response.inquiry.referenceNumber || response.inquiry.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Wystąpił błąd podczas wysyłania zgłoszenia. Spróbuj ponownie.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-headline"
      className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <div>
            <h2 id="modal-headline" className="text-lg font-bold text-gray-900 leading-tight">
              {createdReferenceNumber ? 'Zgłoszenie wysłane' : 'Zapytaj o tę ofertę'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {offer.vehicle.make} {offer.vehicle.model}
              {rentalDisplay
                ? ` (${(rentalDisplay.isConsumer ? rentalDisplay.monthlyRateGross : rentalDisplay.monthlyRateNet).toLocaleString('pl-PL')} zł ${rentalDisplay.isConsumer ? 'brutto' : 'netto'} / mies.)`
                : offer.pricing?.employeePricePln
                ? ` (${offer.pricing.employeePricePln.toLocaleString('pl-PL')} zł brutto)`
                : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij modal"
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {createdReferenceNumber ? (
            /* Ekran Sukcesu */
            <div className="text-center py-4 flex flex-col items-center">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Dziękujemy za przesłanie zgłoszenia!</h3>
              <p className="text-sm text-gray-600 mt-2 max-w-sm">
                Twój dedykowany opiekun programu pracowniczego skontaktuje się z Tobą w ciągu 24 godzin w celu przedstawienia szczegółów.
              </p>

              <div className="my-6 p-4 bg-paper border border-line rounded-2xl w-full text-left">
                <div className="text-xs text-muted font-medium">Numer referencyjny zapytania:</div>
                <div className="text-xl font-mono font-bold text-ink mt-1 select-all">
                  {createdReferenceNumber}
                </div>
                <div className="text-xs text-muted mt-2 border-t border-line pt-2 flex justify-between">
                  <span>Wybrany pojazd:</span>
                  <span className="font-medium text-ink">{offer.vehicle.make} {offer.vehicle.model}</span>
                </div>
                {rentalDisplay && (
                  <div className="text-xs text-muted mt-1 flex justify-between">
                    <span>Parametry najmu:</span>
                    <span className="font-medium text-ink">
                      {rentalDisplay.contractMonths} mies. · {rentalDisplay.annualMileage.toLocaleString('pl-PL')} km · {(rentalDisplay.isConsumer ? rentalDisplay.monthlyRateGross : rentalDisplay.monthlyRateNet).toLocaleString('pl-PL')} zł {rentalDisplay.isConsumer ? 'brutto' : 'netto'} / mies.
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full">
                {onViewMyInquiries && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onViewMyInquiries();
                    }}
                    className="flex-1 py-3 px-4 bg-ink hover:bg-ink/90 text-paper font-semibold text-sm rounded-full transition-colors shadow-xs"
                  >
                    Zobacz moje zapytania
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 px-4 border border-line text-ink hover:bg-paper font-medium text-sm rounded-full transition-colors"
                >
                  Wróć do katalogu
                </button>
              </div>
            </div>
          ) : (
            /* Formularz */
            <form onSubmit={handleFormSubmit} className="space-y-5" noValidate>
              {errorMessage && (
                <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800">
                  <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>{errorMessage}</div>
                </div>
              )}

              {/* Parametry najmu (jeśli dotyczy) */}
              {rentalDisplay && (
                <div className="p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-xl text-xs space-y-1.5 text-emerald-950">
                  <div className="font-semibold text-emerald-900 border-b border-emerald-100/80 pb-1.5">
                    <span>Wybrane parametry najmu:</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-emerald-800 pt-1">
                    <div>Okres umowy: <strong>{rentalDisplay.contractMonths} mies.</strong></div>
                    <div>Limit roczny: <strong>{rentalDisplay.annualMileage.toLocaleString('pl-PL')} km</strong></div>
                    <div>Wpłata wstępna: <strong>{rentalDisplay.downPaymentPct}%</strong></div>
                    <div>
                      Rata miesięczna:{' '}
                      <strong>
                        {rentalDisplay.isConsumer
                          ? `${rentalDisplay.monthlyRateGross.toLocaleString('pl-PL')} zł brutto`
                          : `${rentalDisplay.monthlyRateNet.toLocaleString('pl-PL')} zł netto`}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Wybór strony umowy */}
              <div>
                <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-2">
                  Forma finansowania / Strona umowy *
                </label>
                <div className="space-y-2">
                  <label className={`flex items-start p-3 border rounded-xl cursor-pointer transition-colors ${contractParty === 'CONSUMER' ? 'border-ink bg-lime/15 ring-2 ring-lime' : 'border-line hover:bg-paper'}`}>
                    <input
                      type="radio"
                      name="contractParty"
                      value="CONSUMER"
                      checked={contractParty === 'CONSUMER'}
                      onChange={() => setContractParty('CONSUMER')}
                      className="mt-0.5 accent-ink text-ink focus:ring-ink"
                    />
                    <div className="ml-3 text-xs">
                      <div className="font-semibold text-ink">Osoba prywatna (Konsument)</div>
                      <div className="text-muted mt-0.5">
                        {rentalDisplay ? 'Najem konsumencki na osobę fizyczną' : 'Pożyczka konsumencka lub zakup prywatny'}
                      </div>
                    </div>
                  </label>

                  <label className={`flex items-start p-3 border rounded-xl cursor-pointer transition-colors ${contractParty === 'EMPLOYEE_B2B' ? 'border-ink bg-lime/15 ring-2 ring-lime' : 'border-line hover:bg-paper'}`}>
                    <input
                      type="radio"
                      name="contractParty"
                      value="EMPLOYEE_B2B"
                      checked={contractParty === 'EMPLOYEE_B2B'}
                      onChange={() => setContractParty('EMPLOYEE_B2B')}
                      className="mt-0.5 accent-ink text-ink focus:ring-ink"
                    />
                    <div className="ml-3 text-xs">
                      <div className="font-semibold text-ink">Działalność gospodarcza (B2B pracownika)</div>
                      <div className="text-muted mt-0.5">
                        {rentalDisplay ? 'Najem długoterminowy dla firm (faktura VAT)' : 'Leasing operacyjny na jednoosobową działalność'}
                      </div>
                    </div>
                  </label>

                  <label className={`flex items-start p-3 border rounded-xl cursor-pointer transition-colors ${contractParty === 'EMPLOYER_COMPANY' ? 'border-ink bg-lime/15 ring-2 ring-lime' : 'border-line hover:bg-paper'}`}>
                    <input
                      type="radio"
                      name="contractParty"
                      value="EMPLOYER_COMPANY"
                      checked={contractParty === 'EMPLOYER_COMPANY'}
                      onChange={() => setContractParty('EMPLOYER_COMPANY')}
                      className="mt-0.5 accent-ink text-ink focus:ring-ink"
                    />
                    <div className="ml-3 text-xs">
                      <div className="font-semibold text-ink">Firma pracodawcy (Finansowanie przez firmę)</div>
                      <div className="text-muted mt-0.5">Samochód służbowy finansowany bezpośrednio przez pracodawcę</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* NIP (warunkowy) */}
              {contractParty !== 'CONSUMER' && (
                <div>
                  <label htmlFor="inquiry-nip" className="block text-xs font-medium text-ink mb-1">
                    NIP Firmy *
                  </label>
                  <input
                    id="inquiry-nip"
                    type="text"
                    required
                    maxLength={15}
                    value={nip}
                    onChange={(e) => setNip(e.target.value)}
                    placeholder="np. 1234567890"
                    className="w-full px-3.5 py-2.5 border border-line rounded-xl text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink"
                  />
                </div>
              )}

              {/* Dane kontaktowe */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label htmlFor="inquiry-name" className="block text-xs font-medium text-ink mb-1">
                    Imię i nazwisko *
                  </label>
                  <input
                    id="inquiry-name"
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-line rounded-xl text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink"
                  />
                </div>

                <div>
                  <label htmlFor="inquiry-email" className="block text-xs font-medium text-ink mb-1">
                    Adres e-mail *
                  </label>
                  <input
                    id="inquiry-email"
                    type="email"
                    required
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-line rounded-xl text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink"
                  />
                </div>

                <div>
                  <label htmlFor="inquiry-phone" className="block text-xs font-medium text-ink mb-1">
                    Numer telefonu *
                  </label>
                  <input
                    id="inquiry-phone"
                    type="tel"
                    required
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-line rounded-xl text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink"
                  />
                </div>
              </div>

              {/* Uwagi */}
              <div>
                <label htmlFor="inquiry-notes" className="block text-xs font-medium text-ink mb-1">
                  Uwagi lub pytania do opiekuna (opcjonalne)
                </label>
                <textarea
                  id="inquiry-notes"
                  rows={2}
                  maxLength={2000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="np. preferowany okres leasingu, wysokość wpłaty wstępnej..."
                  className="w-full px-3.5 py-2.5 border border-line rounded-xl text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink resize-none"
                />
              </div>

              {/* Checkbox RODO (§3.1a) */}
              <div className="pt-2 border-t border-line">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-muted">
                  <input
                    type="checkbox"
                    required
                    checked={consentPrivacy}
                    onChange={(e) => setConsentPrivacy(e.target.checked)}
                    className="mt-0.5 accent-ink rounded-sm text-ink focus:ring-ink"
                  />
                  <span>
                    Wyrażam zgodę na przetwarzanie moich danych osobowych w celu obsługi zapytania o ofertę samochodową zgodnie z{' '}
                    <a
                      href="/polityka-prywatnosci"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ink underline font-medium hover:text-muted"
                    >
                      Polityką Prywatności
                    </a>
                    . *
                  </span>
                </label>
              </div>

              {/* Przyciski */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 border border-line text-muted text-sm font-medium rounded-full hover:text-ink hover:bg-paper transition-colors disabled:opacity-50"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-ink hover:bg-ink/90 text-paper text-sm font-semibold rounded-full transition-colors shadow-xs disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isSubmitting ? 'Wysyłanie...' : 'Wyślij zapytanie'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
