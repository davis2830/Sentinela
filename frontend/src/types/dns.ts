export type DNSRecordType = 'A' | 'AAAA' | 'MX' | 'TXT' | 'NS' | 'CNAME';

export interface DNSRecord {
  id: string;
  organization: string;
  domain: string;
  record_type: DNSRecordType;
  value: string;
  ttl: number | null;
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
}
