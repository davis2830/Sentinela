import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import type {
  AlertRule,
  CreateAlertRuleData,
  AlertTargetType,
  AlertCondition,
  AlertSeverity,
} from '../../types/alerts';
import type { MonitoringTarget } from '../../types/monitoring';
import { X, Loader2, BellRing } from 'lucide-react';

interface AlertRuleFormProps {
  rule?: AlertRule | null;
  onSubmit: (data: CreateAlertRuleData) => Promise<void>;
  onClose: () => void;
}

const TARGET_TYPES: { value: AlertTargetType; label: string }[] = [
  { value: 'ssl', label: 'Certificados SSL' },
  { value: 'monitoring', label: 'Uptime & Latencia' },
  { value: 'dns', label: 'Registros DNS' },
  { value: 'domain', label: 'Dominios WHOIS' },
  { value: 'api_check', label: 'API Endpoints' },
  { value: 'security_headers', label: 'Security Headers' },
];

const CONDITIONS: { value: AlertCondition; label: string }[] = [
  { value: 'status_down', label: 'Servicio Caído (Status Down)' },
  { value: 'ssl_expiring', label: 'Certificado SSL por Expirar (días)' },
  { value: 'uptime_below', label: 'Uptime Menor al Umbral (%)' },
  { value: 'response_time_above', label: 'Tiempo de Respuesta Mayor a (ms)' },
  { value: 'dns_changed', label: 'Cambio Detectado en Registro DNS' },
  { value: 'domain_expiring', label: 'Dominio WHOIS por Expirar (días)' },
  { value: 'security_score_below', label: 'Puntuación Security Headers Menor a' },
  { value: 'api_check_failed', label: 'Falló Validación de API Check' },
];

const SEVERITIES: AlertSeverity[] = ['critical', 'warning', 'info'];

export default function AlertRuleForm({ rule, onSubmit, onClose }: AlertRuleFormProps) {
  const [name, setName] = useState('');
  const [targetType, setTargetType] = useState<AlertTargetType>('monitoring');
  const [condition, setCondition] = useState<AlertCondition>('status_down');
  const [threshold, setThreshold] = useState<number>(0);
  const [severity, setSeverity] = useState<AlertSeverity>('warning');
  const [targetId, setTargetId] = useState<string>('');
  const [enabled, setEnabled] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState(false);

  // Fetch monitoring targets for target_id dropdown selection
  const { data: monitoringTargets } = useQuery({
    queryKey: ['monitoring-targets'],
    queryFn: async () => {
      const response = await api.get('monitoring/');
      return (response.data?.data || []) as MonitoringTarget[];
    },
    enabled: targetType === 'monitoring',
  });

  useEffect(() => {
    if (rule) {
      setName(rule.name);
      setTargetType(rule.target_type);
      setCondition(rule.condition);
      setThreshold(rule.threshold);
      setSeverity(rule.severity);
      setTargetId(rule.target_id || '');
      setEnabled(rule.enabled);
    } else {
      setName('');
      setTargetType('monitoring');
      setCondition('status_down');
      setThreshold(0);
      setSeverity('warning');
      setTargetId('');
      setEnabled(true);
    }
  }, [rule]);

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
        className="bg-bg-card border border-border-base rounded-2xl p-6 w-full max-w-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
            <BellRing size={20} className="text-accent-green" />
            {rule ? 'Editar Regla de Alerta' : 'Nueva Regla de Alerta'}
          </h2>
          <button onClick={onClose} className="p-1.5 text-text-muted hover:text-text-main rounded-full hover:bg-bg-dark transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">
              Nombre de la Regla
            </label>
            <input
              type="text"
              required
              placeholder="ej. Alerta SSL Crítica < 15 días"
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
                onChange={(e) => {
                  setTargetType(e.target.value as AlertTargetType);
                  setTargetId('');
                }}
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
                Severidad
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as AlertSeverity)}
                className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green"
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s === 'critical' ? 'Crítica' : s === 'warning' ? 'Advertencia' : 'Informativa'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">
              Aplicar a Target Específico
            </label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-sans"
            >
              <option value="">Todos los targets (Regla Global)</option>
              {targetType === 'monitoring' &&
                (monitoringTargets || []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.endpoint})
                  </option>
                ))}
            </select>
            <p className="text-xs text-text-dim mt-1">
              Selecciona un target específico o aplica la regla de forma global a todos.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">
              Condición de Disparo
            </label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value as AlertCondition)}
              className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-sans"
            >
              {CONDITIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">
              Valor Umbral (Threshold)
            </label>
            <input
              type="number"
              required
              step="any"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-mono"
            />
            <p className="text-xs text-text-dim mt-1.5">
              Valor numérico de referencia (ej. 15 días, 95%, 2000 ms).
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="enabledRule"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-4 h-4 rounded bg-bg-dark border-border-base text-accent-green focus:ring-accent-green focus:ring-offset-bg-dark cursor-pointer"
            />
            <label htmlFor="enabledRule" className="text-sm font-medium text-text-main cursor-pointer">
              Regla Activa
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
              {submitting ? <Loader2 className="animate-spin" size={18} /> : rule ? 'Actualizar' : 'Crear Regla'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
