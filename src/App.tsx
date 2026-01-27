import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PriceSettingsProvider } from "@/contexts/PriceSettingsContext";
import { SpecialOfferProvider } from "@/contexts/SpecialOfferContext";
import { CrmTrackingProvider } from "@/contexts/CrmTrackingContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import SearchPage from "./pages/SearchPage";
import ListingDetailPage from "./pages/ListingDetailPage";
import LeadFormPage from "./pages/LeadFormPage";
import LoginPage from "./pages/admin/LoginPage";
import AdminDashboard from "./pages/admin/DashboardPage";
import TranslationsPage from "./pages/admin/TranslationsPage";
import UsersPage from "./pages/admin/UsersPage";
import FaqPage from "./pages/admin/FaqPage";
import FinancingPage from "./pages/admin/FinancingPage";
import NotFound from "./pages/NotFound";
import { LanguageSync } from "./components/LanguageSync";
import { DynamicTranslationsLoader } from "./components/DynamicTranslationsLoader";
import ForgotPasswordPage from "./pages/admin/ForgotPasswordPage";
import ResetPasswordPage from "./pages/admin/ResetPasswordPage";
import './i18n';

import { HelmetProvider } from 'react-helmet-async';
import { SeoManager } from '@/components/seo/SeoManager';
import SeoPage from "./pages/admin/SeoPage";
import AdminLayout from "./components/admin/AdminLayout";

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
              <SpecialOfferProvider>
                <CrmTrackingProvider>
                  <Routes>
                    {/* Public routes */}
                    <Route path="/" element={<SearchPage />} />
                    <Route path="/search" element={<SearchPage />} />
                    <Route path="/listing/:id" element={<ListingDetailPage />} />
                    <Route path="/listing/:id/lead" element={<LeadFormPage />} />

                    {/* Admin routes */}
                    <Route path="/admin/login" element={<LoginPage />} />
                    <Route path="/admin/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/admin/reset-password" element={<ResetPasswordPage />} />

                    <Route element={<AdminLayout />}>
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
                        path="/admin/financing"
                        element={
                          <ProtectedRoute allowedRoles={['admin', 'manager']}>
                            <FinancingPage />
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
                    </Route>

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </CrmTrackingProvider>
              </SpecialOfferProvider>
            </BrowserRouter>
          </TooltipProvider>
        </PriceSettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
