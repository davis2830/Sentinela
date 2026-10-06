import type { AgentProbe } from '../types/agent_probe';
import type { Alert } from '../types/alerts';
import type { APICheckTarget } from '../types/api_checks';
import type { DNSRecord } from '../types/dns';
import type { DomainInfo } from '../types/domain';
import type { Incident } from '../types/incidents';
import type { MonitoringTarget } from '../types/monitoring';
import type { SecurityHeaderTarget } from '../types/security_headers';
import type { SSLCertificate } from '../types/ssl';

export type DashboardResourceType =
  | 'monitoring'
  | 'api_check'
  | 'ssl'
  | 'domain'
  | 'dns'
  | 'security'
  | 'alert'
  | 'incident'
  | 'agent';

export type DashboardModuleFilter =
  | 'web'
  | 'api'
  | 'tcp'
  | 'ssl'
  | 'dns'
  | 'domain'
  | 'security'
  | 'agent'
  | 'alerts';

export type DashboardHealthFilter = 'healthy' | 'degraded' | 'down' | 'unknown';
export type DashboardSeverity = 'critical' | 'warning' | 'healthy' | 'unknown';

export interface DashboardFilterState {
  view: 'attention' | 'all';
  health: DashboardHealthFilter | null;
  module: DashboardModuleFilter | null;
}

export type DashboardRawItem =
  | MonitoringTarget
  | APICheckTarget
  | SSLCertificate
  | DomainInfo
  | DNSRecord
  | SecurityHeaderTarget
  | Alert
  | Incident
  | AgentProbe;

export interface DashboardAttentionItem {
  key: string;
  id: string;
  type: DashboardResourceType;
  module: DashboardModuleFilter;
  moduleLabel: string;
  title: string;
  subtitle: string;
  severity: DashboardSeverity;
  health: DashboardHealthFilter;
  statusLabel: string;
  metricLabel?: string;
  occurredAt: number | null;
  urgencyAt: number | null;
  path: string;
  canScan: boolean;
  linkedAlertsCount?: number;
  details: Array<{ label: string; value: string }>;
  raw: DashboardRawItem;
}

export interface DashboardActivityEvent {
  id: string;
  title: string;
  description: string;
  occurredAt: number;
  category: 'operations' | 'changes';
  severity: DashboardSeverity;
  type: DashboardResourceType | 'audit';
  path: string;
}

