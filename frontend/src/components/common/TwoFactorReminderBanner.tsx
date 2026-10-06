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
    <div className="relative overflow-hidden bg-accent-purple/5 border border-accent-purple/25 rounded-lg px-3 py-2">
      {/* Top subtle highlight border */}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-accent-purple/10 text-accent-purple shrink-0">
            <ShieldAlert size={16} />
          </div>

          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-text-main font-sans">
                Protege tu cuenta con 2FA
              </span>
            </div>
            <p className="text-xs text-text-muted font-sans leading-relaxed">
              Vincula un autenticador para reforzar la seguridad de tu acceso.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 justify-end">
          <button
            type="button"
            onClick={() => navigate('/profile', { state: { tab: 'security' } })}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-accent-purple/30 text-accent-purple hover:bg-accent-purple/10 transition-colors cursor-pointer"
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
