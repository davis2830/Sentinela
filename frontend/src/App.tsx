import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import MonitoringPage from './pages/MonitoringPage';
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
                  <PlaceholderPage title="Monitoreo SSL" />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dns"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <PlaceholderPage title="DNS & WHOIS" />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/api-checks"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <PlaceholderPage title="API Endpoints" />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/security-headers"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <PlaceholderPage title="Security Headers" />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/alerts"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <PlaceholderPage title="Smart Alerts" />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/incidents"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <PlaceholderPage title="Incidentes" />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <PlaceholderPage title="Reportes" />
                </AppLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}