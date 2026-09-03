import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Activity, Search } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import OmnibarSearch from '../common/OmnibarSearch';

export default function Navbar() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      <nav className="flex items-center justify-between px-8 py-3 bg-bg-dark/85 backdrop-blur-md border-b border-border-base sticky top-0 z-50">
        {/* Brand */}
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="flex items-center gap-3 font-mono font-bold text-lg text-text-main no-underline">
            <span className="text-accent-green text-xl">//</span>
            <span>sentinel</span>
          </Link>
          <span className="bg-accent-green/10 border border-accent-green/30 text-accent-green text-xs px-2.5 py-0.5 rounded-full font-semibold">
            Fase 1: Observabilidad
          </span>
        </div>

        {/* Omnibar Search Trigger Button */}
        <button
          onClick={() => setIsSearchOpen(true)}
          className="flex items-center gap-3 bg-bg-card border border-border-base hover:border-accent-green px-4 py-1.5 rounded-full text-xs text-text-muted hover:text-text-main transition-all shadow-sm"
        >
          <Search size={14} className="text-accent-green" />
          <span>Buscar todo en Sentinela...</span>
          <span className="bg-bg-dark border border-border-base text-text-dim px-2 py-0.5 rounded-full text-[10px] font-mono">
            Ctrl K
          </span>
        </button>

        {/* User + Logout */}
        <div className="flex items-center gap-4">
          <Link
            to="/profile"
            className="hidden sm:flex items-center gap-2 text-sm text-text-muted hover:text-accent-green transition-colors"
            title="Ver perfil de usuario"
          >
            <Activity className="text-accent-green" size={16} />
            <span>{user?.email || 'admin@sentinel.local'}</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-text-muted hover:text-accent-red transition-colors text-sm"
          >
            <LogOut size={18} />
            <span className="hidden sm:inline">Cerrar Sesion</span>
          </button>
        </div>
      </nav>

      {/* Omnibar Modal */}
      <OmnibarSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}