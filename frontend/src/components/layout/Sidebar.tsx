import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Activity,
  Sliders,
  Layers,
} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';

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
    id: 'conectividad',
    title: 'Conectividad',
    icon: Zap,
    items: [
      { to: '/monitoring', icon: Zap, label: 'Uptime & Latencia' },
      { to: '/ssl', icon: Lock, label: 'Monitoreo SSL' },
      { to: '/dns', icon: Globe, label: 'Registros DNS' },
      { to: '/domains', icon: FileText, label: 'Dominios WHOIS' },
      { to: '/api-checks', icon: Plug, label: 'API Endpoints' },
      { to: '/security-headers', icon: ShieldCheck, label: 'Security Headers' },
    ],
  },
  {
    id: 'gestion',
    title: 'Gestión',
    icon: Sliders,
    items: [
      { to: '/alerts', icon: Bell, label: 'Smart Alerts' },
      { to: '/incidents', icon: AlertTriangle, label: 'Incidentes' },
      { to: '/status-page', icon: Activity, label: 'Status Page' },
      { to: '/notifications', icon: Send, label: 'Notificaciones' },
      { to: '/reports', icon: FileText, label: 'Reportes' },
    ],
  },
  {
    id: 'sistema',
    title: 'Sistema',
    icon: Settings,
    items: [
      { to: '/audit-logs', icon: ShieldAlert, label: 'Logs de Auditoría' },
      { to: '/users', icon: Users, label: 'Usuarios & Equipo' },
      { to: '/profile', icon: User, label: 'Perfil de Usuario' },
    ],
  },
];

