import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, LogIn, Loader2, AlertCircle, CheckCircle2, Eye, EyeOff, Shield } from 'lucide-react';
import AuthLayout from '../../components/layout/AuthLayout';
import { useAuthStore } from '../../store/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const successMessage = location.state?.message;
  const { login, isLoading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(email, password);
    if (success) {
      navigate('/dashboard');
    }
  };

  return (
    <AuthLayout>
      <div className="bg-bg-card border border-border-base rounded-3xl p-7 sm:p-9 xl:p-10 shadow-2xl relative overflow-hidden w-full font-sans">
        {/* Subtle top edge glow */}
        <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-transparent via-accent-green to-transparent opacity-90" />

        {/* Card Header */}
        <div className="text-center mb-7 sm:mb-8">
          {/* Logo badge: shown on desktop inside card; on mobile it is in the top header */}
          <div className="hidden lg:inline-flex p-3.5 rounded-2xl bg-bg-dark border border-border-base shadow-inner mb-3.5">
            <img
              src="/logo.png"
              alt="Sentinela Logo"
              className="h-11 w-auto object-contain drop-shadow-[0_0_15px_rgba(16,185,129,0.35)]"
            />
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-text-main tracking-tight font-sans">
            Iniciar Sesión
          </h2>
          <p className="text-sm text-text-muted mt-1.5 font-sans">
            Acceso corporativo a la consola de operaciones
          </p>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="mb-5 flex items-center gap-3 bg-accent-green/10 border border-accent-green/40 text-accent-green px-4 py-3 rounded-xl text-sm font-sans animate-in fade-in">
            <CheckCircle2 size={18} className="shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-5 flex items-center gap-3 bg-accent-red/10 border border-accent-red/40 text-accent-red px-4 py-3 rounded-xl text-sm font-sans animate-in fade-in">
            <AlertCircle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Field */}
          <div>
            <label className="block text-sm font-semibold text-text-muted mb-1.5 font-sans">
              Correo Electrónico
            </label>
            <div className="relative group">
              <Mail
                className="absolute left-4 top-1/2 -translate-y-1/2 text-text-dim group-focus-within:text-accent-green transition-colors"
                size={19}
              />
              <input
                type="email"
                placeholder="usuario@dominio.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearError();
                }}
                required
                className="w-full bg-bg-dark border border-border-base focus:border-accent-green rounded-xl px-4 py-3.5 pl-11 text-base text-text-main placeholder:text-text-dim/60 focus:outline-none focus:ring-2 focus:ring-accent-green/20 transition-all font-sans"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold text-text-muted font-sans">
                Contraseña
              </label>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  alert('Por favor contacta al administrador del sistema para restablecer tu contraseña.');
                }}
                className="text-xs text-accent-green hover:underline font-medium transition-colors font-sans"
              >
                ¿Olvidaste tu contraseña?
              </a>
            </div>
            <div className="relative group">
              <Lock
                className="absolute left-4 top-1/2 -translate-y-1/2 text-text-dim group-focus-within:text-accent-green transition-colors"
                size={19}
              />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearError();
                }}
                required
                className="w-full bg-bg-dark border border-border-base focus:border-accent-green rounded-xl px-4 py-3.5 pl-11 pr-11 text-base text-text-main placeholder:text-text-dim/60 focus:outline-none focus:ring-2 focus:ring-accent-green/20 transition-all font-sans"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-main transition-colors p-1.5 cursor-pointer"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Remember Me Checkbox */}
          <div className="flex items-center gap-2.5 pt-0.5">
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-border-base text-accent-green bg-bg-dark focus:ring-accent-green/20 accent-accent-green cursor-pointer"
            />
            <label
              htmlFor="rememberMe"
              className="text-sm text-text-muted select-none cursor-pointer font-sans"
            >
              Recordar mi sesión en este equipo
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-4 px-6 rounded-xl font-bold text-base bg-accent-green hover:bg-accent-green-glow text-black shadow-xl shadow-accent-green/20 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2.5 font-sans cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                <span>Autenticando credenciales...</span>
              </>
            ) : (
              <>
                <LogIn size={20} />
                <span>Ingresar a la Plataforma</span>
              </>
            )}
          </button>
        </form>

        {/* Footer Register Link */}
        <div className="mt-7 pt-5 border-t border-border-base/50 text-center">
          <p className="text-sm text-text-muted font-sans">
            ¿Aún no tienes acceso?{' '}
            <Link to="/register" className="text-accent-green hover:underline font-semibold">
              Crear una cuenta aquí
            </Link>
          </p>

          <div className="flex items-center justify-center gap-1.5 text-xs text-text-dim mt-4 font-sans">
            <Shield size={14} className="text-accent-green" />
            <span>Sentinela NOC &bull; <span className="font-mono">v1.0.0</span></span>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}