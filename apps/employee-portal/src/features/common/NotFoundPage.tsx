import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper p-4">
      <div className="text-center max-w-md">
        <AlertCircle className="h-12 w-12 text-muted mx-auto" />
        <h1 className="mt-4 text-2xl font-bold text-ink">404 - Nie znaleziono strony</h1>
        <p className="mt-2 text-sm text-muted">
          Strona, której szukasz, nie istnieje w portalu pracowniczym.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-semibold rounded-full text-paper bg-ink hover:bg-ink/90 transition-colors"
          >
            Wróć na stronę główną
          </Link>
        </div>
      </div>
    </div>
  );
};
