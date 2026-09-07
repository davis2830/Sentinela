export interface SSLCertificate {
  id: string;
  organization: string;
  domain: string;
  port?: number;
  issuer: string | null;
  subject: string | null;
  issued_at?: string | null;
  expiration_date: string | null;
  algorithm: string | null;
  fingerprint: string | null;
  days_remaining: number | null;
  percentage_used?: number | null;
  security_grade?: string;
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
  port?: number;
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

export interface SSLTestConnectionResult {
  domain: string;
  port: number;
  is_valid: boolean;
  issuer?: string;
  subject?: string;
  issued_at?: string | null;
  expiration_date?: string | null;
  days_remaining?: number | null;
  percentage_used?: number | null;
  algorithm?: string;
  fingerprint?: string;
  san_domains?: string[];
  tls_version?: string;
  cipher_suite?: string;
  security_grade?: string;
  error_message?: string;
}
