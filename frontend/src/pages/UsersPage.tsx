import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { usePersistentViewMode } from '../hooks/usePersistentViewMode';

// NOC Toolkit Components
import NOCPageHeader from '../components/common/noc/NOCPageHeader';
import NOCKpiGrid from '../components/common/noc/NOCKpiGrid';
import NOCKpiCard from '../components/common/noc/NOCKpiCard';
import NOCToolbar, { NOCStatusPill, NOCCategoryChip } from '../components/common/noc/NOCToolbar';
import NOCBulkActionBar from '../components/common/noc/NOCBulkActionBar';

// Users & Teams Components
import UserTableView from '../components/users/UserTableView';
import UserCard from '../components/users/UserCard';
import TeamsView from '../components/users/TeamsView';
import UserDetailDrawer from '../components/users/UserDetailDrawer';
import TeamDetailDrawer from '../components/users/TeamDetailDrawer';
import UserFormModal from '../components/users/UserFormModal';
import TeamFormModal from '../components/users/TeamFormModal';
import ConfirmDelete from '../components/common/ConfirmDelete';

// Types
import type {
  TeamMember,
  Team,
  InviteMemberPayload,
  CreateDirectUserPayload,
  UpdateUserPayload,
  CreateTeamPayload,
  UpdateTeamPayload,
} from '../types/users';

