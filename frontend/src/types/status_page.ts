export type MaintenanceStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type SystemHealthStatus = 'operational' | 'degraded' | 'outage';
export type AnnouncementType = 'info' | 'warning' | 'critical';

export interface ComponentSettingItem {
  id: string;
  target_type: 'uptime' | 'api' | 'ssl' | 'dns';
  display_name: string;
  category: string;
  is_visible: boolean;
  order?: number;
}

export interface AvailableTargetItem {
  id: string;
  name: string;
  type: 'uptime' | 'api';
  target_url: string;
  enabled: boolean;
  current_status: string;
  default_category: string;
}

export interface MaintenanceUpdateItem {
  id: string;
  message: string;
  status: string;
  posted_at: string;
}

export interface StatusPageConfigData {
  id: string;
  organization: string;
  company_name: string;
  slug: string;
  description: string;
  logo_url: string;
  website_url?: string;
  is_public: boolean;
  is_default?: boolean;
  support_email: string;
  custom_announcement?: string;
  announcement_type?: AnnouncementType;
  announcement_active?: boolean;
  show_uptime_pct?: boolean;
  show_latency_24h?: boolean;
  monitored_targets: string[];
  component_settings: ComponentSettingItem[];
  created_at: string;
  updated_at: string;
}

export interface StatusPageSummaryItem {
  id: string;
  company_name: string;
  slug: string;
  description: string;
  logo_url: string;
  website_url: string;
  support_email: string;
  is_public: boolean;
  is_default: boolean;
  published_components_count: number;
  subscribers_count: number;
  active_maintenances_count: number;
  announcement_active: boolean;
  created_at: string;
}

export interface StatusPageCreatePayload {
  company_name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  website_url?: string;
  support_email?: string;
  is_public?: boolean;
  is_default?: boolean;
  clone_from_page_id?: string | null;
}

export interface ScheduledMaintenanceItem {
  id: string;
  organization?: string;
  status_page_id?: string | null;
  status_page_name?: string | null;
  title: string;
  description: string;
  status: MaintenanceStatus;
  start_time: string;
  end_time: string;
  updates?: MaintenanceUpdateItem[];
  created_at?: string;
  updated_at?: string;
}

export interface StatusPageSubscriberItem {
  id: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface StatusPageAdminStats {
  total_components: number;
  published_components: number;
  scheduled_maintenances: number;
  active_subscribers: number;
  total_pages?: number;
  projected_status: SystemHealthStatus;
  is_public: boolean;
  is_default?: boolean;
  slug: string;
  company_name?: string;
  page_id?: string;
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
  avg_latency_24h_ms?: number;
  history_90_days: DayHistoryBlock[];
}

export interface PublicStatusData {
  company_name: string;
  description: string;
  logo_url: string;
  website_url?: string;
  support_email: string;
  system_status: SystemHealthStatus;
  system_status_label: string;
  global_uptime_pct: number;
  global_avg_latency_ms?: number;
  total_services_count: number;
  operational_services_count: number;
  services: ServiceStatusItem[];
  active_incidents: Array<{
    id: string;
    title: string;
    description: string;
    priority: string;
    status: string;
    impacted_service?: string;
    opened_at: string;
  }>;
  past_incidents?: Array<{
    id: string;
    title: string;
    description: string;
    priority: string;
    status: string;
    impacted_service?: string;
    opened_at: string;
    closed_at: string | null;
  }>;
  maintenances: ScheduledMaintenanceItem[];
  custom_announcement?: string;
  announcement_type?: AnnouncementType;
  announcement_active?: boolean;
  show_uptime_pct?: boolean;
  show_latency_24h?: boolean;
  updated_at: string;
}
