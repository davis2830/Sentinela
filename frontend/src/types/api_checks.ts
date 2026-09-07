export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';

export interface APICheckTarget {
  id: string;
  organization: string;
  name: string;
  url: string;
  method: HTTPMethod;
  expected_status: number;
  expected_response_time_ms: number;
  expected_headers?: Record<string, string>;
  expected_schema?: Record<string, any>;
  request_headers?: Record<string, string>;
  request_body?: Record<string, any>;
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
  request_body?: Record<string, any>;
  expected_headers?: Record<string, string>;
  expected_schema?: Record<string, any>;
}

export interface APICheckResult {
  id: string;
  target: string;
  status: 'pass' | 'fail' | 'slow' | 'error' | string;
  http_status: number | null;
  response_time_ms: number | null;
  json_valid: boolean;
  schema_valid: boolean;
  headers_valid: boolean;
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
  avg_latency: number;
}

export interface APITestRequestResult {
  success: boolean;
  status_code: number | null;
  response_time_ms: number | null;
  headers: Record<string, string>;
  body: any;
  is_json: boolean;
  size_bytes: number;
  schema_inferred?: Record<string, string>;
  error?: string | null;
}
