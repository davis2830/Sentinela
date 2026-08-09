import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Key, LogIn, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import AuthLayout from '../../components/layout/AuthLayout';
import { useAuthStore } from '../../store/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const successMessage = location.state?.message;
  const { login, isLoading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(email, password);
    if (success) {
      navigate('/dashboard');
    }
  };

  return (
    <AuthLayout>
      <h2 className="text-center text-2xl font-bold mt-8 mb-8">Iniciar Sesion en Sentinel</h2>

      {successMessage && (
        <div className="mb-4 flex items-center gap-2 bg-accent-green/10 border border-accent-green/50 text-accent-green px-4 py-3 rounded-lg text-sm font-mono">
          <CheckCircle size={18} className="shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-center gap-2 bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearError();
              }}
              required
              className="input-base pl-11"
            />
          </div>
        </div>

        <div>
          <div className="relative">
            <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
            <input
              type="password"
              placeholder="Contrasena"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearError();
              }}
              required
              className="input-base pl-11"
            />
          </div>
        </div>

        <div className="text-right">
          <a href="#" className="text-text-muted text-sm hover:text-text-main transition-colors">
            ¿Olvide mi contrasena?
          </a>
        </div>

        <button type="submit" disabled={isLoading} className="btn-primary">
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              Iniciando...
            </>
          ) : (
            <>
              <LogIn size={18} />
              Iniciar Sesion
            </>
          )}
        </button>
      </form>

      <p className="text-center mt-6 text-text-muted text-sm">
        ¿No tienes cuenta?{' '}
        <Link to="/register" className="text-accent-green hover:underline">
          Registrate aqui
        </Link>
      </p>
    </AuthLayout>
  );
}