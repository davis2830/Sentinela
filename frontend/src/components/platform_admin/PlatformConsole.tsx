import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { platformApi, usePlatformSession } from "../../services/platformApi";
import NavbarFrame from "../layout/NavbarFrame";
import {
  LogOut,
  Menu,
  Activity,
  HeartPulse,
  LayoutDashboard,
  Building2,
  Users,
  Zap,
  ShieldCheck,
} from "lucide-react";
import "./platform-console.css";
import SidebarFrame from "../layout/SidebarFrame";
import ModalSurface from "../common/ModalSurface";
import { createPortal } from "react-dom";
import {
  PlatformNavigationProvider,
  usePlatformNavigation,
  platformSections,
} from "./PlatformNavigation";

export default function PlatformConsole({ children }: { children: ReactNode }) {
  const { session, setSession } = usePlatformSession();
  const [client] = useState(() => new QueryClient());
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    if (!session) return;
    const timeout = window.setTimeout(
      () => {
        setExpired(true);
        client.clear();
        setSession(null);
      },
      Math.max(0, session.expiresAt - Date.now()),
    );
    return () => {
      window.clearTimeout(timeout);
      client.clear();
    };
  }, [client, session, setSession]);
  if (!session || session.expiresAt <= now)
    return (
      <Navigate
        to="/admin/login"
        state={{ expired: expired || !!session }}
        replace
      />
    );

  async function logout() {
    setEnding(true);
    setError("");
    try {
      await platformApi.post("platform-admin/session/logout/");
      setSession(null);
    } catch {
      setError("No se pudo cerrar la sesión en el servidor. Reintenta.");
    } finally {
      setEnding(false);
    }
  }
  return (
    <QueryClientProvider client={client}>
      <PlatformNavigationProvider>
        <ConsoleShell
          email={session.user.email}
          expiresAt={session.expiresAt}
          now={now}
          ending={ending}
          error={error}
          logout={() => void logout()}
        >
          {children}
        </ConsoleShell>
      </PlatformNavigationProvider>
    </QueryClientProvider>
  );
}

function ConsoleShell({
  children,
  email,
  expiresAt,
  now,
  ending,
  error,
  logout,
}: {
  children: ReactNode;
  email: string;
  expiresAt: number;
  now: number;
  ending: boolean;
  error: string;
  logout: () => void;
}) {
  const { section } = usePlatformNavigation();
  const main = useRef<HTMLElement>(null);
  const positions = useRef<Record<string, number>>({});
  useLayoutEffect(() => {
    if (main.current) main.current.scrollTop = positions.current[section] ?? 0;
  }, [section]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return (
        localStorage.getItem("sentinel_platform_sidebar_collapsed") === "true"
      );
    } catch {
      return false;
    }
  });
  useEffect(() => setMobileOpen(false), [section]);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const change = () => {
      if (media.matches) setMobileOpen(false);
    };
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  const entry = (
    id: keyof typeof platformSections,
    label: string,
    icon: typeof Activity,
  ) => ({
    to: "/admin/platform?tab=" + id,
    label,
    icon,
    active: section === id,
  });
  const sections = [
    {
      label: "General",
      items: [entry("resumen", "Resumen SaaS", LayoutDashboard)],
    },
    {
      label: "Administración",
      items: [
        entry("beta", "Beta", Zap),
        entry("organizaciones", "Organizaciones", Building2),
        entry("usuarios", "Usuarios", Users),
      ],
    },
    {
      label: "Control",
      items: [
        entry("salud", "Salud de plataforma", HeartPulse),
        entry("auditoria", "Auditoría", ShieldCheck),
      ],
    },
  ];
  return (
    <div className="platform-console fixed inset-0 flex flex-col overflow-hidden bg-bg-dark text-text-main">
      <NavbarFrame
        badge="Consola de plataforma"
        home="/admin/platform?tab=resumen"
        leading={
          <button
            type="button"
            aria-label="Abrir menú administrativo"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
            className="grid min-h-11 min-w-11 place-items-center rounded-lg text-text-muted md:hidden"
          >
            <Menu size={20} />
          </button>
        }
        actions={
          <>
            <span className="hidden items-center gap-2 text-xs text-text-muted md:flex">
              <Activity size={16} className="text-accent-green" />
              <span className="max-w-52 truncate" title={email}>
                {email}
              </span>
            </span>
            <button
              type="button"
              aria-label="Cerrar sesión administrativa"
              title="Cerrar sesión administrativa"
              disabled={ending}
              onClick={logout}
              className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg text-sm text-text-muted hover:text-accent-red"
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">
                {ending ? "Cerrando…" : "Cerrar sesión"}
              </span>
            </button>
          </>
        }
      />
      {error && (
        <p
          role="alert"
          className="border-b border-border-base px-6 py-2 text-sm text-accent-red"
        >
          {error}
        </p>
      )}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="hidden h-full md:block">
          <SidebarFrame
            sections={sections}
            collapsed={collapsed}
            footer="Consola de plataforma"
            onToggle={() =>
              setCollapsed((previous) => {
                try {
                  localStorage.setItem(
                    "sentinel_platform_sidebar_collapsed",
                    String(!previous),
                  );
                } catch {
                  /* Storage is optional; keep the current in-memory navigation state. */
                }
                return !previous;
              })
            }
          />
        </div>
        <main
          ref={main}
          onScroll={() => {
            if (main.current)
              positions.current[section] = main.current.scrollTop;
          }}
          aria-label="Administración SaaS"
          tabIndex={0}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 lg:px-6 lg:py-5"
        >
          {expiresAt - now <= 120000 && (
            <p
              role="status"
              className="mb-3 border-b border-border-base pb-3 text-sm text-accent-yellow"
            >
              Tu sesión administrativa vence en{" "}
              {Math.max(0, Math.ceil((expiresAt - now) / 1000))} segundos. Al
              vencer tendrás que autenticarte de nuevo.
            </p>
          )}
          {children}
        </main>
      </div>
      {mobileOpen &&
        createPortal(
          <div
            className="platform-console fixed inset-0 z-[60] bg-black/70 md:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <ModalSurface
              label="Menú administrativo"
              onClose={() => setMobileOpen(false)}
              className="h-full w-64 max-w-[85vw] bg-bg-dark"
            >
              <SidebarFrame
                sections={sections}
                collapsed={false}
                onToggle={() => setMobileOpen(false)}
                onNavigate={() => setMobileOpen(false)}
                footer="Consola de plataforma"
                className="max-w-full"
              />
            </ModalSurface>
          </div>,
          document.body,
        )}
    </div>
  );
}
