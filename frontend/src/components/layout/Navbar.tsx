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
      <nav className="h-14 shrink-0 flex items-center justify-between gap-3 px-4 lg:px-6 bg-bg-dark/95 backdrop-blur-md border-b border-border-base z-30">
        {/* Brand */}
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="flex items-center gap-3 font-bold text-lg text-text-main no-underline group">
            <img
              src="/logo.webp"
              alt="Sentinel"
              width={32}
              height={32}
              className="h-8 w-auto object-contain drop-shadow-md group-hover:scale-105 transition-transform"
            />
            <span className="font-sans font-extrabold text-xl tracking-tight text-text-main">
              Sentinel
            </span>
          </Link>
          <span className="hidden xl:inline bg-accent-green/10 border border-accent-green/30 text-accent-green text-xs px-2.5 py-0.5 rounded-full font-semibold">
            Observabilidad
          </span>
        </div>

        {/* Omnibar Search Trigger Button */}
        <button
          aria-label="Buscar en Sentinel"
          onClick={() => setIsSearchOpen(true)}
          className="flex items-center gap-3 bg-bg-card border border-border-base hover:border-accent-green px-4 py-1.5 rounded-full text-xs text-text-muted hover:text-text-main transition-all shadow-sm"
        >
          <Search size={14} className="text-accent-green" />
          <span className="hidden lg:inline">Buscar en Sentinel...</span>
          <span className="hidden lg:inline bg-bg-dark border border-border-base text-text-dim px-2 py-0.5 rounded-full text-[10px] font-mono">
            Ctrl K
          </span>
        </button>

        {/* User + Logout */}
        <div className="flex items-center gap-4">
          <Link
            to="/profile"
            className="hidden md:flex items-center gap-2 text-xs text-text-muted hover:text-accent-green transition-colors"
            title="Ver perfil de usuario"
          >
            <Activity className="text-accent-green" size={16} />
            <span className="max-w-52 truncate">{user?.email || 'admin@sentinel.local'}</span>
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
