import React, { useState, useEffect } from 'react';
import type { Team, TeamMember, UpdateTeamPayload } from '../../types/users';
import type { MonitoringTarget } from '../../types/monitoring';
import type { Incident } from '../../types/incidents';
import NOCDrawer, { NOCDrawerTab } from '../common/noc/NOCDrawer';
import { api } from '../../services/api';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Layers,
  Users,
  AlertTriangle,
  Activity,
  Crown,
  UserPlus,
  UserMinus,
  Mail,
  Calendar,
  ExternalLink,
  Shield,
  Edit2,
  Trash2,
  Loader2,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';

interface TeamDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  team: Team | null;
  availableMembers: TeamMember[];
  onUpdateTeam: (teamId: string, payload: UpdateTeamPayload) => Promise<void>;
  onDeleteTeam: (team: Team) => void;
  onEditTeam: (team: Team) => void;
}

const DRAWER_TABS: NOCDrawerTab[] = [
  { id: 'overview', label: 'Resumen & Salud', icon: <Layers size={14} /> },
  { id: 'members', label: 'Integrantes', icon: <Users size={14} /> },
  { id: 'services', label: 'Servicios a Cargo', icon: <Activity size={14} /> },
  { id: 'incidents', label: 'Incidentes', icon: <AlertTriangle size={14} /> },
];

