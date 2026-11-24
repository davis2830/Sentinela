import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Activity } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import BetaFeedbackLink from '../common/BetaFeedbackLink';
import NavbarFrame from './NavbarFrame';

export default function Navbar() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      <NavbarFrame badge="Observabilidad" home="/dashboard" actions={
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
    </>
  );
}
