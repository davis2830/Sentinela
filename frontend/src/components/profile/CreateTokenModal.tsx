import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Key, Loader2, ShieldCheck, Clock, ShieldAlert, Copy, Download, Check } from 'lucide-react';

interface CreateTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; scope: 'read' | 'full'; expires_in_days: number | null }) => Promise<string>;
  isLoading?: boolean;
}

export default function CreateTokenModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: CreateTokenModalProps) {
  const [name, setName] = useState('');
  const [scope, setScope] = useState<'read' | 'full'>('full');
  const [expiration, setExpiration] = useState<number | null>(90);
  const [rawToken, setRawToken] = useState<string | null>(null);
  const [secretSaved, setSecretSaved] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const secret = await onSubmit({
      name: name.trim(),
      scope,
      expires_in_days: expiration,
    });
    setRawToken(secret);
  };

  const closeSafely = () => {
    if (rawToken && !secretSaved) return;
    setRawToken(null);
    setSecretSaved(false);
    setName('');
    onClose();
  };

  const copySecret = async () => {
    if (!rawToken) return;
    await navigator.clipboard.writeText(rawToken);
    setSecretSaved(true);
  };

  const downloadSecret = () => {
    if (!rawToken) return;
    const blob = new Blob([`${rawToken}\n`], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sentinel-api-token-${name.trim().replace(/\s+/g, '-').toLowerCase()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    setSecretSaved(true);
  };

  const content = (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={closeSafely}
    >
      <div
        className="bg-bg-card border border-border-base rounded-3xl p-6 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-border-base">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-accent-green/10 border border-accent-green/20 flex items-center justify-center text-accent-green">
              <Key size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-main">
                Generar Nuevo API Token
              </h2>
              <p className="text-xs text-text-dim">
                Clave programática para integración de scripts y sistemas externos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeSafely}
            disabled={!!rawToken && !secretSaved}
            className="p-1.5 rounded-full text-text-dim hover:text-text-main hover:bg-bg-dark transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {rawToken ? (
          <div className="space-y-4 text-xs font-sans">
            <div className="p-4 rounded-2xl border border-accent-yellow/40 bg-accent-yellow/10 text-text-main">
              Este secreto se muestra una sola vez. Cópialo o descárgalo antes de cerrar.
            </div>
            <code className="block break-all rounded-2xl border border-border-base bg-bg-dark p-4 font-mono text-accent-green select-all">
              {rawToken}
            </code>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={copySecret} className="py-2.5 rounded-full border border-border-base flex items-center justify-center gap-2">
                {secretSaved ? <Check size={15} /> : <Copy size={15} />} Copiar
              </button>
              <button type="button" onClick={downloadSecret} className="py-2.5 rounded-full border border-border-base flex items-center justify-center gap-2">
                <Download size={15} /> Descargar
              </button>
            </div>
            <button type="button" disabled={!secretSaved} onClick={closeSafely} className="w-full py-2.5 bg-accent-green text-black font-bold rounded-full disabled:opacity-40">
              Ya guardé el secreto
            </button>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">
              Nombre Descriptivo del Token <span className="text-accent-red">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="ej. Script Exportador Prometheus / Bot Notificador"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-sans"
            />
          </div>

          {/* Scopes */}
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-2 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-accent-green" />
              Alcance de Permisos (Scope)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setScope('full')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  scope === 'full'
                    ? 'bg-accent-green/10 border-accent-green/40 text-accent-green ring-1 ring-accent-green/30'
                    : 'bg-bg-dark border-border-base text-text-muted hover:border-border-accent'
                }`}
              >
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <ShieldCheck size={14} />
                  Full Access
                </div>
                <div className="text-[10px] text-text-dim mt-1 leading-relaxed">
                  Lectura y escritura en endpoints de la plataforma.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setScope('read')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  scope === 'read'
                    ? 'bg-accent-blue/10 border-accent-blue/40 text-accent-blue ring-1 ring-accent-blue/30'
                    : 'bg-bg-dark border-border-base text-text-muted hover:border-border-accent'
                }`}
              >
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <ShieldAlert size={14} />
                  Solo Lectura
                </div>
                <div className="text-[10px] text-text-dim mt-1 leading-relaxed">
                  Solo consulta de métricas, estados y targets.
                </div>
              </button>
            </div>
          </div>

          {/* Expiration */}
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-2 flex items-center gap-1.5">
              <Clock size={14} className="text-accent-yellow" />
              Vigencia / Periodo de Expiración
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: '30 Días', value: 30 },
                { label: '90 Días', value: 90 },
                { label: '1 Año', value: 365 },
                { label: 'Sin límite', value: null },
              ].map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setExpiration(opt.value)}
                  className={`py-2 px-2.5 rounded-xl border text-center transition-all text-xs font-medium ${
                    expiration === opt.value
                      ? 'bg-accent-green/10 border-accent-green text-accent-green font-bold'
                      : 'bg-bg-dark border-border-base text-text-muted hover:border-border-accent'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Security Notice */}
          <div className="p-3 bg-bg-dark/70 border border-border-base rounded-2xl text-[11px] text-text-dim leading-relaxed">
            Una vez creado, asegúrate de almacenar la clave en un lugar seguro. Trata este token como si fuera tu contraseña.
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-3 border-t border-border-base">
            <button
              type="button"
              onClick={closeSafely}
              className="flex-1 py-2.5 border border-border-base rounded-full text-xs font-semibold text-text-muted hover:bg-bg-dark transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="flex-1 py-2.5 bg-accent-green text-black font-bold rounded-full text-xs hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? <Loader2 className="animate-spin" size={15} /> : <Key size={14} />}
              Generar Token
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}
