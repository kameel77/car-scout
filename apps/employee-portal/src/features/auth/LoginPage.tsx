import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useBrandConfig } from '../../config/BrandContext';
import { useAuth } from './AuthContext';
import { LogIn, KeyRound, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { config } = useBrandConfig();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const successMessage = (location.state as { message?: string })?.message;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
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
      await login({ email: trimmedEmail, password });
      const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/katalog';
      // Tylko bezpieczne wewnętrzne ścieżki
      const safeTarget = from.startsWith('/') && !from.startsWith('//') ? from : '/katalog';
      navigate(safeTarget, { replace: true });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Wystąpił błąd podczas logowania');
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
            <LogIn className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-2xl font-bold font-heading text-ink tracking-tight">
            Zaloguj się do portalu
          </h2>
          <p className="mt-1 text-sm text-muted">
            {config.brandName}
          </p>
        </div>

        {successMessage && !error && (
          <div
            role="status"
            className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-3 text-emerald-800 text-sm leading-relaxed"
          >
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="font-medium">{successMessage}</div>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-start gap-3 text-red-800 text-sm leading-relaxed"
          >
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="font-medium">{error}</div>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-ink">
              Adres e-mail
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              disabled={isSubmitting}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3.5 py-2.5 bg-white border border-line rounded-xl text-ink sm:text-sm focus:ring-2 focus:ring-ink focus:border-ink disabled:bg-paper disabled:cursor-not-allowed"
              placeholder="twoj.email@firma.pl"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-medium text-ink">
                Hasło
              </label>
              <Link
                to="/zapomnialem-hasla"
                className="text-xs font-medium text-muted hover:text-ink transition-colors"
              >
                Nie pamiętasz hasła?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              disabled={isSubmitting}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3.5 py-2.5 bg-white border border-line rounded-xl text-ink sm:text-sm focus:ring-2 focus:ring-ink focus:border-ink disabled:bg-paper disabled:cursor-not-allowed"
              placeholder="••••••••"
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
                  Logowanie...
                </>
              ) : (
                'Zaloguj się'
              )}
            </button>
          </div>
        </form>

        <div className="text-center pt-3 border-t border-line space-y-2">
          <p className="text-sm text-muted">
            Pierwszy raz w programie?{' '}
            <Link
              to="/rejestracja"
              className="font-semibold text-ink hover:underline inline-flex items-center gap-1"
            >
              <KeyRound className="h-4 w-4 text-ink" />
              Dołącz z kodem firmy
            </Link>
          </p>
          <div>
            <Link
              to="/"
              className="text-xs text-muted hover:text-ink transition-colors inline-flex items-center gap-1"
            >
              ← Wróć do strony głównej benefivo.pl
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
