import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useBrandConfig } from '../../config/BrandContext';
import { LogIn, KeyRound, Info } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { config } = useBrandConfig();
  const [email, setEmail] = useState('jan.kowalski@firma.pl');
  const [password, setPassword] = useState('demo1234');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-primary-50 text-primary-600 rounded-full flex items-center justify-center">
            <LogIn className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-gray-900 tracking-tight">
            Zaloguj się do portalu
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {config.brandName}
          </p>
        </div>

        {/* Informacja o statusie makiety przed formularzem */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 flex items-start gap-3 text-amber-800 text-xs leading-relaxed">
          <Info className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block">Makieta etapu P1 (Tryb demonstracyjny)</span>
            Formularz logowania nie przetwarza danych w etapie P1. Prawdziwe uwierzytelnianie przez tokeny JWT zostanie aktywowane w etapie P3.
          </div>
        </div>

        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Adres e-mail
            </label>
            <input
              id="email"
              type="email"
              disabled
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-500 sm:text-sm cursor-not-allowed"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Hasło (podgląd makiety)
            </label>
            <input
              id="password"
              type="password"
              disabled
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-500 sm:text-sm cursor-not-allowed"
            />
          </div>

          <div>
            <button
              type="button"
              disabled
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-medium text-gray-400 bg-gray-100 cursor-not-allowed"
            >
              Logowanie nieaktywne w etapie P1
            </button>
          </div>
        </form>

        <div className="text-center pt-3 border-t border-gray-100">
          <p className="text-sm text-gray-600">
            Pierwszy raz w programie?{' '}
            <Link
              to="/rejestracja"
              className="font-medium text-primary-600 hover:text-primary-500 inline-flex items-center gap-1"
            >
              <KeyRound className="h-4 w-4" />
              Dołącz z kodem firmy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