// Icons
import {
  Users,
  UserPlus,
  Send,
  Layers,
  Download,
  Shield,
  CheckCircle2,
  Clock,
  XCircle,
  Plus,
  Trash2,
  Power,
  Filter,
  Check,
  Loader2,
  Sparkles,
} from 'lucide-react';

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();

  // Tab: 'members' (Todos los Integrantes) | 'teams' (Equipos de Trabajo)
  const [activeSection, setActiveSection] = useState<'members' | 'teams'>('members');

  // View mode with persistent localStorage ('grid' | 'table')
  const [viewMode, setViewMode] = usePersistentViewMode('users', 'table');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Drawer state
  const [selectedMemberForDrawer, setSelectedMemberForDrawer] = useState<TeamMember | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Team Drawer state
  const [selectedTeamForDrawer, setSelectedTeamForDrawer] = useState<Team | null>(null);
  const [isTeamDrawerOpen, setIsTeamDrawerOpen] = useState(false);

  // Modals state
  const [userModal, setUserModal] = useState<{
    isOpen: boolean;
    mode: 'invite' | 'direct' | 'edit';
    member: TeamMember | null;
  }>({
    isOpen: false,
    mode: 'invite',
    member: null,
  });

  const [teamModal, setTeamModal] = useState<{
    isOpen: boolean;
    team: Team | null;
  }>({
    isOpen: false,
    team: null,
  });

  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    type: 'member' | 'team';
    targetId: string;
    targetName: string;
    isInvitation?: boolean;
  }>({
    isOpen: false,
    type: 'member',
    targetId: '',
    targetName: '',
  });

  const [resendingId, setResendingId] = useState<string | null>(null);
  const [isExportingCSV, setIsExportingCSV] = useState(false);

  // Auto-refresh countdown (30s)
  const autoRefresh = useAutoRefresh({
    intervalSeconds: 30,
    initialEnabled: true,
  });

  // Query: Unified Members & Invitations List
  const {
    data: members = [],
    isLoading: isLoadingMembers,
    refetch: refetchMembers,
  } = useQuery<TeamMember[]>({
    queryKey: ['org-members-unified'],
    queryFn: async () => {
      const response = await api.get('organizations/members/');
      return (response.data?.data || []) as TeamMember[];
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  // Query: Teams & Squads List
  const {
    data: teams = [],
    isLoading: isLoadingTeams,
    refetch: refetchTeams,
  } = useQuery<Team[]>({
    queryKey: ['teams-list'],
    queryFn: async () => {
      const response = await api.get('users/teams/');
      return (response.data?.data || []) as Team[];
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  // ================= MUTATIONS =================

  // 1. Invite via SMTP Magic Link
  const inviteMutation = useMutation({
    mutationFn: async (payload: InviteMemberPayload) => {
      await api.post('organizations/members/', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members-unified'] });
      queryClient.invalidateQueries({ queryKey: ['teams-list'] });
      setUserModal({ isOpen: false, mode: 'invite', member: null });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || err.response?.data?.detail || 'Error al enviar invitación.');
    },
  });

  // 2. Create Direct User
  const createDirectMutation = useMutation({
    mutationFn: async (payload: CreateDirectUserPayload) => {
      await api.post('users/', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members-unified'] });
      queryClient.invalidateQueries({ queryKey: ['teams-list'] });
      setUserModal({ isOpen: false, mode: 'direct', member: null });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || err.response?.data?.detail || 'Error al crear usuario.');
    },
  });

  // 3. Update User
  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateUserPayload }) => {
      await api.patch(`users/${id}/`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members-unified'] });
      queryClient.invalidateQueries({ queryKey: ['teams-list'] });
      setUserModal({ isOpen: false, mode: 'edit', member: null });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || err.response?.data?.detail || 'Error al actualizar usuario.');
    },
  });

  // 4. Delete Member or Revoke Invitation
  const deleteMemberMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`organizations/members/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members-unified'] });
      queryClient.invalidateQueries({ queryKey: ['teams-list'] });
      setDeleteConfirm({ isOpen: false, type: 'member', targetId: '', targetName: '' });
      setSelectedIds((prev) => prev.filter((id) => id !== deleteConfirm.targetId));
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || err.response?.data?.detail || 'Error al eliminar usuario o revocar invitación.');
    },
  });

  // 5. Resend Invitation Magic Link
  const resendInviteMutation = useMutation({
    mutationFn: async (memberId: string) => {
      setResendingId(memberId);
      const response = await api.post(`organizations/members/${memberId}/resend/`);
      return response.data;
    },
    onSuccess: (data) => {
      setResendingId(null);
      alert(data?.message || 'Invitación reenviada correctamente con nuevo enlace magic link.');
    },
    onError: (err: any) => {
      setResendingId(null);
      alert(err.response?.data?.message || err.response?.data?.detail || 'Error al reenviar invitación.');
    },
  });

  // 6. Bulk Action
  const bulkActionMutation = useMutation({
    mutationFn: async ({
      action,
      ids,
    }: {
      action: 'activate' | 'deactivate' | 'delete';
      ids: string[];
    }) => {
      const response = await api.post('organizations/members/bulk-action/', {
        action,
        member_ids: ids,
      });
      return response.data;
    },
    onSuccess: (data) => {
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['org-members-unified'] });
      queryClient.invalidateQueries({ queryKey: ['teams-list'] });
      if (data?.message) {
        // Notification could be shown here
      }
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || err.response?.data?.detail || 'Error al ejecutar acción en lote.');
    },
  });

  // 7. Team Mutations
  const createTeamMutation = useMutation({
    mutationFn: async (payload: CreateTeamPayload) => {
      await api.post('users/teams/', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams-list'] });
      queryClient.invalidateQueries({ queryKey: ['org-members-unified'] });
      setTeamModal({ isOpen: false, team: null });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || err.response?.data?.detail || 'Error al crear equipo.');
    },
  });

  const updateTeamMutation = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateTeamPayload;
    }) => {
      await api.patch(`users/teams/${id}/`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams-list'] });
      queryClient.invalidateQueries({ queryKey: ['org-members-unified'] });
      setTeamModal({ isOpen: false, team: null });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || err.response?.data?.detail || 'Error al actualizar equipo.');
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async (teamId: string) => {
      await api.delete(`users/teams/${teamId}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams-list'] });
      queryClient.invalidateQueries({ queryKey: ['org-members-unified'] });
      setDeleteConfirm({ isOpen: false, type: 'team', targetId: '', targetName: '' });
      if (selectedTeamForDrawer?.id === deleteConfirm.targetId) {
        setIsTeamDrawerOpen(false);
        setSelectedTeamForDrawer(null);
      }
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || err.response?.data?.detail || 'Error al eliminar equipo.');
    },
  });

  // 8. Seed Default Squads
  const seedTeamsMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('users/teams/seed-defaults/');
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['teams-list'] });
      queryClient.invalidateQueries({ queryKey: ['org-members-unified'] });
      if (data?.message) {
        alert(data.message);
      }
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || err.response?.data?.detail || 'Error al aprovisionar cuadrillas sugeridas.');
    },
  });

  // ================= CALCULATIONS & FILTERING =================

  const totalMembers = members.length;
  const activeMembers = members.filter((m) => m.status_code === 'active').length;
  const pendingMembers = members.filter((m) => m.status_code === 'pending').length;
  const revokedMembers = members.filter((m) => m.status_code === 'revoked').length;
  const totalTeams = teams.length;

  const activePercent = totalMembers > 0 ? Math.round((activeMembers / totalMembers) * 100) : 0;
  const avgTeamMembers =
    totalTeams > 0
      ? Math.round((teams.reduce((acc, t) => acc + (t.member_count || 0), 0) / totalTeams) * 10) / 10
      : 0;

  // Filtered members
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      // 1. Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const fullName = `${m.first_name || ''} ${m.last_name || ''}`.toLowerCase();
        const email = (m.email || '').toLowerCase();
        const teamNames = (m.teams || []).map((t) => t.name.toLowerCase()).join(' ');
        if (!fullName.includes(q) && !email.includes(q) && !teamNames.includes(q)) {
          return false;
        }
      }

      // 2. Role filter
      if (roleFilter !== 'all' && m.role !== roleFilter) {
        return false;
      }

      // 3. Status filter
      if (statusFilter !== 'all' && m.status_code !== statusFilter) {
        return false;
      }

      // 4. Team filter
      if (teamFilter !== 'all') {
        const hasTeam = (m.teams || []).some((t) => t.id === teamFilter);
        if (!hasTeam) return false;
      }

      return true;
    });
  }, [members, searchTerm, roleFilter, statusFilter, teamFilter]);

  // Bulk selection toggles
  const handleToggleSelect = (m: TeamMember) => {
    setSelectedIds((prev) =>
      prev.includes(m.id) ? prev.filter((id) => id !== m.id) : [...prev, m.id]
    );
  };

  const handleSelectAllToggle = () => {
    if (selectedIds.length === filteredMembers.length && filteredMembers.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredMembers.map((m) => m.id));
    }
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  // Bulk actions trigger
  const handleBulkAction = (action: 'activate' | 'deactivate' | 'delete') => {
    if (selectedIds.length === 0) return;

    const actionText =
      action === 'activate'
        ? 'activar'
        : action === 'deactivate'
        ? 'suspender / desactivar'
        : 'eliminar o revocar';

    if (
      confirm(
        `¿Estás seguro de que deseas ${actionText} los ${selectedIds.length} integrantes seleccionados?`
      )
    ) {
      bulkActionMutation.mutate({ action, ids: selectedIds });
    }
  };

  // Export to CSV official handler
  const handleExportCSV = async () => {
    setIsExportingCSV(true);
    try {
      const response = await api.get('organizations/members/export-csv/', {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `sentinel_usuarios_equipos_${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Error al exportar inventario de usuarios y equipos a formato CSV.');
    } finally {
      setIsExportingCSV(false);
    }
  };

  // Toggle active status in 1-clic
  const handleToggleActive = (m: TeamMember) => {
    if (currentUser?.email === m.email) {
      alert('No puedes desactivar tu propia cuenta actual.');
      return;
    }
    if (m.is_invitation) {
      alert('Esta es una invitación pendiente. Puedes revocarla o reenviarla por correo.');
      return;
    }
    updateMutation.mutate({
      id: m.id,
      payload: { is_active: !m.is_active },
    });
  };

  // Delete single member trigger
  const handleDeleteMember = (m: TeamMember) => {
    if (currentUser?.email === m.email) {
      alert('No puedes eliminar tu propio usuario de la organización.');
      return;
    }
    setDeleteConfirm({
      isOpen: true,
      type: 'member',
      targetId: m.id,
      targetName: m.email,
      isInvitation: m.is_invitation,
    });
  };

  // Delete single team trigger
  const handleDeleteTeam = (t: Team) => {
    setDeleteConfirm({
      isOpen: true,
      type: 'team',
      targetId: t.id,
      targetName: t.name,
    });
  };

  // Open drawer
  const handleSelectMemberForDrawer = (m: TeamMember) => {
    setSelectedMemberForDrawer(m);
    setIsDrawerOpen(true);
  };

  // Drawer update wrapper
  const handleDrawerUpdateMember = async (memberId: string, payload: UpdateUserPayload) => {
    await updateMutation.mutateAsync({ id: memberId, payload });
    // Update local drawer state if needed
    setSelectedMemberForDrawer((prev) => (prev ? { ...prev, ...payload } : null));
  };

  // Team Drawer update wrapper
  const handleDrawerUpdateTeam = async (teamId: string, payload: UpdateTeamPayload) => {
    await updateTeamMutation.mutateAsync({ id: teamId, payload });
  };

  // Toolbar setup
  const roleCategories: NOCCategoryChip[] = [
    { id: 'all', label: 'Todos los Roles' },
    { id: 'admin', label: 'Administrador' },
    { id: 'operator', label: 'Operador' },
    { id: 'viewer', label: 'Visualizador' },
  ];

  const statusPills: NOCStatusPill[] = [
    { id: 'all', label: 'Todos', count: totalMembers, variant: 'neutral' },
    { id: 'active', label: 'Activos', count: activeMembers, variant: 'success' },
    { id: 'pending', label: 'Pendientes', count: pendingMembers, variant: 'warning' },
    { id: 'revoked', label: 'Inactivos', count: revokedMembers, variant: 'danger' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. NOC Header */}
      <NOCPageHeader
        title="Usuarios y Equipos"
        badgeText="SEGURIDAD & ACCESO"
        description="Administración integral de operadores, cuadrillas de trabajo, invitaciones por correo y control de accesos RBAC"
        icon={<Users size={28} />}
        autoRefresh={{
          enabled: autoRefresh.enabled,
          countdown: autoRefresh.countdown,
          onToggle: autoRefresh.toggle,
        }}
        actions={
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={isExportingCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-bg-card border border-border-base text-text-main hover:border-accent-green/50 hover:bg-bg-card-hover transition-all disabled:opacity-50"
            >
              {isExportingCSV ? (
                <Loader2 size={13} className="animate-spin text-accent-green" />
              ) : (
                <Download size={13} className="text-accent-green" />
              )}
              Exportar CSV
            </button>

            <button
              type="button"
              onClick={() => setTeamModal({ isOpen: true, team: null })}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-bg-card border border-border-base text-text-main hover:border-accent-purple/50 hover:bg-bg-card-hover transition-all"
            >
              <Layers size={13} className="text-accent-purple" />
              Nuevo Equipo
            </button>

            <button
              type="button"
              onClick={() => setUserModal({ isOpen: true, mode: 'invite', member: null })}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-accent-green text-black hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20"
            >
              <Send size={13} />
              Invitar por Correo (SMTP)
            </button>

            <button
              type="button"
              onClick={() => setUserModal({ isOpen: true, mode: 'direct', member: null })}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-bg-card border border-border-base text-text-main hover:border-accent-blue/50 hover:bg-bg-card-hover transition-all"
            >
              <UserPlus size={13} className="text-accent-blue" />
              Crear Usuario
            </button>
          </div>
        }
      />

      {/* 2. Top KPI Cards */}
      <NOCKpiGrid columns={4}>
        {/* KPI 1: Total Integrantes */}
        <NOCKpiCard
          title="Total Integrantes"
          icon={<Users size={16} className="text-accent-blue" />}
          badge={{
            text: `${totalMembers} registros`,
            variant: 'neutral',
          }}
          value={totalMembers}
          valueColor="text-text-main"
          valueSuffix="en organización"
          subtitle="Directorio unificado de operadores"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Usuarios activos</span>
              <span className="font-mono text-text-main font-medium">
                {activeMembers} habilitados
              </span>
            </div>
          }
        />

        {/* KPI 2: Cuentas Activas */}
        <NOCKpiCard
          title="Cuentas Activas"
          icon={<CheckCircle2 size={16} className="text-accent-green" />}
          badge={{
            text: `${activePercent}%`,
            variant: activePercent >= 90 ? 'success' : 'warning',
          }}
          value={activeMembers}
          valueColor="text-accent-green"
          valueSuffix={`de ${totalMembers} en servicio`}
          subtitle="Operadores con acceso vigente a la plataforma"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Estado de acceso</span>
              <span className="text-accent-green font-medium">
                {revokedMembers > 0 ? `${revokedMembers} suspendidos` : '100% operativos'}
              </span>
            </div>
          }
        />

        {/* KPI 3: Invitaciones Pendientes */}
        <NOCKpiCard
          title="Invitaciones Pendientes"
          icon={
            <Clock
              size={16}
              className={pendingMembers > 0 ? 'text-accent-yellow' : 'text-accent-green'}
            />
          }
          badge={{
            text: pendingMembers > 0 ? `${pendingMembers} por confirmar` : 'Al día',
            variant: pendingMembers > 0 ? 'warning' : 'neutral',
          }}
          value={pendingMembers}
          valueColor={pendingMembers > 0 ? 'text-accent-yellow' : 'text-text-main'}
          valueSuffix="enlaces emitidos"
          subtitle={
            pendingMembers > 0
              ? 'Esperando confirmación del enlace seguro'
              : 'Sin invitaciones pendientes por validar'
          }
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Magic link SMTP</span>
              <span
                className={
                  pendingMembers > 0
                    ? 'text-accent-yellow font-medium'
                    : 'text-accent-green font-medium'
                }
              >
                {pendingMembers > 0 ? 'Token temporal activo' : 'Completadas'}
              </span>
            </div>
          }
        />

        {/* KPI 4: Equipos de Trabajo */}
        <NOCKpiCard
          title="Equipos de Trabajo"
          icon={<Layers size={16} className="text-accent-purple" />}
          badge={{
            text: totalTeams > 0 ? `${totalTeams} cuadrillas` : 'Sin configurar',
            variant: totalTeams > 0 ? 'info' : 'neutral',
          }}
          value={totalTeams}
          valueColor="text-accent-purple"
          valueSuffix="squads operativos"
          subtitle={
            totalTeams > 0
              ? `${avgTeamMembers} integrantes promedio por equipo`
              : 'Organiza operadores en cuadrillas especializadas'
          }
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Personal asignado</span>
              <span className="font-mono text-accent-purple font-medium">
                {teams.reduce((acc, t) => acc + (t.member_count || 0), 0)} miembros
              </span>
            </div>
          }
        />
      </NOCKpiGrid>

      {/* 3. Section Tabs (Todos los Integrantes vs Equipos de Trabajo) */}
      <div className="flex items-center justify-between border-b border-border-base pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSection('members')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSection === 'members'
                ? 'bg-bg-card border border-border-accent text-text-main shadow-xs'
                : 'text-text-dim hover:text-text-main hover:bg-bg-card/50'
            }`}
          >
            <Users size={14} className={activeSection === 'members' ? 'text-accent-green' : ''} />
            Todos los Integrantes
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                activeSection === 'members'
                  ? 'bg-accent-green/10 text-accent-green font-bold'
                  : 'bg-bg-dark text-text-dim'
              }`}
            >
              {totalMembers}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('teams')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSection === 'teams'
                ? 'bg-bg-card border border-border-accent text-text-main shadow-xs'
                : 'text-text-dim hover:text-text-main hover:bg-bg-card/50'
            }`}
          >
            <Layers size={14} className={activeSection === 'teams' ? 'text-accent-purple' : ''} />
            Equipos de Trabajo
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                activeSection === 'teams'
                  ? 'bg-accent-purple/10 text-accent-purple font-bold'
                  : 'bg-bg-dark text-text-dim'
              }`}
            >
              {totalTeams}
            </span>
          </button>
        </div>
      </div>

      {/* 4. CONTENT ACCORDING TO ACTIVE SECTION */}
      {activeSection === 'teams' ? (
        <TeamsView
          teams={teams}
          onSelectTeam={(team) => {
            setSelectedTeamForDrawer(team);
            setIsTeamDrawerOpen(true);
          }}
          onCreateTeam={() => setTeamModal({ isOpen: true, team: null })}
          onEditTeam={(team) => setTeamModal({ isOpen: true, team })}
          onDeleteTeam={handleDeleteTeam}
          onManageMembers={(team) => setTeamModal({ isOpen: true, team })}
          onSeedDefaults={() => seedTeamsMutation.mutate()}
          isSeeding={seedTeamsMutation.isPending}
        />
      ) : (
        <div className="space-y-4">
          {/* NOC Toolbar with Search, Categories (Roles), Status Pills, View Mode Switcher and Team Filter */}
          <NOCToolbar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Buscar por nombre, correo electrónico o equipo..."
            categories={roleCategories}
            categoryLabel="Rol:"
            selectedCategory={roleFilter}
            onCategoryChange={setRoleFilter}
            statusPills={statusPills}
            selectedStatus={statusFilter}
            onStatusChange={setStatusFilter}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            extraFilters={
              teams.length > 0 ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-dim font-mono flex items-center gap-1">
                    <Filter size={11} /> Equipo:
                  </span>
                  <select
                    value={teamFilter}
                    onChange={(e) => setTeamFilter(e.target.value)}
                    className="bg-bg-dark border border-border-base rounded-full px-3 py-1.5 text-xs text-text-main focus:outline-none focus:border-accent-green"
                  >
                    <option value="all">Todos los Equipos</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null
            }
          />

          {/* Sticky Bulk Action Bar */}
          <NOCBulkActionBar
            selectedCount={selectedIds.length}
            onClearSelection={handleClearSelection}
            itemLabel="integrante"
            actions={
              <>
                <button
                  type="button"
                  onClick={() => handleBulkAction('activate')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-accent-green/10 text-accent-green hover:bg-accent-green/20 transition-all border border-accent-green/30"
                >
                  <Power size={12} /> Habilitar Cuentas
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkAction('deactivate')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-accent-yellow/10 text-accent-yellow hover:bg-accent-yellow/20 transition-all border border-accent-yellow/30"
                >
                  <Power size={12} /> Suspender Cuentas
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkAction('delete')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-accent-red/10 text-accent-red hover:bg-accent-red/20 transition-all border border-accent-red/30"
                >
                  <Trash2 size={12} /> Eliminar / Revocar
                </button>
              </>
            }
          />

          {/* Members Content: Table vs Grid */}
          {isLoadingMembers ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-text-dim">
              <Loader2 size={28} className="animate-spin text-accent-green" />
              <p className="text-xs font-mono">Cargando directorio de usuarios y equipos...</p>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="bg-bg-card border border-border-base rounded-2xl p-12 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-accent-green/10 border border-accent-green/20 text-accent-green flex items-center justify-center mx-auto">
                <Users size={28} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-main">
                  No se encontraron integrantes
                </h3>
                <p className="text-xs text-text-dim max-w-md mx-auto mt-1">
                  {searchTerm || roleFilter !== 'all' || statusFilter !== 'all' || teamFilter !== 'all'
                    ? 'No hay registros que coincidan con los filtros aplicados. Intenta restablecer la búsqueda.'
                    : 'Aún no hay integrantes registrados en esta organización.'}
                </p>
              </div>
              {(searchTerm || roleFilter !== 'all' || statusFilter !== 'all' || teamFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setRoleFilter('all');
                    setStatusFilter('all');
                    setTeamFilter('all');
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-bg-dark border border-border-base text-text-main hover:bg-bg-card transition-colors"
                >
                  Restablecer Filtros
                </button>
              )}
            </div>
          ) : viewMode === 'table' ? (
            <UserTableView
              members={filteredMembers}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onSelectAllToggle={handleSelectAllToggle}
              onSelectMember={handleSelectMemberForDrawer}
              onToggleActive={handleToggleActive}
              onEdit={(m) => setUserModal({ isOpen: true, mode: 'edit', member: m })}
              onDelete={handleDeleteMember}
              onResendInvite={(m) => resendInviteMutation.mutate(m.id)}
              currentUserId={currentUser?.id}
              resendingId={resendingId}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMembers.map((member) => (
                <UserCard
                  key={member.id}
                  member={member}
                  isSelected={selectedIds.includes(member.id)}
                  onToggleSelect={handleToggleSelect}
                  onSelectMember={handleSelectMemberForDrawer}
                  onToggleActive={handleToggleActive}
                  onEdit={(m) => setUserModal({ isOpen: true, mode: 'edit', member: m })}
                  onDelete={handleDeleteMember}
                  onResendInvite={(m) => resendInviteMutation.mutate(m.id)}
                  currentUserId={currentUser?.id}
                  isResending={resendingId === member.id}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. SLIDE-OVER DRAWER (4 Pestañas) */}
      <UserDetailDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        member={selectedMemberForDrawer}
        availableTeams={teams}
        onUpdateMember={handleDrawerUpdateMember}
        onToggleActive={handleToggleActive}
        onResendInvite={(m) => resendInviteMutation.mutate(m.id)}
        onDelete={handleDeleteMember}
        currentUserId={currentUser?.id}
        isResending={resendingId === selectedMemberForDrawer?.id}
      />

      {/* 5.1 TEAM SLIDE-OVER DRAWER (4 Pestañas) */}
      <TeamDetailDrawer
        isOpen={isTeamDrawerOpen}
        onClose={() => setIsTeamDrawerOpen(false)}
        team={teams.find((t) => t.id === selectedTeamForDrawer?.id) || selectedTeamForDrawer}
        availableMembers={members}
        onUpdateTeam={handleDrawerUpdateTeam}
        onDeleteTeam={handleDeleteTeam}
        onEditTeam={(team) => {
          setIsTeamDrawerOpen(false);
          setTeamModal({ isOpen: true, team });
        }}
      />

      {/* 6. USER MODAL (Invite / Direct / Edit) */}
      <UserFormModal
        isOpen={userModal.isOpen}
        onClose={() => setUserModal({ isOpen: false, mode: 'invite', member: null })}
        mode={userModal.mode}
        editingMember={userModal.member}
        availableTeams={teams}
        onSubmitInvite={async (payload) => {
          await inviteMutation.mutateAsync(payload);
        }}
        onSubmitDirect={async (payload) => {
          await createDirectMutation.mutateAsync(payload);
        }}
        onSubmitEdit={async (id, payload) => {
          await updateMutation.mutateAsync({ id, payload });
        }}
        isLoading={
          inviteMutation.isPending ||
          createDirectMutation.isPending ||
          updateMutation.isPending
        }
      />

      {/* 7. TEAM MODAL (Create / Edit Squads) */}
      <TeamFormModal
        isOpen={teamModal.isOpen}
        onClose={() => setTeamModal({ isOpen: false, team: null })}
        team={teamModal.team}
        availableMembers={members}
        onSubmit={async (data) => {
          if (teamModal.team) {
            await updateTeamMutation.mutateAsync({
              id: teamModal.team.id,
              payload: data,
            });
          } else {
            await createTeamMutation.mutateAsync(data);
          }
        }}
        isLoading={createTeamMutation.isPending || updateTeamMutation.isPending}
      />

      {/* 8. CONFIRM DELETE MODAL */}
      <ConfirmDelete
        isOpen={deleteConfirm.isOpen}
        title={
          deleteConfirm.type === 'team'
            ? 'Eliminar Equipo de Trabajo'
            : deleteConfirm.isInvitation
            ? 'Revocar Invitación'
            : 'Eliminar Usuario'
        }
        itemName={deleteConfirm.targetName}
        isDeleting={
          deleteConfirm.type === 'team'
            ? deleteTeamMutation.isPending
            : deleteMemberMutation.isPending
        }
        onConfirm={() => {
          if (deleteConfirm.type === 'team') {
            deleteTeamMutation.mutate(deleteConfirm.targetId);
          } else {
            deleteMemberMutation.mutate(deleteConfirm.targetId);
          }
        }}
        onClose={() =>
          setDeleteConfirm({ isOpen: false, type: 'member', targetId: '', targetName: '' })
        }
      />
    </div>
  );
}