export interface AuditLogItem {
  id: string;
  user_email?: string;
  action: string;
  module: string;
  result: string;
  ip_address?: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface DashboardSourceData {
  monitoring: MonitoringTarget[];
  apiChecks: APICheckTarget[];
  ssl: SSLCertificate[];
  domains: DomainInfo[];
  dns: DNSRecord[];
  security: SecurityHeaderTarget[];
  alerts: Alert[];
  incidents: Incident[];
  agents: AgentProbe[];
}

const moduleMeta: Record<DashboardModuleFilter, { label: string; path: string }> = {
  web: { label: 'Web', path: '/monitoring' },
  api: { label: 'API', path: '/api-checks' },
  tcp: { label: 'TCP', path: '/monitoring' },
  ssl: { label: 'SSL', path: '/ssl' },
  dns: { label: 'DNS', path: '/dns' },
  domain: { label: 'Dominios', path: '/domains' },
  security: { label: 'Seguridad', path: '/security-headers' },
  agent: { label: 'Sentinine', path: '/monitoring' },
  alerts: { label: 'Alertas', path: '/alerts' },
};

export const dashboardModuleMeta = moduleMeta;

const toEpoch = (value?: string | null) => {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

const displayDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' }) : 'Sin datos';

const makeItem = (
  item: Omit<DashboardAttentionItem, 'moduleLabel' | 'path'> & {
    moduleLabel?: string;
    path?: string;
  },
): DashboardAttentionItem => ({
  ...item,
  moduleLabel: item.moduleLabel ?? moduleMeta[item.module].label,
  path: item.path ?? moduleMeta[item.module].path,
});

export function buildDashboardItems(source: DashboardSourceData): DashboardAttentionItem[] {
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const openIncidentIds = new Set(source.incidents.map((incident) => incident.id));
  const alertsByIncident = new Map<string, number>();
  source.alerts.forEach((alert) => {
    if (alert.incident_id && openIncidentIds.has(alert.incident_id)) {
      alertsByIncident.set(alert.incident_id, (alertsByIncident.get(alert.incident_id) ?? 0) + 1);
    }
  });

  const result: DashboardAttentionItem[] = [];

  source.monitoring.forEach((target) => {
    const status = target.last_status?.toLowerCase() ?? 'unknown';
    const critical = status === 'down' || status === 'error';
    const warning = status === 'slow';
    const healthy = status === 'up';
    const module: DashboardModuleFilter = target.target_type === 'tcp' ? 'tcp' : 'web';
    result.push(
      makeItem({
        key: `monitoring:${target.id}`,
        id: target.id,
        type: 'monitoring',
        module,
        title: target.name,
        subtitle: target.endpoint,
        severity: critical ? 'critical' : warning ? 'warning' : healthy ? 'healthy' : 'unknown',
        health: critical ? 'down' : warning ? 'degraded' : healthy ? 'healthy' : 'unknown',
        statusLabel: critical ? 'Servicio caído' : warning ? 'Latencia degradada' : healthy ? 'Operativo' : 'Sin datos',
        metricLabel: target.last_latency != null ? `${Math.round(target.last_latency)} ms` : undefined,
        occurredAt: toEpoch(target.last_checked_at),
        urgencyAt: toEpoch(target.last_checked_at),
        canScan: true,
        details: [
          { label: 'Tipo', value: target.target_type.toUpperCase() },
          { label: 'Última medición', value: displayDate(target.last_checked_at) },
          { label: 'Latencia', value: target.last_latency != null ? `${Math.round(target.last_latency)} ms` : 'Sin datos' },
          { label: 'Ejecución', value: target.runner_type === 'agent' ? 'Sentinine' : 'Cloud' },
        ],
        raw: target,
      }),
    );
  });

  source.apiChecks.forEach((target) => {
    const status = target.last_status?.toLowerCase() ?? 'unknown';
    const critical = status === 'fail' || status === 'error';
    const warning = status === 'slow';
    const healthy = status === 'pass' || status === 'up';
    result.push(
      makeItem({
        key: `api_check:${target.id}`,
        id: target.id,
        type: 'api_check',
        module: 'api',
        title: target.name,
        subtitle: `${target.method} ${target.url}`,
        severity: critical ? 'critical' : warning ? 'warning' : healthy ? 'healthy' : 'unknown',
        health: critical ? 'down' : warning ? 'degraded' : healthy ? 'healthy' : 'unknown',
        statusLabel: critical ? 'Check fallido' : warning ? 'Respuesta lenta' : healthy ? 'Operativo' : 'Sin datos',
        metricLabel: target.last_response_time_ms != null ? `${Math.round(target.last_response_time_ms)} ms` : undefined,
        occurredAt: toEpoch(target.last_checked_at),
        urgencyAt: toEpoch(target.last_checked_at),
        canScan: true,
        details: [
          { label: 'Método', value: target.method },
          { label: 'HTTP', value: target.last_http_status?.toString() ?? 'Sin datos' },
          { label: 'Última medición', value: displayDate(target.last_checked_at) },
          { label: 'Latencia', value: target.last_response_time_ms != null ? `${Math.round(target.last_response_time_ms)} ms` : 'Sin datos' },
        ],
        raw: target,
      }),
    );
  });

  source.ssl.forEach((certificate) => {
    const days = certificate.days_remaining;
    const critical = !certificate.is_valid || (days != null && days <= 0);
    const warning = !critical && days != null && days <= 30;
    const unknown = !certificate.last_scanned_at;
    result.push(
      makeItem({
        key: `ssl:${certificate.id}`,
        id: certificate.id,
        type: 'ssl',
        module: 'ssl',
        title: certificate.domain,
        subtitle: certificate.issuer || 'Certificado TLS',
        severity: unknown ? 'unknown' : critical ? 'critical' : warning ? 'warning' : 'healthy',
        health: unknown ? 'unknown' : critical ? 'down' : warning ? 'degraded' : 'healthy',
        statusLabel: unknown ? 'Sin escanear' : !certificate.is_valid ? 'Certificado inválido' : critical ? 'Certificado vencido' : warning ? 'Vence pronto' : 'Vigente',
        metricLabel: days != null ? `${days} días` : undefined,
        occurredAt: toEpoch(certificate.last_scanned_at),
        urgencyAt: toEpoch(certificate.expiration_date),
        canScan: true,
        details: [
          { label: 'Validez', value: certificate.is_valid ? 'Válido' : 'Inválido' },
          { label: 'Vencimiento', value: displayDate(certificate.expiration_date) },
          { label: 'Días restantes', value: days?.toString() ?? 'Sin datos' },
          { label: 'Último escaneo', value: displayDate(certificate.last_scanned_at) },
        ],
        raw: certificate,
      }),
    );
  });

  source.domains.forEach((domain) => {
    const days = domain.days_until_expiration;
    const critical = (days != null && days <= 0) || Boolean(domain.error_message);
    const warning = !critical && ((days != null && days <= 30) || domain.is_locked === false);
    const unknown = !domain.last_scanned_at;
    result.push(
      makeItem({
        key: `domain:${domain.id}`,
        id: domain.id,
        type: 'domain',
        module: 'domain',
        title: domain.domain,
        subtitle: domain.registrar || 'Registro de dominio',
        severity: unknown ? 'unknown' : critical ? 'critical' : warning ? 'warning' : 'healthy',
        health: unknown ? 'unknown' : critical ? 'down' : warning ? 'degraded' : 'healthy',
        statusLabel: unknown ? 'Sin escanear' : critical ? 'Dominio vencido o inválido' : domain.is_locked === false ? 'Dominio desbloqueado' : warning ? 'Vence pronto' : 'Protegido',
        metricLabel: days != null ? `${days} días` : undefined,
        occurredAt: toEpoch(domain.last_scanned_at),
        urgencyAt: toEpoch(domain.expiration_date),
        canScan: true,
        details: [
          { label: 'Registrador', value: domain.registrar || 'Sin datos' },
          { label: 'Vencimiento', value: displayDate(domain.expiration_date) },
          { label: 'Bloqueo', value: domain.is_locked === false ? 'Desactivado' : 'Activo' },
          { label: 'Último escaneo', value: displayDate(domain.last_scanned_at) },
        ],
        raw: domain,
      }),
    );
  });

  source.dns.forEach((record) => {
    const changedAt = toEpoch(record.last_change_at);
    const warning = changedAt != null && changedAt >= oneDayAgo;
    const unknown = !record.last_scanned_at;
    result.push(
      makeItem({
        key: `dns:${record.id}`,
        id: record.id,
        type: 'dns',
        module: 'dns',
        title: `${record.domain} · ${record.record_type}`,
        subtitle: record.value || 'Registro sin valor',
        severity: unknown ? 'unknown' : warning ? 'warning' : 'healthy',
        health: unknown ? 'unknown' : warning ? 'degraded' : 'healthy',
        statusLabel: unknown ? 'Sin escanear' : warning ? 'Modificado en 24 h' : 'Sin cambios recientes',
        metricLabel: record.ttl != null ? `TTL ${record.ttl}` : undefined,
        occurredAt: changedAt ?? toEpoch(record.last_scanned_at),
        urgencyAt: changedAt ?? toEpoch(record.last_scanned_at),
        canScan: true,
        details: [
          { label: 'Tipo', value: record.record_type },
          { label: 'Valor', value: record.value || 'Sin datos' },
          { label: 'Último cambio', value: displayDate(record.last_change_at) },
          { label: 'Último escaneo', value: displayDate(record.last_scanned_at) },
        ],
        raw: record,
      }),
    );
  });

  source.security.forEach((target) => {
    const unknown = target.last_score == null;
    const warning = !unknown && (target.last_score! < 70 || target.info_leak_detected);
    result.push(
      makeItem({
        key: `security:${target.id}`,
        id: target.id,
        type: 'security',
        module: 'security',
        title: target.name,
        subtitle: target.url,
        severity: unknown ? 'unknown' : warning ? 'warning' : 'healthy',
        health: unknown ? 'unknown' : warning ? 'degraded' : 'healthy',
        statusLabel: unknown ? 'Sin analizar' : target.info_leak_detected ? 'Fuga de información' : warning ? 'Postura deficiente' : 'Postura adecuada',
        metricLabel: target.last_score != null ? `${target.last_score}/100` : undefined,
        occurredAt: toEpoch(target.last_checked_at),
        urgencyAt: toEpoch(target.last_checked_at),
        canScan: true,
        details: [
          { label: 'Score', value: target.last_score != null ? `${target.last_score}/100` : 'Sin datos' },
          { label: 'Grado', value: target.last_grade || 'Sin datos' },
          { label: 'Fuga', value: target.info_leak_detected ? 'Detectada' : 'No detectada' },
          { label: 'Último análisis', value: displayDate(target.last_checked_at) },
        ],
        raw: target,
      }),
    );
  });

  source.agents.forEach((agent) => {
    const online = agent.is_online || agent.status === 'online';
    result.push(
      makeItem({
        key: `agent:${agent.id}`,
        id: agent.id,
        type: 'agent',
        module: 'agent',
        title: agent.name,
        subtitle: agent.hostname || agent.ip_address || 'Agente Sentinine',
        severity: online ? 'healthy' : 'critical',
        health: online ? 'healthy' : 'down',
        statusLabel: online ? 'En línea' : 'Agente offline',
        metricLabel: `${agent.assigned_targets_count} targets`,
        occurredAt: toEpoch(agent.last_heartbeat),
        urgencyAt: toEpoch(agent.last_heartbeat),
        canScan: false,
        details: [
          { label: 'Estado', value: online ? 'En línea' : 'Offline' },
          { label: 'Último heartbeat', value: displayDate(agent.last_heartbeat) },
          { label: 'Versión', value: agent.version || 'Sin datos' },
          { label: 'Targets asignados', value: agent.assigned_targets_count.toString() },
        ],
        raw: agent,
      }),
    );
  });

  source.incidents.forEach((incident) => {
    const critical = incident.priority === 'critical';
    const linkedAlertsCount = Math.max(incident.alerts_count || 0, alertsByIncident.get(incident.id) ?? 0);
    result.push(
      makeItem({
        key: `incident:${incident.id}`,
        id: incident.id,
        type: 'incident',
        module: 'alerts',
        title: incident.title,
        subtitle: incident.impacted_service || incident.description || 'Incidente activo',
        severity: critical ? 'critical' : 'warning',
        health: critical ? 'down' : 'degraded',
        statusLabel: `Incidente ${incident.status}`,
        metricLabel: linkedAlertsCount ? `${linkedAlertsCount} alertas` : undefined,
        occurredAt: toEpoch(incident.opened_at),
        urgencyAt: toEpoch(incident.opened_at),
        canScan: false,
        linkedAlertsCount,
        path: '/incidents',
        details: [
          { label: 'Prioridad', value: incident.priority },
          { label: 'Estado', value: incident.status },
          { label: 'Abierto', value: displayDate(incident.opened_at) },
          { label: 'Alertas vinculadas', value: linkedAlertsCount.toString() },
        ],
        raw: incident,
      }),
    );
  });

  source.alerts.forEach((alert) => {
    if (alert.incident_id && openIncidentIds.has(alert.incident_id)) return;
    const critical = alert.severity === 'critical';
    result.push(
      makeItem({
        key: `alert:${alert.id}`,
        id: alert.id,
        type: 'alert',
        module: 'alerts',
        title: alert.title,
        subtitle: alert.message,
        severity: critical ? 'critical' : 'warning',
        health: critical ? 'down' : 'degraded',
        statusLabel: `Alerta ${alert.severity}`,
        metricLabel: alert.occurrence_count > 1 ? `${alert.occurrence_count} ocurrencias` : undefined,
        occurredAt: toEpoch(alert.triggered_at),
        urgencyAt: toEpoch(alert.triggered_at),
        canScan: false,
        details: [
          { label: 'Severidad', value: alert.severity },
          { label: 'Estado', value: alert.status },
          { label: 'Disparada', value: displayDate(alert.triggered_at) },
          { label: 'Ocurrencias', value: alert.occurrence_count.toString() },
        ],
        raw: alert,
      }),
    );
  });

  const rank: Record<DashboardSeverity, number> = { critical: 0, warning: 1, healthy: 2, unknown: 3 };
  return result.sort((left, right) => {
    const severity = rank[left.severity] - rank[right.severity];
    if (severity !== 0) return severity;
    const leftTime = left.urgencyAt ?? Number.MAX_SAFE_INTEGER;
    const rightTime = right.urgencyAt ?? Number.MAX_SAFE_INTEGER;
    if (leftTime !== rightTime) return leftTime - rightTime;
    return left.title.localeCompare(right.title);
  });
}

const pathForAuditModule = (module: string) => {
  const normalized = module.toLowerCase();
  if (normalized.includes('monitor')) return '/monitoring';
  if (normalized.includes('api')) return '/api-checks';
  if (normalized.includes('ssl')) return '/ssl';
  if (normalized.includes('dns')) return '/dns';
  if (normalized.includes('domain')) return '/domains';
  if (normalized.includes('incident')) return '/incidents';
  if (normalized.includes('alert')) return '/alerts';
  if (normalized.includes('security')) return '/security-headers';
  return '/audit-logs';
};

export function buildDashboardActivityEvents(
  source: DashboardSourceData,
  auditLogs: AuditLogItem[],
): DashboardActivityEvent[] {
  const events: DashboardActivityEvent[] = [];

  buildDashboardItems(source)
    .filter((item) => item.occurredAt != null)
    .forEach((item) => {
      events.push({
        id: `operation:${item.key}`,
        title: item.title,
        description: `${item.moduleLabel} · ${item.statusLabel}${item.metricLabel ? ` · ${item.metricLabel}` : ''}`,
        occurredAt: item.occurredAt!,
        category: 'operations',
        severity: item.severity,
        type: item.type,
        path: item.path,
      });
    });

  auditLogs.forEach((log) => {
    const occurredAt = toEpoch(log.timestamp);
    if (occurredAt == null) return;
    events.push({
      id: `audit:${log.id}`,
      title: log.action || 'Cambio auditado',
      description: log.description || `${log.module} · ${log.result}`,
      occurredAt,
      category: 'changes',
      severity: log.result?.toLowerCase() === 'failure' ? 'warning' : 'healthy',
      type: 'audit',
      path: pathForAuditModule(log.module || ''),
    });
  });

  return events.sort((left, right) => right.occurredAt - left.occurredAt);
}

export const isAttentionItem = (item: DashboardAttentionItem) =>
  item.severity === 'critical' || item.severity === 'warning';