export default function Sidebar() {
  const location = useLocation();

  // Collapsed state with LocalStorage persistence
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('sentinel_sidebar_collapsed');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  // Accordion groups open/closed state
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    conectividad: true,
    gestion: true,
    sistema: false,
  });

  // Automatically expand group if current path is inside it
  useEffect(() => {
    navGroups.forEach((group) => {
      const hasActiveChild = group.items.some((item) => location.pathname.startsWith(item.to));
      if (hasActiveChild) {
        setOpenGroups((prev) => ({ ...prev, [group.id]: true }));
      }
    });
  }, [location.pathname]);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sentinel_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  return (
    <aside
      className={`bg-bg-dark border-r border-border-base flex flex-col justify-between transition-all duration-300 ease-in-out shrink-0 select-none z-30 ${
        isCollapsed ? 'w-20 p-3' : 'w-64 p-4'
      } h-[calc(100vh-57px)] sticky top-[57px] overflow-y-auto overflow-x-hidden`}
    >
      {/* Top Nav Content */}
      <div className="space-y-4">
        {/* Collapse / Expand Toggle Header */}
        <div
          className={`flex items-center ${
            isCollapsed ? 'justify-center' : 'justify-between'
          } pb-2 border-b border-border-base/50`}
        >
          {!isCollapsed && (
            <span className="text-[10px] font-mono font-bold tracking-wider text-text-dim">
              NAVEGACIÓN
            </span>
          )}
          <button
            onClick={toggleCollapse}
            title={isCollapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
            className="p-1.5 rounded-lg bg-bg-card hover:bg-bg-card-hover border border-border-base text-text-muted hover:text-text-main transition-all shadow-xs flex items-center justify-center cursor-pointer"
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* STANDALONE TOP ITEM: Dashboard */}
        <div>
          {!isCollapsed && (
            <div className="text-[10px] font-mono font-semibold text-text-dim px-2 mb-1.5">
              GENERAL
            </div>
          )}

          <NavLink
            to="/dashboard"
            title="Dashboard"
            className={({ isActive }) =>
              `flex items-center ${
                isCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
              } rounded-xl text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-accent-green/10 text-accent-green border border-accent-green/30 shadow-xs'
                  : 'text-text-muted hover:bg-bg-card hover:text-text-main border border-transparent'
              }`
            }
          >
            <LayoutDashboard size={19} className="shrink-0" />
            {!isCollapsed && <span>Dashboard</span>}
          </NavLink>
        </div>

        {/* COLLAPSED MODE VIEW (Icon Rail) */}
        {isCollapsed ? (
          <div className="space-y-4 pt-2">
            {navGroups.map((group) => {
              const hasActiveChild = group.items.some((item) =>
                location.pathname.startsWith(item.to)
              );

              return (
                <div
                  key={group.id}
                  className="space-y-2 pt-2 border-t border-border-base/40 flex flex-col items-center"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-text-dim/40" title={group.title} />
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        title={item.label}
                        className={({ isActive }) =>
                          `p-2.5 rounded-xl transition-all flex items-center justify-center group relative ${
                            isActive
                              ? 'bg-accent-green/15 text-accent-green border border-accent-green/40 shadow-sm'
                              : 'text-text-muted hover:bg-bg-card hover:text-text-main border border-transparent'
                          }`
                        }
                      >
                        <Icon size={18} />
                      </NavLink>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ) : (
          /* EXPANDED MODE VIEW (Grouped Accordions) */
          <div className="space-y-5">
            {/* Section: Operaciones */}
            <div className="space-y-3">
              <div className="text-[10px] font-mono font-semibold text-text-dim px-2">
                OPERACIONES
              </div>

              {/* Group 1: Conectividad */}
              {navGroups
                .filter((g) => g.id === 'conectividad' || g.id === 'gestion')
                .map((group) => {
                  const isOpen = openGroups[group.id] ?? true;
                  const GroupIcon = group.icon;
                  const hasActiveChild = group.items.some((item) =>
                    location.pathname.startsWith(item.to)
                  );

                  return (
                    <div key={group.id} className="space-y-1">
                      {/* Accordion Toggle Button */}
                      <button
                        onClick={() => toggleGroup(group.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors group cursor-pointer ${
                          hasActiveChild
                            ? 'text-accent-green bg-accent-green/5'
                            : 'text-text-muted hover:text-text-main hover:bg-bg-card'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <GroupIcon
                            size={16}
                            className={hasActiveChild ? 'text-accent-green' : 'text-text-dim'}
                          />
                          <span className="font-sans">{group.title}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono bg-bg-card border border-border-base px-1.5 py-0.2 rounded-full text-text-dim">
                            {group.items.length}
                          </span>
                          <ChevronDown
                            size={14}
                            className={`text-text-dim transition-transform duration-200 ${
                              isOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </div>
                      </button>

                      {/* Accordion Sub-items */}
                      {isOpen && (
                        <div className="ml-4 pl-3 border-l border-border-base/60 space-y-1 mt-1 transition-all">
                          {group.items.map((item) => {
                            const ItemIcon = item.icon;
                            return (
                              <NavLink
                                key={item.to}
                                to={item.to}
                                className={({ isActive }) =>
                                  `flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    isActive
                                      ? 'bg-bg-card text-accent-green font-semibold border-l-2 border-accent-green'
                                      : 'text-text-muted hover:bg-bg-card/70 hover:text-text-main'
                                  }`
                                }
                              >
                                <ItemIcon size={14} className="shrink-0" />
                                <span className="truncate">{item.label}</span>
                              </NavLink>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

            {/* Section: Sistema */}
            <div className="space-y-3 pt-2 border-t border-border-base/40">
              <div className="text-[10px] font-mono font-semibold text-text-dim px-2">
                CONFIGURACIÓN
              </div>

              {navGroups
                .filter((g) => g.id === 'sistema')
                .map((group) => {
                  const isOpen = openGroups[group.id] ?? false;
                  const GroupIcon = group.icon;
                  const hasActiveChild = group.items.some((item) =>
                    location.pathname.startsWith(item.to)
                  );

                  return (
                    <div key={group.id} className="space-y-1">
                      <button
                        onClick={() => toggleGroup(group.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors group cursor-pointer ${
                          hasActiveChild
                            ? 'text-accent-green bg-accent-green/5'
                            : 'text-text-muted hover:text-text-main hover:bg-bg-card'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <GroupIcon
                            size={16}
                            className={hasActiveChild ? 'text-accent-green' : 'text-text-dim'}
                          />
                          <span className="font-sans">{group.title}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono bg-bg-card border border-border-base px-1.5 py-0.2 rounded-full text-text-dim">
                            {group.items.length}
                          </span>
                          <ChevronDown
                            size={14}
                            className={`text-text-dim transition-transform duration-200 ${
                              isOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </div>
                      </button>

                      {isOpen && (
                        <div className="ml-4 pl-3 border-l border-border-base/60 space-y-1 mt-1 transition-all">
                          {group.items.map((item) => {
                            const ItemIcon = item.icon;
                            return (
                              <NavLink
                                key={item.to}
                                to={item.to}
                                className={({ isActive }) =>
                                  `flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    isActive
                                      ? 'bg-bg-card text-accent-green font-semibold border-l-2 border-accent-green'
                                      : 'text-text-muted hover:bg-bg-card/70 hover:text-text-main'
                                  }`
                                }
                              >
                                <ItemIcon size={14} className="shrink-0" />
                                <span className="truncate">{item.label}</span>
                              </NavLink>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* Sidebar Footer (Version/Status Indicator) */}
      <div className="pt-3 border-t border-border-base/50">
        {!isCollapsed ? (
          <div className="px-2 flex items-center justify-between text-[11px] font-mono text-text-dim">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
              <span>NOC Activo</span>
            </span>
            <span>v1.0.0</span>
          </div>
        ) : (
          <div className="flex justify-center" title="NOC Activo (v1.0.0)">
            <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
          </div>
        )}
      </div>
    </aside>
  );
}