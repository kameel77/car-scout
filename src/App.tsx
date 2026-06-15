import { lazy, Suspense } from "react";
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
import { LanguageSync } from "./components/LanguageSync";
import { DynamicTranslationsLoader } from "./components/DynamicTranslationsLoader";
import AdminLayout from "./components/admin/AdminLayout";
import { ConsentBanner } from "./components/consent/ConsentBanner";
import { HelmetProvider } from 'react-helmet-async';
import { SeoManager } from '@/components/seo/SeoManager';
import { ChunkErrorBoundary } from './components/ChunkErrorBoundary';
import './i18n';

import HomePage from "./pages/HomePage";

const SearchPage = lazy(() => import("./pages/SearchPage"));
const ListingDetailPage = lazy(() => import("./pages/ListingDetailPage"));
const LeadFormPage = lazy(() => import("./pages/LeadFormPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Lazy load non-critical page components to enable code splitting
const ContactPage = lazy(() => import("./pages/ContactPage"));
const PublicFaqPage = lazy(() => import("./pages/PublicFaqPage"));
const LoginPage = lazy(() => import("./pages/admin/LoginPage"));
const AdminDashboard = lazy(() => import("./pages/admin/DashboardPage"));
const TranslationsPage = lazy(() => import("./pages/admin/TranslationsPage"));
const UsersPage = lazy(() => import("./pages/admin/UsersPage"));
const FaqPage = lazy(() => import("./pages/admin/FaqPage"));
const AdminFeatureTilesPage = lazy(() => import("./pages/admin/FeatureTilesPage"));
const AdminPartnersPage = lazy(() => import("./pages/admin/PartnersPage"));
const AdminApiPartnersPage = lazy(() => import("./pages/admin/ApiPartnersPage"));
const FinancingPage = lazy(() => import("./pages/admin/FinancingPage"));
const ImportPage = lazy(() => import("./pages/admin/ImportPage"));
const PriceAnalyticsPage = lazy(() => import("./pages/admin/PriceAnalyticsPage"));
const ListingManagementPage = lazy(() => import("./pages/admin/ListingManagementPage"));
const ListingNewPage = lazy(() => import("./pages/admin/ListingNewPage"));
const ListingEditPage = lazy(() => import("./pages/admin/ListingEditPage"));
const ForgotPasswordPage = lazy(() => import("./pages/admin/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/admin/ResetPasswordPage"));
const SeoPage = lazy(() => import("./pages/admin/SeoPage"));
const RentalVehiclesPage = lazy(() => import("./pages/admin/RentalVehiclesPage"));
const RentalCompaniesPage = lazy(() => import("./pages/admin/RentalCompaniesPage"));
const RentalMatrixPage = lazy(() => import("./pages/admin/RentalMatrixPage"));
const PersonalOfferPage = lazy(() => import("./pages/PersonalOfferPage"));
const B2BOnepagerPage = lazy(() => import("./pages/B2BOnepagerPage"));
const RentalSearchPage = lazy(() => import("./pages/RentalSearchPage"));
const RentalDetailPage = lazy(() => import("./pages/RentalDetailPage"));
const ConditionPage = lazy(() => import("./pages/ConditionPage"));
const RentalLeadFormPage = lazy(() => import("./pages/RentalLeadFormPage"));
const DealerGroupsPage = lazy(() => import("./pages/admin/DealerGroupsPage"));
const DealersPage = lazy(() => import("./pages/admin/DealersPage"));
const WidgetsPage = lazy(() => import("./pages/admin/WidgetsPage"));
const WidgetEmbedPage = lazy(() => import("./pages/WidgetEmbedPage"));

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
                    <ChunkErrorBoundary>
                      <Suspense fallback={null}>
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
                      <Route path="/leasing" element={<SearchPage />} />
                      <Route path="/kredyt" element={<SearchPage />} />
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
                              <AdminFeatureTilesPage />
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
                          path="/admin/api-partners"
                          element={
                            <ProtectedRoute allowedRoles={['admin', 'manager']}>
                              <AdminApiPartnersPage />
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
                    </Suspense>
                    </ChunkErrorBoundary>
                    <ConsentBanner />
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
