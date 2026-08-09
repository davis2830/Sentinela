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
  | 'alert_added'
  | 'note_added'
  | 'resolved'
  | 'closed';

export interface Incident {
  id: string;
  organization: string;
  title: string;
  description: string;
  status: IncidentStatus;
  priority: IncidentPriority;
  opened_at: string;
  closed_at: string | null;
  alerts_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateIncidentData {
  title: string;
  description?: string;
  priority: IncidentPriority;
}

export interface UpdateIncidentData {
  status?: IncidentStatus;
  priority?: IncidentPriority;
  description?: string;
}

export interface IncidentTimelineEvent {
  id: string;
  incident: string;
  event_type: IncidentEventType;
  description: string;
  old_value: string | null;
  new_value: string | null;
  occurred_at: string;
}

export interface IncidentAlert {
  id: string;
  incident: string;
  alert_id: string;
  alert_title?: string;
  alert_severity?: string;
  alert_status?: string;
  alert_triggered_at?: string;
  added_at: string;
}
