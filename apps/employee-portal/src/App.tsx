import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { BrandProvider } from './config/BrandContext';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterCodePage } from './features/auth/RegisterCodePage';
import { CatalogPage } from './features/catalog/CatalogPage';
import { NotFoundPage } from './features/common/NotFoundPage';
import { PortalBrandConfig } from './config/brand';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/katalog" replace />} />
      <Route path="/logowanie" element={<LoginPage />} />
      <Route path="/rejestracja" element={<RegisterCodePage />} />
      <Route path="/katalog" element={<CatalogPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export const App: React.FC<{ initialConfig?: PortalBrandConfig }> = ({ initialConfig }) => {
  return (
    <BrandProvider initialConfig={initialConfig}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </BrandProvider>
  );
};

export default App;
