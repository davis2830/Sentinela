export type ReportType = 'sla' | 'availability' | 'ssl' | 'incidents' | 'trends' | 'summary';
export type ReportStatus = 'pending' | 'generating' | 'completed' | 'failed';

export interface TargetSLAResult {
  target_id: string;
  target_name: string;
  target_type: string;
  endpoint: string;
  total_checks: number;
  up_checks: number;
  down_checks?: number;
  sla_percentage: number | null;
  consumed_downtime_minutes?: number | null;
  meets_sla?: boolean | null;
}

export interface LiveTargetMetric {
  target_id: string;
  target_name: string;
  target_type: string;
  endpoint: string;
  uptime_percentage: number;
  avg_latency_ms: number;
  total_checks: number;
  up_checks: number;
  down_checks: number;
  consumed_budget_minutes: number;
  burn_rate: 'none' | 'normal' | 'fast' | 'exhausted';
  meets_sla: boolean;
}

export interface LiveSLAMetrics {
  period_days: number;
  target_sla: number;
  current_sla: number;
  total_error_budget_minutes: number;
  consumed_error_budget_minutes: number;
  remaining_error_budget_minutes: number;
  consumed_percentage: number;
  mttr_minutes: number;
  mttd_minutes: number;
  total_targets: number;
  meeting_sla: number;
  failing_sla: number;
  targets: LiveTargetMetric[];
}

export interface ReportData {
  period_start?: string;
  period_end?: string;
  overall_sla?: number | null;
  target_sla?: number;
  allowed_downtime_minutes?: number;
  consumed_downtime_minutes?: number | null;
  remaining_budget_minutes?: number | null;
  budget_consumed_percentage?: number | null;
  mttr_minutes?: number;
  mttd_minutes?: number | null;
  total_incidents?: number;
  targets?: TargetSLAResult[];
  summary?: {
    overall_sla_percentage?: number | null;
    mttr_minutes?: number;
    mttd_minutes?: number | null;
    monitoring_targets?: number;
    ssl_certificates?: number;
    active_alerts?: number;
    open_incidents?: number;
  };
  by_priority?: Record<string, number>;
  by_status?: Record<string, number>;
  incidents?: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    opened_at: string;
    closed_at: string | null;
  }>;
  certificates?: Array<{
    domain: string;
    issuer: string;
    expiration_date: string | null;
    days_remaining: number | null;
    is_valid: boolean;
    last_scanned_at: string | null;
  }>;
}

export interface ReportItem {
  id: string;
  organization: string;
  report_type: ReportType;
  title: string;
  parameters: Record<string, any>;
  status: ReportStatus;
  data: ReportData;
  error_message: string;
  generated_at: string | null;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateReportData {
  report_type: ReportType;
  title: string;
  target_ids?: string[];
  sla_target?: number;
  parameters?: Record<string, any>;
  period_start?: string;
  period_end?: string;
}
