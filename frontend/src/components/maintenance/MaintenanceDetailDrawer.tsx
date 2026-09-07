import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Wrench,
  Play,
  CheckCircle2,
  XCircle,
  BellOff,
  Shield,
  Layers,
  Repeat,
  Send,
  Trash2,
  Edit,
  Globe,
  Zap,
  Plug,
  Lock,
  FileText,
  User,
  Users,
  ExternalLink,
} from 'lucide-react';
import NOCDrawer, { type NOCDrawerTab } from '../common/noc/NOCDrawer';
import type { MaintenanceWindow } from '../../types';

interface MaintenanceDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  window: MaintenanceWindow | null;
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
  onCancel: (id: string) => void;
  onEdit: (window: MaintenanceWindow) => void;
  onDelete: (id: string) => void;
  onAddUpdate: (id: string, message: string, status?: string) => Promise<void>;
  isStarting?: boolean;
  isCompleting?: boolean;
  isCancelling?: boolean;
}

export const MaintenanceDetailDrawer: React.FC<MaintenanceDetailDrawerProps> = ({
  isOpen,
  onClose,
  window: item,
  onStart,
  onComplete,
  onCancel,
  onEdit,
  onDelete,
  onAddUpdate,
  isStarting,
  isCompleting,
  isCancelling,
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [updateMsg, setUpdateMsg] = useState('');
  const [updateStatus, setUpdateStatus] = useState('');
  const [isPostingUpdate, setIsPostingUpdate] = useState(false);

  if (!item) return null;

  const startDate = new Date(item.start_time);
  const endDate = new Date(item.end_time);
  const isLive = item.status === 'in_progress' || item.is_active_now;

  const tabs: NOCDrawerTab[] = [
    { id: 'overview', label: 'Detalles & Targets', icon: <Layers size={14} /> },
    { id: 'timeline', label: `Bitácora (${item.updates?.length || 0})`, icon: <Clock size={14} /> },
    { id: 'actions', label: 'Controles Operativos', icon: <Wrench size={14} /> },
  ];

  const handlePostUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateMsg.trim()) return;

    try {
      setIsPostingUpdate(true);
      await onAddUpdate(item.id, updateMsg.trim(), updateStatus || undefined);
      setUpdateMsg('');
      setUpdateStatus('');
    } finally {
      setIsPostingUpdate(false);
    }
  };

  const statusBadge = (
    <span
      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1.5 ${
        isLive
          ? 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30'
          : item.status === 'completed'
          ? 'bg-accent-green/10 text-accent-green border-accent-green/30'
          : item.status === 'cancelled'
          ? 'bg-accent-red/10 text-accent-red border-accent-red/30'
          : 'bg-accent-blue/10 text-accent-blue border-accent-blue/30'
      }`}
    >
      {isLive && <span className="w-1.5 h-1.5 rounded-full bg-accent-yellow animate-ping" />}
      {isLive
        ? 'En Curso'
        : item.status === 'completed'
        ? 'Completado'
        : item.status === 'cancelled'
        ? 'Cancelado'
        : 'Programado'}
    </span>
  );

  const getTargetIcon = (type: string) => {
    switch (type) {
      case 'all':
        return <Globe size={13} className="text-accent-green" />;
      case 'monitoring':
        return <Zap size={13} className="text-accent-blue" />;
      case 'ssl':
        return <Lock size={13} className="text-accent-yellow" />;
      case 'api_check':
        return <Plug size={13} className="text-accent-purple" />;
      default:
        return <Layers size={13} className="text-text-muted" />;
    }
  };

  return (
    <NOCDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={item.title}
      subtitle={`Ventana ID: ${item.id.slice(0, 8)} • Creada por ${item.created_by_name || 'Sistema'}`}
      statusBadge={statusBadge}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      maxWidthClass="max-w-xl"
    >
      {/* TAB 1: OVERVIEW & TARGETS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Descripción */}
          <div>
            <h4 className="text-xs font-mono uppercase tracking-wider text-text-dim mb-1">
              Descripción Operativa
            </h4>
            <p className="text-xs text-text-muted leading-relaxed p-3 bg-bg-dark border border-border-base rounded-xl">
              {item.description || 'Sin descripción adicional para esta ventana de mantenimiento.'}
            </p>
          </div>

          {/* Tarjeta de Horarios */}
          <div className="p-4 bg-bg-dark border border-border-base rounded-2xl space-y-3">
            <h4 className="text-xs font-mono uppercase tracking-wider text-text-dim flex items-center justify-between">
              <span>Programación Temporal</span>
              <span className="text-accent-green font-bold">
                {item.duration_minutes > 60
                  ? `${Math.floor(item.duration_minutes / 60)}h ${item.duration_minutes % 60}m`
                  : `${item.duration_minutes}m`}
              </span>
            </h4>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-2.5 bg-bg-card border border-border-base/70 rounded-xl">
                <div className="text-[10px] text-text-dim flex items-center gap-1 mb-1">
                  <Calendar size={11} className="text-accent-blue" /> Fecha y Hora Inicio:
                </div>
                <div className="text-text-main font-bold">
                  {startDate.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                </div>
              </div>

              <div className="p-2.5 bg-bg-card border border-border-base/70 rounded-xl">
                <div className="text-[10px] text-text-dim flex items-center gap-1 mb-1">
                  <Clock size={11} className="text-accent-yellow" /> Fecha y Hora Fin:
                </div>
                <div className="text-text-main font-bold">
                  {endDate.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                </div>
              </div>
            </div>

            {item.recurrence && item.recurrence !== 'none' && (
              <div className="p-2 bg-accent-blue/10 border border-accent-blue/30 rounded-xl text-xs text-accent-blue flex items-center gap-2">
                <Repeat size={14} />
                <span>
                  Ventana recurrente: <strong>{item.recurrence}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Políticas de Supresión */}
          <div className="space-y-2">
            <h4 className="text-xs font-mono uppercase tracking-wider text-text-dim mb-1">
              Políticas Operativas Aplicadas
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div
                className={`p-3 rounded-xl border flex items-center gap-2.5 ${
                  item.suppress_notifications
                    ? 'bg-accent-yellow/10 border-accent-yellow/30 text-accent-yellow'
                    : 'bg-bg-dark border-border-base text-text-dim opacity-50'
                }`}
              >
                <BellOff size={18} />
                <div>
                  <div className="font-bold text-xs">Alertas Silenciadas</div>
                  <div className="text-[10px]">Sin avisos externos</div>
                </div>
              </div>

              <div
                className={`p-3 rounded-xl border flex items-center gap-2.5 ${
                  item.exclude_from_sla
                    ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
                    : 'bg-bg-dark border-border-base text-text-dim opacity-50'
                }`}
              >
                <Shield size={18} />
                <div>
                  <div className="font-bold text-xs">Excluido de SLA</div>
                  <div className="text-[10px]">Sin castigo en reportes</div>
                </div>
              </div>
            </div>
          </div>

          {/* Sincronización con Status Page de Clientes */}
          {item.publish_to_status_page && (
            <div className="p-3.5 bg-accent-blue/10 border border-accent-blue/30 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <Globe size={18} className="text-accent-blue shrink-0" />
                <div>
                  <div className="font-bold text-text-main">Publicado en Status Page</div>
                  <div className="text-[10px] text-text-dim mt-0.5">
                    Visible para clientes en {item.status_page_name || 'Portal Principal'}
                  </div>
                </div>
              </div>
              <a
                href={`/status/${item.status_page_slug || 'global'}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg bg-bg-dark hover:bg-bg-card border border-border-base text-accent-blue hover:text-white transition-colors text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <span>Ver Portal</span>
                <ExternalLink size={12} />
              </a>
            </div>
          )}

          {/* Cuadrilla y Asignación */}
          {item.responsible_team_name && (
            <div className="p-3 bg-bg-dark border border-border-base rounded-xl flex items-center justify-between text-xs">
              <span className="text-text-dim flex items-center gap-1.5">
                <Users size={14} className="text-accent-blue" /> Cuadrilla Responsable:
              </span>
              <span className="font-semibold text-text-main flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: item.responsible_team_color || '#3B82F6' }}
                />
                {item.responsible_team_name}
              </span>
            </div>
          )}

          {/* Targets Cubiertos */}
          <div className="space-y-2">
            <h4 className="text-xs font-mono uppercase tracking-wider text-text-dim flex items-center justify-between">
              <span>Targets en Mantenimiento</span>
              <span className="text-accent-blue font-bold">{item.targets?.length || 0}</span>
            </h4>

            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {item.targets?.map((t, idx) => (
                <div
                  key={idx}
                  className="p-2.5 bg-bg-dark border border-border-base rounded-xl flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    {getTargetIcon(t.target_type)}
                    <span className="font-bold text-text-main font-mono">
                      {t.target_type === 'all' ? 'Toda la Organización (Global)' : t.target_name || t.target_id}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-bg-card border border-border-base text-text-dim uppercase">
                    {t.target_type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LIVE TIMELINE & UPDATES */}
      {activeTab === 'timeline' && (
        <div className="space-y-6">
          {/* Formulario para publicar notas de avance */}
          <form onSubmit={handlePostUpdate} className="p-4 bg-bg-dark border border-border-base rounded-2xl space-y-3">
            <div className="font-bold text-xs text-text-main flex items-center gap-1.5">
              <Clock size={14} className="text-accent-green" /> Publicar Avance en Vivo
            </div>
            <textarea
              rows={2}
              required
              value={updateMsg}
              onChange={(e) => setUpdateMsg(e.target.value)}
              placeholder="Ej. Iniciando migración de base de datos... / Servicios reiniciados y en verificación."
              className="w-full bg-bg-card border border-border-base rounded-xl px-3 py-2 text-xs text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green"
            />
            <div className="flex items-center justify-between">
              <select
                value={updateStatus}
                onChange={(e) => setUpdateStatus(e.target.value)}
                className="bg-bg-card border border-border-base rounded-xl px-2.5 py-1 text-[11px] text-text-main font-mono focus:outline-none focus:border-accent-green"
              >
                <option value="">Mantener estado actual ({item.status})</option>
                <option value="in_progress">En Curso</option>
                <option value="completed">Completado</option>
              </select>

              <button
                type="submit"
                disabled={isPostingUpdate || !updateMsg.trim()}
                className="px-3 py-1.5 rounded-full bg-accent-green text-black font-bold text-xs hover:bg-accent-green/90 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Send size={12} /> Publicar
              </button>
            </div>
          </form>

          {/* Historial de Hitos */}
          <div className="space-y-3 relative pl-4 before:content-[''] before:absolute before:left-1 before:top-2 before:bottom-2 before:w-0.5 before:bg-border-base">
            {item.updates && item.updates.length > 0 ? (
              item.updates.map((u) => (
                <div key={u.id} className="relative space-y-1 bg-bg-dark border border-border-base rounded-xl p-3 text-xs">
                  <div className="absolute -left-[19px] top-3.5 w-2.5 h-2.5 rounded-full bg-accent-blue border-2 border-bg-card" />
                  <div className="flex items-center justify-between text-[10px] text-text-dim font-mono">
                    <span className="font-bold text-text-main">{u.actor_name || 'Operador'}</span>
                    <span>{new Date(u.posted_at).toLocaleString('es-ES')}</span>
                  </div>
                  <p className="text-text-muted leading-relaxed">{u.message}</p>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-text-dim text-xs">
                No hay notas ni hitos registrados aún.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: ACTIONS & LIFECYCLE */}
      {activeTab === 'actions' && (
        <div className="space-y-4 text-xs">
          <div className="p-4 bg-bg-dark border border-border-base rounded-2xl space-y-3">
            <h4 className="font-bold text-text-main">Transiciones Rápidas de Estado</h4>
            <p className="text-text-dim text-[11px] leading-relaxed">
              Controla manualmente el ciclo de vida del mantenimiento sin esperar a los límites horarios.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                disabled={isStarting || item.status === 'in_progress' || item.status === 'completed'}
                onClick={() => onStart(item.id)}
                className="py-2.5 px-4 rounded-xl font-bold bg-accent-blue/15 text-accent-blue hover:bg-accent-blue/25 border border-accent-blue/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
              >
                <Play size={14} /> Iniciar Mantenimiento
              </button>

              <button
                type="button"
                disabled={isCompleting || item.status === 'completed'}
                onClick={() => onComplete(item.id)}
                className="py-2.5 px-4 rounded-xl font-bold bg-accent-green/15 text-accent-green hover:bg-accent-green/25 border border-accent-green/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
              >
                <CheckCircle2 size={14} /> Marcar Completado
              </button>
            </div>

            {item.status !== 'cancelled' && item.status !== 'completed' && (
              <button
                type="button"
                disabled={isCancelling}
                onClick={() => onCancel(item.id)}
                className="w-full py-2 px-4 rounded-xl font-semibold bg-bg-card border border-border-base text-text-muted hover:text-accent-red hover:border-accent-red/40 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 mt-1"
              >
                <XCircle size={14} /> Cancelar Ventana de Mantenimiento
              </button>
            )}
          </div>

          <div className="p-4 bg-bg-dark border border-border-base rounded-2xl space-y-3">
            <h4 className="font-bold text-text-main">Gestión de la Ventana</h4>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(item);
                }}
                className="flex-1 py-2 px-4 rounded-xl font-semibold bg-bg-card border border-border-base text-text-main hover:bg-bg-card-hover transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Edit size={14} /> Editar Configuración
              </button>

              <button
                type="button"
                onClick={() => {
                  if (confirm(`¿Estás seguro de eliminar la ventana '${item.title}'?`)) {
                    onDelete(item.id);
                    onClose();
                  }
                }}
                className="py-2 px-4 rounded-xl font-semibold bg-accent-red/10 border border-accent-red/30 text-accent-red hover:bg-accent-red/20 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={14} /> Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </NOCDrawer>
  );
};
