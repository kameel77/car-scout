import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
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
import { ConsentBanner } from "./components/consent/ConsentBanner";
import { HelmetProvider } from 'react-helmet-async';
import { SeoManager } from '@/components/seo/SeoManager';
import { ChunkErrorBoundary } from './components/ChunkErrorBoundary';
import { ClarityPageTracker } from './components/seo/ClarityPageTracker';
import { ScrollToTop } from './components/ScrollToTop';
import './i18n';

import HomePage from "./pages/HomePage";

// Poza ścieżką krytyczną strony głównej: layout admina i sonner (~45 KB min)
// nie mają prawa siedzieć w głównym chunku.
const AdminLayout = lazy(() => import("./components/admin/AdminLayout"));
const Sonner = lazy(() =>
  import("@/components/ui/sonner").then((m) => ({ default: m.Toaster })),
);

const SearchPage = lazy(() => import("./pages/SearchPage"));
const ListingDetailPage = lazy(() => import("./pages/ListingDetailPage"));
const LeadFormPage = lazy(() => import("./pages/LeadFormPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Lazy load non-critical page components to enable code splitting
const ContactPage = lazy(() => import("./pages/ContactPage"));
const PublicFaqPage = lazy(() => import("./pages/PublicFaqPage"));
const LoginPage = lazy(() => import("./pages/admin/LoginPage"));
const AdminDashboard = lazy(() => import("./pages/admin/DashboardPage"));
const LeadsPage = lazy(() => import("./pages/admin/LeadsPage"));
const TranslationsPage = lazy(() => import("./pages/admin/TranslationsPage"));
const UsersPage = lazy(() => import("./pages/admin/UsersPage"));
const FaqPage = lazy(() => import("./pages/admin/FaqPage"));
const SeoContentPage = lazy(() => import("./pages/admin/SeoContentPage"));
const AdminFeatureTilesPage = lazy(() => import("./pages/admin/FeatureTilesPage"));
const AdminHeroBannersPage = lazy(() => import("./pages/admin/HeroBannersPage"));
const AdminPartnersPage = lazy(() => import("./pages/admin/PartnersPage"));
const SpecificationsPage = lazy(() => import("./pages/admin/SpecificationsPage"));
const SpecificationEditPage = lazy(() => import("./pages/admin/SpecificationEditPage"));
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
const MotoliaB2BPage = lazy(() => import("./pages/MotoliaB2BPage"));
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
              <Suspense fallback={null}>
                <Sonner />
              </Suspense>
              <BrowserRouter>
                <ScrollToTop />
                <ClarityPageTracker />
                <SpecialOfferProvider>
                  <CrmTrackingProvider>
                  <PersonalOfferProvider>
                    <ChunkErrorBoundary>
                      <Suspense fallback={null}>
                        <Routes>
                        {/* Public routes */}
                        <Route path="/" element={<HomePage />} />
                      {/* key wymusza remount przy nawigacji SPA między trasami dzielącymi
                          ten sam komponent — bez niego stan (np. filters.statuses) zostaje
                          z poprzedniej trasy i lista pokazuje złe auta do czasu odświeżenia */}
                      <Route path="/samochody" element={<SearchPage key="samochody" />} />
                      <Route path="/samochody/:marka" element={<SearchPage key="samochody-marka" />} />
                      <Route path="/samochody/:marka/:model" element={<SearchPage key="samochody-marka-model" />} />
                      <Route path="/search" element={<SearchPage key="search" />} />
                      <Route path="/nowe" element={<ConditionPage key="nowe" condition="NEW" />} />
                      <Route path="/uzywane" element={<ConditionPage key="uzywane" condition="USED" />} />
                      <Route path="/kontakt" element={<ContactPage />} />
                      <Route path="/faq" element={<PublicFaqPage />} />

                      {/* SEO financing-type routes */}
                      <Route path="/leasing" element={<SearchPage key="leasing" />} />
                      <Route path="/kredyt" element={<SearchPage key="kredyt" />} />
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
                      <Route path="/dla-firm" element={<MotoliaB2BPage />} />
                      <Route path="/dla-firmy" element={<B2BOnepagerPage />} />
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
                          path="/admin/leads"
                          element={
                            <ProtectedRoute allowedRoles={['admin', 'manager']}>
                              <LeadsPage />
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
                          path="/admin/seo-content"
                          element={
                            <ProtectedRoute allowedRoles={['admin', 'manager']}>
                              <SeoContentPage />
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
                          path="/admin/hero-banners"
                          element={
                            <ProtectedRoute allowedRoles={['admin', 'manager']}>
                              <AdminHeroBannersPage />
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
                          path="/admin/specifications"
                          element={
                            <ProtectedRoute allowedRoles={['admin', 'manager']}>
                              <SpecificationsPage />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/admin/specifications/:id/edit"
                          element={
                            <ProtectedRoute allowedRoles={['admin', 'manager']}>
                              <SpecificationEditPage />
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
