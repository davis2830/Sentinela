import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, UserPlus, Loader2, AlertCircle, Eye, EyeOff, Shield } from 'lucide-react';
import AuthLayout from '../../components/layout/AuthLayout';
import { useAuthStore } from '../../store/authStore';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [localError, setLocalError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (password !== confirmPassword) {
      setLocalError('Las contraseñas no coinciden.');
      return;
    }

    if (password.length < 8) {
      setLocalError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    const success = await register(email, password, firstName, lastName);
    if (success) {
      navigate('/dashboard');
    }
  };

  const displayError = localError || error;

  return (
    <AuthLayout>
      <div className="bg-bg-card border border-border-base rounded-3xl p-7 sm:p-9 shadow-2xl relative overflow-hidden">
        {/* Subtle top edge glow */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent-green to-transparent opacity-80" />

        {/* Card Header with Official Sentinela Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex p-3 rounded-2xl bg-bg-dark border border-border-base shadow-inner mb-3">
            <img
              src="/logo.png"
              alt="Sentinela Logo"
              className="h-10 w-auto object-contain drop-shadow-[0_0_12px_rgba(16,185,129,0.35)]"
            />
          </div>
          <h2 className="text-2xl font-extrabold text-text-main tracking-tight font-sans">
            Crear Cuenta
          </h2>
          <p className="text-xs text-text-muted mt-1 font-mono">
            Únete a la plataforma de observabilidad Sentinela
          </p>
        </div>

        {/* Error Alert */}
        {displayError && (
          <div className="mb-5 flex items-center gap-2.5 bg-accent-red/10 border border-accent-red/40 text-accent-red px-4 py-3 rounded-xl text-xs font-mono animate-in fade-in">
            <AlertCircle size={16} className="shrink-0" />
            <span>{displayError}</span>
          </div>
        )}

        {/* Register Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5 font-sans">
                Nombre
              </label>
              <div className="relative group">
                <User
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim group-focus-within:text-accent-green transition-colors"
                  size={17}
                />
                <input
                  type="text"
                  placeholder="Juan"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="w-full bg-bg-dark border border-border-base focus:border-accent-green/60 rounded-xl px-3.5 py-2.5 pl-10 text-sm text-text-main placeholder:text-text-dim/60 focus:outline-none focus:ring-2 focus:ring-accent-green/20 transition-all font-sans"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5 font-sans">
                Apellido
              </label>
              <div className="relative group">
                <User
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim group-focus-within:text-accent-green transition-colors"
                  size={17}
                />
                <input
                  type="text"
                  placeholder="Pérez"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="w-full bg-bg-dark border border-border-base focus:border-accent-green/60 rounded-xl px-3.5 py-2.5 pl-10 text-sm text-text-main placeholder:text-text-dim/60 focus:outline-none focus:ring-2 focus:ring-accent-green/20 transition-all font-sans"
                />
              </div>
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5 font-sans">
              Correo Electrónico
            </label>
            <div className="relative group">
              <Mail
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim group-focus-within:text-accent-green transition-colors"
                size={17}
              />
              <input
                type="email"
                placeholder="usuario@dominio.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearError();
                  setLocalError('');
                }}
                required
                className="w-full bg-bg-dark border border-border-base focus:border-accent-green/60 rounded-xl px-3.5 py-2.5 pl-10 text-sm text-text-main placeholder:text-text-dim/60 focus:outline-none focus:ring-2 focus:ring-accent-green/20 transition-all font-sans"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5 font-sans">
              Contraseña
            </label>
            <div className="relative group">
              <Lock
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim group-focus-within:text-accent-green transition-colors"
                size={17}
              />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearError();
                  setLocalError('');
                }}
                required
                className="w-full bg-bg-dark border border-border-base focus:border-accent-green/60 rounded-xl px-3.5 py-2.5 pl-10 pr-10 text-sm text-text-main placeholder:text-text-dim/60 focus:outline-none focus:ring-2 focus:ring-accent-green/20 transition-all font-sans"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-main transition-colors p-1 cursor-pointer"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5 font-sans">
              Confirmar Contraseña
            </label>
            <div className="relative group">
              <Lock
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim group-focus-within:text-accent-green transition-colors"
                size={17}
              />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Repite tu contraseña"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setLocalError('');
                }}
                required
                className="w-full bg-bg-dark border border-border-base focus:border-accent-green/60 rounded-xl px-3.5 py-2.5 pl-10 text-sm text-text-main placeholder:text-text-dim/60 focus:outline-none focus:ring-2 focus:ring-accent-green/20 transition-all font-sans"
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-sm bg-accent-green hover:bg-accent-green-glow text-black shadow-lg shadow-accent-green/20 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                <span>Registrando cuenta...</span>
              </>
            ) : (
              <>
                <UserPlus size={18} />
                <span>Completar Registro</span>
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-border-base/50 text-center">
          <p className="text-xs text-text-muted">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-accent-green hover:underline font-semibold">
              Inicia sesión aquí
            </Link>
          </p>

          <div className="flex items-center justify-center gap-1.5 text-[10px] font-mono text-text-dim mt-3">
            <Shield size={12} className="text-accent-green" />
            <span>Sentinela NOC &bull; v1.0.0</span>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}