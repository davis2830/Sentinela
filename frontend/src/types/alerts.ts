export type AlertTargetType =
  | 'ssl'
  | 'monitoring'
  | 'dns'
  | 'domain'
  | 'api_check'
  | 'security_headers';

export type AlertCondition =
  | 'ssl_expiring'
  | 'ssl_grade_below'
  | 'ssl_invalid'
  | 'uptime_below'
  | 'status_down'
  | 'response_time_above'
  | 'dns_changed'
  | 'dns_latency_above'
  | 'domain_expiring'
  | 'domain_unlocked'
  | 'security_score_below'
  | 'security_leak_detected'
  | 'api_check_failed'
  | 'api_latency_above';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export type AlertStatus = 'active' | 'acknowledged' | 'resolved';

export interface AlertRule {
  id: string;
  organization: string;
  name: string;
  target_type: AlertTargetType;
  condition: AlertCondition;
  threshold: number;
  severity: AlertSeverity;
  enabled: boolean;
  target_id?: string | null;
  snoozed_until?: string | null;
  cooldown_minutes?: number;
  auto_resolve?: boolean;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAlertRuleData {
  name: string;
  target_type: AlertTargetType;
  condition: AlertCondition;
  threshold: number;
  severity: AlertSeverity;
  enabled?: boolean;
  target_id?: string | null;
  snoozed_until?: string | null;
  cooldown_minutes?: number;
  auto_resolve?: boolean;
}

export interface UpdateAlertRuleData {
  name?: string;
  target_type?: AlertTargetType;
  condition?: AlertCondition;
  threshold?: number;
  severity?: AlertSeverity;
  enabled?: boolean;
  target_id?: string | null;
  snoozed_until?: string | null;
  cooldown_minutes?: number;
  auto_resolve?: boolean;
}

export interface Alert {
  id: string;
  organization: string;
  rule: string | null;
  title: string;
  message: string;
  severity: AlertSeverity;
  status: AlertStatus;
  target_type: AlertTargetType;
  target_id: string;
  occurrence_count: number;
  last_seen_at: string;
  is_flapping: boolean;
  flapping_count: number;
  snoozed_until: string | null;
  auto_resolved: boolean;
  metadata: Record<string, any>;
  incident_id?: string | null;
  incident_title?: string | null;
  triggered_at: string;
  resolved_at: string | null;
  created_at: string;
}

export interface AlertStats {
  active_critical: number;
  active_warning: number;
  active_info: number;
  total_active: number;
  acknowledged: number;
  resolved: number;
  flapping_count?: number;
  snoozed_count?: number;
  avg_mttr_minutes: number;
}

export interface SimulateRuleResult {
  targets_evaluated: number;
  would_trigger_count: number;
  matching_targets: {
    name: string;
    endpoint: string;
    current_value: string;
    threshold: string;
    severity: string;
  }[];
}
