import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="text-center max-w-md">
        <AlertCircle className="h-12 w-12 text-gray-400 mx-auto" />
        <h1 className="mt-4 text-2xl font-bold text-gray-900">404 - Nie znaleziono strony</h1>
        <p className="mt-2 text-sm text-gray-600">
          Strona, której szukasz, nie istnieje w portalu pracowniczym.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700"
          >
            Wróć na stronę główną
          </Link>
        </div>
      </div>
    </div>
  );
};
