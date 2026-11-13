import { canNavigate } from "./PortalAccess";
import SidebarFrame from "./SidebarFrame";
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Zap,
  Lock,
  Globe,
  Plug,
  ShieldCheck,
  Send,
  Bell,
  AlertTriangle,
  FileText,
  User,
  ShieldAlert,
  Users,
  Settings,
  Activity,
  Sliders,
  Wrench,
  Building,
  Crown,
  Server,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";
import { useAuthStore } from "../../store/authStore";

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

interface NavGroup {
  id: string;
  title: string;
  icon: LucideIcon;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    id: "conectividad",
    title: "Conectividad",
    icon: Zap,
    items: [
      { to: "/monitoring", icon: Zap, label: "Uptime & Latencia" },
      { to: "/senti9", icon: Server, label: "Senti9" },
      { to: "/ssl", icon: Lock, label: "Monitoreo SSL" },
      { to: "/dns", icon: Globe, label: "Registros DNS" },
      { to: "/domains", icon: FileText, label: "Dominios WHOIS" },
      { to: "/api-checks", icon: Plug, label: "API Endpoints" },
      { to: "/security-headers", icon: ShieldCheck, label: "Security Headers" },
    ],
  },
  {
    id: "gestion",
    title: "Gestión",
    icon: Sliders,
    items: [
      { to: "/gestion", icon: LayoutDashboard, label: "Resumen de gestión" },
      { to: "/alerts", icon: Bell, label: "Smart Alerts" },
      { to: "/incidents", icon: AlertTriangle, label: "Incidentes" },
      { to: "/maintenance", icon: Wrench, label: "Mantenimientos" },
      { to: "/status-page", icon: Activity, label: "Status Page" },
      { to: "/notifications", icon: Send, label: "Notificaciones" },
      { to: "/reports", icon: FileText, label: "Reportes" },
    ],
  },
  {
    id: "sistema",
    title: "Sistema",
    icon: Settings,
    items: [
      { to: "/organization", icon: Building, label: "Organización & Planes" },
      { to: "/audit-logs", icon: ShieldAlert, label: "Logs de Auditoría" },
      { to: "/users", icon: Users, label: "Usuarios y Equipos" },
      { to: "/profile", icon: User, label: "Perfil de Usuario" },
    ],
  },
];

export default function Sidebar() {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const [desktopCollapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("sentinel_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });
  const [mobile, setMobile] = useState(
    () => window.matchMedia("(max-width: 767px)").matches,
  );
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => setExpanded(false), [location.pathname]);
  const groups = navGroups
    .map((group) => ({
      ...group,
      defaultOpen: group.id !== "sistema",
      items: [
        ...group.items,
        ...(group.id === "sistema" && user?.is_superuser
          ? [
              {
                to: import.meta.env.PROD
                  ? "https://admin.sentinel.gctechops.com/"
                  : "/admin/login",
                icon: Crown,
                label: "Administración de Plataforma",
              },
            ]
          : []),
      ]
        .filter((item) => canNavigate(user, item.to))
        .map((item) => ({
          ...item,
          active:
            location.pathname === item.to ||
            location.pathname.startsWith(item.to + "/"),
        })),
    }))
    .filter((group) => group.items.length > 0);
  return (
    <SidebarFrame
      sections={[
        {
          label: "General",
          items: [
            {
              to: "/dashboard",
              label: "Dashboard",
              icon: LayoutDashboard,
              active: location.pathname === "/dashboard",
            },
          ],
        },
        {
          label: "Operaciones",
          groups: groups.filter((group) => group.id !== "sistema"),
        },
        {
          label: "Configuración",
          groups: groups.filter((group) => group.id === "sistema"),
        },
      ]}
      collapsed={mobile ? !expanded : desktopCollapsed}
      onToggle={() => {
        if (mobile) setExpanded(!expanded);
        else
          setCollapsed((previous) => {
            try {
              localStorage.setItem(
                "sentinel_sidebar_collapsed",
                String(!previous),
              );
            } catch {
              /* Storage is optional; keep the current in-memory navigation state. */
            }
            return !previous;
          });
      }}
      className={
        mobile
          ? expanded
            ? "absolute left-0 top-14 bottom-0 z-30 shadow-2xl"
            : "!w-14 !p-2"
          : ""
      }
      onNavigate={() => setExpanded(false)}
    />
  );
}
