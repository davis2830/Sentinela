export type SecurityGrade = "A+" | "A" | "B" | "C" | "D" | "F";

export interface DirectiveInfo {
  present: boolean;
  status: "optimal" | "warning" | "danger" | "invalid" | "missing";
  value: string | null;
  notes?: string;
  max_age?: number | null;
  include_subdomains?: boolean;
  preload?: boolean;
  has_unsafe_inline?: boolean;
  has_unsafe_eval?: boolean;
  has_wildcard?: boolean;
}

export interface InfoLeakInfo {
  header: string;
  value: string;
  severity: "low" | "medium" | "high";
  recommendation: string;
}

export interface SecurityHeaderRecentResult {
  id: string;
  score: number;
  grade: SecurityGrade | "";
  response_time_ms: number | null;
  error_message: string | null;
  leaks_count: number;
  checked_at: string | null;
}

export interface SecurityHeaderAlertSummary {
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

export interface SecurityHeaderTarget {
  scan_availability?: import("./scan").ScanAvailability;
  id: string;
  organization: string;
  name: string;
  url: string;
  enabled: boolean;
  last_checked_at: string | null;
  last_score: number | null;
  last_grade: SecurityGrade | "" | null;
  last_response_time_ms: number | null;
  has_hsts: boolean;
  has_csp: boolean;
  has_xfo: boolean;
  info_leak_detected: boolean;
  server_header: string;
  powered_by_header: string;
  last_error_message?: string | null;
  headers_found_count?: number | null;
  headers_missing_count?: number | null;
  recent_results?: SecurityHeaderRecentResult[];
  alert_summary?: SecurityHeaderAlertSummary;
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
  response_time_ms: number | null;
  headers_found: Record<string, string> | string[];
  headers_missing: string[] | Record<string, string>;
  directives_analysis?: Record<string, DirectiveInfo>;
  info_leaks?: Record<string, InfoLeakInfo>;
  raw_headers?: Record<string, string>;
  error_message: string | null;
  checked_at: string;
  created_at: string;
}

export interface SecurityHeaderStats {
  total: number;
  healthy?: number;
  warning?: number;
  critical?: number;
  unmeasured?: number;
  paused?: number;
  grade_a: number;
  grade_bc: number;
  grade_df: number;
  info_leaks_count?: number;
  avg_score: number;
}

export interface TestHeaderResponse {
  url: string;
  http_status: number;
  response_time_ms: number;
  score: number;
  grade: SecurityGrade;
  headers_found: Record<string, string>;
  headers_missing: string[];
  directives_analysis: Record<string, DirectiveInfo>;
  info_leaks: Record<string, InfoLeakInfo>;
  raw_headers: Record<string, string>;
  success: boolean;
  error?: string | null;
}
