import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useBrandConfig } from '../../config/BrandContext';
import { requestPasswordReset } from './auth-api';
import { KeyRound, ArrowLeft, Mail, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export const ForgotPasswordPage: React.FC = () => {
  const { config } = useBrandConfig();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Podaj adres e-mail');
      return;
    }

    setIsSubmitting(true);
    try {
      await requestPasswordReset(config.apiUrl, trimmedEmail);
      setIsSubmitted(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Wystąpił błąd podczas wysyłania żądania');
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
            <KeyRound className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-2xl font-bold font-heading text-ink tracking-tight">
            Nie pamiętasz hasła?
          </h2>
          <p className="mt-1 text-sm text-muted">
            Podaj swój adres e-mail przypisany do programu firmy w {config.brandName}, a wyślemy Ci link do ustawienia nowego hasła.
          </p>
        </div>

        {isSubmitted ? (
          <div className="space-y-6">
            <div
              role="status"
              className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3 text-emerald-800 text-sm leading-relaxed"
            >
              <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">Sprawdź swoją skrzynkę odbiorczą</p>
                <p className="text-emerald-700">
                  Jeśli konto istnieje, wysłaliśmy link do zmiany hasła. Link jest ważny przez 30 minut.
                </p>
              </div>
            </div>

            <Link
              to="/logowanie"
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-line rounded-full text-sm font-semibold text-ink bg-white hover:bg-paper focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ink transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Powrót do logowania
            </Link>
          </div>
        ) : (
          <>
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
                <div className="relative mt-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    disabled={isSubmitting}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3.5 py-2.5 bg-white border border-line rounded-xl text-ink sm:text-sm focus:ring-2 focus:ring-ink focus:border-ink disabled:bg-paper disabled:cursor-not-allowed"
                    placeholder="twoj.email@firma.pl"
                  />
                </div>
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
                      Wysyłanie...
                    </>
                  ) : (
                    'Wyślij link do resetu'
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
          </>
        )}
      </div>
    </div>
  );
};
