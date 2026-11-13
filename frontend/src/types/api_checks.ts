export type HTTPMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";

export interface APICheckTarget {
  scan_availability?: import("./scan").ScanAvailability;
  id: string;
  organization: string;
  name: string;
  url: string;
  method: HTTPMethod;
  expected_status: number;
  expected_response_time_ms: number;
  expected_headers?: Record<string, string>;
  expected_schema?: Record<string, unknown>;
  request_headers?: Record<string, string>;
  request_body?: Record<string, unknown>;
  check_interval: number;
  enabled: boolean;
  last_checked_at: string | null;
  last_status: string | null;
  last_response_time_ms?: number | null;
  last_http_status?: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAPICheckTargetData {
  name: string;
  url: string;
  method: HTTPMethod;
  expected_status: number;
  expected_response_time_ms: number;
  check_interval?: number;
  enabled?: boolean;
  request_headers?: Record<string, string>;
  request_body?: Record<string, unknown>;
  expected_headers?: Record<string, string>;
  expected_schema?: Record<string, unknown>;
}

export interface APICheckResult {
  id: string;
  target: string;
  status: "pass" | "fail" | "slow" | "error" | string;
  http_status: number | null;
  response_time_ms: number | null;
  schema_failures?: {
    field: string;
    expected: string;
    received: string;
    code: string;
  }[];
  json_valid: boolean | null;
  schema_valid: boolean | null;
  headers_valid: boolean | null;
  response_headers?: Record<string, string>;
  error_message: string | null;
  checked_at: string;
  created_at: string;
}

export interface APICheckStats {
  total: number;
  pass_count: number;
  slow_count: number;
  fail_count: number;
  paused_count?: number;
  avg_latency: number | null;
}

export interface APITestRequestResult {
  success: boolean;
  status_code: number | null;
  response_time_ms: number | null;
  headers: Record<string, string>;
  body: unknown;
  is_json: boolean;
  size_bytes: number;
  schema_inferred?: Record<string, string>;
  error?: string | null;
}
