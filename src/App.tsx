import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PriceSettingsProvider } from "@/contexts/PriceSettingsContext";
import { SpecialOfferProvider } from "@/contexts/SpecialOfferContext";
import { CrmTrackingProvider } from "@/contexts/CrmTrackingContext";
import { PersonalOfferProvider } from "@/contexts/PersonalOfferContext";
import { BrandProvider } from "@/contexts/BrandContext";
import { LanguageSync } from "./components/LanguageSync";
import { DynamicTranslationsLoader } from "./components/DynamicTranslationsLoader";
import { ConsentBanner } from "./components/consent/ConsentBanner";
import { HelmetProvider } from 'react-helmet-async';
import { SeoManager } from '@/components/seo/SeoManager';
import { ChunkErrorBoundary } from './components/ChunkErrorBoundary';
import { ClarityPageTracker } from './components/seo/ClarityPageTracker';
import { PageViewTracker } from './components/seo/PageViewTracker';
import { ScrollToTop } from './components/ScrollToTop';
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { TooltipProvider } from "@/components/ui/tooltip";
import './i18n';

// Homepage stays synchronous: createRoot does not hydrate or preserve the SSR shell
// while a lazy page is suspended. Split non-critical sections inside the page instead.
import HomePage from "./pages/HomePage";

