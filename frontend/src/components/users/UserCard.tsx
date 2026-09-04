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
  Power,
} from 'lucide-react';

interface UserCardProps {
  member: TeamMember;
  isSelected: boolean;
  onToggleSelect: (member: TeamMember) => void;
  onSelectMember: (member: TeamMember) => void;
  onToggleActive: (member: TeamMember) => void;
  onEdit: (member: TeamMember) => void;
  onDelete: (member: TeamMember) => void;
  onResendInvite: (member: TeamMember) => void;
  currentUserId?: string;
  isResending?: boolean;
}

export default function UserCard({
  member,
  isSelected,
  onToggleSelect,
  onSelectMember,
  onToggleActive,
  onEdit,
  onDelete,
  onResendInvite,
  currentUserId,
  isResending,
}: UserCardProps) {
  const isSelf = currentUserId === member.id;
  const isPending = member.status_code === 'pending';

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

  const roleMeta = getRoleBadge(member.role);

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
    <div
      onClick={() => onSelectMember(member)}
      className={`group relative bg-bg-card border rounded-2xl p-5 hover:border-border-accent transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
        isSelected
          ? 'border-accent-green ring-1 ring-accent-green/40 bg-accent-green/[0.02]'
          : 'border-border-base'
      }`}
    >
      <div>
        {/* Top bar: Checkbox & Role */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <button
            type="button"
            disabled={isSelf}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(member);
            }}
            className={`text-text-dim hover:text-accent-green transition-colors ${
              isSelf ? 'opacity-30 cursor-not-allowed' : ''
            }`}
          >
            {isSelected ? (
              <CheckSquare size={17} className="text-accent-green" />
            ) : (
              <Square size={17} />
            )}
          </button>

          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${roleMeta.bg} ${roleMeta.color} ${roleMeta.border}`}
          >
            {roleMeta.icon}
            {roleMeta.label}
          </span>
        </div>

        {/* User Avatar + Full Name */}
        <div className="flex items-center gap-3.5 mb-3">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 border ${
              isPending
                ? 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30'
                : member.role === 'admin'
                ? 'bg-accent-purple/10 text-accent-purple border-accent-purple/30'
                : 'bg-accent-green/10 text-accent-green border-accent-green/30'
            }`}
          >
            {getInitials(member)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-text-main text-sm group-hover:text-accent-green transition-colors truncate">
                {member.first_name || member.last_name
                  ? `${member.first_name} ${member.last_name}`.trim()
                  : 'Usuario'}
              </h3>
              {isSelf && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-bg-main text-text-dim font-mono border border-border-base shrink-0">
                  Tú
                </span>
              )}
            </div>
            <p className="text-xs font-mono text-text-muted truncate mt-0.5">
              {member.email}
            </p>
          </div>
        </div>

        {/* Assigned Teams */}
        <div className="min-h-[26px] mb-3">
          {member.teams && member.teams.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {member.teams.map((t) => (
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
            <span className="text-[11px] text-text-dim italic">Sin equipo asignado</span>
          )}
        </div>

        {/* Login Metadata */}
        <div className="flex items-center justify-between text-[11px] text-text-dim pt-2 border-t border-border-base/40">
          <span>Último acceso:</span>
          <span className="flex items-center gap-1 font-mono text-text-muted">
            <Clock size={12} />
            {formatRelativeTime(member.last_login)}
          </span>
        </div>
      </div>

      {/* Card Footer: Status Switch & Actions */}
      <div className="pt-3 border-t border-border-base/50 flex items-center justify-between mt-3">
        {isPending ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/30">
            <AlertTriangle size={11} />
            Pendiente
          </span>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleActive(member);
            }}
            disabled={isSelf}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all ${
              member.is_active
                ? 'bg-accent-green/10 text-accent-green border-accent-green/30 hover:bg-accent-red/10 hover:text-accent-red'
                : 'bg-accent-red/10 text-accent-red border-accent-red/30 hover:bg-accent-green/10 hover:text-accent-green'
            } ${isSelf ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            <Power size={10} />
            {member.is_active ? 'Activo' : 'Desactivado'}
          </button>
        )}

        {/* Action icons */}
        <div
          className="flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => onSelectMember(member)}
            title="Ver detalle"
            className="p-1.5 text-text-dim hover:text-accent-green hover:bg-bg-main rounded-lg transition-colors"
          >
            <Eye size={15} />
          </button>

          {isPending && (
            <button
              type="button"
              onClick={() => onResendInvite(member)}
              disabled={isResending}
              title="Reenviar invitación"
              className="p-1.5 text-text-dim hover:text-amber-400 hover:bg-bg-main rounded-lg transition-colors"
            >
              <Send size={15} className={isResending ? 'animate-spin' : ''} />
            </button>
          )}

          {!isPending && (
            <button
              type="button"
              onClick={() => onEdit(member)}
              title="Editar usuario"
              className="p-1.5 text-text-dim hover:text-sky-400 hover:bg-bg-main rounded-lg transition-colors"
            >
              <Edit2 size={15} />
            </button>
          )}

          <button
            type="button"
            onClick={() => onDelete(member)}
            disabled={isSelf}
            title={isSelf ? 'No puedes eliminarte a ti mismo' : 'Eliminar usuario'}
            className={`p-1.5 text-text-dim hover:text-accent-red hover:bg-bg-main rounded-lg transition-colors ${
              isSelf ? 'opacity-30 cursor-not-allowed' : ''
            }`}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
