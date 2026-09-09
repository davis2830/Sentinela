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
  raw_token?: string;
  docker_command?: string;
  created_at: string;
  updated_at: string;
}
