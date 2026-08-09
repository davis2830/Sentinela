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
  sla_percentage: number;
}

export interface ReportData {
  period_start?: string;
  period_end?: string;
  overall_sla?: number;
  mttr_minutes?: number;
  mttd_minutes?: number;
  total_incidents?: number;
  targets?: TargetSLAResult[];
  summary?: {
    overall_sla_percentage?: number;
    mttr_minutes?: number;
    mttd_minutes?: number;
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
  period_start?: string;
  period_end?: string;
}
