import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import type {
  AlertRule,
  CreateAlertRuleData,
  AlertTargetType,
  AlertCondition,
  AlertSeverity,
  SimulateRuleResult,
} from '../../types/alerts';
import {
  X,
  Loader2,
  BellRing,
  Zap,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Play,
} from 'lucide-react';

interface AlertRuleFormProps {
  rule?: AlertRule | null;
  onSubmit: (data: CreateAlertRuleData) => Promise<void>;
  onClose: () => void;
}

const TARGET_TYPES: { value: AlertTargetType; label: string }[] = [
  { value: 'monitoring', label: 'Uptime & Latencia' },
  { value: 'ssl', label: 'Certificados SSL' },
  { value: 'dns', label: 'Registros DNS' },
  { value: 'domain', label: 'Dominios WHOIS' },
  { value: 'api_check', label: 'API Endpoints' },
  { value: 'security_headers', label: 'Cabeceras de Seguridad' },
];

const CONDITIONS_BY_TARGET_TYPE: Record<AlertTargetType, { value: AlertCondition; label: string; unit: string; defaultThreshold: number }[]> = {
  monitoring: [
    { value: 'status_down', label: 'Servicio Caído (Status Down)', unit: '', defaultThreshold: 0 },
    { value: 'response_time_above', label: 'Tiempo de Respuesta Mayor a (ms)', unit: 'ms', defaultThreshold: 1000 },
    { value: 'uptime_below', label: 'Uptime Menor al Umbral SLA (%)', unit: '%', defaultThreshold: 99.0 },
  ],
  ssl: [
    { value: 'ssl_expiring', label: 'Certificado SSL por Expirar (días)', unit: 'días', defaultThreshold: 30 },
    { value: 'ssl_grade_below', label: 'Calificación TLS por debajo de Grado A', unit: '', defaultThreshold: 0 },
    { value: 'ssl_invalid', label: 'Certificado Inválido o Error TLS', unit: '', defaultThreshold: 0 },
  ],
  dns: [
    { value: 'dns_changed', label: 'Mutación Detectada en Registro DNS (24h)', unit: '', defaultThreshold: 0 },
    { value: 'dns_latency_above', label: 'Latencia de Resolución DNS Mayor a (ms)', unit: 'ms', defaultThreshold: 150 },
  ],
  domain: [
    { value: 'domain_expiring', label: 'Dominio WHOIS por Expirar (días)', unit: 'días', defaultThreshold: 30 },
    { value: 'domain_unlocked', label: 'Candado Anti-Robo EPP Desactivado', unit: '', defaultThreshold: 0 },
  ],
  api_check: [
    { value: 'api_check_failed', label: 'Falló Petición / Validación de API Check', unit: '', defaultThreshold: 0 },
    { value: 'api_latency_above', label: 'Latencia de Petición API Mayor a (ms)', unit: 'ms', defaultThreshold: 2000 },
  ],
  security_headers: [
    { value: 'security_score_below', label: 'Puntuación de Cabeceras Menor a (pts)', unit: 'pts', defaultThreshold: 70 },
    { value: 'security_leak_detected', label: 'Fuga de Stack / Versión de Servidor Detectada', unit: '', defaultThreshold: 0 },
  ],
};

const SEVERITIES: AlertSeverity[] = ['critical', 'warning', 'info'];

