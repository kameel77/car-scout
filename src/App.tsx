import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PriceSettingsProvider } from "@/contexts/PriceSettingsContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import SearchPage from "./pages/SearchPage";
import ListingDetailPage from "./pages/ListingDetailPage";
import LeadFormPage from "./pages/LeadFormPage";
import LoginPage from "./pages/admin/LoginPage";
import AdminDashboard from "./pages/admin/DashboardPage";
import TranslationsPage from "./pages/admin/TranslationsPage";
import UsersPage from "./pages/admin/UsersPage";
import FaqPage from "./pages/admin/FaqPage";
import NotFound from "./pages/NotFound";
import { LanguageSync } from "./components/LanguageSync";
import { DynamicTranslationsLoader } from "./components/DynamicTranslationsLoader";
import './i18n';

import { HelmetProvider } from 'react-helmet-async';
import { SeoManager } from '@/components/seo/SeoManager';
import SeoPage from "./pages/admin/SeoPage";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PriceSettingsProvider>
          <TooltipProvider>
            <SeoManager />
            <DynamicTranslationsLoader />
            <LanguageSync />
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<SearchPage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/listing/:id" element={<ListingDetailPage />} />
                <Route path="/listing/:id/lead" element={<LeadFormPage />} />

                {/* Admin routes */}
                <Route path="/admin/login" element={<LoginPage />} />
                <Route
                  path="/admin/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'manager']}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/translations"
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'manager']}>
                      <TranslationsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/seo"
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'manager']}>
                      <SeoPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/faq"
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'manager']}>
                      <FaqPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/users"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <UsersPage />
                    </ProtectedRoute>
                  }
                />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </PriceSettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
