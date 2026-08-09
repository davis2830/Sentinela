export type SecurityGrade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface SecurityHeaderTarget {
  id: string;
  organization: string;
  name: string;
  url: string;
  enabled: boolean;
  last_checked_at: string | null;
  last_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSecurityHeaderTargetData {
  name: string;
  url: string;
  enabled?: boolean;
}

export interface SecurityHeaderResult {
  id: string;
  target: string;
  score: number;
  grade: SecurityGrade;
  headers_found: string[] | Record<string, string>;
  headers_missing: string[] | Record<string, string>;
  raw_headers?: Record<string, string>;
  error_message: string | null;
  checked_at: string;
  created_at: string;
}

export interface SecurityHeaderStats {
  total: number;
  grade_a: number;
  grade_bc: number;
  grade_df: number;
  avg_score: number;
}
