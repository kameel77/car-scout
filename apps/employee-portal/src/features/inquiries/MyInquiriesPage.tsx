import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Car,
  Clock,
  AlertCircle,
  RefreshCw,
  FileQuestion,
  ArrowRight,
  Gift
} from 'lucide-react';
import { useBrandConfig } from '../../config/BrandContext';
import { useAuth } from '../auth/AuthContext';
import { fetchEmployeeInquiries, EmployeeInquiryItem } from './inquiries-api';
import { PortalHeader } from '../common/PortalHeader';
import { PortalFooter } from '../common/PortalFooter';
import { formatCountPl } from '../common/plural';

const INQUIRY_STAGES = [
  { id: 1, label: 'Nowe' },
  { id: 2, label: 'Weryfikacja' },
  { id: 3, label: 'Oferta' },
  { id: 4, label: 'Umowa' }
];

function getStageIndex(status: string): number | null {
  const s = status.toUpperCase();
  if (['NEW', 'PENDING'].includes(s)) return 1;
  if (['VERIFICATION', 'IN_REVIEW', 'IN_PROGRESS', 'PROCESSING'].includes(s)) return 2;
  if (['OFFER', 'OFFER_SENT', 'OFFER_PREPARED'].includes(s)) return 3;
  if (['CONTRACT', 'COMPLETED', 'SIGNED', 'DELIVERED'].includes(s)) return 4;
  return null;
}

