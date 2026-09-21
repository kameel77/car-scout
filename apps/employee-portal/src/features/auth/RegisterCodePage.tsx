import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useBrandConfig } from '../../config/BrandContext';
import { useAuth } from './AuthContext';
import { validateCompanyCode, ValidateCodeResponse } from './auth-api';
import { ShieldCheck, ArrowLeft, AlertCircle, Loader2, Building, CheckCircle2 } from 'lucide-react';

export const RegisterCodePage: React.FC = () => {
  const { config } = useBrandConfig();
  const { register } = useAuth();
  const navigate = useNavigate();

  // Step 1: Code validation
  const [code, setCode] = useState('');
  const [validatedData, setValidatedData] = useState<ValidateCodeResponse | null>(null);

  // Step 2: Employee user details
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleValidateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode) {
      setError('Wprowadź kod dostępu firmy');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await validateCompanyCode(config.apiUrl, trimmedCode);
      if (data.valid) {
        setValidatedData(data);
      } else {
        setError('Kod dostępu jest nieprawidłowy');
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Weryfikacja kodu nie powiodła się');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validatedData) return;

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedFirst) {
      setError('Podaj imię');
      return;
    }
    if (!trimmedLast) {
      setError('Podaj nazwisko');
      return;
    }
    if (!trimmedEmail) {
      setError('Podaj adres e-mail');
      return;
    }
    if (!password || password.length < 8) {
      setError('Hasło musi mieć co najmniej 8 znaków');
      return;
    }
    if (new TextEncoder().encode(password).length > 72) {
      setError('Hasło jest za długie (maks. 72 znaki)');
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        code: code.trim().toUpperCase(),
        firstName: trimmedFirst,
        lastName: trimmedLast,
        email: trimmedEmail,
        phone: trimmedPhone || undefined,
        password,
      });
      navigate('/katalog', { replace: true });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Rejestracja nie powiodła się');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-line">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-lime text-ink rounded-full flex items-center justify-center">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-2xl font-bold font-heading text-ink tracking-tight">
            Aktywuj dostęp pracowniczy
          </h2>
          <p className="mt-1 text-sm text-muted">
            {config.brandName}
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-start gap-3 text-red-800 text-sm leading-relaxed"
          >
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="font-medium">{error}</div>
          </div>
        )}

        {!validatedData ? (
          /* KROK 1: Walidacja kodu firmy */
          <form className="space-y-4" onSubmit={handleValidateCode} noValidate>
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-ink">
                Kod dostępu firmy
              </label>
              <input
                id="code"
                type="text"
                required
                autoComplete="off"
                disabled={isSubmitting}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="mt-1 block w-full px-3.5 py-2.5 bg-white border border-line rounded-xl text-ink sm:text-sm uppercase tracking-wider font-mono focus:ring-2 focus:ring-ink focus:border-ink disabled:bg-paper disabled:cursor-not-allowed"
                placeholder="NP. KOD-FIRMY-1234"
              />
              <p className="mt-1 text-xs text-muted">
                Wpisz unikalny kod przekazany pracownikom Twojej organizacji.
              </p>
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-full text-sm font-semibold text-paper bg-ink hover:bg-ink/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ink disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Weryfikacja...
                  </>
                ) : (
                  'Sprawdź kod'
                )}
              </button>
            </div>
          </form>
        ) : (
          /* KROK 2: Formularz rejestracji */
          <form className="space-y-4" onSubmit={handleRegister} noValidate>
            <div className="bg-lime/25 border border-lime rounded-xl p-3 text-ink text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-ink">
                <CheckCircle2 className="h-4 w-4 text-forest" />
                <span>Kod zweryfikowany pomyślnie</span>
              </div>
              <div className="flex items-center gap-1">
                <Building className="h-3.5 w-3.5 text-forest" />
                <span>Firma: <strong>{validatedData.companyName}</strong></span>
              </div>
              <div>Program: <strong>{validatedData.programName}</strong></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-ink">
                  Imię
                </label>
                <input
                  id="firstName"
                  type="text"
                  required
                  autoComplete="given-name"
                  disabled={isSubmitting}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="mt-1 block w-full px-3.5 py-2.5 bg-white border border-line rounded-xl text-ink sm:text-sm focus:ring-2 focus:ring-ink focus:border-ink disabled:bg-paper"
                />
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-ink">
                  Nazwisko
                </label>
                <input
                  id="lastName"
                  type="text"
                  required
                  autoComplete="family-name"
                  disabled={isSubmitting}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="mt-1 block w-full px-3.5 py-2.5 bg-white border border-line rounded-xl text-ink sm:text-sm focus:ring-2 focus:ring-ink focus:border-ink disabled:bg-paper"
                />
              </div>
            </div>

            <div>
              <label htmlFor="regEmail" className="block text-sm font-medium text-ink">
                Adres e-mail
              </label>
              <input
                id="regEmail"
                type="email"
                required
                autoComplete="email"
                disabled={isSubmitting}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3.5 py-2.5 bg-white border border-line rounded-xl text-ink sm:text-sm focus:ring-2 focus:ring-ink focus:border-ink disabled:bg-paper"
                placeholder="twoj.email@firma.pl"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-ink">
                Numer telefonu <span className="text-muted text-xs">(opcjonalnie)</span>
              </label>
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                disabled={isSubmitting}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 block w-full px-3.5 py-2.5 bg-white border border-line rounded-xl text-ink sm:text-sm focus:ring-2 focus:ring-ink focus:border-ink disabled:bg-paper"
                placeholder="+48 123 456 789"
              />
            </div>

            <div>
              <label htmlFor="regPassword" className="block text-sm font-medium text-ink">
                Hasło
              </label>
              <input
                id="regPassword"
                type="password"
                required
                autoComplete="new-password"
                disabled={isSubmitting}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3.5 py-2.5 bg-white border border-line rounded-xl text-ink sm:text-sm focus:ring-2 focus:ring-ink focus:border-ink disabled:bg-paper"
                placeholder="Min. 8 znaków"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-full text-sm font-semibold text-paper bg-ink hover:bg-ink/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ink disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Tworzenie konta...
                  </>
                ) : (
                  'Utwórz konto'
                )}
              </button>
            </div>
          </form>
        )}

        <div className="text-center pt-3 border-t border-line">
          <Link
            to="/logowanie"
            className="font-medium text-muted hover:text-ink inline-flex items-center gap-1 text-sm transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Wróć do logowania
          </Link>
        </div>
      </div>
    </div>
  );
};
