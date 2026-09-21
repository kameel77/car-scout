import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { BrandProvider } from './config/BrandContext';
import { AuthProvider } from './features/auth/AuthContext';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterCodePage } from './features/auth/RegisterCodePage';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { LandingPage } from './features/landing/pages/LandingPage';
import { NotFoundPage } from './features/common/NotFoundPage';
import { PortalBrandConfig } from './config/brand';

// Lazy load non-homepage public pages
const EmployerB2bPage = lazy(() =>
  import('./features/landing/pages/EmployerB2bPage').then((m) => ({ default: m.EmployerB2bPage }))
);
const TermsPage = lazy(() =>
  import('./features/landing/pages/TermsPage').then((m) => ({ default: m.TermsPage }))
);
const PrivacyPolicyPage = lazy(() =>
  import('./features/landing/pages/PrivacyPolicyPage').then((m) => ({ default: m.PrivacyPolicyPage }))
);

// Lazy load heavy internal authenticated catalog & inquiry modules
const CatalogPage = lazy(() =>
  import('./features/catalog/CatalogPage').then((m) => ({ default: m.CatalogPage }))
);
const NewCarOfferDetailPage = lazy(() =>
  import('./features/catalog/NewCarOfferDetailPage').then((m) => ({ default: m.NewCarOfferDetailPage }))
);
const RentalCatalogPage = lazy(() =>
  import('./features/rental/RentalCatalogPage').then((m) => ({ default: m.RentalCatalogPage }))
);
const RentalOfferDetailPage = lazy(() =>
  import('./features/rental/RentalOfferDetailPage').then((m) => ({ default: m.RentalOfferDetailPage }))
);
const MyInquiriesPage = lazy(() =>
  import('./features/inquiries/MyInquiriesPage').then((m) => ({ default: m.MyInquiriesPage }))
);
const AccountPage = lazy(() =>
  import('./features/account/AccountPage').then((m) => ({ default: m.AccountPage }))
);

const FallbackSpinner: React.FC = () => (
  <div className="min-h-screen bg-paper flex flex-col items-center justify-center gap-3">
    <div className="w-8 h-8 border-2 border-ink/15 border-t-ink rounded-full animate-spin" />
    <span className="text-xs text-muted font-medium tracking-wide">Ładowanie...</span>
  </div>
);

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/dla-firm"
        element={
          <Suspense fallback={<FallbackSpinner />}>
            <EmployerB2bPage />
          </Suspense>
        }
      />
      <Route
        path="/regulamin"
        element={
          <Suspense fallback={<FallbackSpinner />}>
            <TermsPage />
          </Suspense>
        }
      />
      <Route
        path="/prywatnosc"
        element={
          <Suspense fallback={<FallbackSpinner />}>
            <PrivacyPolicyPage />
          </Suspense>
        }
      />
      <Route path="/logowanie" element={<LoginPage />} />
      <Route path="/rejestracja" element={<RegisterCodePage />} />
      <Route path="/zapomnialem-hasla" element={<ForgotPasswordPage />} />
      <Route path="/reset-hasla" element={<ResetPasswordPage />} />
      <Route
        path="/katalog"
        element={
          <ProtectedRoute>
            <Suspense fallback={<FallbackSpinner />}>
              <CatalogPage />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/katalog/:id"
        element={
          <ProtectedRoute>
            <Suspense fallback={<FallbackSpinner />}>
              <NewCarOfferDetailPage />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/najem"
        element={
          <ProtectedRoute>
            <Suspense fallback={<FallbackSpinner />}>
              <RentalCatalogPage />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/najem/:id"
        element={
          <ProtectedRoute>
            <Suspense fallback={<FallbackSpinner />}>
              <RentalOfferDetailPage />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/zapytania"
        element={
          <ProtectedRoute>
            <Suspense fallback={<FallbackSpinner />}>
              <MyInquiriesPage />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/konto"
        element={
          <ProtectedRoute>
            <Suspense fallback={<FallbackSpinner />}>
              <AccountPage />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export const App: React.FC<{ initialConfig?: PortalBrandConfig }> = ({ initialConfig }) => {
  return (
    <BrandProvider initialConfig={initialConfig}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </BrandProvider>
  );
};

export default App;
