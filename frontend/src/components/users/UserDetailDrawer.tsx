import React, { useState, useEffect } from 'react';
import type { TeamMember, Team, UpdateUserPayload } from '../../types/users';
import NOCDrawer, { NOCDrawerTab } from '../common/noc/NOCDrawer';
import { api } from '../../services/api';
import { useQuery } from '@tanstack/react-query';
import {
  User,
  Shield,
  Layers,
  History,
  Lock,
  Mail,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Send,
  Trash2,
  Power,
  Save,
  Loader2,
  Check,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

interface UserDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  member: TeamMember | null;
  availableTeams: Team[];
  onUpdateMember: (memberId: string, payload: UpdateUserPayload) => Promise<void>;
  onToggleActive: (member: TeamMember) => void;
  onResendInvite: (member: TeamMember) => void;
  onDelete: (member: TeamMember) => void;
  currentUserId?: string;
  isResending?: boolean;
}

interface AuditLogItem {
  id: string;
  user_email: string;
  action: string;
  module: string;
  description: string;
  result: string;
  ip_address: string;
  created_at: string;
}

const DRAWER_TABS: NOCDrawerTab[] = [
  { id: 'profile', label: 'Perfil & Cuenta', icon: <User size={14} /> },
  { id: 'teams_role', label: 'Equipos & Rol', icon: <Layers size={14} /> },
  { id: 'audit', label: 'Actividad & Auditoría', icon: <History size={14} /> },
  { id: 'security', label: 'Seguridad & Acciones', icon: <Lock size={14} /> },
];

