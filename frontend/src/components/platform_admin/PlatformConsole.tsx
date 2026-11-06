import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { platformApi, usePlatformSession } from '../../services/platformApi';
import SentinelBrand from '../layout/SentinelBrand';

export default function PlatformConsole({ children }: { children: ReactNode }) {
  const { session, setSession } = usePlatformSession();
  const [client] = useState(() => new QueryClient());
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!session) return;
    const timeout = window.setTimeout(() => setSession(null), Math.max(0, session.expiresAt - Date.now()));
    return () => { window.clearTimeout(timeout); client.clear(); };
  }, [client, session, setSession]);
  if (!session || session.expiresAt <= Date.now()) return <Navigate to="/admin/login" replace />;

  async function logout() {
    setEnding(true);
    setError('');
    try {
      await platformApi.post('platform-admin/session/logout/');
      setSession(null);
    } catch {
      setError('No se pudo cerrar la sesión en el servidor. Reintenta.');
    } finally {
      setEnding(false);
    }
  }
  return <QueryClientProvider client={client}>
    <div className="flex h-full flex-col bg-bg-dark text-text-main">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border-base bg-bg-dark px-4 py-3 sm:px-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <SentinelBrand />
          <span className="rounded-full border border-border-base px-2.5 py-0.5 text-xs font-medium text-text-muted">Consola de plataforma</span>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="break-all text-text-muted">{session.user.email}</span>
          <button className="min-h-11 rounded-xl border border-border-base px-4 hover:bg-bg-card-hover" disabled={ending} onClick={() => void logout()}>Cerrar sesión administrativa</button>
        </div>
        {error && <p role="alert" className="w-full text-sm text-accent-red">{error}</p>}
      </header>
      <main aria-label="Administración SaaS" tabIndex={0} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-8">{children}</div>
      </main>
    </div>
  </QueryClientProvider>;
}