// Lazy-loaded pages
const AdminLayout = lazy(() => import("./components/admin/AdminLayout"));
const Sonner = lazy(() => import("@/components/ui/sonner").then((m) => ({ default: m.Toaster })));
const Toaster = lazy(() => import("@/components/ui/toaster").then((m) => ({ default: m.Toaster })));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const ListingDetailPage = lazy(() => import("./pages/ListingDetailPage"));
const RentalSearchPage = lazy(() => import("./pages/RentalSearchPage"));
const RentalDetailPage = lazy(() => import("./pages/RentalDetailPage"));
const ConditionPage = lazy(() => import("./pages/ConditionPage"));
const CalculatorPage = lazy(() => import("./pages/CalculatorPage"));
const PublicFaqPage = lazy(() => import("./pages/PublicFaqPage"));
const MotoliaB2BPage = lazy(() => import("./pages/MotoliaB2BPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const PersonalOfferPage = lazy(() => import("./pages/PersonalOfferPage"));
const FotonLandingPage = lazy(() => import("./pages/FotonLandingPage"));
const FotonModelPage = lazy(() => import("./pages/FotonModelPage"));
const CampaignLandingPage = lazy(() => import("./pages/CampaignLandingPage"));
const LeadFormPage = lazy(() => import("./pages/LeadFormPage"));
const RentalLeadFormPage = lazy(() => import("./pages/RentalLeadFormPage"));
const WidgetEmbedPage = lazy(() => import("./pages/WidgetEmbedPage"));
const B2BOnepagerPage = lazy(() => import("./pages/B2BOnepagerPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Admin pages
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
const AdminLandingPagesPage = lazy(() => import("./pages/admin/LandingPagesPage"));
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
const DealerGroupsPage = lazy(() => import("./pages/admin/DealerGroupsPage"));
const DealersPage = lazy(() => import("./pages/admin/DealersPage"));
const WidgetsPage = lazy(() => import("./pages/admin/WidgetsPage"));
const PipelinePage = lazy(() => import("./pages/admin/pipeline/PipelinePage"));
const EmployeeProgramsPage = lazy(() => import("./pages/admin/EmployeeProgramsPage"));

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PriceSettingsProvider>
          <BrandProvider>
            <BrowserRouter>
              <ScrollToTop />
              <ClarityPageTracker />
              <PageViewTracker />
              <SeoManager />
              <DynamicTranslationsLoader />
              <LanguageSync />
              <Suspense fallback={null}>
                <Toaster />
                <Sonner />
              </Suspense>
              <SpecialOfferProvider>
                <CrmTrackingProvider>
                  <PersonalOfferProvider>
                    <TooltipProvider delayDuration={0}>
                    <ChunkErrorBoundary>
                      <Suspense fallback={null}>
                        <Routes>
                          <Route path="/" element={<HomePage />} />
                          <Route path="/samochody" element={<SearchPage key="samochody" />} />
                          <Route path="/samochody/:marka" element={<SearchPage key="samochody-marka" />} />
                          <Route path="/samochody/:marka/:model" element={<SearchPage key="samochody-marka-model" />} />
                          <Route path="/search" element={<SearchPage key="search" />} />
                          <Route path="/nowe" element={<ConditionPage key="nowe" condition="NEW" />} />
                          <Route path="/uzywane" element={<ConditionPage key="uzywane" condition="USED" />} />
                          <Route path="/kontakt" element={<ContactPage />} />
                          <Route path="/faq" element={<PublicFaqPage />} />
                          <Route path="/kalkulator-rat" element={<CalculatorPage />} />
                          <Route path="/leasing" element={<SearchPage key="leasing" />} />
                          <Route path="/kredyt" element={<SearchPage key="kredyt" />} />
                          <Route path="/leasing/:slug" element={<ListingDetailPage />} />
                          <Route path="/leasing/:slug/lead" element={<LeadFormPage />} />
                          <Route path="/leasing/:slug/negotiate" element={<LeadFormPage />} />
                          <Route path="/kredyt/:slug" element={<ListingDetailPage />} />
                          <Route path="/kredyt/:slug/lead" element={<LeadFormPage />} />
                          <Route path="/kredyt/:slug/negotiate" element={<LeadFormPage />} />
                          <Route path="/oferta/:slug" element={<ListingDetailPage />} />
                          <Route path="/oferta/:slug/lead" element={<LeadFormPage />} />
                          <Route path="/oferta/:slug/negotiate" element={<LeadFormPage />} />
                          <Route path="/dla-ciebie" element={<PersonalOfferPage />} />
                          <Route path="/promo/:slug" element={<CampaignLandingPage />} />
                          <Route path="/dla-firm" element={<MotoliaB2BPage />} />
                          <Route path="/dla-firmy" element={<B2BOnepagerPage />} />
                          <Route path="/foton" element={<FotonLandingPage />} />
                          <Route path="/foton/:slug" element={<FotonModelPage />} />
                          <Route path="/wynajem-dlugoterminowy" element={<RentalSearchPage />} />
                          <Route path="/wynajem-dlugoterminowy/:slug" element={<RentalDetailPage />} />
                          <Route path="/wynajem-dlugoterminowy/:slug/zapytanie" element={<RentalLeadFormPage />} />
                          <Route path="/embed/widget/:id" element={<WidgetEmbedPage />} />
                          <Route path="/listing/:id" element={<ListingDetailPage />} />
                          <Route path="/listing/:id/lead" element={<LeadFormPage />} />
                          <Route path="/listing/:id/negotiate" element={<LeadFormPage />} />
                          <Route path="/admin/login" element={<LoginPage />} />
                          <Route path="/admin/forgot-password" element={<ForgotPasswordPage />} />
                          <Route path="/admin/reset-password" element={<ResetPasswordPage />} />
                          <Route element={<AdminLayout />}>
                            <Route path="/admin/dashboard" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
                            <Route path="/admin/leads" element={<ProtectedRoute permission="leads:read"><LeadsPage /></ProtectedRoute>} />
                            <Route path="/admin/pipeline" element={<ProtectedRoute permission="pipeline:read"><PipelinePage /></ProtectedRoute>} />
                            <Route path="/admin/listings" element={<ProtectedRoute permission="stock:read"><ListingManagementPage /></ProtectedRoute>} />
                            <Route path="/admin/listings/new" element={<ProtectedRoute permission="stock:write"><ListingNewPage /></ProtectedRoute>} />
                            <Route path="/admin/listings/:id/edit" element={<ProtectedRoute permission="stock:write"><ListingEditPage /></ProtectedRoute>} />
                            <Route path="/admin/translations" element={<ProtectedRoute permission="content:read"><TranslationsPage /></ProtectedRoute>} />
                            <Route path="/admin/seo" element={<ProtectedRoute permission="content:read"><SeoPage /></ProtectedRoute>} />
                            <Route path="/admin/faq" element={<ProtectedRoute permission="content:read"><FaqPage /></ProtectedRoute>} />
                            <Route path="/admin/seo-content" element={<ProtectedRoute permission="content:read"><SeoContentPage /></ProtectedRoute>} />
                            <Route path="/admin/feature-tiles" element={<ProtectedRoute permission="content:read"><AdminFeatureTilesPage /></ProtectedRoute>} />
                            <Route path="/admin/hero-banners" element={<ProtectedRoute permission="content:read"><AdminHeroBannersPage /></ProtectedRoute>} />
                            <Route path="/admin/landing-pages" element={<ProtectedRoute permission="content:read"><AdminLandingPagesPage /></ProtectedRoute>} />
                            <Route path="/admin/partners" element={<ProtectedRoute permission="content:read"><AdminPartnersPage /></ProtectedRoute>} />
                            <Route path="/admin/api-partners" element={<ProtectedRoute permission="platform:settings:read"><AdminApiPartnersPage /></ProtectedRoute>} />
                            <Route path="/admin/employee-programs" element={<ProtectedRoute permission="platform:settings:write"><EmployeeProgramsPage /></ProtectedRoute>} />
                            <Route path="/admin/financing" element={<ProtectedRoute permission="platform:settings:read"><FinancingPage /></ProtectedRoute>} />
                            <Route path="/admin/import" element={<ProtectedRoute permission="stock:import"><ImportPage /></ProtectedRoute>} />
                            <Route path="/admin/analytics" element={<ProtectedRoute permission="analytics:read"><PriceAnalyticsPage /></ProtectedRoute>} />
                            <Route path="/admin/users" element={<ProtectedRoute permission="users:read"><UsersPage /></ProtectedRoute>} />
                            <Route path="/admin/rental-vehicles" element={<ProtectedRoute permission="rental:read"><RentalVehiclesPage /></ProtectedRoute>} />
                            <Route path="/admin/rental-companies" element={<ProtectedRoute permission="rental:config:write"><RentalCompaniesPage /></ProtectedRoute>} />
                            <Route path="/admin/rental-matrix" element={<ProtectedRoute permission="rental:config:write"><RentalMatrixPage /></ProtectedRoute>} />
                            <Route path="/admin/dealer-groups" element={<ProtectedRoute permission="dealer_groups:read"><DealerGroupsPage /></ProtectedRoute>} />
                            <Route path="/admin/dealers" element={<ProtectedRoute permission="dealers:read"><DealersPage /></ProtectedRoute>} />
                            <Route path="/admin/specifications" element={<ProtectedRoute permission="stock:read"><SpecificationsPage /></ProtectedRoute>} />
                            <Route path="/admin/specifications/:id/edit" element={<ProtectedRoute permission="stock:write"><SpecificationEditPage /></ProtectedRoute>} />
                            <Route path="/admin/widgets" element={<ProtectedRoute permission="content:read"><WidgetsPage /></ProtectedRoute>} />
                          </Route>
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </Suspense>
                    </ChunkErrorBoundary>
                    </TooltipProvider>
                  </PersonalOfferProvider>
                </CrmTrackingProvider>
              </SpecialOfferProvider>
              <ConsentBanner />
            </BrowserRouter>
          </BrandProvider>
        </PriceSettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
