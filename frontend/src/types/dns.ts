export type DNSRecordType =
  | "A"
  | "AAAA"
  | "MX"
  | "TXT"
  | "NS"
  | "CNAME"
  | "SOA"
  | "PTR"
  | "CAA"
  | "SRV";

export interface DNSResolverResult {
  resolver: string;
  label?: string;
  success: boolean;
  values: string[];
  ttl?: number | null;
  latency_ms?: number | null;
  response_time_ms?: number | null;
  error_type?: string | null;
  error_message?: string | null;
}

export interface DNSLinkedTarget {
  id: string;
  name: string;
  endpoint: string;
  enabled: boolean;
}

export interface DNSLatestChange {
  id: string;
  old_value: string;
  new_value: string;
  changed_at: string | null;
}

export type DNSPropagationStatus =
  | "consistent"
  | "propagating"
  | "error"
  | "";

export type DNSReferenceMode = "exact" | "cidr" | "provider";

export interface DNSRecord {
  scan_availability?: import("./scan").ScanAvailability;
  id: string;
  organization: string;
  domain: string;
  record_type: DNSRecordType;
  value: string;
  ttl: number | null;
  response_time_ms?: number | null;
  last_scanned_at: string | null;
  last_change_at: string | null;
  last_attempt_status?: string;
  last_error_code?: string;
  last_error_message?: string;
  last_successful_at?: string | null;
  resolver?: string;
  resolver_results?: DNSResolverResult[];
  propagation_status?: DNSPropagationStatus;
  expected_values?: string[];
  reference_mode?: DNSReferenceMode;
  reference_updated_at?: string | null;
  matches_expected?: boolean | null;
  latest_change?: DNSLatestChange | null;
  changes_last_hour?: number;
  linked_targets?: DNSLinkedTarget[];
  suggested_targets?: DNSLinkedTarget[];
  created_at: string;
  updated_at: string;
}

export interface CreateDNSRecordData {
  domain: string;
  record_type: DNSRecordType;
  expected_values?: string[];
  reference_mode?: DNSReferenceMode;
}

export interface DNSChangeHistory {
  id: string;
  record: string;
  old_value: string;
  new_value: string;
  changed_at: string;
}

export interface DNSStats {
  total: number;
  unique_domains: number;
  changes_24h: number;
  unresolved: number;
  avg_latency_ms?: number | null;
}

export interface DNSTestResolutionResult {
  success: boolean;
  domain: string;
  record_type: DNSRecordType;
  values: string[];
  ttl?: number | null;
  response_time_ms?: number | null;
  resolver?: string | null;
  resolver_results?: DNSResolverResult[];
  propagation_status?: DNSPropagationStatus;
  spf_info?: {
    raw: string;
    is_valid: boolean;
    policy: string;
    is_permissive: boolean;
  } | null;
  dmarc_info?: {
    raw: string;
    policy: string;
    is_enforced: boolean;
  } | null;
  error_type?: string | null;
  error_message?: string | null;
}
