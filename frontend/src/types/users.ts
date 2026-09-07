export interface TeamMemberTeam {
  id: string;
  name: string;
  color: string;
}

export interface TeamMember {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  status_code: 'active' | 'pending' | 'revoked';
  status_label: string;
  date_joined: string | null;
  last_login?: string | null;
  is_invitation?: boolean;
  teams: TeamMemberTeam[];
}

export interface TeamMemberMini {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  organization: string;
  color: string;
  lead?: TeamMemberMini | null;
  contact_email?: string;
  members: TeamMemberMini[];
  member_count: number;
  assigned_incidents_count?: number;
  assigned_targets_count?: number;
  created_at: string;
  updated_at: string;
}

export interface InviteMemberPayload {
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
  team_ids?: string[];
}

export interface CreateDirectUserPayload {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  role: string;
  is_active?: boolean;
  team_ids?: string[];
}

export interface UpdateUserPayload {
  first_name?: string;
  last_name?: string;
  role?: string;
  is_active?: boolean;
  team_ids?: string[];
}

export interface CreateTeamPayload {
  name: string;
  description?: string;
  color?: string;
  lead_id?: string | null;
  contact_email?: string;
  member_ids?: string[];
}

export interface UpdateTeamPayload {
  name?: string;
  description?: string;
  color?: string;
  lead_id?: string | null;
  contact_email?: string;
  member_ids?: string[];
}
