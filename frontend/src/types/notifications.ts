export type ChannelType = 'email' | 'slack' | 'teams' | 'discord' | 'telegram' | 'webhook';
export type NotificationStatus = 'pending' | 'sent' | 'failed';

export interface NotificationChannel {
  id: string;
  organization: string;
  name: string;
  channel_type: ChannelType;
  config: Record<string, any>;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateChannelData {
  name: string;
  channel_type: ChannelType;
  config: Record<string, any>;
  enabled?: boolean;
}

export interface NotificationItem {
  id: string;
  organization: string;
  channel: string | null;
  channel_name: string;
  alert_id: string | null;
  title: string;
  message: string;
  status: NotificationStatus;
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
}