export default function AlertRuleForm({ rule, onSubmit, onClose }: AlertRuleFormProps) {
  const [name, setName] = useState('');
  const [targetType, setTargetType] = useState<AlertTargetType>('monitoring');
  const [condition, setCondition] = useState<AlertCondition>('status_down');
  const [threshold, setThreshold] = useState<number>(0);
  const [severity, setSeverity] = useState<AlertSeverity>('warning');
  const [targetId, setTargetId] = useState<string>('');
  const [cooldownMinutes, setCooldownMinutes] = useState<number>(15);
  const [autoResolve, setAutoResolve] = useState<boolean>(true);
  const [enabled, setEnabled] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState(false);

  // Simulation state
  const [simulating, setSimulating] = useState(false);
  const [simulateResult, setSimulateResult] = useState<SimulateRuleResult | null>(null);
  const [simulateError, setSimulateError] = useState<string | null>(null);

  // Target queries for each module
  const { data: monitoringTargets } = useQuery({
    queryKey: ['monitoring-targets'],
    queryFn: async () => {
      const res = await api.get('monitoring/');
      return (res.data?.data || []) as { id: string; name: string; endpoint: string }[];
    },
    enabled: targetType === 'monitoring',
  });

  const { data: sslTargets } = useQuery({
    queryKey: ['ssl-targets'],
    queryFn: async () => {
      const res = await api.get('ssl-certificates/');
      return (res.data?.data || []) as { id: string; domain: string }[];
    },
    enabled: targetType === 'ssl',
  });

  const { data: dnsTargets } = useQuery({
    queryKey: ['dns-targets'],
    queryFn: async () => {
      const res = await api.get('dns-records/');
      return (res.data?.data || []) as { id: string; domain: string; record_type: string }[];
    },
    enabled: targetType === 'dns',
  });

  const { data: domainTargets } = useQuery({
    queryKey: ['domain-targets'],
    queryFn: async () => {
      const res = await api.get('domains/');
      return (res.data?.data || []) as { id: string; domain: string }[];
    },
    enabled: targetType === 'domain',
  });

  const { data: apiCheckTargets } = useQuery({
    queryKey: ['api-check-targets'],
    queryFn: async () => {
      const res = await api.get('api-checks/');
      return (res.data?.data || []) as { id: string; name: string; url: string }[];
    },
    enabled: targetType === 'api_check',
  });

  const { data: headerTargets } = useQuery({
    queryKey: ['header-targets'],
    queryFn: async () => {
      const res = await api.get('security-headers/');
      return (res.data?.data || []) as { id: string; name: string; url: string }[];
    },
    enabled: targetType === 'security_headers',
  });

  useEffect(() => {
    if (rule) {
      setName(rule.name);
      setTargetType(rule.target_type);
      setCondition(rule.condition);
      setThreshold(rule.threshold);
      setSeverity(rule.severity);
      setTargetId(rule.target_id || '');
      setCooldownMinutes(rule.cooldown_minutes ?? 15);
      setAutoResolve(rule.auto_resolve ?? true);
      setEnabled(rule.enabled);
    } else {
      setName('');
      setTargetType('monitoring');
      setCondition('status_down');
      setThreshold(0);
      setSeverity('warning');
      setTargetId('');
      setCooldownMinutes(15);
      setAutoResolve(true);
      setEnabled(true);
    }
    setSimulateResult(null);
    setSimulateError(null);
  }, [rule]);

  // When target type changes, update condition to first relevant condition
  const handleTargetTypeChange = (newType: AlertTargetType) => {
    setTargetType(newType);
    setTargetId('');
    const available = CONDITIONS_BY_TARGET_TYPE[newType] || [];
    if (available.length > 0) {
      setCondition(available[0].value);
      setThreshold(available[0].defaultThreshold);
    }
    setSimulateResult(null);
    setSimulateError(null);
  };

  const handleConditionChange = (newCond: AlertCondition) => {
    setCondition(newCond);
    const available = CONDITIONS_BY_TARGET_TYPE[targetType] || [];
    const found = available.find((c) => c.value === newCond);
    if (found) {
      setThreshold(found.defaultThreshold);
    }
    setSimulateResult(null);
    setSimulateError(null);
  };

  // Simulate Rule in Memory
  const handleSimulateRule = async () => {
    setSimulating(true);
    setSimulateResult(null);
    setSimulateError(null);

    try {
      const response = await api.post('alert-rules/simulate/', {
        target_type: targetType,
        condition,
        threshold: Number(threshold),
        target_id: targetId || null,
      });
      setSimulateResult(response.data?.data as SimulateRuleResult);
    } catch (err: any) {
      setSimulateError(err?.response?.data?.message || err?.message || 'Error al simular la regla.');
    } finally {
      setSimulating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        target_type: targetType,
        condition,
        threshold: Number(threshold),
        severity,
        enabled,
        target_id: targetId || null,
        cooldown_minutes: Number(cooldownMinutes),
        auto_resolve: autoResolve,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const activeConditionMeta = (CONDITIONS_BY_TARGET_TYPE[targetType] || []).find((c) => c.value === condition);
  const requiresThreshold = activeConditionMeta ? Boolean(activeConditionMeta.unit) : false;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-bg-card border border-border-base rounded-2xl p-6 w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
            <BellRing size={20} className="text-accent-green" />
            {rule ? 'Editar Regla de Alerta Inteligente' : 'Nueva Regla de Alerta Inteligente'}
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
              Nombre Descriptivo de la Regla
            </label>
            <input
              type="text"
              required
              placeholder="ej. Alerta Latencia Alta en API Gateway (>1000ms)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-sans"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5">
                Módulo Objetivo
              </label>
              <select
                value={targetType}
                onChange={(e) => handleTargetTypeChange(e.target.value as AlertTargetType)}
                className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-sans"
              >
                {TARGET_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5">
                Nivel de Severidad
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as AlertSeverity)}
                className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-sans"
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s === 'critical' ? 'Crítica (Inmediata)' : s === 'warning' ? 'Advertencia' : 'Informativa'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">
              Condición de Disparo Inteligente
            </label>
            <select
              value={condition}
              onChange={(e) => handleConditionChange(e.target.value as AlertCondition)}
              className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-sans"
            >
              {(CONDITIONS_BY_TARGET_TYPE[targetType] || []).map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Threshold value input */}
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">
              Valor Umbral {activeConditionMeta?.unit ? `(${activeConditionMeta.unit})` : ''}
            </label>
            <input
              type="number"
              required
              step="any"
              disabled={!requiresThreshold}
              value={threshold}
              onChange={(e) => {
                setThreshold(Number(e.target.value));
                setSimulateResult(null);
              }}
              className={`w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-mono ${
                !requiresThreshold ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            />
            <p className="text-[11px] text-text-dim mt-1.5">
              {requiresThreshold
                ? `Define el límite numérico en ${activeConditionMeta?.unit} para activar la alarma.`
                : 'Esta condición se evalúa como estado booleano (caído / inválido / detectado).'}
            </p>
          </div>

          {/* Target Scoping Selection */}
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">
              Alcance del Objetivo
            </label>
            <select
              value={targetId}
              onChange={(e) => {
                setTargetId(e.target.value);
                setSimulateResult(null);
              }}
              className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-sans"
            >
              <option value="">Todos los objetivos del módulo (Regla Global)</option>

              {targetType === 'monitoring' &&
                (monitoringTargets || []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.endpoint})
                  </option>
                ))}

              {targetType === 'ssl' &&
                (sslTargets || []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.domain}
                  </option>
                ))}

              {targetType === 'dns' &&
                (dnsTargets || []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.domain} ({t.record_type})
                  </option>
                ))}

              {targetType === 'domain' &&
                (domainTargets || []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.domain}
                  </option>
                ))}

              {targetType === 'api_check' &&
                (apiCheckTargets || []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.url})
                  </option>
                ))}

              {targetType === 'security_headers' &&
                (headerTargets || []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.url})
                  </option>
                ))}
            </select>
          </div>

          {/* Smart Rule Simulator Button & Card */}
          <div className="pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-muted">Simulación de Impacto:</span>
              <button
                type="button"
                onClick={handleSimulateRule}
                disabled={simulating}
                className="text-xs font-semibold text-accent-green hover:underline flex items-center gap-1 disabled:opacity-40 transition-colors"
                title="Comprobar qué objetivos activarían esta regla ahora mismo"
              >
                {simulating ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                {simulating ? 'Simulando...' : 'Simular Impacto'}
              </button>
            </div>

            {simulateResult && (
              <div className="mt-2 p-3 bg-bg-dark/90 border border-border-base rounded-xl space-y-2 text-xs animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-border-base/50 pb-1.5">
                  <span className="text-text-muted font-sans font-medium">Resultado de Simulación:</span>
                  <span
                    className={`font-bold font-mono px-2 py-0.5 rounded-full text-[11px] ${
                      simulateResult.would_trigger_count > 0
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {simulateResult.would_trigger_count} de {simulateResult.targets_evaluated} objetivos activarían alarma
                  </span>
                </div>

                {simulateResult.matching_targets.length > 0 ? (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto font-mono text-[11px] pr-1">
                    {simulateResult.matching_targets.map((mt, i) => (
                      <div
                        key={i}
                        className="p-2 bg-bg-card/70 border border-border-base/40 rounded-lg flex items-center justify-between gap-2"
                      >
                        <span className="font-bold text-text-main truncate">{mt.name}</span>
                        <span className="text-amber-400 shrink-0 font-semibold">{mt.current_value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-emerald-300/90 flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="shrink-0 text-accent-green" />
                    Ningún objetivo excede este umbral actualmente. La regla operará en modo preventivo.
                  </p>
                )}
              </div>
            )}

            {simulateError && (
              <div className="mt-2 p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{simulateError}</span>
              </div>
            )}
          </div>

          {/* Cooldown & Auto-Resolve Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5">
                Cooldown de Notificación (min)
              </label>
              <input
                type="number"
                min="1"
                max="1440"
                value={cooldownMinutes}
                onChange={(e) => setCooldownMinutes(Number(e.target.value))}
                className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:border-accent-green font-mono"
              />
              <p className="text-[10px] text-text-dim mt-1">
                Tiempo mínimo entre re-notificaciones al mismo canal.
              </p>
            </div>

            <div className="flex flex-col justify-center space-y-2 pt-1">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="autoResolveRule"
                  checked={autoResolve}
                  onChange={(e) => setAutoResolve(e.target.checked)}
                  className="w-4 h-4 rounded bg-bg-dark border-border-base text-accent-green focus:ring-accent-green cursor-pointer"
                />
                <label htmlFor="autoResolveRule" className="text-xs font-medium text-text-main cursor-pointer">
                  Auto-resolución al recuperarse
                </label>
              </div>
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="enabledRule"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="w-4 h-4 rounded bg-bg-dark border-border-base text-accent-green focus:ring-accent-green cursor-pointer"
                />
                <label htmlFor="enabledRule" className="text-xs font-medium text-text-main cursor-pointer">
                  Regla de Alerta Activa
                </label>
              </div>
            </div>
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
              ) : rule ? (
                'Actualizar Regla'
              ) : (
                'Crear Regla Inteligente'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
