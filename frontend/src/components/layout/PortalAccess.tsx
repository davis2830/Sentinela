import type { User } from "../../types";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { hasCapability } from "../../hooks/useCapability";

export const operationRoutes: Record<string, string> = {
  "/monitoring": "monitoring",
  "/ssl": "ssl_monitor",
  "/dns": "dns_monitor",
  "/domains": "domain",
  "/api-checks": "api_checks",
  "/security-headers": "security_headers",
  "/alerts": "alerts",
  "/notifications": "notifications",
  "/incidents": "incidents",
  "/maintenance": "maintenance",
  "/reports": "reports",
  "/status-page": "status_page",
};
export function canNavigate(user: User | null, path: string) {
  if (
    user?.authorization_mode !== "custom" ||
    user.is_staff ||
    user.is_superuser
  )
    return true;
  const module = operationRoutes[path];
  return module
    ? hasCapability(user, module + ".read")
    : ["/profile", "/dashboard", "/gestion"].includes(path);
}
export default function PortalAccess({ children }: { children: ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const path = useLocation().pathname;
  if (
    user?.authorization_mode !== "custom" ||
    user.is_staff ||
    user.is_superuser
  )
    return children;
  const module = operationRoutes["/" + path.split("/")[1]];
  const fullRead = Object.values(operationRoutes).every((module) =>
    hasCapability(user, module + ".read"),
  );
  if (
    path === "/profile" ||
    (module && hasCapability(user, module + ".read")) ||
    (["/dashboard", "/gestion"].includes(path) && fullRead)
  )
    return children;
  return (
    <section className="space-y-4 p-5 border border-border-base rounded-2xl">
      <h1 className="text-xl font-bold">Tu espacio de operación</h1>
      <p className="text-text-muted">
        Selecciona un módulo habilitado. Tu administrador puede revisar el
        acceso desde Roles y permisos.
      </p>
      <nav className="flex flex-wrap gap-3" aria-label="Módulos habilitados">
        {Object.entries(operationRoutes)
          .filter(([, module]) => hasCapability(user, module + ".read"))
          .map(([route, module]) => (
            <Link
              key={route}
              className="min-h-11 px-4 py-3 border border-border-base rounded-xl"
              to={route}
            >
              {module}
            </Link>
          ))}
      </nav>
      <Link
        className="inline-block min-h-11 py-3 text-accent-green"
        to="/profile"
      >
        Abrir mi perfil
      </Link>
    </section>
  );
}
