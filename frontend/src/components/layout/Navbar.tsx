import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Activity } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export default function Navbar() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="flex items-center justify-between px-8 py-3 bg-bg-dark/85 backdrop-blur-md border-b border-border-base sticky top-0 z-50">
      {/* Brand */}
      <div className="flex items-center gap-4">
        <Link to="/dashboard" className="flex items-center gap-3 font-mono font-bold text-lg text-text-main no-underline">
          <span className="text-accent-green text-xl">//</span>
          <span>sentinel</span>
        </Link>
        <span className="bg-accent-green/10 border border-accent-green text-accent-green text-xs px-2 py-0.5 rounded-full font-mono uppercase tracking-wide">
          Fase 1: Observabilidad
        </span>
      </div>

      {/* Target Selector */}
      <div className="hidden md:flex items-center gap-2 bg-bg-card border border-border-base px-3 py-1.5 rounded-lg font-mono text-sm">
        <div className="w-2 h-2 rounded-full bg-accent-green shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div>
        <span className="text-text-muted">sentinel.local</span>
      </div>

      {/* User + Logout */}
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 text-sm">
          <Activity className="text-accent-green" size={16} />
          <span className="text-text-muted">{user?.email || 'admin@sentinel.local'}</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-text-muted hover:text-accent-red transition-colors text-sm"
        >
          <LogOut size={18} />
          <span className="hidden sm:inline">Cerrar Sesion</span>
        </button>
      </div>
    </nav>
  );
}