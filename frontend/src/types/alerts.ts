export type AlertTargetType =
  | 'ssl'
  | 'monitoring'
  | 'dns'
  | 'domain'
  | 'api_check'
  | 'security_headers';

export type AlertCondition =
  | 'ssl_expiring'
  | 'uptime_below'
  | 'status_down'
  | 'response_time_above'
  | 'dns_changed'
  | 'domain_expiring'
  | 'security_score_below'
  | 'api_check_failed';

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
}

export interface UpdateAlertRuleData {
  name?: string;
  target_type?: AlertTargetType;
  condition?: AlertCondition;
  threshold?: number;
  severity?: AlertSeverity;
  enabled?: boolean;
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
  triggered_at: string;
  resolved_at: string | null;
  created_at: string;
}
