import type { UITone } from '../components/common/MetricCard';
import type { CoverageModule, CoverageSection } from '../types/endpoint';

export const measuredAt = (resource: Record<string, unknown>) => {
  const stamp = resource.last_scanned_at || resource.last_checked_at;
  return typeof stamp === 'string' && Number.isFinite(Date.parse(stamp)) ? stamp : null;
};
export const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
/** A measured status takes precedence; a numeric threshold alone detects degradation. */
export const latencyTone = (value: unknown, threshold?: unknown, status?: string | null): UITone => {
  if (!finite(value) || value < 0) return 'muted';
  if (status === 'down' || status === 'error') return 'danger';
  if (status === 'slow') return 'warning';
  if (status === 'up') return 'success';
  if (finite(threshold) && threshold > 0) return value > threshold ? 'warning' : 'success';
  return 'muted';
};
export const formatMetric = (n: number, decimals = 0) => n.toLocaleString('es-GT', {
  minimumFractionDigits: decimals, maximumFractionDigits: decimals,
});
export const uptimeTone = (n: unknown): UITone => !finite(n) || n < 0 || n > 100 ? 'muted' : n >= 99.9 ? 'success' : n >= 99 ? 'warning' : 'danger';
export const securityTone = (n: unknown): UITone => !finite(n) || n < 0 || n > 100 ? 'muted' : n < 50 ? 'danger' : n < 70 ? 'warning' : 'success';

export function coveragePresentation(module: CoverageModule, section?: CoverageSection) {
  if (!section) return { value: '—', caption: 'Sin datos de cobertura', tone: 'muted' as UITone };
  if (section.status !== 'linked') return {
    value: section.status === 'not_applicable' ? 'No aplica' : section.status === 'needs_review' ? 'Revisar vínculo' : section.candidates.length ? 'Sin vincular' : 'Sin configurar',
    caption: section.status === 'needs_review' ? 'La asociación cambió' : section.status === 'not_applicable' ? 'Según protocolo o ejecutor' : 'Sin evaluación disponible',
    tone: 'muted' as UITone,
  };
  const resources = section.resources;
  const measured = resources.filter(r => measuredAt(r));
  if (!measured.length) return { value: 'Sin medición', caption: 'Cobertura vinculada', tone: 'muted' as UITone };
  if (measured.some(r => r.error_message)) return { value: 'Error de medición', caption: 'Revisar el último resultado', tone: 'danger' as UITone };
  const first = measured[0];
  if (module === 'ssl') {
    if (first.is_valid === false) return { value: 'Inválido', caption: 'Certificado TLS', tone: 'danger' as UITone };
    if (finite(first.days_remaining)) return {
      value: `${formatMetric(first.days_remaining)} días`, caption: 'Vigencia del certificado',
      tone: (first.days_remaining <= 7 ? 'danger' : first.days_remaining <= 30 ? 'warning' : first.is_valid === true ? 'success' : 'muted') as UITone,
    };
    return { value: first.is_valid === true ? 'Válido' : 'Sin evaluación', caption: 'Vigencia no disponible', tone: (first.is_valid === true ? 'success' : 'muted') as UITone };
  }
  if (module === 'domain') return finite(first.days_until_expiration)
    ? { value: `${formatMetric(first.days_until_expiration)} días`, caption: first.is_locked === false ? 'Sin bloqueo de transferencia' : 'Hasta el vencimiento', tone: (first.days_until_expiration <= 7 ? 'danger' : first.days_until_expiration <= 30 || first.is_locked === false ? 'warning' : 'success') as UITone }
    : { value: 'Sin fecha', caption: 'Vencimiento no disponible', tone: 'muted' as UITone };
  if (module === 'security') {
    const tone = securityTone(first.last_score);
    return { value: tone === 'muted' ? 'Sin evaluación' : `${formatMetric(first.last_score as number)}/100`, caption: first.info_leak_detected ? 'Fuga de información' : 'Evaluación de cabeceras', tone: first.info_leak_detected && tone === 'success' ? 'warning' as UITone : tone };
  }
  return { value: `${measured.length} ${measured.length === 1 ? 'registro' : 'registros'}`, caption: `${measured.length} de ${resources.length} medidos`, tone: 'muted' as UITone };
}
