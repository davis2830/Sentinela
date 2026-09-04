export type ChannelType = 'email' | 'slack' | 'teams' | 'discord' | 'telegram' | 'webhook';
export type NotificationStatus = 'pending' | 'sent' | 'failed';
export type NotificationSeverity = 'info' | 'warning' | 'critical';

export interface NotificationChannel {
  id: string;
  organization: string;
  name: string;
  description: string;
  channel_type: ChannelType;
  config: Record<string, any>;
  enabled: boolean;
  min_severity: NotificationSeverity;
  subscribed_events: string[];
  rate_limit_per_hour: number;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  quiet_hours_critical_override: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateChannelData {
  name: string;
  description?: string;
  channel_type: ChannelType;
  config: Record<string, any>;
  enabled?: boolean;
  min_severity?: NotificationSeverity;
  subscribed_events?: string[];
  rate_limit_per_hour?: number;
  quiet_hours_enabled?: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  quiet_hours_critical_override?: boolean;
}

export interface NotificationItem {
  id: string;
  organization: string;
  channel: string | null;
  channel_name: string;
  channel_type?: ChannelType;
  alert_id: string | null;
  title: string;
  message: string;
  status: NotificationStatus;
  severity: NotificationSeverity;
  event_type: string;
  duration_ms: number;
  http_status: number | null;
  retry_count: number;
  sent_at: string | null;
  response: string;
  error_message: string;
  created_at: string;
}

export interface NotificationStats {
  total_channels: number;
  enabled_channels: number;
  total_sent: number;
  total_failed: number;
  active_types_count: number;
  success_rate: number;
  avg_duration_ms: number;
  quiet_hours_active: number;
}

export interface TestChannelConfigPayload {
  channel_type: ChannelType;
  config: Record<string, any>;
  custom_title?: string;
  custom_message?: string;
}

export interface TestChannelResult {
  success: boolean;
  status_code: number | null;
  duration_ms: number;
  message: string;
}