export const InquiryStatusTracker: React.FC<{ status: string }> = ({ status }) => {
  const s = status.toUpperCase();
  if (s === 'REJECTED' || s === 'CANCELLED') {
    return (
      <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl my-2">
        <AlertCircle className="h-4 w-4 flex-shrink-0" />
        <span>
          <span className="font-semibold">{s === 'CANCELLED' ? 'Anulowane' : 'Odrzucone'}</span>
          {' - '}Skontaktuj się z doradcą, aby poznać szczegóły.
        </span>
      </div>
    );
  }

  const currentStage = getStageIndex(status);
  if (currentStage === null) {
    return (
      <div className="my-2">
        <span className="text-xs px-2.5 py-1 rounded-full bg-paper text-ink font-semibold border border-line">
          {status}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 sm:gap-2 my-2.5 w-full max-w-md">
      {INQUIRY_STAGES.map((stage, idx) => {
        const isCurrent = stage.id === currentStage;
        const isDone = stage.id < currentStage;
        return (
          <React.Fragment key={stage.id}>
            <div
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-colors ${
                isCurrent
                  ? 'bg-lime text-ink font-bold shadow-xs'
                  : isDone
                  ? 'bg-ink text-paper font-semibold'
                  : 'bg-paper text-muted border border-line'
              }`}
            >
              {isDone ? (
                <span className="text-[10px]">✓</span>
              ) : (
                <span className="text-[10px]">{stage.id}</span>
              )}
              <span>{stage.label}</span>
            </div>
            {idx < INQUIRY_STAGES.length - 1 && (
              <div
                className={`h-0.5 flex-1 min-w-[6px] sm:min-w-[12px] ${
                  isDone ? 'bg-ink' : 'bg-line'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export const MyInquiriesPage: React.FC = () => {
  const { config, isLoading: isBrandLoading } = useBrandConfig();
  const { user, logout, sessionError, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();

  const [inquiries, setInquiries] = useState<EmployeeInquiryItem[]>([]);
  const [isLoadingInquiries, setIsLoadingInquiries] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const loadInquiries = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoadingInquiries(true);
      setFetchError(null);

      try {
        const response = await fetchEmployeeInquiries(config.apiUrl, {}, signal);
        setInquiries(response.inquiries || []);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        const msg = err instanceof Error ? err.message : 'Nie udało się pobrać listy Twoich zapytań. Spróbuj ponownie.';
        setFetchError(msg);
      } finally {
        setIsLoadingInquiries(false);
      }
    },
    [config.apiUrl]
  );

  useEffect(() => {
    if (!isBrandLoading && !isAuthLoading && user) {
      const controller = new AbortController();
      loadInquiries(controller.signal);
      return () => controller.abort();
    }
  }, [isBrandLoading, isAuthLoading, user, loadInquiries]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    setLogoutError(null);
    try {
      await logout();
      navigate('/logowanie');
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('401')) {
        navigate('/logowanie');
      } else {
        setLogoutError('Wystąpił błąd podczas wylogowywania');
      }
    } finally {
      setIsLoggingOut(false);
    }
  };

  const formatPartyLabel = (party: string) => {
    switch (party) {
      case 'CONSUMER':
        return 'Osoba prywatna (Konsument)';
      case 'EMPLOYEE_B2B':
        return 'Działalność gospodarcza (B2B)';
      case 'EMPLOYER_COMPANY':
        return 'Firma pracodawcy';
      default:
        return party;
    }
  };

  const activeError = logoutError || sessionError;

  if (isBrandLoading || isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-ink border-t-transparent rounded-full animate-spin" />
          <div className="text-muted text-sm">Ładowanie danych...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      {/* Top Navbar */}
      <PortalHeader onLogout={handleLogout} isLoggingOut={isLoggingOut} />

      {/* Logout / Session Error Alert */}
      {activeError && (
        <div
          role="alert"
          className="bg-red-50 border-b border-red-200 px-4 py-3 text-sm text-red-800 flex items-center justify-between shadow-xs"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex items-center justify-between">
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

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-heading text-ink tracking-tight flex items-center gap-2">
              <span>Moje zapytania</span>
              {!isLoadingInquiries && inquiries.length > 0 && (
                <span className="text-xs font-normal text-muted">
                  ({formatCountPl(inquiries.length, ['zapytanie', 'zapytania', 'zapytań'])})
                </span>
              )}
            </h1>
            <p className="text-sm text-muted mt-1">
              Historia zapytań o oferty samochodowe złożonych w programie partnerskim.
            </p>
          </div>
          <Link
            to="/katalog"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-line hover:bg-paper text-ink text-sm font-semibold rounded-full transition-colors shadow-xs self-start sm:self-auto"
          >
            Przeglądaj katalog
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* 1. Loading Skeleton */}
        {isLoadingInquiries ? (
          <div className="space-y-4" data-testid="inquiries-skeleton">
            {[1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="bg-white border border-line rounded-2xl p-5 shadow-xs animate-pulse flex flex-col md:flex-row gap-5"
              >
                <div className="w-full md:w-48 h-32 bg-gray-200 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-3 py-1">
                  <div className="h-5 bg-gray-200 rounded-md w-1/3" />
                  <div className="h-4 bg-gray-200 rounded-md w-1/4" />
                  <div className="h-4 bg-gray-200 rounded-md w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : fetchError ? (
          /* 2. Error State */
          <div
            role="alert"
            className="bg-white border border-red-200 rounded-2xl p-8 text-center max-w-lg mx-auto shadow-xs my-10"
          >
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold font-heading text-ink">Nie udało się pobrać zapytań</h3>
            <p className="text-sm text-muted mt-2 mb-6">{fetchError}</p>
            <button
              type="button"
              onClick={() => loadInquiries()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-ink hover:bg-ink/90 text-paper text-sm font-semibold rounded-full transition-colors shadow-xs"
            >
              <RefreshCw className="h-4 w-4" />
              Spróbuj ponownie
            </button>
          </div>
        ) : inquiries.length === 0 ? (
          /* 3. Empty State */
          <div className="bg-white border border-line rounded-2xl p-12 text-center max-w-lg mx-auto shadow-xs my-10">
            <div className="w-14 h-14 bg-lime text-ink rounded-full flex items-center justify-center mx-auto mb-4">
              <FileQuestion className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold font-heading text-ink">Nie masz jeszcze zapytań</h3>
            <p className="text-sm text-muted mt-2 mb-6">
              Nie przesłałeś jeszcze żadnego zapytania o auto. Przejdź do katalogu i wybierz ofertę z dedykowanym rabatem.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/katalog"
                className="inline-flex items-center gap-2 px-6 py-3 bg-ink hover:bg-ink/90 text-paper text-sm font-semibold rounded-full transition-colors shadow-xs"
              >
                Przeglądaj katalog
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/najem"
                className="inline-flex items-center gap-2 px-5 py-3 bg-white border border-line hover:bg-paper text-ink text-sm font-medium rounded-full transition-colors"
              >
                Oferty najmu
              </Link>
            </div>
          </div>
        ) : (
          /* 4. Inquiries List */
          <div className="space-y-4">
            {inquiries.map((inq) => (
              <article
                key={inq.id}
                className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs hover:border-gray-300 transition-colors flex flex-col md:flex-row gap-5 items-start md:items-center justify-between"
              >
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center w-full md:w-auto">
                  {/* Vehicle Thumbnail */}
                  <div className="w-full sm:w-36 h-24 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {inq.vehicle?.primaryImageUrl ? (
                      <img
                        src={inq.vehicle.primaryImageUrl}
                        alt={`${inq.vehicle.make} ${inq.vehicle.model}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Car className="h-8 w-8 text-gray-300" />
                    )}
                  </div>

                  {/* Vehicle Specs & Snapshot Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-ink bg-lime px-2.5 py-0.5 rounded-full">
                        {inq.referenceNumber || inq.id}
                      </span>
                      {inq.rental && (
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-paper text-ink font-semibold border border-line">
                          Najem długoterminowy
                        </span>
                      )}
                      <span className="text-xs text-muted flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(inq.createdAt).toLocaleDateString('pl-PL', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>

                    <h3 className="text-base font-bold font-heading text-ink mt-1">
                      {inq.vehicle ? `${inq.vehicle.make} ${inq.vehicle.model}` : 'Pojazd z oferty'}
                      {inq.vehicle?.version && (
                        <span className="text-muted font-normal text-xs ml-2">
                          {inq.vehicle.version}
                        </span>
                      )}
                    </h3>

                    {/* Status Horizontal Stage Tracker */}
                    <InquiryStatusTracker status={inq.status} />

                    {/* Advisor Contact / 24h SLA */}
                    <div className="text-xs text-muted space-y-0.5 mt-1.5">
                      <p>Doradca skontaktuje się w ciągu 24 godzin roboczych.</p>
                      {inq.accountManagerEmail && (
                        <p className="font-medium text-ink">
                          Dedykowany opiekun programu:{' '}
                          <a
                            href={`mailto:${inq.accountManagerEmail}`}
                            className="underline text-ink hover:text-ink/80"
                          >
                            {inq.accountManagerEmail}
                          </a>
                        </p>
                      )}
                    </div>

                    <div className="text-xs text-muted mt-2 space-y-0.5">
                      <div>
                        <span className="font-medium text-ink">Strona umowy:</span>{' '}
                        {formatPartyLabel(inq.contractParty)}
                        {inq.nip && <span className="ml-1 text-muted">(NIP: {inq.nip})</span>}
                      </div>
                      {inq.notes && (
                        <div className="italic text-muted line-clamp-1">
                          &quot;{inq.notes}&quot;
                        </div>
                      )}
                      {inq.benefit && (
                        <div className="inline-flex items-center gap-1.5 text-xs text-ink bg-lime/30 px-2.5 py-0.5 rounded-full font-medium mt-1">
                          <Gift className="h-3 w-3 text-ink" />
                          <span>{inq.benefit.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Snapshot Pricing / Rental Block */}
                {inq.rental ? (
                  <div className="pt-3 md:pt-0 border-t md:border-t-0 border-line w-full md:w-auto flex md:flex-col items-baseline md:items-end justify-between md:justify-center">
                    <div className="text-xs text-muted">
                      {inq.rental.contractMonths} mies. · {(inq.rental.annualMileageKm ?? inq.rental.annualMileage ?? 0).toLocaleString('pl-PL')} km/rok
                    </div>
                    <div className="text-lg font-black text-ink tracking-tight">
                      {(inq.rental.monthlyRateNetPln ?? inq.rental.monthlyRateNet ?? 0).toLocaleString('pl-PL')} zł <span className="text-xs font-normal text-muted">netto / mc</span>
                    </div>
                    <div className="text-[11px] text-muted">
                      Wpłata wstępna: {inq.rental.initialPaymentPct ?? inq.rental.downPaymentPct ?? 0}% ({(inq.rental.initialPaymentAmountNet ?? inq.rental.downPaymentAmountPln ?? 0).toLocaleString('pl-PL')} zł)
                    </div>
                    {inq.rental.rentalCompanyName && (
                      <div className="text-[11px] text-muted">
                        Dostawca: {inq.rental.rentalCompanyName}
                      </div>
                    )}
                  </div>
                ) : inq.pricing ? (
                  <div className="pt-3 md:pt-0 border-t md:border-t-0 border-line w-full md:w-auto flex md:flex-col items-baseline md:items-end justify-between md:justify-center">
                    <div className="text-xs text-muted line-through">
                      Katalogowa: {inq.pricing.listPricePln.toLocaleString('pl-PL')} zł
                    </div>
                    <div className="text-lg font-black text-ink tracking-tight">
                      {inq.pricing.employeePricePln.toLocaleString('pl-PL')} zł
                    </div>
                    {inq.pricing.savingsPln > 0 && (
                      <div className="text-[11px] text-ink bg-lime px-2 py-0.5 rounded-full font-semibold">
                        Oszczędzasz {inq.pricing.savingsPln.toLocaleString('pl-PL')} zł
                      </div>
                    )}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </main>
      <PortalFooter />
    </div>
  );
};

export default MyInquiriesPage;
