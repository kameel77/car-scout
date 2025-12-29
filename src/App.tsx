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
import NotFound from "./pages/NotFound";
import './i18n';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <PriceSettingsProvider>
        <TooltipProvider>
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
                  <ProtectedRoute>
                    <AdminDashboard />
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
);

export default App;
