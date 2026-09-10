export interface OrganizationData {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended' | 'cancelled';
  timezone: string;
  locale: string;

  // SaaS Subscription & Billing
  plan_tier: 'free' | 'pro' | 'business' | 'enterprise';
  subscription_status: 'trialing' | 'active' | 'past_due' | 'canceled';
  trial_ends_at: string | null;
  is_in_trial: boolean;
  trial_days_remaining: number;
  billing_email: string;
  tax_id: string;
  contact_phone: string;
  website: string;
  logo_url: string;

  // SLA & Observability Defaults
  sla_target_percentage: number | string;
  alert_flapping_threshold: number;
  default_scan_interval_seconds: number;

  // Retention & Compliance
  metrics_retention_days: number;
  audit_logs_retention_days: number;
  resolved_incidents_retention_days: number;

  // Security & Access Control
  session_timeout_minutes: number;
  require_2fa: boolean;
  allowed_ip_ranges: string;

  created_at: string;
  updated_at: string;
}

export interface QuotaMetric {
  current: number;
  limit: number;
  percentage: number;
  is_unlimited: boolean;
  is_exceeded: boolean;
}

export interface PlanLimitInfo {
  tier: 'free' | 'pro' | 'business' | 'enterprise';
  name: string;
  price_monthly_usd: number;
  max_monitoring_targets: number;
  max_ssl_certificates: number;
  max_api_checks: number;
  max_dns_records: number;
  max_domains: number;
  max_security_headers: number;
  max_notification_channels: number;
  max_private_agents: number;
  min_check_interval_seconds: number;
  metrics_retention_days: number;
  max_team_members: number;
  max_status_pages: number;
  custom_domain_status_page: boolean;
  sla_reports: boolean;
  maintenance_windows: boolean;
  rca_postmortem: boolean;
}

export interface SubscriptionSummary {
  plan_tier: 'free' | 'pro' | 'business' | 'enterprise';
  plan_name: string;
  subscription_status: 'trialing' | 'active' | 'past_due' | 'canceled';
  billing_email: string;
  is_in_trial: boolean;
  trial_days_remaining: number;
  trial_ends_at: string | null;
  limits: PlanLimitInfo;
  usage: {
    targets: QuotaMetric;
    ssl_certificates: QuotaMetric;
    api_checks: QuotaMetric;
    dns_records: QuotaMetric;
    domains: QuotaMetric;
    security_headers: QuotaMetric;
    notification_channels: QuotaMetric;
    team_members: QuotaMetric;
    status_pages: QuotaMetric;
    private_agents: QuotaMetric;
  };
  all_plans: PlanLimitInfo[];
}

export interface OrganizationTeamMember {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  status_code: 'active' | 'pending' | 'revoked';
  status_label: string;
  date_joined: string;
  last_login?: string;
}
