export interface AgentProbe {
  id: string;
  name: string;
  status: 'online' | 'offline';
  is_online: boolean;
  last_heartbeat: string | null;
  ip_address: string;
  hostname: string;
  version: string;
  os_info: string;
  assigned_targets_count: number;
  telemetry?: {
    state: 'current' | 'stale' | 'unknown';
    received_at: string | null;
    snapshot: {
      schema_version: 1;
      queue: { queued: number; running: number; ready: number } | null;
      queue_limit: number;
      draining: boolean;
      last_ack_at: string | null;
      last_rejection_at: string | null;
      rejected_retained: number | null;
      errors: { component: 'storage' | 'delivery' | 'heartbeat'; code: string; failures: number }[];
    } | null;
  };
  delivery?: {
    state: 'offline' | 'overdue' | 'pending' | 'received' | 'unknown';
    pending: number;
    overdue: number;
    last_received_at: string | null;
    source: 'server_execution_ledger';
  };
  raw_token?: string;
  docker_command?: string;
  created_at: string;
  updated_at: string;
}
