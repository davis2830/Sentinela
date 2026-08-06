export interface MonitoringTarget {
  id: string;
  organization: string;
  name: string;
  target_type: 'http' | 'https' | 'tcp' | 'dns' | 'api' | 'ssl';
  endpoint: string;
  interval: number;
  enabled: boolean;
  last_checked_at: string | null;
  last_status: string | null;
  last_latency: number | null;
  created_at: string;
  updated_at: string;
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
}

export interface UpdateTargetData {
  name?: string;
  target_type?: 'http' | 'https' | 'tcp' | 'dns' | 'api' | 'ssl';
  endpoint?: string;
  interval?: number;
  enabled?: boolean;
}