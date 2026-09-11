import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppLayout from './components/layout/AppLayout';
import SuperAdminRoute from './components/auth/SuperAdminRoute';
import { useAuthStore } from './store/authStore';
import PageLoadingSpinner from './components/common/PageLoadingSpinner';

// Lazy-loaded pages for optimal route-level code splitting
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const AcceptInvitationPage = lazy(() => import('./pages/AcceptInvitationPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const MonitoringPage = lazy(() => import('./pages/MonitoringPage'));
const SSLCertificatesPage = lazy(() => import('./pages/SSLCertificatesPage'));
const DNSRecordsPage = lazy(() => import('./pages/DNSRecordsPage'));
const DomainsPage = lazy(() => import('./pages/DomainsPage'));
const APIChecksPage = lazy(() => import('./pages/APIChecksPage'));
const SecurityHeadersPage = lazy(() => import('./pages/SecurityHeadersPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const StatusPageAdmin = lazy(() => import('./pages/StatusPageAdmin'));
const PublicStatusPage = lazy(() => import('./pages/PublicStatusPage'));
const MaintenancePage = lazy(() => import('./pages/MaintenancePage'));
const AlertsPage = lazy(() => import('./pages/AlertsPage'));
const IncidentsPage = lazy(() => import('./pages/IncidentsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage'));
const OrganizationSettingsPage = lazy(() => import('./pages/OrganizationSettingsPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const PlatformAdminPage = lazy(() => import('./pages/PlatformAdminPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      gcTime: 300_000,
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

export default function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Background prefetch of primary operational modules once authenticated
  React.useEffect(() => {
    if (!isAuthenticated) return;
    const idleCallback =
      (window as any).requestIdleCallback || ((cb: () => void) => setTimeout(cb, 1000));
    const handle = idleCallback(() => {
      import('./pages/MonitoringPage');
      import('./pages/AlertsPage');
      import('./pages/IncidentsPage');
      import('./pages/SSLCertificatesPage');
      import('./pages/DNSRecordsPage');
      import('./pages/DomainsPage');
      import('./pages/APIChecksPage');
      import('./pages/SecurityHeadersPage');
    });
    return () => {
      if ((window as any).cancelIdleCallback) {
        (window as any).cancelIdleCallback(handle);
      }
    };
  }, [isAuthenticated]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageLoadingSpinner />}>
          <Routes>
            {/* Public Routes */}
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
            <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
            <Route path="/status/:slug" element={<PublicStatusPage />} />

            {/* Persistent Authenticated NOC Layout (Navbar & Sidebar NEVER unmount) */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/monitoring" element={<MonitoringPage />} />
              <Route path="/ssl" element={<SSLCertificatesPage />} />
              <Route path="/dns" element={<DNSRecordsPage />} />
              <Route path="/domains" element={<DomainsPage />} />
              <Route path="/api-checks" element={<APIChecksPage />} />
              <Route path="/security-headers" element={<SecurityHeadersPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/status-page" element={<StatusPageAdmin />} />
              <Route path="/maintenance" element={<MaintenancePage />} />
              <Route path="/alerts" element={<AlertsPage />} />
              <Route path="/incidents" element={<IncidentsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/audit-logs" element={<AuditLogsPage />} />
              <Route path="/organization" element={<OrganizationSettingsPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route
                path="/admin/platform"
                element={
                  <SuperAdminRoute>
                    <PlatformAdminPage />
                  </SuperAdminRoute>
                }
              />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}