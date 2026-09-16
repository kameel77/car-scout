import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Car,
  Clock,
  Building2,
  UserCircle2,
  LogOut,
  AlertCircle,
  RefreshCw,
  FileQuestion,
  ArrowRight,
  Gift
} from 'lucide-react';
import { useBrandConfig } from '../../config/BrandContext';
import { useAuth } from '../auth/AuthContext';
import { fetchEmployeeInquiries, EmployeeInquiryItem } from './inquiries-api';

export const MyInquiriesPage: React.FC = () => {
  const { config, isLoading: isBrandLoading } = useBrandConfig();
  const { user, logout, sessionError, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();

  const [inquiries, setInquiries] = useState<EmployeeInquiryItem[]>([]);
  const [isLoadingInquiries, setIsLoadingInquiries] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <div className="text-gray-500 text-sm">Ładowanie danych...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/katalog" className="flex items-center gap-3">
              {config.brandLogoUrl && !logoError ? (
                <img
                  src={config.brandLogoUrl}
                  alt={config.brandName}
                  onError={() => setLogoError(true)}
                  className="h-8 w-auto max-w-[140px] object-contain"
                />
              ) : (
                <div className="h-8 w-8 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                  {config.brandName.charAt(0) || 'P'}
                </div>
              )}
              <span className="font-semibold text-gray-900 hidden sm:inline">{config.brandName}</span>
            </Link>

            {/* Navigation Tabs */}
            <nav className="flex items-center gap-2">
              <Link
                to="/katalog"
                className="px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                Katalog ofert
              </Link>
              <Link
                to="/zapytania"
                className="px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg bg-primary-50 text-primary-700 transition-colors"
              >
                Moje zapytania
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 border border-gray-200 py-1.5 px-3 rounded-lg">
                <UserCircle2 className="h-4 w-4 text-gray-500" />
                <span className="font-medium text-gray-900">
                  {user.firstName} {user.lastName}
                </span>
                <span className="hidden md:inline text-gray-300">|</span>
                <div className="hidden md:flex items-center gap-1.5 text-xs text-gray-600">
                  <Building2 className="h-3.5 w-3.5 text-gray-400" />
                  <span className="font-medium text-gray-800">{user.company?.name || 'Firma'}</span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 shadow-xs text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 transition-colors"
              aria-label="Wyloguj"
            >
              <LogOut className="h-4 w-4 text-gray-500" />
              <span className="hidden sm:inline">Wyloguj</span>
            </button>
          </div>
        </div>
      </header>

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
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Moje zapytania</h1>
            <p className="text-sm text-gray-500 mt-1">
              Historia zapytań o oferty samochodowe złożonych w programie partnerskim.
            </p>
          </div>
          <Link
            to="/katalog"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-xl transition-colors shadow-xs self-start sm:self-auto"
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
                className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs animate-pulse flex flex-col md:flex-row gap-5"
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
            <h3 className="text-lg font-bold text-gray-900">Nie udało się pobrać zapytań</h3>
            <p className="text-sm text-gray-600 mt-2 mb-6">{fetchError}</p>
            <button
              type="button"
              onClick={() => loadInquiries()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-xs"
            >
              <RefreshCw className="h-4 w-4" />
              Spróbuj ponownie
            </button>
          </div>
        ) : inquiries.length === 0 ? (
          /* 3. Empty State */
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center max-w-lg mx-auto shadow-xs my-10">
            <div className="w-14 h-14 bg-primary-50 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileQuestion className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Brak złożonych zapytań</h3>
            <p className="text-sm text-gray-500 mt-2 mb-6">
              Nie przesłałeś jeszcze żadnego zapytania o auto. Przejdź do katalogu i wybierz ofertę z dedykowanym rabatem.
            </p>
            <Link
              to="/katalog"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-xs"
            >
              Przejdź do katalogu
              <ArrowRight className="h-4 w-4" />
            </Link>
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
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-primary-700 bg-primary-50 border border-primary-200 px-2 py-0.5 rounded-md">
                        {inq.referenceNumber || inq.id}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                        {inq.status === 'NEW' ? 'Nowe' : inq.status}
                      </span>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
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

                    <h3 className="text-base font-bold text-gray-900 mt-1">
                      {inq.vehicle ? `${inq.vehicle.make} ${inq.vehicle.model}` : 'Pojazd z oferty'}
                      {inq.vehicle?.version && (
                        <span className="text-gray-500 font-normal text-xs ml-2">
                          {inq.vehicle.version}
                        </span>
                      )}
                    </h3>

                    <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                      <div>
                        <span className="font-medium text-gray-700">Strona umowy:</span>{' '}
                        {formatPartyLabel(inq.contractParty)}
                        {inq.nip && <span className="ml-1 text-gray-400">(NIP: {inq.nip})</span>}
                      </div>
                      {inq.notes && (
                        <div className="italic text-gray-400 line-clamp-1">
                          &quot;{inq.notes}&quot;
                        </div>
                      )}
                      {inq.benefit && (
                        <div className="inline-flex items-center gap-1.5 text-xs text-primary-700 bg-primary-50 px-2 py-0.5 rounded-md font-medium mt-1">
                          <Gift className="h-3 w-3 text-primary-600" />
                          <span>{inq.benefit.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Snapshot Pricing Block */}
                {inq.pricing && (
                  <div className="pt-3 md:pt-0 border-t md:border-t-0 border-gray-100 w-full md:w-auto flex md:flex-col items-baseline md:items-end justify-between md:justify-center">
                    <div className="text-xs text-gray-400 line-through">
                      Katalogowa: {inq.pricing.listPricePln.toLocaleString('pl-PL')} zł
                    </div>
                    <div className="text-lg font-bold text-primary-600 tracking-tight">
                      {inq.pricing.employeePricePln.toLocaleString('pl-PL')} zł
                    </div>
                    {inq.pricing.savingsPln > 0 && (
                      <div className="text-[11px] text-emerald-700 font-medium">
                        Oszczędność {inq.pricing.savingsPln.toLocaleString('pl-PL')} zł
                      </div>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
