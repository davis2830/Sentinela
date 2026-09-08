import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import {
  X,
  Zap,
  Globe,
  Shield,
  Lock,
  Server,
  Activity,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Rocket,
  Check,
} from 'lucide-react';

interface QuickStartWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export default function QuickStartWizardModal({
  isOpen,
  onClose,
  onComplete,
}: QuickStartWizardModalProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form State
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [enableSSL, setEnableSSL] = useState(true);
  const [enableSecurityHeaders, setEnableSecurityHeaders] = useState(true);
  const [enableDNS, setEnableDNS] = useState(true);
  const [interval, setInterval] = useState(60);

  // Live Test State
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    status_code?: number;
    latency_ms?: number;
    message?: string;
  } | null>(null);

  // Submit Mutation
  const launchMutation = useMutation({
    mutationFn: async () => {
      // 1. Create Monitoring Target
      const formattedUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
      const targetRes = await api.post('/monitoring/', {
        name: name.trim() || new URL(formattedUrl).hostname,
        endpoint: formattedUrl,
        target_type: formattedUrl.startsWith('https') ? 'https' : 'http',
        interval: interval,
        enabled: true,
        tags: ['onboarding', 'production'],
      });
      const newTarget = targetRes.data?.data;

      // 2. Immediate Initial Scan
      if (newTarget?.id) {
        try {
          await api.post(`/monitoring/${newTarget.id}/scan/`);
        } catch {
          // Non-blocking scan failure
        }
      }
      return newTarget;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dash-monitoring'] });
      queryClient.invalidateQueries({ queryKey: ['monitoring-targets'] });
      queryClient.invalidateQueries({ queryKey: ['org-subscription'] });
      localStorage.removeItem('sentinel_launch_onboarding');
      localStorage.removeItem('sentinela_launch_onboarding');
      if (onComplete) {
        onComplete();
      }
      setStep(3);
    },
  });

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    if (!url.trim()) return;
    setIsTesting(true);
    setTestResult(null);

    const formatted = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    try {
      const res = await api.post('/monitoring/test-connection/', {
        endpoint: formatted,
        target_type: formatted.startsWith('https') ? 'https' : 'http',
        timeout: 8,
      });

      const data = res.data?.data;
      setTestResult({
        success: data?.status === 'up',
        status_code: data?.status_code,
        latency_ms: data?.latency_ms,
        message: data?.error_message || (data?.status === 'up' ? 'Conexión verificada exitosamente' : 'Respuesta con error'),
      });

      // Auto-suggest name if empty
      if (!name) {
        try {
          const hostname = new URL(formatted).hostname;
          setName(hostname.replace('www.', ''));
        } catch {
          setName(url);
        }
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.response?.data?.message || 'No se pudo contactar el endpoint.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-bg-card border border-border-base rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]">
        {/* Top Edge Glow */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent-green to-transparent opacity-80" />

        {/* Modal Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border-base flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-green/10 border border-accent-green/30 flex items-center justify-center shadow-inner">
              <Rocket className="text-accent-green" size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-text-main">
                  {step === 3 ? '¡Observabilidad Activada!' : 'Despliegue Rápido de Observabilidad'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent-green/15 text-accent-green border border-accent-green/30 font-mono">
                  &lt; 60s
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                {step === 3
                  ? 'Tu primer objetivo ya se encuentra bajo vigilancia continua.'
                  : 'Configura tu primer monitor y activa la red de alertas inteligentes de Sentinel.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-dim hover:text-text-main p-1.5 rounded-lg hover:bg-bg-dark transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stepper Progress */}
        {step < 3 && (
          <div className="px-6 pt-3 pb-2 bg-bg-dark/60 border-b border-border-base/50 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                  step === 1 ? 'bg-accent-green text-black ring-2 ring-accent-green/30' : 'bg-zinc-800 text-zinc-300'
                }`}
              >
                1
              </div>
              <span className={step === 1 ? 'text-accent-green font-semibold' : 'text-text-muted'}>
                Endpoint & Diagnóstico
              </span>
            </div>
            <div className="w-12 h-0.5 bg-border-base" />
            <div className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                  step === 2 ? 'bg-accent-green text-black ring-2 ring-accent-green/30' : 'bg-zinc-800 text-zinc-300'
                }`}
              >
                2
              </div>
              <span className={step === 2 ? 'text-accent-green font-semibold' : 'text-text-muted'}>
                Cobertura de Monitoreo
              </span>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  URL o Dominio Corporativo <span className="text-accent-red">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Globe
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim"
                      size={16}
                    />
                    <input
                      type="text"
                      placeholder="https://miempresa.com o api.servicio.cl"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="w-full bg-bg-dark border border-border-base focus:border-accent-green/60 rounded-xl px-3.5 py-2.5 pl-10 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent-green/20 font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={!url.trim() || isTesting}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-accent-green/10 border border-accent-green/40 text-accent-green hover:bg-accent-green/20 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {isTesting ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                    <span>Probar en Vivo</span>
                  </button>
                </div>
                <p className="text-[11px] text-text-dim mt-1.5">
                  Ingresa tu portal web, API pública o microservicio cloud.
                </p>
              </div>

              {/* Test Result Feedback */}
              {testResult && (
                <div
                  className={`p-3.5 rounded-xl border flex items-start gap-3 animate-in fade-in duration-150 ${
                    testResult.success
                      ? 'bg-accent-green/10 border-accent-green/30 text-emerald-400'
                      : 'bg-accent-red/10 border-accent-red/30 text-rose-400'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 size={18} className="shrink-0 text-accent-green mt-0.5" />
                  ) : (
                    <AlertCircle size={18} className="shrink-0 text-accent-red mt-0.5" />
                  )}
                  <div className="text-xs">
                    <div className="font-bold flex items-center gap-2">
                      <span>{testResult.message}</span>
                      {testResult.status_code && (
                        <span className="px-1.5 py-0.5 rounded bg-bg-dark text-text-main font-mono text-[10px]">
                          HTTP {testResult.status_code}
                        </span>
                      )}
                      {testResult.latency_ms !== undefined && (
                        <span className="px-1.5 py-0.5 rounded bg-bg-dark text-text-main font-mono text-[10px]">
                          {testResult.latency_ms.toFixed(0)}ms
                        </span>
                      )}
                    </div>
                    {testResult.success && (
                      <p className="text-emerald-300/80 text-[11px] mt-1">
                        Endpoint respondiendo adecuadamente desde la red de monitoreo Sentinel Cloud.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Friendly Name */}
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  Nombre Identificador en Dashboards
                </label>
                <input
                  type="text"
                  placeholder="Ej. Producción Web Principal"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-bg-dark border border-border-base focus:border-accent-green/60 rounded-xl px-3.5 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent-green/20"
                />
              </div>

              {/* Frequency Selector */}
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  Frecuencia de Sondeo
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: '30 seg (Alta Fidelidad)', value: 30 },
                    { label: '60 seg (Recomendado)', value: 60 },
                    { label: '300 seg (Estándar)', value: 300 },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setInterval(opt.value)}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-semibold transition-all text-center ${
                        interval === opt.value
                          ? 'bg-accent-green/15 border-accent-green text-accent-green shadow-sm'
                          : 'bg-bg-dark border-border-base text-text-muted hover:border-zinc-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-bg-dark/60 border border-border-base rounded-2xl p-4">
                <h4 className="text-xs font-bold text-text-main uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-accent-green" />
                  Descubrimiento Cruzado de Seguridad Automático
                </h4>
                <p className="text-xs text-text-muted mb-3">
                  Al registrar tu endpoint, Sentinel aprovisionará automáticamente los módulos de auditoría para una cobertura 360°:
                </p>

                <div className="space-y-2.5">
                  {/* Item 1: Uptime */}
                  <label className="flex items-start gap-3 p-3 rounded-xl bg-bg-card border border-border-base/70 cursor-pointer hover:border-accent-green/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={true}
                      disabled
                      className="mt-0.5 rounded text-accent-green focus:ring-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-text-main">
                        <Activity size={13} className="text-accent-green" />
                        <span>Monitoreo Uptime & Latencia HTTP/S</span>
                      </div>
                      <p className="text-[11px] text-text-dim mt-0.5">
                        Métricas de disponibilidad SLA en tiempo real, sparklines y alertas si el servicio cae.
                      </p>
                    </div>
                  </label>

                  {/* Item 2: SSL */}
                  <label
                    onClick={() => setEnableSSL(!enableSSL)}
                    className="flex items-start gap-3 p-3 rounded-xl bg-bg-card border border-border-base/70 cursor-pointer hover:border-accent-green/40 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={enableSSL}
                      onChange={() => {}}
                      className="mt-0.5 rounded text-accent-green focus:ring-0 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-text-main">
                        <Lock size={13} className="text-sky-400" />
                        <span>Vigilancia Criptográfica SSL / TLS</span>
                      </div>
                      <p className="text-[11px] text-text-dim mt-0.5">
                        Auditoría de vigencia de certificado, emisor, grado de seguridad y alertas 30 días antes del vencimiento.
                      </p>
                    </div>
                  </label>

                  {/* Item 3: Security Headers */}
                  <label
                    onClick={() => setEnableSecurityHeaders(!enableSecurityHeaders)}
                    className="flex items-start gap-3 p-3 rounded-xl bg-bg-card border border-border-base/70 cursor-pointer hover:border-accent-green/40 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={enableSecurityHeaders}
                      onChange={() => {}}
                      className="mt-0.5 rounded text-accent-green focus:ring-0 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-text-main">
                        <Shield size={13} className="text-purple-400" />
                        <span>Análisis de Cabeceras de Seguridad (HSTS, CSP, XFO)</span>
                      </div>
                      <p className="text-[11px] text-text-dim mt-0.5">
                        Detección de vulnerabilidades CWE-200, fugas de versión en encabezados y calificación criptográfica.
                      </p>
                    </div>
                  </label>

                  {/* Item 4: DNS */}
                  <label
                    onClick={() => setEnableDNS(!enableDNS)}
                    className="flex items-start gap-3 p-3 rounded-xl bg-bg-card border border-border-base/70 cursor-pointer hover:border-accent-green/40 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={enableDNS}
                      onChange={() => {}}
                      className="mt-0.5 rounded text-accent-green focus:ring-0 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-text-main">
                        <Server size={13} className="text-emerald-400" />
                        <span>Resolución & Mutaciones DNS</span>
                      </div>
                      <p className="text-[11px] text-text-dim mt-0.5">
                        Supervisión de registros A/CNAME, latencia de resolución en milisegundos y prevención de secuestro.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Summary notice */}
              <div className="p-3 bg-accent-green/10 border border-accent-green/20 rounded-xl text-xs text-text-main flex items-center gap-2.5">
                <CheckCircle2 size={16} className="text-accent-green shrink-0" />
                <span>
                  Las 6 reglas de alerta automáticas se vincularán inmediatamente a este objetivo.
                </span>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-center py-6 space-y-4 animate-in fade-in zoom-in-95 duration-300">
              <div className="w-16 h-16 rounded-full bg-accent-green/20 border border-accent-green/40 flex items-center justify-center mx-auto shadow-lg shadow-accent-green/20">
                <Check className="text-accent-green" size={32} strokeWidth={3} />
              </div>
              <div>
                <h4 className="text-xl font-extrabold text-text-main">
                  ¡Objetivo Registrado & Observabilidad en Vivo!
                </h4>
                <p className="text-xs text-text-muted mt-1 max-w-md mx-auto">
                  Hemos enviado el primer escaneo de telemetría a los motores de Sentinel. Puedes monitorear la salud en tiempo real desde el tablero principal.
                </p>
              </div>

              <div className="bg-bg-dark border border-border-base rounded-2xl p-4 text-left max-w-md mx-auto text-xs space-y-2 font-mono">
                <div className="flex justify-between border-b border-border-base/50 pb-1.5">
                  <span className="text-text-dim">Nombre:</span>
                  <span className="text-text-main font-bold">{name || url}</span>
                </div>
                <div className="flex justify-between border-b border-border-base/50 pb-1.5">
                  <span className="text-text-dim">Endpoint:</span>
                  <span className="text-accent-green truncate max-w-[200px]">{url}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-dim">Frecuencia:</span>
                  <span className="text-text-muted">Cada {interval}s</span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full max-w-md mx-auto py-3 px-6 rounded-xl font-bold text-sm bg-accent-green hover:bg-accent-green/90 text-black shadow-lg shadow-accent-green/20 transition-all flex items-center justify-center gap-2"
              >
                <span>Ir al Tablero Principal</span>
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer (Steps 1 & 2) */}
        {step < 3 && (
          <div className="px-6 py-4 bg-bg-dark/80 border-t border-border-base flex items-center justify-between">
            {step === 1 ? (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-text-muted hover:text-text-main hover:bg-bg-card transition-colors"
              >
                Omitir por ahora
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-text-muted hover:text-text-main hover:bg-bg-card transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft size={14} />
                <span>Atrás</span>
              </button>
            )}

            {step === 1 ? (
              <button
                type="button"
                disabled={!url.trim()}
                onClick={() => setStep(2)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-accent-green hover:bg-accent-green/90 text-black shadow-md shadow-accent-green/20 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <span>Siguiente: Cobertura</span>
                <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                disabled={launchMutation.isPending}
                onClick={() => launchMutation.mutate()}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-accent-green hover:bg-accent-green/90 text-black shadow-lg shadow-accent-green/20 transition-all flex items-center gap-2 disabled:opacity-60"
              >
                {launchMutation.isPending ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Lanzando Monitoreo...</span>
                  </>
                ) : (
                  <>
                    <Rocket size={15} />
                    <span>Lanzar Monitoreo (1-Clic)</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
