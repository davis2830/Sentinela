import type { Alert } from '../types/alerts';
import type { Incident } from '../types/incidents';
import type { MaintenanceWindow } from '../types/maintenance';
import type { NotificationItem } from '../types/notifications';
import type { ReportItem } from '../types/reports';

export type ManagementPendingItem = { key: string; title: string; detail: string; priority: number; at: number; path: string };
const epoch = (value: string) => Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
const priority = (value: string) => ({critical:0, high:1, warning:1, medium:2, info:3, low:3}[value] ?? 2);
export const activeIncident = (incident: Incident) => !['resolved','closed'].includes(incident.status);
export const unresolvedAlert = (alert: Alert) => alert.status !== 'resolved';
export const recentFailure = (resource: NotificationItem | ReportItem, now: number) => resource.status === 'failed' && epoch(resource.created_at) >= now - 86400000 && epoch(resource.created_at) <= now;

export function managementPending(sources: { alerts?: Alert[]; incidents?: Incident[]; notifications?: NotificationItem[]; reports?: ReportItem[] }, now = Date.now()): ManagementPendingItem[] {
  const incidents = (sources.incidents || []).filter(activeIncident);
  const visibleIds = new Set(incidents.map(i => i.id));
  const items: ManagementPendingItem[] = incidents.map(i => ({key:`incident:${i.id}`,title:i.title, detail:`Incidente · ${i.priority} · ${i.alerts_count} alertas agrupadas`,priority:priority(i.priority),at:epoch(i.opened_at),path:`/incidents?status=${i.status}&resource=${i.id}`}));
  for (const a of sources.alerts || []) if (unresolvedAlert(a) && (!a.incident_id || !visibleIds.has(a.incident_id))) items.push({key:`alert:${a.id}`,title:a.title,detail:`Alerta · ${a.severity} · ${a.status === 'acknowledged' ? 'Reconocida' : 'Activa'}`,priority:priority(a.severity),at:epoch(a.triggered_at),path:`/alerts?status=${a.status}&resource=${a.id}`});
  for (const n of sources.notifications || []) if (recentFailure(n, now)) items.push({key:`notification:${n.id}`,title:n.title,detail:`Notificación fallida · ${n.channel_name || 'Sin canal'}`,priority:priority(n.severity),at:epoch(n.created_at),path:`/notifications?status=failed&resource=${n.id}`});
  for (const r of sources.reports || []) if (recentFailure(r, now)) items.push({key:`report:${r.id}`,title:r.title,detail:'Reporte fallido',priority:2,at:epoch(r.created_at),path:`/reports?status=failed&resource=${r.id}`});
  return items.sort((a,b)=>a.priority-b.priority || a.at-b.at || a.key.localeCompare(b.key));
}
export function managementAgenda(windows?: MaintenanceWindow[], now = Date.now()) {
  return (windows || []).filter(w=>w.status === 'in_progress' || w.status === 'scheduled' && epoch(w.start_time) >= now && epoch(w.start_time) <= now + 7 * 86400000).sort((a,b)=>epoch(a.start_time)-epoch(b.start_time));
}