export default function UserDetailDrawer({
  isOpen,
  onClose,
  member,
  availableTeams,
  onUpdateMember,
  onToggleActive,
  onResendInvite,
  onDelete,
  currentUserId,
  isResending,
}: UserDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState('profile');
  const [selectedRole, setSelectedRole] = useState(member?.role || 'member');
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [isSavingRoleTeams, setIsSavingRoleTeams] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync state when member changes
  useEffect(() => {
    if (member) {
      setSelectedRole(member.role || 'member');
      const assignedIds = (member.teams || []).map((t) => t.id);
      setSelectedTeamIds(assignedIds);
      setActiveTab('profile');
      setSaveSuccess(false);
    }
  }, [member]);

  // Query audit logs when drawer is open and member is selected
  const { data: auditLogs, isLoading: isLoadingAudit } = useQuery<AuditLogItem[]>({
    queryKey: ['user-audit-logs', member?.email],
    queryFn: async () => {
      if (!member?.email) return [];
      try {
        const response = await api.get('audit-logs/');
        const allLogs = (response.data?.data || []) as AuditLogItem[];
        return allLogs.filter((log) => log.user_email?.toLowerCase() === member.email.toLowerCase());
      } catch {
        return [];
      }
    },
    enabled: isOpen && !!member?.email && activeTab === 'audit',
  });

  if (!member) return null;

  const isSelf = currentUserId === member.id;
  const isPending = member.status_code === 'pending';
  const fullName = `${member.first_name || ''} ${member.last_name || ''}`.trim() || 'Sin nombre asignado';

  const getInitials = () => {
    const f = member.first_name ? member.first_name[0].toUpperCase() : '';
    const l = member.last_name ? member.last_name[0].toUpperCase() : '';
    return f || l ? `${f}${l}` : member.email.slice(0, 2).toUpperCase();
  };

  const handleSaveRoleTeams = async () => {
    if (member.is_invitation) {
      alert('Las invitaciones pendientes no soportan edición directa de equipos hasta ser aceptadas.');
      return;
    }
    setIsSavingRoleTeams(true);
    try {
      await onUpdateMember(member.id, {
        role: selectedRole,
        team_ids: selectedTeamIds,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Error al actualizar rol y equipos.');
    } finally {
      setIsSavingRoleTeams(false);
    }
  };

  const toggleTeam = (teamId: string) => {
    setSelectedTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    );
  };

  // Status Badge for Drawer
  const statusBadge = (
    <div className="flex items-center gap-1.5">
      {member.status_code === 'active' && (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent-green/10 text-accent-green border border-accent-green/20">
          <CheckCircle2 size={12} />
          Activo
        </span>
      )}
      {member.status_code === 'pending' && (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/20">
          <Clock size={12} />
          Invitación Pendiente
        </span>
      )}
      {member.status_code === 'revoked' && (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent-red/10 text-accent-red border border-accent-red/20">
          <XCircle size={12} />
          Inactivo / Revocado
        </span>
      )}
    </div>
  );

  // Quick KPIs for Drawer Header
  const quickKpis = (
    <div className="grid grid-cols-3 gap-2 w-full pt-1">
      <div className="bg-bg-card border border-border-base rounded-xl p-2.5 text-center">
        <p className="text-[10px] text-text-dim uppercase tracking-wider font-mono">Rol Actual</p>
        <p className="text-xs font-bold text-text-main mt-0.5 capitalize">
          {member.role === 'admin' ? 'Admin' : member.role === 'operator' ? 'Operador' : member.role === 'viewer' ? 'Lector' : member.role}
        </p>
      </div>
      <div className="bg-bg-card border border-border-base rounded-xl p-2.5 text-center">
        <p className="text-[10px] text-text-dim uppercase tracking-wider font-mono">Equipos</p>
        <p className="text-xs font-bold text-accent-blue mt-0.5">
          {member.teams?.length || 0} asignados
        </p>
      </div>
      <div className="bg-bg-card border border-border-base rounded-xl p-2.5 text-center">
        <p className="text-[10px] text-text-dim uppercase tracking-wider font-mono">Tipo</p>
        <p className="text-xs font-bold text-accent-purple mt-0.5">
          {member.is_invitation ? 'Invitación' : 'Usuario'}
        </p>
      </div>
    </div>
  );

  return (
    <NOCDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={fullName !== 'Sin nombre asignado' ? fullName : member.email}
      subtitle={
        <span className="text-xs text-text-dim font-mono flex items-center gap-1.5">
          <Mail size={12} className="text-accent-blue" />
          {member.email}
          {isSelf && (
            <span className="px-1.5 py-0.2 rounded text-[10px] bg-accent-green/20 text-accent-green font-semibold">
              Tú
            </span>
          )}
        </span>
      }
      statusBadge={statusBadge}
      quickKpis={quickKpis}
      tabs={DRAWER_TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      maxWidthClass="max-w-2xl"
    >
      {/* TAB 1: PERFIL & CUENTA */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {/* Avatar Hero */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-bg-card border border-border-base">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-purple/20 to-accent-blue/20 border border-accent-purple/30 flex items-center justify-center text-text-main font-bold text-xl shadow-inner font-mono">
              {getInitials()}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-text-main truncate">
                {fullName}
              </h3>
              <p className="text-xs text-text-muted font-mono truncate">{member.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[11px] font-mono text-text-dim flex items-center gap-1">
                  <Calendar size={12} />
                  Alta: {member.date_joined ? new Date(member.date_joined).toLocaleDateString() : 'Desconocida'}
                </span>
              </div>
            </div>
          </div>

          {/* Pending Invite Alert */}
          {isPending && (
            <div className="p-4 rounded-2xl bg-accent-yellow/5 border border-accent-yellow/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-accent-yellow shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-text-main">
                    Invitación por Correo Pendiente
                  </h4>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    El usuario aún no ha aceptado su enlace de acceso seguro enviado por correo.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onResendInvite(member)}
                disabled={isResending}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-accent-yellow/20 text-accent-yellow hover:bg-accent-yellow/30 transition-all shrink-0 disabled:opacity-50"
              >
                {isResending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                Reenviar Magic Link
              </button>
            </div>
          )}

          {/* User Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-bg-card border border-border-base space-y-1">
              <p className="text-[10px] text-text-dim font-mono uppercase">Nombre</p>
              <p className="text-xs font-semibold text-text-main">{member.first_name || '—'}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-bg-card border border-border-base space-y-1">
              <p className="text-[10px] text-text-dim font-mono uppercase">Apellidos</p>
              <p className="text-xs font-semibold text-text-main">{member.last_name || '—'}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-bg-card border border-border-base space-y-1">
              <p className="text-[10px] text-text-dim font-mono uppercase">Correo Corporativo</p>
              <p className="text-xs font-mono font-medium text-text-main truncate">{member.email}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-bg-card border border-border-base space-y-1">
              <p className="text-[10px] text-text-dim font-mono uppercase">Último Inicio de Sesión</p>
              <p className="text-xs font-mono text-text-muted flex items-center gap-1">
                <Clock size={12} className="text-accent-blue" />
                {member.last_login ? new Date(member.last_login).toLocaleString() : 'Sin registros'}
              </p>
            </div>
          </div>

          {/* Teams Summary */}
          <div className="p-4 rounded-2xl bg-bg-card border border-border-base space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-text-main flex items-center gap-2">
                <Layers size={14} className="text-accent-blue" />
                Equipos de Trabajo Asociados
              </h4>
              <button
                type="button"
                onClick={() => setActiveTab('teams_role')}
                className="text-xs font-semibold text-accent-green hover:underline"
              >
                Gestionar
              </button>
            </div>
            {member.teams && member.teams.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {member.teams.map((team) => (
                  <span
                    key={team.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-bg-dark border border-border-base text-text-main shadow-xs"
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: team.color || '#3B82F6' }}
                    />
                    {team.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-dim italic">
                El usuario no pertenece a ningún equipo actualmente.
              </p>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: EQUIPOS & ROL */}
      {activeTab === 'teams_role' && (
        <div className="space-y-6">
          {member.is_invitation && (
            <div className="p-3.5 rounded-xl bg-accent-yellow/10 border border-accent-yellow/20 text-accent-yellow text-xs flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" />
              <span>
                Esta cuenta es una invitación pendiente. Los equipos y roles podrán actualizarse directamente una vez que el usuario complete su registro.
              </span>
            </div>
          )}

          {/* Role Selection */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-text-main flex items-center gap-2">
              <Shield size={14} className="text-accent-purple" />
              Rol y Nivel de Privilegios
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                {
                  id: 'admin',
                  name: 'Administrador',
                  desc: 'Acceso total a configuración, usuarios y alertas',
                  icon: <ShieldCheck size={16} className="text-accent-purple" />,
                },
                {
                  id: 'operator',
                  name: 'Operador',
                  desc: 'Gestión operativa, incidentes y escaneos en vivo',
                  icon: <UserCheck size={16} className="text-accent-blue" />,
                },
                {
                  id: 'viewer',
                  name: 'Visualizador',
                  desc: 'Solo lectura de métricas de SLA y telemetría',
                  icon: <Shield size={16} className="text-accent-green" />,
                },
              ].map((roleOption) => {
                const isSelected = selectedRole === roleOption.id;
                return (
                  <button
                    key={roleOption.id}
                    type="button"
                    disabled={member.is_invitation}
                    onClick={() => setSelectedRole(roleOption.id)}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-accent-purple/10 border-accent-purple shadow-sm ring-1 ring-accent-purple/30'
                        : 'bg-bg-card border-border-base hover:border-border-accent'
                    } ${member.is_invitation ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <div className="flex items-center gap-2">
                        {roleOption.icon}
                        <span className="text-xs font-bold text-text-main">{roleOption.name}</span>
                      </div>
                      {isSelected && (
                        <span className="w-4 h-4 rounded-full bg-accent-purple text-white flex items-center justify-center">
                          <Check size={10} />
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-text-dim leading-snug">{roleOption.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Teams Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-text-main flex items-center gap-2">
                <Layers size={14} className="text-accent-blue" />
                Asignación a Equipos de Trabajo
              </label>
              <span className="text-[11px] font-mono text-text-dim">
                {selectedTeamIds.length} seleccionados
              </span>
            </div>

            {availableTeams.length === 0 ? (
              <div className="p-6 rounded-2xl bg-bg-card border border-border-base text-center space-y-1">
                <p className="text-xs font-medium text-text-main">No hay equipos creados todavía</p>
                <p className="text-[11px] text-text-dim">
                  Crea un equipo en la pestaña principal de "Equipos de Trabajo".
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {availableTeams.map((team) => {
                  const isChecked = selectedTeamIds.includes(team.id);
                  return (
                    <button
                      key={team.id}
                      type="button"
                      disabled={member.is_invitation}
                      onClick={() => toggleTeam(team.id)}
                      className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                        isChecked
                          ? 'bg-bg-card border-accent-blue shadow-xs'
                          : 'bg-bg-card/50 border-border-base hover:border-border-accent'
                      } ${member.is_invitation ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                          style={{ backgroundColor: team.color || '#3B82F6' }}
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-text-main truncate">
                            {team.name}
                          </p>
                          <p className="text-[10px] text-text-dim">
                            {team.member_count || 0} integrantes
                          </p>
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                          isChecked
                            ? 'bg-accent-blue text-white'
                            : 'border border-border-base bg-bg-dark'
                        }`}
                      >
                        {isChecked && <Check size={12} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Button */}
          {!member.is_invitation && (
            <div className="pt-3 flex items-center justify-between border-t border-border-base">
              {saveSuccess ? (
                <span className="text-xs font-semibold text-accent-green flex items-center gap-1">
                  <CheckCircle2 size={14} /> Cambios guardados con éxito
                </span>
              ) : (
                <span className="text-xs text-text-dim">
                  Los cambios se aplican de forma inmediata.
                </span>
              )}
              <button
                type="button"
                onClick={handleSaveRoleTeams}
                disabled={isSavingRoleTeams}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold bg-accent-green text-black hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20 disabled:opacity-50"
              >
                {isSavingRoleTeams ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Guardando...
                  </>
                ) : (
                  <>
                    <Save size={13} /> Guardar Cambios
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ACTIVIDAD & AUDITORÍA */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-text-main flex items-center gap-2">
              <History size={14} className="text-accent-green" />
              Historial de Eventos del Operador
            </h4>
            <span className="text-[11px] font-mono text-text-dim">
              {auditLogs?.length || 0} eventos registrados
            </span>
          </div>

          {isLoadingAudit ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-text-dim">
              <Loader2 size={24} className="animate-spin text-accent-green" />
              <p className="text-xs">Consultando bitácora de auditoría...</p>
            </div>
          ) : !auditLogs || auditLogs.length === 0 ? (
            <div className="p-8 rounded-2xl bg-bg-card border border-border-base text-center space-y-2">
              <History size={32} className="text-text-dim mx-auto opacity-50" />
              <p className="text-xs font-medium text-text-main">Sin actividad reciente registrada</p>
              <p className="text-[11px] text-text-dim max-w-sm mx-auto">
                No se han capturado eventos de auditoría para {member.email} en los últimos registros del sistema.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl bg-bg-card border border-border-base hover:border-border-accent transition-colors space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-main font-mono">
                      {log.action}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        log.result === 'success'
                          ? 'bg-accent-green/10 text-accent-green'
                          : 'bg-accent-red/10 text-accent-red'
                      }`}
                    >
                      {log.result}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted">{log.description}</p>
                  <div className="flex items-center justify-between text-[10px] font-mono text-text-dim pt-1">
                    <span>Módulo: {log.module || 'General'}</span>
                    <span>{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SEGURIDAD & ACCIONES */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* Account Status Card */}
          <div className="p-4 rounded-2xl bg-bg-card border border-border-base space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-text-main">Estado de Autenticación</h4>
                <p className="text-[11px] text-text-dim mt-0.5">
                  Controla la capacidad del usuario de iniciar sesión en Sentinel.
                </p>
              </div>
              <div>{statusBadge}</div>
            </div>

            {!member.is_invitation && !isSelf && (
              <div className="pt-2 border-t border-border-base flex items-center justify-between">
                <span className="text-xs text-text-muted">
                  {member.is_active ? 'La cuenta está activa' : 'La cuenta está suspendida temporalmente'}
                </span>
                <button
                  type="button"
                  onClick={() => onToggleActive(member)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    member.is_active
                      ? 'bg-accent-red/10 text-accent-red hover:bg-accent-red/20'
                      : 'bg-accent-green/10 text-accent-green hover:bg-accent-green/20'
                  }`}
                >
                  <Power size={13} />
                  {member.is_active ? 'Suspender Acceso' : 'Habilitar Acceso'}
                </button>
              </div>
            )}
          </div>

          {/* Invitation Resend (if pending) */}
          {isPending && (
            <div className="p-4 rounded-2xl bg-bg-card border border-border-base space-y-3">
              <h4 className="text-xs font-semibold text-text-main flex items-center gap-2">
                <Send size={14} className="text-accent-blue" />
                Despachar Invitación por Correo
              </h4>
              <p className="text-xs text-text-muted">
                Si el destinatario no recibió el correo de bienvenida o el token expiró, puedes despachar un nuevo token magic link a <span className="font-mono text-text-main">{member.email}</span>.
              </p>
              <button
                type="button"
                onClick={() => onResendInvite(member)}
                disabled={isResending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-accent-blue text-white hover:bg-accent-blue/90 transition-all shadow-md shadow-accent-blue/20 disabled:opacity-50"
              >
                {isResending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Reenviar Magic Link Ahora
              </button>
            </div>
          )}

          {/* Danger Zone */}
          <div className="p-4 rounded-2xl bg-accent-red/5 border border-accent-red/20 space-y-3">
            <h4 className="text-xs font-bold text-accent-red flex items-center gap-2">
              <Trash2 size={14} />
              Zona de Peligro
            </h4>
            <p className="text-xs text-text-muted">
              {member.is_invitation
                ? 'Revocar esta invitación cancelará inmediatamente el token y no permitirá el acceso a la organización.'
                : 'Eliminar a este usuario revocará permanentemente su acceso a la organización, desconectará sesiones activas y desvinculará sus cuadrillas.'}
            </p>

            {isSelf ? (
              <div className="p-2.5 rounded-xl bg-bg-dark text-xs text-text-dim italic">
                No puedes eliminar tu propia cuenta de usuario en esta sesión activa.
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onDelete(member);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-accent-red text-white hover:bg-accent-red/90 transition-all shadow-md shadow-accent-red/20"
              >
                <Trash2 size={13} />
                {member.is_invitation ? 'Revocar Invitación' : 'Eliminar Usuario'}
              </button>
            )}
          </div>
        </div>
      )}
    </NOCDrawer>
  );
}
