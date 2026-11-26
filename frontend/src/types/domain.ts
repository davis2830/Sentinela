export interface DomainChangeHistoryItem {
  id: string;
  field_name:
    | "registrar"
    | "name_servers"
    | "is_locked"
    | "status"
    | "expiration_date"
    | string;
  old_value: string;
  new_value: string;
  changed_at: string | null;
}

export interface DomainNSServerHealth {
  host: string;
  ip: string;
  responding: boolean;
  authoritative: boolean;
  soa_serial: number | null;
  latency_ms: number | null;
  error?: string;
}

export interface DomainNSHealth {
  total_count: number;
  responding_count: number;
  soa_consistent: boolean | null;
  soa_serials?: number[];
  zone_ns?: string[];
  delegation_consistent: boolean | null;
  servers?: DomainNSServerHealth[];
}

export interface DomainLinkedTarget {
  id: string;
  name: string;
  endpoint: string;
  enabled: boolean;
}

export interface DomainDependencies {
  targets: { id: string; name: string; enabled: boolean }[];
  targets_count: number;
  dns_count: number;
  ssl_count: number;
}

export interface DomainAlertSummary {
  rules: {
    id: string;
    name: string;
    condition: string;
    threshold: number;
    severity: string;
    snoozed_until: string | null;
  }[];
  destinations: {
    id: string;
    name: string;
    channel_type: string;
  }[];
}

export interface UnwatchedDomainSuggestion {
  domain: string;
  targets_count: number;
  dns_count: number;
  ssl_count: number;
  sources: string[];
}

export interface DomainInfo {
  scan_availability?: import("./scan").ScanAvailability;
  id: string;
  organization: string;
  domain: string;
  registrar: string | null;
  creation_date: string | null;
  expiration_date: string | null;
  manual_expiration_date?: string | null;
  auto_renew?: boolean | null;
  effective_expiration_date?: string | null;
  effective_days_until_expiration?: number | null;
  last_updated: string | null;
  status: string[] | string | null;
  name_servers: string[] | string | null;
  ns_health?: DomainNSHealth | null;
  registrant_country: string | null;
  days_until_expiration: number | null;
  is_locked?: boolean | null;
  data_source?: string;
  source_url?: string;
  last_successful_at?: string | null;
  last_change_at?: string | null;
  changes_acknowledged_at?: string | null;
  has_unacknowledged_changes?: boolean;
  recent_changes?: DomainChangeHistoryItem[];
  linked_targets?: DomainLinkedTarget[];
  suggested_targets?: DomainLinkedTarget[];
  dependencies?: DomainDependencies;
  alert_summary?: DomainAlertSummary;
  whois_server?: string | null;
  dnssec?: string | null;
  last_scanned_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDomainInfoData {
  domain: string;
  manual_expiration_date?: string | null;
}

export interface DomainStats {
  total: number;
  active: number;
  expiring_30d: number;
  expiring_15d: number;
  expired: number;
  error: number;
  locked_count?: number;
  unlocked_count?: number;
}

export interface DomainTestWhoisResult {
  success: boolean;
  domain: string;
  registrar?: string;
  creation_date?: string | null;
  expiration_date?: string | null;
  last_updated?: string | null;
  days_until_expiration?: number | null;
  remaining_percentage?: number | null;
  is_locked?: boolean | null;
  data_source?: string;
  source_url?: string;
  last_successful_at?: string | null;
  status?: string[];
  name_servers?: string[];
  registrant_country?: string;
  dnssec?: string;
  whois_server?: string;
  error_message?: string | null;
}
