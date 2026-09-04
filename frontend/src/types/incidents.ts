export type IncidentPriority = 'critical' | 'high' | 'medium' | 'low';

export type IncidentStatus =
  | 'open'
  | 'investigating'
  | 'identified'
  | 'mitigated'
  | 'resolved'
  | 'closed';

export type IncidentEventType =
  | 'created'
  | 'status_changed'
  | 'priority_changed'
  | 'alert_added'
  | 'note_added'
  | 'assigned'
  | 'rca_updated'
  | 'mitigated'
  | 'resolved'
  | 'closed';

export interface Incident {
  id: string;
  organization: string;
  title: string;
  description: string;
  status: IncidentStatus;
  priority: IncidentPriority;
  assigned_to?: string | null;
  assigned_to_name?: string;
  impacted_service?: string;
  target_type?: string;
  target_id?: string | null;
  root_cause?: string;
  resolution_summary?: string;
  preventive_actions?: string;
  opened_at: string;
  acknowledged_at?: string | null;
  mitigated_at?: string | null;
  resolved_at?: string | null;
  closed_at: string | null;
  alerts_count: number;
  duration_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface CreateIncidentData {
  title: string;
  description?: string;
  priority: IncidentPriority;
  impacted_service?: string;
  target_type?: string;
  target_id?: string | null;
  assigned_to?: string | null;
}

export interface UpdateIncidentData {
  status?: IncidentStatus;
  priority?: IncidentPriority;
  description?: string;
  impacted_service?: string;
  assigned_to?: string | null;
  root_cause?: string;
  resolution_summary?: string;
  preventive_actions?: string;
}

export interface IncidentRCAData {
  root_cause: string;
  resolution_summary?: string;
  preventive_actions?: string;
}

export interface IncidentTimelineEvent {
  id: string;
  incident: string;
  event_type: IncidentEventType;
  description: string;
  old_value: string | null;
  new_value: string | null;
  actor_name?: string;
  occurred_at: string;
}

export interface IncidentAlert {
  id: string;
  incident: string;
  alert_id: string;
  alert_title?: string;
  alert_severity?: string;
  alert_status?: string;
  alert_target_type?: string;
  alert_triggered_at?: string;
  added_at: string;
}

export interface IncidentStats {
  total: number;
  open_count: number;
  in_progress_count: number;
  in_mitigation?: number;
  mitigated_count: number;
  resolved_count: number;
  active_critical: number;
  critical_incidents?: number;
  resolution_rate: number;
  avg_mttr_minutes: number;
  avg_mtta_minutes: number;
  sla_compliance_rate?: number;
}
