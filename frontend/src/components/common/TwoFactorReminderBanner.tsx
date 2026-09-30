import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowRight, X, Lock } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export default function TwoFactorReminderBanner() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [isDismissed, setIsDismissed] = useState(false);

  // Show only if 2FA is not enabled AND (user is admin/staff or organization requires 2FA or flag is set)
  const shouldShow =
    !isDismissed &&
    user &&
    !user.is_2fa_enabled &&
    (user.requires_2fa_setup || user.is_staff || user.is_superuser);

  if (!shouldShow) {
    return null;
  }

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-accent-purple/15 via-bg-card to-accent-yellow/10 border border-accent-purple/30 rounded-2xl p-4 sm:p-5 shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Top subtle highlight border */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-accent-purple via-accent-yellow to-transparent" />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="p-2.5 rounded-xl bg-accent-purple/15 border border-accent-purple/30 text-accent-purple shrink-0 mt-0.5 sm:mt-0">
            <ShieldAlert size={20} />
          </div>

          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-text-main font-sans">
                Autenticación en Dos Pasos (2FA) Requerida
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent-purple/20 text-accent-purple border border-accent-purple/40 uppercase tracking-wider">
                AppSec Policy
              </span>
            </div>
            <p className="text-xs text-text-muted font-sans leading-relaxed">
              Como administrador del NOC Sentinel, debes proteger tu cuenta vinculando un autenticador TOTP (Google Authenticator, Aegis o 1Password) conforme a las directivas de seguridad ISO 27001.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 justify-end">
          <button
            type="button"
            onClick={() => navigate('/profile', { state: { tab: 'security' } })}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-accent-purple hover:bg-accent-purple/80 text-white transition-all shadow-md shadow-accent-purple/20 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <Lock size={14} />
            <span>Configurar 2FA</span>
            <ArrowRight size={14} />
          </button>

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            title="Recordar más tarde"
            className="p-2 rounded-xl text-text-dim hover:text-text-main hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
