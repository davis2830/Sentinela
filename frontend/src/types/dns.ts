export type DNSRecordType =
  | 'A'
  | 'AAAA'
  | 'MX'
  | 'TXT'
  | 'NS'
  | 'CNAME'
  | 'SOA'
  | 'PTR'
  | 'CAA';

export interface DNSRecord {
  id: string;
  organization: string;
  domain: string;
  record_type: DNSRecordType;
  value: string;
  ttl: number | null;
  response_time_ms?: number | null;
  last_scanned_at: string | null;
  last_change_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDNSRecordData {
  domain: string;
  record_type: DNSRecordType;
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
  avg_latency_ms?: number;
}

export interface DNSTestResolutionResult {
  success: boolean;
  domain: string;
  record_type: DNSRecordType;
  values: string[];
  ttl?: number | null;
  response_time_ms?: number | null;
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
