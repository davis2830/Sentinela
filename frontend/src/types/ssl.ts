export interface SSLCertificate {
  id: string;
  organization: string;
  domain: string;
  issuer: string | null;
  subject: string | null;
  expiration_date: string | null;
  algorithm: string | null;
  fingerprint: string | null;
  days_remaining: number | null;
  is_valid: boolean;
  last_scanned_at: string | null;
  error_message: string | null;
  san_domains?: string[];
  tls_version?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateSSLCertificateData {
  domain: string;
}

export interface SSLStats {
  total: number;
  valid: number;
  expiring_15d: number;
  expiring_30d: number;
  expired: number;
  invalid: number;
  avg_days_remaining: number;
}
