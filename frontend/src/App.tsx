import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import MonitoringPage from './pages/MonitoringPage';
import SSLCertificatesPage from './pages/SSLCertificatesPage';
import DNSRecordsPage from './pages/DNSRecordsPage';
import DomainsPage from './pages/DomainsPage';
import APIChecksPage from './pages/APIChecksPage';
import SecurityHeadersPage from './pages/SecurityHeadersPage';
import NotificationsPage from './pages/NotificationsPage';
import StatusPageAdmin from './pages/StatusPageAdmin';
import PublicStatusPage from './pages/PublicStatusPage';
import AlertsPage from './pages/AlertsPage';
import IncidentsPage from './pages/IncidentsPage';
import ProfilePage from './pages/ProfilePage';
import ReportsPage from './pages/ReportsPage';
import AppLayout from './components/layout/AppLayout';
import { useAuthStore } from './store/authStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-text-main mb-4">{title}</h1>
        <p className="text-text-muted">Proximamente...</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <RegisterPage />
              </PublicRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <DashboardPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/monitoring"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <MonitoringPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/ssl"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <SSLCertificatesPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dns"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <DNSRecordsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/domains"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <DomainsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/api-checks"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <APIChecksPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/security-headers"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <SecurityHeadersPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <NotificationsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/status-page"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <StatusPageAdmin />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route path="/status/:slug" element={<PublicStatusPage />} />
          <Route
            path="/alerts"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <AlertsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/incidents"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <IncidentsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ProfilePage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ReportsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}