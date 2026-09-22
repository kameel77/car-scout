import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useBrandConfig } from '../../config/BrandContext';
import { resetEmployeePassword } from './auth-api';
import { Lock, ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';

export const ResetPasswordPage: React.FC = () => {
  const { config } = useBrandConfig();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token || !token.trim()) {
      setError('Brak tokenu resetującego hasło w adresie URL');
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

    if (password !== confirmPassword) {
      setError('Wprowadzone hasła nie są identyczne');
      return;
    }

    setIsSubmitting(true);
    try {
      await resetEmployeePassword(config.apiUrl, { token: token.trim(), password });
      navigate('/logowanie', {
        replace: true,
        state: { message: 'Hasło zostało pomyślnie zmienione. Możesz się teraz zalogować nowym hasłem.' }
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Wystąpił błąd podczas zmiany hasła');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token || !token.trim()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-line text-center">
          <div className="mx-auto h-12 w-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold font-heading text-ink tracking-tight">
            Nieprawidłowy link resetu
          </h2>
          <p className="text-sm text-muted">
            Link do zmiany hasła jest niepełny, wygasł lub został już wykorzystany.
          </p>
          <div className="pt-2">
            <Link
              to="/zapomnialem-hasla"
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-full text-sm font-semibold text-paper bg-ink hover:bg-ink/90 transition-colors"
            >
              Wyślij nowy link do resetu
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-line">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-lime text-ink rounded-full flex items-center justify-center">
            <Lock className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-2xl font-bold font-heading text-ink tracking-tight">
            Ustaw nowe hasło
          </h2>
          <p className="mt-1 text-sm text-muted">
            {config.brandName} - Wprowadź nowe hasło do swojego konta
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

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-ink">
              Nowe hasło
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              disabled={isSubmitting}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3.5 py-2.5 bg-white border border-line rounded-xl text-ink sm:text-sm focus:ring-2 focus:ring-ink focus:border-ink disabled:bg-paper disabled:cursor-not-allowed"
              placeholder="Minimum 8 znaków"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-ink">
              Powtórz nowe hasło
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              disabled={isSubmitting}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full px-3.5 py-2.5 bg-white border border-line rounded-xl text-ink sm:text-sm focus:ring-2 focus:ring-ink focus:border-ink disabled:bg-paper disabled:cursor-not-allowed"
              placeholder="Wpisz ponownie nowe hasło"
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
                  Zapisywanie nowego hasła...
                </>
              ) : (
                'Zapisz nowe hasło'
              )}
            </button>
          </div>
        </form>

        <div className="text-center pt-3 border-t border-line">
          <Link
            to="/logowanie"
            className="text-sm font-medium text-muted hover:text-ink transition-colors inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Wróć do logowania
          </Link>
        </div>
      </div>
    </div>
  );
};
