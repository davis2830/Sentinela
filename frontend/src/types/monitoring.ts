export interface MonitoringTarget {
  id: string;
  organization: string;
  name: string;
  target_type: 'http' | 'https' | 'tcp' | 'dns' | 'api' | 'ssl';
  endpoint: string;
  interval: number;
  enabled: boolean;
  http_method?: string;
  expected_status?: number;
  custom_headers?: Record<string, string>;
  request_body?: string;
  max_latency_ms?: number;
  last_checked_at: string | null;
  last_status: string | null;
  last_latency: number | null;
  tags?: string[];
  recent_checks?: RecentCheckItem[];
  created_at: string;
  updated_at: string;
}

export interface RecentCheckItem {
  status: 'up' | 'down' | 'slow' | 'error';
  latency: number | null;
  checked_at: string;
}

export interface MonitoringCheck {
  id: string;
  target: string;
  status: 'up' | 'down' | 'slow' | 'error';
  latency: number | null;
  checked_at: string;
  details: Record<string, any>;
  created_at: string;
}

export interface UptimeStats {
  target_id: string;
  hours: number;
  total_checks: number;
  up_checks: number;
  uptime_percentage: number;
}

export interface CreateTargetData {
  name: string;
  target_type: 'http' | 'https' | 'tcp' | 'dns' | 'api' | 'ssl';
  endpoint: string;
  interval: number;
  enabled: boolean;
  http_method?: string;
  expected_status?: number;
  custom_headers?: Record<string, string>;
  request_body?: string;
  max_latency_ms?: number;
  tags?: string[];
}

export interface UpdateTargetData {
  name?: string;
  target_type?: 'http' | 'https' | 'tcp' | 'dns' | 'api' | 'ssl';
  endpoint?: string;
  interval?: number;
  enabled?: boolean;
  http_method?: string;
  expected_status?: number;
  custom_headers?: Record<string, string>;
  request_body?: string;
  max_latency_ms?: number;
  tags?: string[];
}

export interface TimeseriesPoint {
  timestamp: string;
  label: string;
  latency: number | null;
  max_latency: number | null;
  status: 'up' | 'down' | 'slow';
  is_down: boolean;
  down_count: number;
  total_count: number;
}

export interface DailyAvailabilityItem {
  date: string;
  label: string;
  uptime_percentage: number;
  total_checks: number;
  down_checks: number;
  status: 'operational' | 'degraded' | 'down' | 'no_data';
  avg_latency: number;
}

export interface DowntimeIncident {
  id: string;
  started_at: string;
  resolved_at: string;
  duration_seconds: number;
  duration_formatted: string;
  error_message: string;
  status_code: number | null;
  checks_failed: number;
}

export interface TimeseriesSummary {
  uptime_percentage: number;
  total_checks: number;
  up_checks: number;
  down_checks: number;
  avg_latency: number;
  p50_latency: number;
  p90_latency: number;
  p99_latency: number;
  max_latency: number;
  min_latency: number;
  total_downtime_seconds: number;
  incidents_count: number;
}

export interface TimeseriesData {
  period: '24h' | '7d' | '30d';
  target_id: string;
  summary: TimeseriesSummary;
  timeseries: TimeseriesPoint[];
  daily_availability: DailyAvailabilityItem[];
  incidents: DowntimeIncident[];
}