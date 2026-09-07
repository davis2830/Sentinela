import React from 'react';
import type { Team } from '../../types/users';
import {
  Layers,
  Plus,
  Users,
  Edit2,
  Trash2,
  UserPlus,
  Crown,
  AlertTriangle,
  Activity,
  Sparkles,
  Loader2,
  ExternalLink,
  Mail,
  Eye,
} from 'lucide-react';

interface TeamsViewProps {
  teams: Team[];
  onSelectTeam: (team: Team) => void;
  onEditTeam: (team: Team) => void;
  onDeleteTeam: (team: Team) => void;
  onManageMembers: (team: Team) => void;
  onCreateTeam: () => void;
  onSeedDefaults?: () => void;
  isSeeding?: boolean;
}

export default function TeamsView({
  teams,
  onSelectTeam,
  onEditTeam,
  onDeleteTeam,
  onManageMembers,
  onCreateTeam,
  onSeedDefaults,
  isSeeding,
}: TeamsViewProps) {
  if (!teams || teams.length === 0) {
    return (
      <div className="bg-bg-card border border-border-base rounded-2xl p-12 text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-accent-purple/10 border border-accent-purple/20 text-accent-purple flex items-center justify-center mx-auto">
          <Layers size={32} />
        </div>
        <div>
          <h3 className="text-base font-bold text-text-main">
            No hay equipos de trabajo configurados
          </h3>
          <p className="text-xs text-text-dim max-w-md mx-auto mt-1 leading-relaxed">
            Organiza a tus operadores en cuadrillas especializadas (ej. SRE & Infraestructura, NOC Nivel 1, SecOps) para delegar la propiedad de servicios e incidentes.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 flex-wrap pt-2">
          {onSeedDefaults && (
            <button
              type="button"
              onClick={onSeedDefaults}
              disabled={isSeeding}
              className="inline-flex items-center gap-2 bg-bg-card hover:bg-bg-card-hover border border-accent-purple/40 text-accent-purple font-semibold px-5 py-2 rounded-full text-xs transition-all shadow-sm disabled:opacity-50"
            >
              {isSeeding ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Aprovisionar Cuadrillas Sugeridas (4 Squads)
            </button>
          )}

          <button
            type="button"
            onClick={onCreateTeam}
            className="inline-flex items-center gap-2 bg-accent-green text-black font-semibold px-5 py-2 rounded-full text-xs hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20"
          >
            <Plus size={15} />
            Crear Primer Equipo Manualmente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top summary bar */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-dim">
          Mostrando <strong>{teams.length}</strong> cuadrillas operativas en la organización
        </span>
        <div className="flex items-center gap-2">
          {onSeedDefaults && (
            <button
              type="button"
              onClick={onSeedDefaults}
              disabled={isSeeding}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg-card hover:bg-bg-card-hover border border-border-base hover:border-accent-purple/50 text-text-muted hover:text-accent-purple text-xs font-semibold rounded-full transition-colors disabled:opacity-50"
            >
              {isSeeding ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              Sugeridas
            </button>
          )}
          <button
            type="button"
            onClick={onCreateTeam}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-accent-green text-black text-xs font-bold rounded-full hover:bg-accent-green/90 transition-all shadow-sm shadow-accent-green/20"
          >
            <Plus size={14} />
            Nuevo Equipo
          </button>
        </div>
      </div>

      {/* Grid of Teams */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((t) => {
          const members = t.members || [];
          const visibleMembers = members.slice(0, 4);
          const remainingCount = members.length - visibleMembers.length;
          const activeIncidents = t.assigned_incidents_count ?? 0;
          const assignedTargets = t.assigned_targets_count ?? 0;

          return (
            <div
              key={t.id}
              className="bg-bg-card border border-border-base hover:border-border-accent rounded-2xl p-5 shadow-sm transition-all flex flex-col justify-between group hover:shadow-md"
            >
              <div>
                {/* Team Header */}
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div
                    onClick={() => onSelectTeam(t)}
                    className="flex items-center gap-2.5 cursor-pointer min-w-0"
                  >
                    <div
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm ring-2 ring-bg-dark"
                      style={{ backgroundColor: t.color || '#10B981' }}
                    />
                    <h3 className="font-bold text-text-main text-sm group-hover:text-accent-green transition-colors truncate">
                      {t.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onEditTeam(t)}
                      title="Editar equipo"
                      className="p-1.5 text-text-dim hover:text-sky-400 hover:bg-bg-main rounded-lg transition-colors"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteTeam(t)}
                      title="Eliminar equipo"
                      className="p-1.5 text-text-dim hover:text-accent-red hover:bg-bg-main rounded-lg transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Team Description */}
                <p className="text-xs text-text-dim line-clamp-2 min-h-[32px] mb-3 leading-relaxed">
                  {t.description || 'Sin descripción especificada para esta cuadrilla operativa.'}
                </p>

                {/* Team Lead Strip */}
                <div className="p-2.5 rounded-xl bg-bg-dark border border-border-base/70 flex items-center justify-between mb-3 text-xs">
                  <span className="text-[11px] text-text-dim flex items-center gap-1.5">
                    <Crown size={12} className={t.lead ? 'text-accent-yellow' : 'text-text-dim'} />
                    Líder:
                  </span>
                  <span className="font-semibold text-text-main truncate max-w-[180px]">
                    {t.lead
                      ? `${t.lead.first_name || ''} ${t.lead.last_name || ''}`.trim() || t.lead.email
                      : 'Sin asignar'}
                  </span>
                </div>

                {/* Quick Telemetry Chips (Incidentes & Servicios) */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div
                    className={`p-2 rounded-xl border flex items-center justify-between ${
                      activeIncidents > 0
                        ? 'bg-accent-red/5 border-accent-red/20'
                        : 'bg-bg-dark border-border-base'
                    }`}
                  >
                    <span className="text-[10px] text-text-dim flex items-center gap-1">
                      <AlertTriangle
                        size={11}
                        className={activeIncidents > 0 ? 'text-accent-red' : 'text-text-dim'}
                      />
                      Incidentes
                    </span>
                    <span
                      className={`text-xs font-mono font-bold ${
                        activeIncidents > 0 ? 'text-accent-red' : 'text-accent-green'
                      }`}
                    >
                      {activeIncidents}
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-bg-dark border border-border-base flex items-center justify-between">
                    <span className="text-[10px] text-text-dim flex items-center gap-1">
                      <Activity size={11} className="text-accent-blue" />
                      Servicios
                    </span>
                    <span className="text-xs font-mono font-bold text-accent-blue">
                      {assignedTargets}
                    </span>
                  </div>
                </div>

                {/* Members Avatars Strip */}
                <div className="space-y-1.5 mb-2">
                  <div className="flex items-center justify-between text-[11px] text-text-dim">
                    <span className="flex items-center gap-1">
                      <Users size={12} />
                      Integrantes
                    </span>
                    <span className="font-mono font-semibold text-text-main">
                      {t.member_count ?? members.length}
                    </span>
                  </div>

                  <div className="flex items-center -space-x-2 overflow-hidden py-1">
                    {visibleMembers.length > 0 ? (
                      visibleMembers.map((m) => {
                        const initials = (
                          (m.first_name ? m.first_name[0] : '') +
                          (m.last_name ? m.last_name[0] : '')
                        ).toUpperCase() || m.email.slice(0, 2).toUpperCase();

                        return (
                          <div
                            key={m.id}
                            title={`${m.first_name || ''} ${m.last_name || ''} (${m.email})`}
                            className="w-7 h-7 rounded-full bg-bg-main border-2 border-bg-card flex items-center justify-center font-bold text-[10px] text-text-main shadow-xs"
                          >
                            {initials}
                          </div>
                        );
                      })
                    ) : (
                      <span className="text-[11px] text-text-dim italic">
                        Cero miembros asignados
                      </span>
                    )}

                    {remainingCount > 0 && (
                      <div className="w-7 h-7 rounded-full bg-bg-main border-2 border-bg-card flex items-center justify-center font-mono font-bold text-[10px] text-accent-green shadow-xs">
                        +{remainingCount}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Footer: Action buttons */}
              <div className="pt-3 border-t border-border-base/50 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSelectTeam(t)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-bg-main hover:bg-bg-card-hover border border-border-base hover:border-accent-green/40 text-text-main rounded-xl text-xs font-semibold transition-colors"
                >
                  <Eye size={13} className="text-accent-green" />
                  Inspeccionar
                </button>
                <button
                  type="button"
                  onClick={() => onManageMembers(t)}
                  title="Añadir o remover miembros"
                  className="p-2 bg-bg-main hover:bg-bg-card-hover border border-border-base text-text-dim hover:text-text-main rounded-xl transition-colors shrink-0"
                >
                  <UserPlus size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
