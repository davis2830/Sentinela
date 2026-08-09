export type MaintenanceStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type SystemHealthStatus = 'operational' | 'degraded' | 'outage';

export interface StatusPageConfigData {
  id: string;
  organization: string;
  company_name: string;
  slug: string;
  description: string;
  logo_url: string;
  is_public: boolean;
  support_email: string;
  monitored_targets: string[];
  created_at: string;
  updated_at: string;
}

export interface ScheduledMaintenanceItem {
  id: string;
  organization?: string;
  title: string;
  description: string;
  status: MaintenanceStatus;
  start_time: string;
  end_time: string;
  created_at?: string;
  updated_at?: string;
}

export interface DayHistoryBlock {
  date: string;
  status: 'up' | 'degraded' | 'down';
  uptime_pct: number;
  total_checks?: number;
}

export interface ServiceStatusItem {
  id: string;
  name: string;
  type: 'uptime' | 'api';
  category?: string;
  current_status: 'up' | 'down';
  uptime_90_days_pct: number;
  history_90_days: DayHistoryBlock[];
}

export interface PublicStatusData {
  company_name: string;
  description: string;
  logo_url: string;
  support_email: string;
  system_status: SystemHealthStatus;
  system_status_label: string;
  global_uptime_pct: number;
  total_services_count: number;
  operational_services_count: number;
  services: ServiceStatusItem[];
  active_incidents: Array<{
    id: string;
    title: string;
    description: string;
    priority: string;
    status: string;
    opened_at: string;
  }>;
  past_incidents?: Array<{
    id: string;
    title: string;
    description: string;
    priority: string;
    status: string;
    opened_at: string;
    closed_at: string | null;
  }>;
  maintenances: ScheduledMaintenanceItem[];
  updated_at: string;
}
