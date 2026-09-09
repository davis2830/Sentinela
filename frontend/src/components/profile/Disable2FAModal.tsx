import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ShieldAlert, X, Loader2, AlertCircle } from 'lucide-react';

interface Disable2FAModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (password: string) => Promise<void>;
  isLoading: boolean;
}

export default function Disable2FAModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}: Disable2FAModalProps) {
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setErrorMsg(null);
    try {
      await onConfirm(password);
      setPassword('');
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Contraseña incorrecta. No se pudo desactivar 2FA.');
    }
  };

  const content = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-bg-card border border-border-base rounded-3xl w-full max-w-md shadow-2xl overflow-hidden relative font-sans">
        {/* Header */}
        <div className="p-6 border-b border-border-base flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-accent-red/10 text-accent-red border border-accent-red/20">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-text-main">
                Desactivar Autenticación 2FA
              </h3>
              <p className="text-xs text-text-dim mt-0.5">
                Confirmación de seguridad requerida
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setPassword('');
              setErrorMsg(null);
              onClose();
            }}
            className="text-text-dim hover:text-text-main p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-text-muted">
            Al desactivar la verificación en dos pasos, tu cuenta solo estará protegida por tu contraseña y los códigos de respaldo quedarán invalidados.
          </p>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-accent-red/10 border border-accent-red/30 text-accent-red text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">
              Ingresa tu contraseña actual para confirmar:
            </label>
            <input
              type="password"
              required
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              className="w-full bg-bg-dark border border-border-base focus:border-accent-red rounded-xl px-4 py-2.5 text-xs text-text-main font-mono focus:outline-none focus:ring-2 focus:ring-accent-red/20 transition-all"
            />
          </div>

          <div className="pt-3 border-t border-border-base flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setPassword('');
                setErrorMsg(null);
                onClose();
              }}
              className="px-4 py-2 text-xs font-semibold text-text-muted hover:text-text-main transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading || !password}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent-red text-white font-bold rounded-xl text-xs hover:bg-accent-red/90 transition-all shadow-md shadow-accent-red/20 disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={14} />
                  <span>Desactivando...</span>
                </>
              ) : (
                <span>Confirmar y Desactivar</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}
