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
}

export interface ServiceStatusItem {
  id: string;
  name: string;
  type: 'uptime' | 'api';
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
  services: ServiceStatusItem[];
  active_incidents: Array<{
    id: string;
    title: string;
    description: string;
    priority: string;
    status: string;
    opened_at: string;
  }>;
  maintenances: ScheduledMaintenanceItem[];
  updated_at: string;
}
