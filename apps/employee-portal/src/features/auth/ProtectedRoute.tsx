import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, isServiceUnavailable, sessionError, refreshSession } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm font-medium">Weryfikacja sesji pracowniczej...</p>
        </div>
      </div>
    );
  }

  if (isServiceUnavailable) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white p-6 rounded-xl border border-gray-200 shadow-sm text-center">
          <div className="mx-auto h-12 w-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Usługa tymczasowo niedostępna</h2>
          <p className="text-sm text-gray-600 mb-6">
            {sessionError || 'Wystąpił problem z połączeniem z serwerem. Spróbuj ponownie za chwilę.'}
          </p>
          <button
            type="button"
            onClick={() => refreshSession()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
            Spróbuj ponownie
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/logowanie" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
