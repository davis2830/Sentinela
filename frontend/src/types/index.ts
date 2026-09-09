export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  timezone?: string;
  notification_preferences?: {
    email_critical_alerts?: boolean;
    sound_alerts?: boolean;
    incident_assignments?: boolean;
    weekly_digest?: boolean;
  };
  role?: string;
  is_staff: boolean;
  is_active: boolean;
  is_2fa_enabled?: boolean;
  backup_codes_remaining?: number;
  last_login?: string | null;
  created_at?: string;
  teams?: Array<{
    id: string;
    name: string;
    color: string;
    is_lead?: boolean;
  }>;
  organization?: {
    id: string;
    name: string;
    timezone: string;
    locale: string;
  };
}

export interface APITokenItem {
  id: string;
  name: string;
  token: string;
  scope: 'read' | 'full';
  expires_at: string | null;
  is_expired: boolean;
  created_at: string;
  last_used_at: string | null;
}

export interface AuthResponse {
  access_token?: string;
  refresh_token?: string;
  user?: User;
  requires_2fa?: boolean;
  pre_auth_token?: string;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}

export * from './ssl';
export * from './dns';
export * from './domain';
export * from './api_checks';
export * from './security_headers';
export * from './alerts';
export * from './incidents';
export * from './reports';
export * from './users';
export * from './maintenance';