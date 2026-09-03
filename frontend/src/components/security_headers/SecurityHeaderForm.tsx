import React, { useState, useEffect } from 'react';
import type {
  SecurityHeaderTarget,
  CreateSecurityHeaderTargetData,
} from '../../types/security_headers';
import { X, Loader2, ShieldCheck } from 'lucide-react';

interface SecurityHeaderFormProps {
  target?: SecurityHeaderTarget | null;
  onSubmit: (data: CreateSecurityHeaderTargetData) => Promise<void>;
  onClose: () => void;
}

export default function SecurityHeaderForm({
  target,
  onSubmit,
  onClose,
}: SecurityHeaderFormProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [enabled, setEnabled] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (target) {
      setName(target.name);
      setUrl(target.url);
      setEnabled(target.enabled);
    } else {
      setName('');
      setUrl('');
      setEnabled(true);
    }
  }, [target]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        url: url.trim(),
        enabled,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-bg-card border border-border-base rounded-2xl p-6 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
            <ShieldCheck size={20} className="text-accent-green" />
            {target ? 'Editar Security Header Target' : 'Nuevo Security Header Scan'}
          </h2>
          <button onClick={onClose} className="p-1.5 text-text-muted hover:text-text-main rounded-full hover:bg-bg-dark transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">
              Nombre de la Aplicación / Sitio
            </label>
            <input
              type="text"
              required
              placeholder="ej. Portal Cliente Producción"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-sans"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">
              URL del Sitio Web
            </label>
            <input
              type="url"
              required
              placeholder="ej. https://portal.miempresa.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-mono"
            />
            <p className="text-xs text-text-dim mt-1.5">
              Se analizará la presencia de cabeceras de seguridad HTTP (HSTS, CSP, X-Frame-Options, etc.).
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="enabledSecurityCheck"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-4 h-4 rounded bg-bg-dark border-border-base text-accent-green focus:ring-accent-green focus:ring-offset-bg-dark cursor-pointer"
            />
            <label
              htmlFor="enabledSecurityCheck"
              className="text-sm font-medium text-text-main cursor-pointer"
            >
              Escaneo Activo
            </label>
          </div>

          <div className="flex gap-3 pt-4 border-t border-border-base">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-border-base rounded-full text-sm text-text-muted hover:bg-bg-dark transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 bg-accent-green text-black font-semibold rounded-full text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
            >
              {submitting ? (
                <Loader2 className="animate-spin" size={18} />
              ) : target ? (
                'Actualizar'
              ) : (
                'Guardar y Escanear'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
