import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { BrandProvider } from './config/BrandContext';
import { AuthProvider } from './features/auth/AuthContext';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterCodePage } from './features/auth/RegisterCodePage';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { CatalogPage } from './features/catalog/CatalogPage';
import { RentalCatalogPage } from './features/rental/RentalCatalogPage';
import { RentalOfferDetailPage } from './features/rental/RentalOfferDetailPage';
import { MyInquiriesPage } from './features/inquiries/MyInquiriesPage';
import { NotFoundPage } from './features/common/NotFoundPage';
import { PortalBrandConfig } from './config/brand';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/katalog" replace />} />
      <Route path="/logowanie" element={<LoginPage />} />
      <Route path="/rejestracja" element={<RegisterCodePage />} />
      <Route
        path="/katalog"
        element={
          <ProtectedRoute>
            <CatalogPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/najem"
        element={
          <ProtectedRoute>
            <RentalCatalogPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/najem/:id"
        element={
          <ProtectedRoute>
            <RentalOfferDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/zapytania"
        element={
          <ProtectedRoute>
            <MyInquiriesPage />
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
