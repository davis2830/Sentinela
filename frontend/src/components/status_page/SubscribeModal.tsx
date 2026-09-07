import React, { useState } from 'react';
import { X, Mail, CheckCircle2, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';

interface SubscribeModalProps {
  isOpen: boolean;
  onClose: () => void;
  slug: string;
  companyName: string;
}

export default function SubscribeModal({
  isOpen,
  onClose,
  slug,
  companyName,
}: SubscribeModalProps) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Por favor ingresa un correo electrónico válido.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    try {
      await api.post(`status-page/public/${slug}/subscribe/`, { email: email.trim().toLowerCase() });
      setSuccess(true);
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message || err.message || 'Error al procesar la suscripción. Intenta nuevamente.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setSuccess(false);
    setErrorMessage('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200 font-sans"
      onClick={handleClose}
    >
      <div
        className="bg-bg-card border border-border-base rounded-3xl p-6 w-full max-w-md shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 text-text-muted hover:text-text-main p-1.5 rounded-full hover:bg-bg-dark transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {success ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-accent-green/10 border border-accent-green/30 text-accent-green flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 size={28} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-main">¡Suscripción Confirmada!</h3>
              <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
                Hemos registrado <strong className="text-text-main font-mono">{email}</strong> para recibir alertas en tiempo real sobre el estado de {companyName}.
              </p>
            </div>
            <p className="text-[11px] text-text-dim">
              Puedes cancelar tu suscripción en cualquier momento desde los enlaces al pie de cada notificación.
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2 bg-accent-green text-black font-semibold rounded-full text-xs hover:bg-accent-green/90 transition-all cursor-pointer shadow-sm"
            >
              Entendido
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-accent-blue/10 border border-accent-blue/30 text-accent-blue flex items-center justify-center shrink-0">
                <Mail size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-text-main">
                  Suscribirse a Actualizaciones
                </h3>
                <p className="text-xs text-text-muted">
                  Recibe avisos automáticos de caídas e inicios de mantenimiento.
                </p>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5 pt-2">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  required
                  placeholder="tu-correo@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-3.5 py-2.5 text-xs text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-sans"
                />
              </div>

              <div className="flex items-start gap-2 text-[11px] text-text-dim">
                <ShieldCheck size={14} className="text-accent-green shrink-0 mt-0.5" />
                <span>
                  Tus datos están protegidos. Únicamente te enviaremos actualizaciones operativas críticas. Cero spam.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border-base/60">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 border border-border-base rounded-full text-xs text-text-muted hover:text-text-main hover:bg-bg-dark transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-accent-green text-black font-semibold rounded-full text-xs hover:bg-accent-green/90 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                  Suscribirme Ahora
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
