import React from 'react';
import type { TeamMember } from '../../types/users';
import {
  CheckSquare,
  Square,
  Eye,
  Edit2,
  Trash2,
  Send,
  Shield,
  ShieldCheck,
  UserCheck,
  AlertTriangle,
  Clock,
  Layers,
  Power,
} from 'lucide-react';

interface UserTableViewProps {
  members: TeamMember[];
  selectedIds: string[];
  onToggleSelect: (member: TeamMember) => void;
  onSelectAllToggle: () => void;
  onSelectMember: (member: TeamMember) => void;
  onToggleActive: (member: TeamMember) => void;
  onEdit: (member: TeamMember) => void;
  onDelete: (member: TeamMember) => void;
  onResendInvite: (member: TeamMember) => void;
  currentUserId?: string;
  resendingId?: string | null;
}

export default function UserTableView({
  members,
  selectedIds,
  onToggleSelect,
  onSelectAllToggle,
  onSelectMember,
  onToggleActive,
  onEdit,
  onDelete,
  onResendInvite,
  currentUserId,
  resendingId,
}: UserTableViewProps) {
  const isAllSelected = members.length > 0 && selectedIds.length === members.length;

  const getInitials = (m: TeamMember) => {
    const f = m.first_name ? m.first_name[0].toUpperCase() : '';
    const l = m.last_name ? m.last_name[0].toUpperCase() : '';
    return f || l ? `${f}${l}` : m.email.slice(0, 2).toUpperCase();
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return {
          label: 'Administrador',
          color: 'text-accent-purple',
          bg: 'bg-accent-purple/10',
          border: 'border-accent-purple/30',
          icon: <Shield size={12} className="text-accent-purple" />,
        };
      case 'member':
        return {
          label: 'Ingeniero Operaciones',
          color: 'text-accent-green',
          bg: 'bg-accent-green/10',
          border: 'border-accent-green/30',
          icon: <ShieldCheck size={12} className="text-accent-green" />,
        };
      case 'viewer':
      default:
        return {
          label: 'Visualizador',
          color: 'text-sky-400',
          bg: 'bg-sky-500/10',
          border: 'border-sky-500/30',
          icon: <UserCheck size={12} className="text-sky-400" />,
        };
    }
  };

  const formatRelativeTime = (dateStr?: string | null) => {
    if (!dateStr) return 'Nunca';
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 5) return 'En línea';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} h`;
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 30) return `Hace ${diffDays} d`;
    return date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="bg-bg-card border border-border-base rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border-base text-text-dim text-xs bg-bg-card/60">
              <th className="py-3 px-3.5 w-10">
                <button
                  type="button"
                  onClick={onSelectAllToggle}
                  className="text-text-dim hover:text-accent-green transition-colors"
                  title={isAllSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
                >
                  {isAllSelected ? (
                    <CheckSquare size={16} className="text-accent-green" />
                  ) : (
                    <Square size={16} />
                  )}
                </button>
              </th>
              <th className="py-3 px-4">Usuario / Nombre</th>
              <th className="py-3 px-4">Correo Electrónico</th>
              <th className="py-3 px-3">Rol</th>
              <th className="py-3 px-3">Equipos Asignados</th>
              <th className="py-3 px-3">Estado</th>
              <th className="py-3 px-3">Último Acceso</th>
              <th className="py-3 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-base/40 font-sans">
            {members.map((m) => {
              const isSelected = selectedIds.includes(m.id);
              const roleMeta = getRoleBadge(m.role);
              const isSelf = currentUserId === m.id;
              const isPending = m.status_code === 'pending';

              return (
                <tr
                  key={m.id}
                  onClick={() => onSelectMember(m)}
                  className={`hover:bg-bg-card-hover/80 transition-colors cursor-pointer group ${
                    isSelected ? 'bg-accent-green/[0.04]' : ''
                  }`}
                >
                  {/* Checkbox */}
                  <td
                    className="py-3 px-3.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelect(m);
                    }}
                  >
                    <button
                      type="button"
                      disabled={isSelf}
                      className={`text-text-dim hover:text-accent-green transition-colors ${
                        isSelf ? 'opacity-30 cursor-not-allowed' : ''
                      }`}
                    >
                      {isSelected ? (
                        <CheckSquare size={16} className="text-accent-green" />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                  </td>

                  {/* Avatar + Name */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 border ${
                          isPending
                            ? 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30'
                            : m.role === 'admin'
                            ? 'bg-accent-purple/10 text-accent-purple border-accent-purple/30'
                            : 'bg-accent-green/10 text-accent-green border-accent-green/30'
                        }`}
                      >
                        {getInitials(m)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-text-main group-hover:text-accent-green transition-colors truncate">
                            {m.first_name || m.last_name
                              ? `${m.first_name} ${m.last_name}`.trim()
                              : 'Usuario'}
                          </span>
                          {isSelf && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-bg-main text-text-dim font-mono border border-border-base">
                              Tú
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-text-dim block">
                          Registrado:{' '}
                          {m.date_joined
                            ? new Date(m.date_joined).toLocaleDateString('es-ES', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Email */}
                  <td className="py-3 px-4 font-mono text-text-muted text-xs">
                    {m.email}
                  </td>

                  {/* Role */}
                  <td className="py-3 px-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${roleMeta.bg} ${roleMeta.color} ${roleMeta.border}`}
                    >
                      {roleMeta.icon}
                      {roleMeta.label}
                    </span>
                  </td>

                  {/* Teams */}
                  <td className="py-3 px-3">
                    {m.teams && m.teams.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {m.teams.map((t) => (
                          <span
                            key={t.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border"
                            style={{
                              backgroundColor: `${t.color}15`,
                              color: t.color,
                              borderColor: `${t.color}35`,
                            }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: t.color }}
                            />
                            {t.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-text-dim italic">Sin equipo</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="py-3 px-3">
                    {isPending ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/30">
                        <AlertTriangle size={12} />
                        Invitación Pendiente
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleActive(m);
                        }}
                        disabled={isSelf}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-all ${
                          m.is_active
                            ? 'bg-accent-green/10 text-accent-green border-accent-green/30 hover:bg-accent-red/10 hover:text-accent-red hover:border-accent-red/30'
                            : 'bg-accent-red/10 text-accent-red border-accent-red/30 hover:bg-accent-green/10 hover:text-accent-green hover:border-accent-green/30'
                        } ${isSelf ? 'cursor-not-allowed opacity-60' : ''}`}
                        title={
                          isSelf
                            ? 'No puedes desactivar tu propia cuenta'
                            : m.is_active
                            ? 'Clic para desactivar cuenta'
                            : 'Clic para reactivar cuenta'
                        }
                      >
                        <Power size={11} />
                        {m.is_active ? 'Activo' : 'Desactivado'}
                      </button>
                    )}
                  </td>

                  {/* Last Login */}
                  <td className="py-3 px-3 text-text-dim text-[11px] font-mono">
                    <span className="flex items-center gap-1">
                      <Clock size={12} className="text-text-dim shrink-0" />
                      {formatRelativeTime(m.last_login)}
                    </span>
                  </td>

                  {/* Actions */}
                  <td
                    className="py-3 px-4 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                      {/* View Drawer */}
                      <button
                        type="button"
                        onClick={() => onSelectMember(m)}
                        title="Ver detalle de auditoría y roles"
                        className="p-1.5 text-text-dim hover:text-accent-green hover:bg-bg-main rounded-lg transition-colors"
                      >
                        <Eye size={15} />
                      </button>

                      {/* Resend Invitation (if pending) */}
                      {isPending && (
                        <button
                          type="button"
                          onClick={() => onResendInvite(m)}
                          disabled={resendingId === m.id}
                          title="Reenviar invitación por correo (SMTP)"
                          className="p-1.5 text-text-dim hover:text-amber-400 hover:bg-bg-main rounded-lg transition-colors"
                        >
                          <Send size={15} className={resendingId === m.id ? 'animate-spin' : ''} />
                        </button>
                      )}

                      {/* Edit (if not invitation) */}
                      {!isPending && (
                        <button
                          type="button"
                          onClick={() => onEdit(m)}
                          title="Editar usuario y roles"
                          className="p-1.5 text-text-dim hover:text-sky-400 hover:bg-bg-main rounded-lg transition-colors"
                        >
                          <Edit2 size={15} />
                        </button>
                      )}

                      {/* Delete / Revoke */}
                      <button
                        type="button"
                        onClick={() => onDelete(m)}
                        disabled={isSelf}
                        title={
                          isSelf
                            ? 'No puedes eliminarte a ti mismo'
                            : isPending
                            ? 'Revocar invitación'
                            : 'Eliminar usuario'
                        }
                        className={`p-1.5 text-text-dim hover:text-accent-red hover:bg-bg-main rounded-lg transition-colors ${
                          isSelf ? 'opacity-30 cursor-not-allowed' : ''
                        }`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
