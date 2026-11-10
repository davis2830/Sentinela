import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Activity, Search } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { hasCapability } from "../../hooks/useCapability";
import BetaFeedbackLink from '../common/BetaFeedbackLink';
import OmnibarSearch from '../common/OmnibarSearch';
import NavbarFrame from './NavbarFrame';

export default function Navbar() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const canSearch = hasCapability(user, ["monitoring.read", "ssl_monitor.read", "dns_monitor.read", "api_checks.read", "alerts.read", "incidents.read"]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    if (!canSearch) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canSearch]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      <NavbarFrame badge="Observabilidad" home="/dashboard" center={canSearch && (
        <button
          aria-label="Buscar en Sentinel"
          onClick={() => setIsSearchOpen(true)}
          className="flex items-center gap-3 bg-bg-card border border-border-base hover:border-accent-green px-4 py-1.5 rounded-full text-xs text-text-muted hover:text-text-main transition-all shadow-sm"
        >
          <Search size={14} className="text-accent-green" />
          <span className="hidden lg:inline">Buscar en Sentinel...</span>
          <span className="hidden lg:inline bg-bg-dark border border-border-base text-text-dim px-2 py-0.5 rounded-full text-xs font-mono">
            Ctrl K
          </span>
        </button>)
      } actions={
<div className="flex items-center gap-4">
          <BetaFeedbackLink/>
          <Link
            to="/profile"
            className="hidden md:flex items-center gap-2 text-xs text-text-muted hover:text-accent-green transition-colors"
            title="Ver perfil de usuario"
          >
            <Activity className="text-accent-green" size={16} />
            <span className="max-w-52 truncate">{user?.email || 'admin@sentinel.local'}</span>
          </Link>
          <button
            aria-label="Cerrar sesión" onClick={handleLogout}
            className="flex items-center gap-2 text-text-muted hover:text-accent-red transition-colors text-sm"
          >
            <LogOut size={18} />
            <span className="hidden sm:inline">Cerrar Sesion</span>
          </button>
        </div>
      } />

      {/* Omnibar Modal */}
      <OmnibarSearch isOpen={canSearch && isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}