export default function TeamDetailDrawer({
  isOpen,
  onClose,
  team,
  availableMembers,
  onUpdateTeam,
  onDeleteTeam,
  onEditTeam,
}: TeamDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedNewMemberId, setSelectedNewMemberId] = useState('');
  const [isUpdatingMembers, setIsUpdatingMembers] = useState(false);

  useEffect(() => {
    if (team) {
      setActiveTab('overview');
      setSelectedNewMemberId('');
    }
  }, [team]);

  // Query monitoring targets owned by this team
  const { data: teamTargets = [], isLoading: isLoadingTargets } = useQuery<MonitoringTarget[]>({
    queryKey: ['team-targets', team?.id],
    queryFn: async () => {
      if (!team?.id) return [];
      try {
        const response = await api.get(`monitoring/?team_id=${team.id}`);
        return (response.data?.data || []) as MonitoringTarget[];
      } catch {
        return [];
      }
    },
    enabled: isOpen && !!team?.id && activeTab === 'services',
  });

  // Query incidents assigned to this team
  const { data: teamIncidents = [], isLoading: isLoadingIncidents } = useQuery<Incident[]>({
    queryKey: ['team-incidents', team?.id],
    queryFn: async () => {
      if (!team?.id) return [];
      try {
        const response = await api.get('incidents/');
        const allIncidents = (response.data?.data || []) as Incident[];
        return allIncidents.filter((inc) => inc.assigned_team === team.id);
      } catch {
        return [];
      }
    },
    enabled: isOpen && !!team?.id && (activeTab === 'incidents' || activeTab === 'overview'),
  });

  if (!team) return null;

  const currentMemberIds = (team.members || []).map((m) => m.id);
  const candidateMembers = availableMembers.filter(
    (m) => !m.is_invitation && !currentMemberIds.includes(m.id)
  );

  const activeIncidents = teamIncidents.filter((i) => i.status !== 'closed' && i.status !== 'resolved');

  // Member management handlers
  const handleSetLead = async (userId: string) => {
    setIsUpdatingMembers(true);
    try {
      await onUpdateTeam(team.id, { lead_id: userId });
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al designar líder del equipo.');
    } finally {
      setIsUpdatingMembers(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    const updatedIds = currentMemberIds.filter((id) => id !== userId);
    setIsUpdatingMembers(true);
    try {
      const payload: UpdateTeamPayload = { member_ids: updatedIds };
      if (team.lead?.id === userId) {
        payload.lead_id = null;
      }
      await onUpdateTeam(team.id, payload);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al remover integrante.');
    } finally {
      setIsUpdatingMembers(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedNewMemberId) return;
    const updatedIds = [...currentMemberIds, selectedNewMemberId];
    setIsUpdatingMembers(true);
    try {
      await onUpdateTeam(team.id, { member_ids: updatedIds });
      setSelectedNewMemberId('');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al añadir integrante al equipo.');
    } finally {
      setIsUpdatingMembers(false);
    }
  };

  const statusBadge = (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold"
      style={{
        backgroundColor: `${team.color || '#10B981'}15`,
        borderColor: `${team.color || '#10B981'}30`,
        color: team.color || '#10B981',
      }}
    >
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: team.color || '#10B981' }} />
      Cuadrilla Operativa
    </span>
  );

  const quickKpis = (
    <div className="grid grid-cols-3 gap-2 w-full pt-1">
      <div className="bg-bg-card border border-border-base rounded-xl p-2.5 text-center">
        <p className="text-[10px] text-text-dim uppercase tracking-wider font-mono">Integrantes</p>
        <p className="text-xs font-bold text-text-main mt-0.5 font-mono">
          {team.member_count ?? (team.members?.length || 0)}
        </p>
      </div>
      <div className="bg-bg-card border border-border-base rounded-xl p-2.5 text-center">
        <p className="text-[10px] text-text-dim uppercase tracking-wider font-mono">Incidentes</p>
        <p
          className={`text-xs font-bold mt-0.5 font-mono ${
            activeIncidents.length > 0 ? 'text-accent-red' : 'text-accent-green'
          }`}
        >
          {activeIncidents.length} activos
        </p>
      </div>
      <div className="bg-bg-card border border-border-base rounded-xl p-2.5 text-center">
        <p className="text-[10px] text-text-dim uppercase tracking-wider font-mono">Servicios</p>
        <p className="text-xs font-bold text-accent-blue mt-0.5 font-mono">
          {team.assigned_targets_count ?? teamTargets.length} a cargo
        </p>
      </div>
    </div>
  );

  return (
    <NOCDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={team.name}
      subtitle={
        <span className="text-xs text-text-dim flex items-center gap-2">
          <span>{team.description || 'Sin descripción asignada'}</span>
        </span>
      }
      statusBadge={statusBadge}
      quickKpis={quickKpis}
      tabs={DRAWER_TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      maxWidthClass="max-w-2xl"
    >
      {/* TAB 1: RESUMEN & SALUD */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Identity Card */}
          <div className="p-4 rounded-2xl bg-bg-card border border-border-base flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl border flex items-center justify-center font-bold text-2xl shadow-inner shrink-0"
              style={{
                backgroundColor: `${team.color || '#10B981'}15`,
                borderColor: `${team.color || '#10B981'}30`,
                color: team.color || '#10B981',
              }}
            >
              <Layers size={28} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-text-main truncate">{team.name}</h3>
              <p className="text-xs text-text-muted mt-0.5 line-clamp-2">
                {team.description || 'Cuadrilla técnica para soporte y operaciones en Sentinel.'}
              </p>
              <div className="flex items-center gap-4 mt-2 text-[11px] text-text-dim font-mono">
                <span className="flex items-center gap-1">
                  <Calendar size={12} /> Creado: {new Date(team.created_at).toLocaleDateString()}
                </span>
                {team.contact_email && (
                  <span className="flex items-center gap-1 text-accent-blue truncate">
                    <Mail size={12} /> {team.contact_email}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Team Lead Card */}
          <div className="p-4 rounded-2xl bg-bg-card border border-border-base space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-text-main flex items-center gap-2">
                <Crown size={14} className="text-accent-yellow" />
                Líder de Cuadrilla (Team Lead)
              </h4>
              <button
                type="button"
                onClick={() => setActiveTab('members')}
                className="text-xs font-semibold text-accent-green hover:underline"
              >
                Cambiar Líder
              </button>
            </div>

            {team.lead ? (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-bg-dark border border-border-base">
                <div className="w-10 h-10 rounded-xl bg-accent-yellow/10 border border-accent-yellow/30 text-accent-yellow flex items-center justify-center font-bold text-sm font-mono">
                  {((team.lead.first_name ? team.lead.first_name[0] : '') +
                    (team.lead.last_name ? team.lead.last_name[0] : '')).toUpperCase() ||
                    team.lead.email.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-text-main truncate">
                    {`${team.lead.first_name || ''} ${team.lead.last_name || ''}`.trim() ||
                      team.lead.email}
                  </p>
                  <p className="text-[11px] text-text-dim font-mono truncate">{team.lead.email}</p>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/20">
                  Team Lead
                </span>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-bg-dark border border-border-base text-center space-y-1">
                <p className="text-xs text-text-muted">No se ha designado un líder para este equipo.</p>
                <p className="text-[11px] text-text-dim">
                  Puedes nombrar a uno de los integrantes como referente técnico desde la pestaña de Integrantes.
                </p>
              </div>
            )}
          </div>

          {/* Quick Actions Footer in Tab */}
          <div className="pt-2 flex items-center justify-between border-t border-border-base">
            <button
              type="button"
              onClick={() => onEditTeam(team)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-bg-card border border-border-base text-text-main hover:bg-bg-card-hover transition-colors"
            >
              <Edit2 size={13} className="text-accent-blue" />
              Editar Detalles del Equipo
            </button>
            <button
              type="button"
              onClick={() => {
                onDeleteTeam(team);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-accent-red/10 text-accent-red hover:bg-accent-red/20 transition-colors"
            >
              <Trash2 size={13} />
              Eliminar Equipo
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: INTEGRANTES DEL SQUAD */}
      {activeTab === 'members' && (
        <div className="space-y-6">
          {/* Add Member Bar */}
          {candidateMembers.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-bg-card border border-border-base flex items-center gap-2.5">
              <select
                value={selectedNewMemberId}
                onChange={(e) => setSelectedNewMemberId(e.target.value)}
                className="flex-1 bg-bg-dark border border-border-base rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:border-accent-green"
              >
                <option value="">Seleccionar operador para añadir al squad...</option>
                {candidateMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {`${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email} ({m.email})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddMember}
                disabled={!selectedNewMemberId || isUpdatingMembers}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-accent-green text-black hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20 disabled:opacity-50"
              >
                {isUpdatingMembers ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
                Añadir
              </button>
            </div>
          )}

          {/* Members List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-text-main flex items-center gap-2">
                <Users size={14} className="text-accent-blue" />
                Miembros Asignados ({team.members?.length || 0})
              </h4>
            </div>

            {!team.members || team.members.length === 0 ? (
              <div className="p-8 rounded-2xl bg-bg-card border border-border-base text-center space-y-2">
                <Users size={28} className="text-text-dim mx-auto opacity-50" />
                <p className="text-xs font-medium text-text-main">Sin miembros asignados</p>
                <p className="text-[11px] text-text-dim max-w-sm mx-auto">
                  Selecciona operadores en el desplegable superior para integrarlos a este equipo de trabajo.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {team.members.map((m) => {
                  const isLead = team.lead?.id === m.id;
                  const initials = (
                    (m.first_name ? m.first_name[0] : '') +
                    (m.last_name ? m.last_name[0] : '')
                  ).toUpperCase() || m.email.slice(0, 2).toUpperCase();

                  return (
                    <div
                      key={m.id}
                      className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                        isLead
                          ? 'bg-accent-yellow/5 border-accent-yellow/30'
                          : 'bg-bg-card border-border-base hover:border-border-accent'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl border flex items-center justify-center font-bold text-xs font-mono shrink-0 ${
                            isLead
                              ? 'bg-accent-yellow/10 border-accent-yellow/30 text-accent-yellow'
                              : 'bg-bg-dark border-border-base text-text-main'
                          }`}
                        >
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-semibold text-text-main truncate">
                              {`${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email}
                            </p>
                            {isLead && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-bold bg-accent-yellow/20 text-accent-yellow">
                                <Crown size={10} /> Lead
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-text-dim font-mono truncate">{m.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!isLead && (
                          <button
                            type="button"
                            onClick={() => handleSetLead(m.id)}
                            disabled={isUpdatingMembers}
                            title="Designar como líder del equipo"
                            className="p-1.5 text-text-dim hover:text-accent-yellow hover:bg-bg-main rounded-lg transition-colors text-xs flex items-center gap-1"
                          >
                            <Crown size={13} />
                            <span className="hidden sm:inline text-[11px]">Hacer Lead</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(m.id)}
                          disabled={isUpdatingMembers}
                          title="Remover de este equipo"
                          className="p-1.5 text-text-dim hover:text-accent-red hover:bg-bg-main rounded-lg transition-colors"
                        >
                          <UserMinus size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SERVICIOS A CARGO */}
      {activeTab === 'services' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-semibold text-text-main flex items-center gap-2">
                <Activity size={14} className="text-accent-green" />
                Objetivos de Monitoreo Asignados
              </h4>
              <p className="text-[11px] text-text-dim mt-0.5">
                Servicios cuya disponibilidad y respuesta están bajo la tutela de este equipo.
              </p>
            </div>
            <Link
              to="/monitoring"
              onClick={onClose}
              className="inline-flex items-center gap-1 text-xs font-semibold text-accent-green hover:underline shrink-0"
            >
              Ir a Uptime <ArrowUpRight size={13} />
            </Link>
          </div>

          {isLoadingTargets ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-text-dim">
              <Loader2 size={24} className="animate-spin text-accent-green" />
              <p className="text-xs">Consultando objetivos del squad...</p>
            </div>
          ) : teamTargets.length === 0 ? (
            <div className="p-8 rounded-2xl bg-bg-card border border-border-base text-center space-y-2">
              <Activity size={28} className="text-text-dim mx-auto opacity-50" />
              <p className="text-xs font-medium text-text-main">Sin servicios asignados a este equipo</p>
              <p className="text-[11px] text-text-dim max-w-sm mx-auto">
                Puedes asociar objetivos de monitoreo (HTTP/S, TCP, Ping) a esta cuadrilla editando el objetivo desde el módulo de Monitoreo.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {teamTargets.map((target) => {
                const isUp = target.last_status === 'up';
                return (
                  <div
                    key={target.id}
                    className="p-3 rounded-xl bg-bg-card border border-border-base hover:border-border-accent transition-colors flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isUp ? 'bg-accent-green' : 'bg-accent-red'
                          }`}
                        />
                        <p className="text-xs font-bold text-text-main truncate">{target.name}</p>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-bg-dark text-text-dim">
                          {target.target_type}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-dim font-mono truncate mt-0.5">
                        {target.endpoint}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-xs font-mono font-bold ${
                          isUp ? 'text-accent-green' : 'text-accent-red'
                        }`}
                      >
                        {target.last_latency ? `${Math.round(target.last_latency)}ms` : '—'}
                      </span>
                      <p className="text-[10px] text-text-dim uppercase">
                        {target.last_status || 'desconocido'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: INCIDENTES ASIGNADOS */}
      {activeTab === 'incidents' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-semibold text-text-main flex items-center gap-2">
                <AlertTriangle size={14} className="text-accent-red" />
                Incidentes Asignados al Squad
              </h4>
              <p className="text-[11px] text-text-dim mt-0.5">
                Eventos críticos escalados para investigación y mitigación por esta cuadrilla.
              </p>
            </div>
            <Link
              to="/incidents"
              onClick={onClose}
              className="inline-flex items-center gap-1 text-xs font-semibold text-accent-green hover:underline shrink-0"
            >
              Ir a Incidentes <ArrowUpRight size={13} />
            </Link>
          </div>

          {isLoadingIncidents ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-text-dim">
              <Loader2 size={24} className="animate-spin text-accent-green" />
              <p className="text-xs">Consultando incidentes del equipo...</p>
            </div>
          ) : teamIncidents.length === 0 ? (
            <div className="p-8 rounded-2xl bg-bg-card border border-border-base text-center space-y-2">
              <CheckCircle2 size={32} className="text-accent-green mx-auto" />
              <p className="text-xs font-medium text-text-main">
                ¡Sin incidentes asignados a este squad!
              </p>
              <p className="text-[11px] text-text-dim max-w-sm mx-auto">
                No hay incidentes abiertos ni históricos vinculados formalmente a esta cuadrilla.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {teamIncidents.map((inc) => {
                const isCritical = inc.priority === 'critical';
                const isResolved = inc.status === 'resolved' || inc.status === 'closed';

                return (
                  <div
                    key={inc.id}
                    className="p-3.5 rounded-xl bg-bg-card border border-border-base hover:border-border-accent transition-colors space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          isCritical
                            ? 'bg-accent-red/10 text-accent-red'
                            : 'bg-accent-yellow/10 text-accent-yellow'
                        }`}
                      >
                        {inc.priority}
                      </span>
                      <span
                        className={`text-[10px] font-medium font-mono px-2 py-0.5 rounded-full ${
                          isResolved
                            ? 'bg-accent-green/10 text-accent-green'
                            : 'bg-accent-blue/10 text-accent-blue'
                        }`}
                      >
                        {inc.status}
                      </span>
                    </div>

                    <h5 className="text-xs font-bold text-text-main">{inc.title}</h5>

                    <div className="flex items-center justify-between text-[10px] font-mono text-text-dim pt-1 border-t border-border-base/50">
                      <span>Operador: {inc.assigned_to_name || 'Sin asignar a persona'}</span>
                      <span>{new Date(inc.opened_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </NOCDrawer>
  );
}
