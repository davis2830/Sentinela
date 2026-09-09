export interface PlatformStats {
  financials: {
    mrr_usd: number;
    arr_usd: number;
    currency: string;
  };
  organizations: {
    total: number;
    by_plan: Record<string, number>;
    by_status: Record<string, number>;
    recent_signups_30d: number;
  };
  infrastructure: {
    total_users: number;
    total_targets: number;
    active_targets: number;
    total_probes: number;
    online_probes: number;
  };
}

export interface PlatformOrganization {
  id: string;
  name: string;
  slug: string;
  plan_tier: 'free' | 'pro' | 'business' | 'enterprise';
  subscription_status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'suspended';
  is_in_trial: boolean;
  trial_days_remaining: number;
  trial_ends_at: string | null;
  billing_email: string;
  tax_id: string;
  contact_phone: string;
  sla_target_percentage: number;
  created_at: string;
  users_count: number;
  max_users: number;
  targets_count: number;
  max_targets: number;
  probes_count: number;
  max_probes: number;
}

export interface PlatformOrganizationDetail extends PlatformOrganization {
  website: string;
  limits: {
    max_targets: number;
    max_probes: number;
    min_interval: number;
    retention_days: number;
    max_users: number;
    features: string[];
  };
  users: Array<{
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    is_staff: boolean;
    is_active: boolean;
    last_login: string | null;
    created_at: string;
  }>;
  targets: Array<{
    id: string;
    name: string;
    endpoint: string;
    target_type: string;
    runner_type: string;
    enabled: boolean;
    last_status: string;
    last_latency: number | null;
    last_checked_at: string | null;
  }>;
  probes: Array<{
    id: string;
    name: string;
    status: string;
    is_online: boolean;
    last_heartbeat: string | null;
    ip_address: string;
    hostname: string;
    version: string;
  }>;
  recent_audits: Array<{
    id: string;
    user_email: string;
    action: string;
    resource_type: string;
    resource_name: string;
    description: string;
    created_at: string;
  }>;
}
