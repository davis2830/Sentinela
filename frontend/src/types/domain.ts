export interface DomainInfo {
  id: string;
  organization: string;
  domain: string;
  registrar: string | null;
  creation_date: string | null;
  expiration_date: string | null;
  last_updated: string | null;
  status: string[] | string | null;
  name_servers: string[] | string | null;
  registrant_country: string | null;
  days_until_expiration: number | null;
  is_locked?: boolean;
  whois_server?: string | null;
  dnssec?: string | null;
  last_scanned_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDomainInfoData {
  domain: string;
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
  life_percentage?: number;
  is_locked?: boolean;
  status?: string[];
  name_servers?: string[];
  registrant_country?: string;
  dnssec?: string;
  whois_server?: string;
  error_message?: string | null;
}
