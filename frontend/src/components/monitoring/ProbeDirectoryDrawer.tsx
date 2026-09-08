import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { AgentProbe } from '../../types/agent_probe';
import CreateProbeModal from './CreateProbeModal';
import {
  X,
  Server,
  Radio,
  Plus,
  Trash2,
  Loader2,
  ShieldCheck,
  Clock,
  Terminal,
  AlertCircle,
  CheckCircle2,
  HardDrive,
  Activity,
  Laptop,
} from 'lucide-react';

interface ProbeDirectoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProbeDirectoryDrawer({
  isOpen,
  onClose,
}: ProbeDirectoryDrawerProps) {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch all registered probes
  const { data: probes, isLoading } = useQuery<AgentProbe[]>({
    queryKey: ['agent-probes'],
    queryFn: async () => {
      const res = await api.get('agent-probes/');
      return res.data?.data || [];
    },
    enabled: isOpen,
    refetchInterval: 10000, // auto-refresh every 10s to see live heartbeats
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (probeId: string) => {
      await api.delete(`agent-probes/${probeId}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-probes'] });
      queryClient.invalidateQueries({ queryKey: ['org-subscription'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Error al eliminar el agente satélite.');
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-bg-card border-l border-border-base w-full max-w-2xl h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-6 border-b border-border-base flex items-start justify-between bg-gradient-to-r from-bg-card via-bg-card-hover to-bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-accent-green/10 text-accent-green border border-accent-green/30">
              <Server size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-text-main">Agentes Satélite (On-Premise)</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-blue/10 text-accent-blue border border-accent-blue/30">
                  {probes?.length || 0} RUNNERS
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Infraestructura distribuida para monitorear redes locales, bases de datos y VPCs.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text-main rounded-xl hover:bg-white/5 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Action bar */}
        <div className="p-4 px-6 border-b border-border-base/60 bg-bg-dark/40 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-text-dim">
            <span className="w-2 h-2 rounded-full bg-accent-green animate-ping inline-block" />
            <span>Telemetría en vivo cada 10s</span>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-accent-green text-black hover:bg-accent-green-glow transition-all shadow-md shadow-accent-green/10"
          >
            <Plus size={14} />
            <span>Conectar Agente</span>
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-text-muted">
              <Loader2 size={28} className="animate-spin text-accent-green mb-3" />
              <p className="text-xs">Consultando estado de los agentes...</p>
            </div>
          ) : probes?.length === 0 ? (
            <div className="text-center py-16 px-4 rounded-3xl border border-dashed border-border-base bg-bg-dark/30">
              <Server size={36} className="mx-auto text-text-dim mb-3" />
              <h4 className="text-sm font-bold text-text-main">No hay agentes satélite conectados</h4>
              <p className="text-xs text-text-muted max-w-sm mx-auto mt-1 mb-5">
                Conecta un runner privado para comenzar a monitorear bases de datos internas, switches y microservicios locales sin abrir puertos.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-accent-green text-black hover:bg-accent-green-glow transition-all"
              >
                <Plus size={14} />
                <span>Conectar Primer Agente</span>
              </button>
            </div>
          ) : (
            probes?.map((probe) => {
              const isOnline = probe.is_online;
              return (
                <div
                  key={probe.id}
                  className="p-5 rounded-2xl bg-bg-card border border-border-base hover:border-border-accent transition-all shadow-sm flex flex-col justify-between gap-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-xl mt-0.5 ${
                          isOnline
                            ? 'bg-accent-green/10 text-accent-green border border-accent-green/30'
                            : 'bg-white/5 text-text-dim border border-white/10'
                        }`}
                      >
                        <Server size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h4 className="text-sm font-bold text-text-main">{probe.name}</h4>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1.5 ${
                              isOnline
                                ? 'bg-accent-green/10 text-accent-green border-accent-green/30'
                                : 'bg-white/5 text-text-dim border-white/10'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isOnline ? 'bg-accent-green animate-pulse' : 'bg-text-dim'
                              }`}
                            />
                            {isOnline ? 'ONLINE' : 'OFFLINE'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-text-dim mt-2">
                          {probe.hostname && (
                            <span className="flex items-center gap-1">
                              <Laptop size={12} />
                              <span className="font-mono">{probe.hostname}</span>
                            </span>
                          )}
                          {probe.ip_address && (
                            <span className="font-mono bg-bg-dark px-2 py-0.5 rounded border border-border-base/50">
                              IP: {probe.ip_address}
                            </span>
                          )}
                          {probe.os_info && <span>{probe.os_info}</span>}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `¿Estás seguro de desconectar y revocar el agente "${probe.name}"? Los objetivos asignados a este agente dejarán de monitorearse.`
                          )
                        ) {
                          deleteMutation.mutate(probe.id);
                        }
                      }}
                      className="p-1.5 text-text-dim hover:text-accent-red rounded-lg hover:bg-accent-red/10 transition-colors"
                      title="Revocar y eliminar agente"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="pt-3 border-t border-border-base/60 flex items-center justify-between text-[11px] text-text-muted">
                    <div className="flex items-center gap-1.5">
                      <Activity size={13} className="text-accent-blue" />
                      <span>
                        <strong className="text-text-main font-mono">
                          {probe.assigned_targets_count}
                        </strong>{' '}
                        objetivo(s) asignados en esta LAN
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-text-dim">
                      <Clock size={12} />
                      <span>
                        {probe.last_heartbeat
                          ? `Último heartbeat: ${new Date(probe.last_heartbeat).toLocaleTimeString()}`
                          : 'Sin telemetría reciente'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-border-base bg-bg-dark/40 flex items-center justify-between text-xs text-text-dim">
          <span>Los agentes satélite envían telemetría únicamente mediante peticiones salientes.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-text-muted hover:text-text-main rounded-xl border border-border-base hover:bg-white/5 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>

      <CreateProbeModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
}
