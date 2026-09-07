import React, { useState, useEffect } from 'react';
import type {
  SecurityHeaderTarget,
  CreateSecurityHeaderTargetData,
  TestHeaderResponse,
} from '../../types/security_headers';
import { api } from '../../services/api';
import GradeBadge from '../common/GradeBadge';
import {
  X,
  Loader2,
  ShieldCheck,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';

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

  // Live Audit Test state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestHeaderResponse | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

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
    setTestResult(null);
    setTestError(null);
  }, [target]);

  const handleTestAudit = async () => {
    if (!url.trim()) return;
    setTesting(true);
    setTestResult(null);
    setTestError(null);

    try {
      const response = await api.post('security-headers/test-headers/', {
        url: url.trim(),
      });
      const data = response.data?.data;
      if (data?.success) {
        setTestResult(data);
      } else {
        setTestError(data?.error || 'Error al conectar con la URL para auditar cabeceras.');
      }
    } catch (err: any) {
      setTestError(err?.response?.data?.message || err?.message || 'Error al ejecutar prueba de auditoría.');
    } finally {
      setTesting(false);
    }
  };

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

  const leakKeys = testResult?.info_leaks ? Object.keys(testResult.info_leaks) : [];

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-bg-card border border-border-base rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
            <ShieldCheck size={20} className="text-accent-green" />
            {target ? 'Editar Security Header Target' : 'Nuevo Security Header Scan'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text-main rounded-full hover:bg-bg-dark transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">
              Nombre de la Aplicación / Servicio
            </label>
            <input
              type="text"
              required
              placeholder="ej. Portal Transaccional Producción"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-sans"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-text-muted">
                URL del Endpoint / Sitio Web
              </label>
              <button
                type="button"
                onClick={handleTestAudit}
                disabled={testing || !url.trim()}
                className="text-xs font-semibold text-accent-green hover:underline flex items-center gap-1 disabled:opacity-40 transition-colors"
                title="Probar en vivo y auditar cabeceras ahora"
              >
                {testing ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Zap size={12} />
                )}
                {testing ? 'Auditando...' : 'Probar en Vivo'}
              </button>
            </div>
            <div className="relative">
              <input
                type="text"
                required
                placeholder="ej. https://portal.miempresa.com"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setTestResult(null);
                  setTestError(null);
                }}
                className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-mono"
              />
            </div>
            <p className="text-[11px] text-text-dim mt-1.5">
              Se analizarán cabeceras como HSTS, CSP, X-Frame-Options, X-Content-Type-Options y posibles fugas de servidor.
            </p>
          </div>

          {/* Test Audit Live Result Card */}
          {testing && (
            <div className="bg-bg-dark/80 border border-border-base rounded-xl p-4 flex items-center justify-center gap-2 text-xs text-text-muted animate-pulse">
              <Loader2 size={16} className="animate-spin text-accent-green" />
              <span>Conectando y analizando cabeceras HTTP de respuesta...</span>
            </div>
          )}

          {testError && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-400 flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Fallo en la prueba de auditoría:</p>
                <p className="mt-0.5 text-rose-300/90">{testError}</p>
              </div>
            </div>
          )}

          {testResult && (
            <div className="bg-bg-dark/90 border border-border-base rounded-xl p-3.5 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-border-base/60 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-text-muted">Auditoría Previa:</span>
                  <span className="text-xs font-mono font-bold text-accent-green">
                    Status {testResult.http_status}
                  </span>
                  <span className="text-[11px] font-mono text-text-dim flex items-center gap-1">
                    <Clock size={11} /> {testResult.response_time_ms} ms
                  </span>
                </div>
                <GradeBadge grade={testResult.grade} score={testResult.score} />
              </div>

              {/* Score & Headers Count Summary */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-bg-card/70 border border-border-base/50 rounded-lg p-2">
                  <div className="text-[10px] text-text-dim">Puntuación</div>
                  <div className="text-sm font-bold font-mono text-text-main mt-0.5">
                    {testResult.score} / 100
                  </div>
                </div>
                <div className="bg-bg-card/70 border border-border-base/50 rounded-lg p-2">
                  <div className="text-[10px] text-text-dim">Detectadas</div>
                  <div className="text-sm font-bold font-mono text-emerald-400 mt-0.5">
                    {Object.keys(testResult.headers_found).length} OK
                  </div>
                </div>
                <div className="bg-bg-card/70 border border-border-base/50 rounded-lg p-2">
                  <div className="text-[10px] text-text-dim">Faltantes</div>
                  <div className={`text-sm font-bold font-mono mt-0.5 ${
                    testResult.headers_missing.length > 0 ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {testResult.headers_missing.length}
                  </div>
                </div>
              </div>

              {/* Server Leaks Warning if present */}
              {leakKeys.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg p-2.5 text-xs text-amber-400 flex items-start gap-2">
                  <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-semibold">Fuga de información de stack detectada:</span>
                    <p className="text-[11px] text-amber-300/80">
                      {leakKeys.map((k) => `${testResult.info_leaks[k].header}: ${testResult.info_leaks[k].value}`).join(' | ')}
                    </p>
                  </div>
                </div>
              )}

              {/* Detected Header pills */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {Object.keys(testResult.headers_found).map((hdr) => (
                  <span
                    key={hdr}
                    className="px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-md text-[10px] font-mono flex items-center gap-1"
                  >
                    <CheckCircle2 size={10} />
                    {hdr}
                  </span>
                ))}
                {testResult.headers_missing.map((hdr) => (
                  <span
                    key={hdr}
                    className="px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-md text-[10px] font-mono"
                  >
                    Falta {hdr}
                  </span>
                ))}
              </div>
            </div>
          )}

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
              Escaneo Periódico Activo
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
                'Actualizar Endpoint'
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
