export interface MaintenanceWindowTarget {
  id?: string;
  target_type: 'all' | 'monitoring' | 'ssl' | 'dns' | 'domain' | 'api_check' | 'security_headers';
  target_id: string | null;
  target_name: string;
}

export interface MaintenanceWindowUpdate {
  id: string;
  message: string;
  status: string;
  actor_name: string;
  posted_at: string;
}

export interface MaintenanceWindow {
  id: string;
  organization_id: string;
  title: string;
  description: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  start_time: string;
  end_time: string;
  recurrence: 'none' | 'weekly' | 'biweekly' | 'monthly';
  recurrence_day_of_week: number | null;
  recurrence_time_start: string | null;
  recurrence_time_end: string | null;
  suppress_notifications: boolean;
  exclude_from_sla: boolean;
  publish_to_status_page: boolean;
  status_page: string | null;
  status_page_name?: string | null;
  status_page_slug?: string | null;
  status_page_maintenance_id?: string | null;
  responsible_team: string | null;
  responsible_team_name?: string | null;
  responsible_team_color?: string | null;
  responsible_user: string | null;
  responsible_user_name?: string | null;
  created_by: string | null;
  created_by_name?: string | null;
  duration_minutes: number;
  is_active_now: boolean;
  targets: MaintenanceWindowTarget[];
  updates: MaintenanceWindowUpdate[];
  created_at: string;
  updated_at: string;
}

export interface MaintenanceStats {
  active_in_progress: number;
  upcoming_7d: number;
  targets_in_maintenance: number;
  scheduled_hours_month: number;
}
