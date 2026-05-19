import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PriceSettingsProvider } from "@/contexts/PriceSettingsContext";
import { SpecialOfferProvider } from "@/contexts/SpecialOfferContext";
import { CrmTrackingProvider } from "@/contexts/CrmTrackingContext";
import { PersonalOfferProvider } from "@/contexts/PersonalOfferContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { BrandProvider } from "@/contexts/BrandContext";
import SearchPage from "./pages/SearchPage";
import ListingDetailPage from "./pages/ListingDetailPage";
import LeadFormPage from "./pages/LeadFormPage";
import HomePage from "./pages/HomePage";
import ContactPage from "./pages/ContactPage";
import PublicFaqPage from "./pages/PublicFaqPage";
import LoginPage from "./pages/admin/LoginPage";
import AdminDashboard from "./pages/admin/DashboardPage";
import TranslationsPage from "./pages/admin/TranslationsPage";
import UsersPage from "./pages/admin/UsersPage";
import FaqPage from "./pages/admin/FaqPage";
import FeatureTilesPage from "./pages/admin/FeatureTilesPage";
import FinancingPage from "./pages/admin/FinancingPage";
import ImportPage from "./pages/admin/ImportPage";
import PriceAnalyticsPage from "./pages/admin/PriceAnalyticsPage";
import ListingManagementPage from "./pages/admin/ListingManagementPage";
import ListingNewPage from "./pages/admin/ListingNewPage";
import ListingEditPage from "./pages/admin/ListingEditPage";
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
import AdminPartnersPage from "./pages/admin/PartnersPage";
import RentalVehiclesPage from "./pages/admin/RentalVehiclesPage";
import RentalCompaniesPage from "./pages/admin/RentalCompaniesPage";
import RentalMatrixPage from "./pages/admin/RentalMatrixPage";
import PersonalOfferPage from "./pages/PersonalOfferPage";
import B2BOnepagerPage from "./pages/B2BOnepagerPage";
import RentalSearchPage from "./pages/RentalSearchPage";
import RentalDetailPage from "./pages/RentalDetailPage";
import ConditionPage from "./pages/ConditionPage";
import RentalLeadFormPage from "./pages/RentalLeadFormPage";
import DealerGroupsPage from "./pages/admin/DealerGroupsPage";
import DealersPage from "./pages/admin/DealersPage";
import WidgetsPage from "./pages/admin/WidgetsPage";
import WidgetEmbedPage from "./pages/WidgetEmbedPage";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PriceSettingsProvider>
          <TooltipProvider>
            <BrandProvider>
              <SeoManager />
              <DynamicTranslationsLoader />
              <LanguageSync />
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <SpecialOfferProvider>
                  <CrmTrackingProvider>
                  <PersonalOfferProvider>
                    <Routes>
                      {/* Public routes */}
                      <Route path="/" element={<HomePage />} />
                      <Route path="/samochody" element={<SearchPage />} />
                      <Route path="/search" element={<SearchPage />} />
                      <Route path="/nowe" element={<ConditionPage condition="NEW" />} />
                      <Route path="/uzywane" element={<ConditionPage condition="USED" />} />
                      <Route path="/kontakt" element={<ContactPage />} />
                      <Route path="/faq" element={<PublicFaqPage />} />

                      {/* SEO financing-type routes */}
                      <Route path="/leasing/:slug" element={<ListingDetailPage />} />
                      <Route path="/leasing/:slug/lead" element={<LeadFormPage />} />
                      <Route path="/leasing/:slug/negotiate" element={<LeadFormPage />} />
                      <Route path="/kredyt/:slug" element={<ListingDetailPage />} />
                      <Route path="/kredyt/:slug/lead" element={<LeadFormPage />} />
                      <Route path="/kredyt/:slug/negotiate" element={<LeadFormPage />} />

                      {/* Default financing routes (gotówka / backward compatible) */}
                      <Route path="/oferta/:slug" element={<ListingDetailPage />} />
                      <Route path="/oferta/:slug/lead" element={<LeadFormPage />} />
                      <Route path="/oferta/:slug/negotiate" element={<LeadFormPage />} />
                      <Route path="/dla-ciebie" element={<PersonalOfferPage />} />
                      <Route path="/dla-firm" element={<B2BOnepagerPage />} />
                      <Route path="/wynajem-dlugoterminowy" element={<RentalSearchPage />} />
                      <Route path="/wynajem-dlugoterminowy/:slug" element={<RentalDetailPage />} />
                      <Route path="/wynajem-dlugoterminowy/:slug/zapytanie" element={<RentalLeadFormPage />} />
                      
                      <Route path="/embed/widget/:id" element={<WidgetEmbedPage />} />

                      {/* Legacy routes - kept for backward compatibility during transition */}
                      <Route path="/listing/:id" element={<ListingDetailPage />} />
                      <Route path="/listing/:id/lead" element={<LeadFormPage />} />
                      <Route path="/listing/:id/negotiate" element={<LeadFormPage />} />

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
                          path="/admin/listings"
                          element={
                            <ProtectedRoute allowedRoles={['admin', 'manager']}>
                              <ListingManagementPage />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/admin/listings/new"
                          element={
                            <ProtectedRoute allowedRoles={['admin', 'manager']}>
                              <ListingNewPage />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/admin/listings/:id/edit"
                          element={
                            <ProtectedRoute allowedRoles={['admin', 'manager']}>
                              <ListingEditPage />
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
                          path="/admin/feature-tiles"
                          element={
                            <ProtectedRoute allowedRoles={['admin', 'manager']}>
                              <FeatureTilesPage />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/admin/partners"
                          element={
                            <ProtectedRoute allowedRoles={['admin', 'manager']}>
                              <AdminPartnersPage />
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
                          path="/admin/import"
                          element={
                            <ProtectedRoute allowedRoles={['admin', 'manager']}>
                              <ImportPage />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/admin/analytics"
                          element={
                            <ProtectedRoute allowedRoles={['admin', 'manager']}>
                              <PriceAnalyticsPage />
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
                        <Route
                          path="/admin/rental-vehicles"
                          element={
                            <ProtectedRoute allowedRoles={['admin', 'manager']}>
                              <RentalVehiclesPage />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/admin/rental-companies"
                          element={
                            <ProtectedRoute allowedRoles={['admin', 'manager']}>
                              <RentalCompaniesPage />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/admin/rental-matrix"
                          element={
                            <ProtectedRoute allowedRoles={['admin', 'manager']}>
                              <RentalMatrixPage />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/admin/dealer-groups"
                          element={
                            <ProtectedRoute allowedRoles={['admin', 'manager']}>
                              <DealerGroupsPage />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/admin/dealers"
                          element={
                            <ProtectedRoute allowedRoles={['admin', 'manager']}>
                              <DealersPage />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/admin/widgets"
                          element={
                            <ProtectedRoute allowedRoles={['admin', 'manager']}>
                              <WidgetsPage />
                            </ProtectedRoute>
                          }
                        />
                      </Route>

                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </PersonalOfferProvider>
                </CrmTrackingProvider>
              </SpecialOfferProvider>
            </BrowserRouter>
          </BrandProvider>
        </TooltipProvider>
      </PriceSettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
