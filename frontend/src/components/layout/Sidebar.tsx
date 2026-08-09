import { NavLink } from 'react-router-dom';
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
  Building,
  Users,
} from 'lucide-react';

const navSections = [
  {
    title: 'Core Telemetry',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/monitoring', icon: Zap, label: 'Uptime & Latencia' },
      { to: '/ssl', icon: Lock, label: 'Monitoreo SSL' },
      { to: '/dns', icon: Globe, label: 'Registros DNS' },
      { to: '/domains', icon: FileText, label: 'Dominios WHOIS' },
      { to: '/api-checks', icon: Plug, label: 'API Endpoints' },
      { to: '/security-headers', icon: ShieldCheck, label: 'Security Headers' },
    ],
  },
  {
    title: 'Gestion',
    items: [
      { to: '/notifications', icon: Send, label: 'Notificaciones' },
      { to: '/status-page', icon: Globe, label: 'Status Page' },
      { to: '/alerts', icon: Bell, label: 'Smart Alerts' },
      { to: '/incidents', icon: AlertTriangle, label: 'Incidentes' },
      { to: '/reports', icon: FileText, label: 'Reportes' },
      { to: '/audit-logs', icon: ShieldAlert, label: 'Logs de Auditoría' },
      { to: '/organization', icon: Building, label: 'Organización & Equipo' },
      { to: '/users', icon: Users, label: 'Gestión de Usuarios' },
      { to: '/profile', icon: User, label: 'Perfil de Usuario' },
    ],
  },
];

export default function Sidebar() {
  return (
    <aside className="w-60 bg-bg-dark border-r border-border-base p-4 flex flex-col gap-1">
      {navSections.map((section) => (
        <div key={section.title}>
          <div className="text-xs text-text-dim uppercase tracking-wider mt-4 mb-2 ml-2 font-mono">
            {section.title}
          </div>
          {section.items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all ${
                    isActive
                      ? 'bg-bg-card text-accent-green border-l-[3px] border-accent-green'
                      : 'text-text-muted hover:bg-bg-card hover:text-text-main'
                  }`
                }
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      ))}
    </aside>
  );
}