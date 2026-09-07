import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  Wrench,
  Calendar,
  Clock,
  BellOff,
  Shield,
  Layers,
  Users,
  Repeat,
  Loader2,
  AlertCircle,
  Globe,
  Lock,
  Plug,
  Zap,
} from 'lucide-react';
import { api } from '../../services/api';
import type { MaintenanceWindow, MaintenanceWindowTarget } from '../../types';

interface MaintenanceWindowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  initialData?: MaintenanceWindow | null;
  isSubmitting: boolean;
}

export const MaintenanceWindowModal: React.FC<MaintenanceWindowModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isSubmitting,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'scheduled' | 'in_progress'>('scheduled');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [recurrence, setRecurrence] = useState<'none' | 'weekly' | 'biweekly' | 'monthly'>('none');
  const [recurrenceDay, setRecurrenceDay] = useState<number>(0);
  const [suppressNotifications, setSuppressNotifications] = useState(true);
  const [excludeFromSla, setExcludeFromSla] = useState(true);
  const [publishToStatusPage, setPublishToStatusPage] = useState(false);
  const [statusPage, setStatusPage] = useState<string>('');
  const [responsibleTeam, setResponsibleTeam] = useState<string>('');
  const [scopeType, setScopeType] = useState<'all' | 'custom'>('all');
  const [selectedTargets, setSelectedTargets] = useState<MaintenanceWindowTarget[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch available status pages
  const { data: statusPagesData } = useQuery({
    queryKey: ['status-pages-select'],
    queryFn: async () => {
      const res = await api.get('status-page/pages/');
      return res.data?.data || [];
    },
    enabled: isOpen,
  });

  // Fetch available teams
  const { data: teamsData } = useQuery({
    queryKey: ['teams-list-select'],
    queryFn: async () => {
      const res = await api.get('users/teams/');
      return res.data?.data || [];
    },
    enabled: isOpen,
  });

  // Fetch monitoring targets for picker
  const { data: monitoringTargets } = useQuery({
    queryKey: ['monitoring-targets-picker'],
    queryFn: async () => {
      const res = await api.get('monitoring/');
      return res.data?.data || [];
    },
    enabled: isOpen && scopeType === 'custom',
  });

  // Fetch api checks for picker
  const { data: apiChecks } = useQuery({
    queryKey: ['api-checks-picker'],
    queryFn: async () => {
      const res = await api.get('api-checks/');
      return res.data?.data || [];
    },
    enabled: isOpen && scopeType === 'custom',
  });

  // Fetch SSL certificates for picker
  const { data: sslCerts } = useQuery({
    queryKey: ['ssl-certs-picker'],
    queryFn: async () => {
      const res = await api.get('ssl-certificates/');
      return res.data?.data || [];
    },
    enabled: isOpen && scopeType === 'custom',
  });

  // Initialize form
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setDescription(initialData.description || '');
      setStatus(initialData.status === 'in_progress' ? 'in_progress' : 'scheduled');

      // Format for datetime-local: YYYY-MM-DDTHH:MM
      if (initialData.start_time) {
        setStartTime(new Date(initialData.start_time).toISOString().slice(0, 16));
      }
      if (initialData.end_time) {
        setEndTime(new Date(initialData.end_time).toISOString().slice(0, 16));
      }

      setRecurrence(initialData.recurrence || 'none');
      setRecurrenceDay(initialData.recurrence_day_of_week ?? 0);
      setSuppressNotifications(initialData.suppress_notifications ?? true);
      setExcludeFromSla(initialData.exclude_from_sla ?? true);
      setPublishToStatusPage(initialData.publish_to_status_page ?? false);
      setStatusPage(initialData.status_page || '');
      setResponsibleTeam(initialData.responsible_team || '');

      const isAll = initialData.targets?.some((t) => t.target_type === 'all');
      if (isAll || !initialData.targets?.length) {
        setScopeType('all');
        setSelectedTargets([]);
      } else {
        setScopeType('custom');
        setSelectedTargets(initialData.targets || []);
      }
    } else {
      // Default: 2 hours from now
      const now = new Date();
      const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      setStartTime(now.toISOString().slice(0, 16));
      setEndTime(inTwoHours.toISOString().slice(0, 16));
      setTitle('');
      setDescription('');
      setStatus('scheduled');
      setRecurrence('none');
      setRecurrenceDay(0);
      setSuppressNotifications(true);
      setExcludeFromSla(true);
      setPublishToStatusPage(false);
      setStatusPage('');
      setResponsibleTeam('');
      setScopeType('all');
      setSelectedTargets([]);
    }
    setFormError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  // Calculate estimated duration
  const getDurationDisplay = () => {
    if (!startTime || !endTime) return null;
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    if (end <= start) return 'Hora de fin debe ser posterior a inicio';
    const diffMins = Math.floor((end - start) / (1000 * 60));
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours} hora${hours !== 1 ? 's' : ''} ${mins > 0 ? `${mins} min` : ''}`;
  };

  const durationStr = getDurationDisplay();

  const handleToggleTarget = (type: 'monitoring' | 'api_check' | 'ssl', id: string, name: string) => {
    setSelectedTargets((prev) => {
      const exists = prev.some((t) => t.target_type === type && t.target_id === id);
      if (exists) {
        return prev.filter((t) => !(t.target_type === type && t.target_id === id));
      }
      return [...prev, { target_type: type, target_id: id, target_name: name }];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!title.trim()) {
      setFormError('El título es requerido.');
      return;
    }

    if (new Date(endTime).getTime() <= new Date(startTime).getTime()) {
      setFormError('La fecha y hora de fin debe ser posterior a la de inicio.');
      return;
    }

    // Build targets array
    let targetsPayload: Array<{ target_type: string; target_id: string | null; target_name: string }> = [];
    if (scopeType === 'all') {
      targetsPayload = [{ target_type: 'all', target_id: null, target_name: 'Toda la Organización' }];
    } else {
      if (selectedTargets.length === 0) {
        setFormError('Debes seleccionar al menos un objetivo de monitoreo o elegir alcance global.');
        return;
      }
      targetsPayload = selectedTargets.map((t) => ({
        target_type: t.target_type,
        target_id: t.target_id,
        target_name: t.target_name,
      }));
    }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      status,
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
      recurrence,
      recurrence_day_of_week: recurrence === 'weekly' ? recurrenceDay : null,
      suppress_notifications: suppressNotifications,
      exclude_from_sla: excludeFromSla,
      publish_to_status_page: publishToStatusPage,
      status_page: publishToStatusPage && statusPage ? statusPage : null,
      responsible_team: responsibleTeam || null,
      targets: targetsPayload,
    };

    try {
      await onSubmit(payload);
      onClose();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Error al guardar la ventana de mantenimiento.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-bg-card border border-border-base rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden my-8 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-border-base flex items-center justify-between bg-bg-dark/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-accent-blue/10 border border-accent-blue/30 flex items-center justify-center text-accent-blue">
              <Wrench size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-text-main">
                {initialData ? 'Editar Ventana de Mantenimiento' : 'Nueva Ventana de Mantenimiento'}
              </h3>
              <p className="text-xs text-text-dim mt-0.5">
                Planifica trabajos operativos con supresión de alertas y control de SLA
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-text-dim hover:text-text-main hover:bg-bg-card border border-transparent hover:border-border-base transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {formError && (
            <div className="p-3.5 bg-accent-red/10 border border-accent-red/30 rounded-xl text-accent-red flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Title & Description */}
          <div className="space-y-4">
            <div>
              <label className="block text-text-muted font-bold mb-1.5">
                Título del Mantenimiento <span className="text-accent-red">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Parche de Seguridad de SO y Reinicio de Nodos DB"
                className="w-full bg-bg-dark border border-border-base rounded-xl px-3.5 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green"
              />
            </div>

            <div>
              <label className="block text-text-muted font-bold mb-1.5">
                Descripción / Alcance Operativo
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalla las actividades técnicas a realizar, pods o servicios afectados..."
                className="w-full bg-bg-dark border border-border-base rounded-xl px-3.5 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green"
              />
            </div>
          </div>

          {/* Horarios & Fechas */}
          <div className="p-4 bg-bg-dark border border-border-base rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-text-main flex items-center gap-1.5">
                <Clock size={14} className="text-accent-yellow" /> Programación Temporal
              </span>
              {durationStr && (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                    durationStr.includes('debe ser')
                      ? 'bg-accent-red/10 text-accent-red border border-accent-red/30'
                      : 'bg-accent-green/10 text-accent-green border border-accent-green/30'
                  }`}
                >
                  {durationStr}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-text-dim mb-1 font-mono">Fecha y Hora de Inicio:</label>
                <input
                  type="datetime-local"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-bg-card border border-border-base rounded-xl px-3 py-2 text-text-main font-mono focus:outline-none focus:border-accent-green"
                />
              </div>

              <div>
                <label className="block text-text-dim mb-1 font-mono">Fecha y Hora de Fin:</label>
                <input
                  type="datetime-local"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-bg-card border border-border-base rounded-xl px-3 py-2 text-text-main font-mono focus:outline-none focus:border-accent-green"
                />
              </div>
            </div>

            {/* Recurrencia */}
            <div className="pt-2 border-t border-border-base/60 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-text-dim mb-1 flex items-center gap-1 font-mono">
                  <Repeat size={12} className="text-accent-blue" /> Recurrencia:
                </label>
                <select
                  value={recurrence}
                  onChange={(e: any) => setRecurrence(e.target.value)}
                  className="w-full bg-bg-card border border-border-base rounded-xl px-3 py-2 text-text-main font-mono focus:outline-none focus:border-accent-green"
                >
                  <option value="none">Única vez (Sin recurrencia)</option>
                  <option value="weekly">Semanal</option>
                  <option value="biweekly">Quincenal</option>
                  <option value="monthly">Mensual</option>
                </select>
              </div>

              {recurrence === 'weekly' && (
                <div>
                  <label className="block text-text-dim mb-1 font-mono">Día de la Semana:</label>
                  <select
                    value={recurrenceDay}
                    onChange={(e) => setRecurrenceDay(Number(e.target.value))}
                    className="w-full bg-bg-card border border-border-base rounded-xl px-3 py-2 text-text-main font-mono focus:outline-none focus:border-accent-green"
                  >
                    <option value={0}>Lunes</option>
                    <option value={1}>Martes</option>
                    <option value={2}>Miércoles</option>
                    <option value={3}>Jueves</option>
                    <option value={4}>Viernes</option>
                    <option value={5}>Sábado</option>
                    <option value={6}>Domingo</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Alcance y Selección de Targets */}
          <div className="space-y-3">
            <label className="block text-text-muted font-bold flex items-center gap-1.5">
              <Layers size={14} className="text-accent-blue" />
              Alcance de la Ventana (Targets Protegidos)
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label
                className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                  scopeType === 'all'
                    ? 'bg-accent-green/10 border-accent-green/40 text-text-main'
                    : 'bg-bg-dark border-border-base text-text-dim hover:bg-bg-card'
                }`}
              >
                <input
                  type="radio"
                  name="scopeType"
                  checked={scopeType === 'all'}
                  onChange={() => setScopeType('all')}
                  className="sr-only"
                />
                <Globe size={16} className={scopeType === 'all' ? 'text-accent-green' : 'text-text-dim'} />
                <div>
                  <div className="font-bold text-xs">Mantenimiento Global</div>
                  <div className="text-[10px] text-text-dim">Cubre toda la infraestructura</div>
                </div>
              </label>

              <label
                className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                  scopeType === 'custom'
                    ? 'bg-accent-green/10 border-accent-green/40 text-text-main'
                    : 'bg-bg-dark border-border-base text-text-dim hover:bg-bg-card'
                }`}
              >
                <input
                  type="radio"
                  name="scopeType"
                  checked={scopeType === 'custom'}
                  onChange={() => setScopeType('custom')}
                  className="sr-only"
                />
                <Layers size={16} className={scopeType === 'custom' ? 'text-accent-green' : 'text-text-dim'} />
                <div>
                  <div className="font-bold text-xs">Targets Específicos</div>
                  <div className="text-[10px] text-text-dim">Selección granular ({selectedTargets.length})</div>
                </div>
              </label>
            </div>

            {/* Picker when scope is custom */}
            {scopeType === 'custom' && (
              <div className="p-4 bg-bg-dark border border-border-base rounded-2xl space-y-3 max-h-56 overflow-y-auto">
                {/* Uptime Targets */}
                <div>
                  <div className="text-[11px] font-mono text-text-dim mb-1.5 flex items-center gap-1 font-bold">
                    <Zap size={12} className="text-accent-green" /> Targets de Uptime & Latencia:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {monitoringTargets?.map((t: any) => {
                      const isChecked = selectedTargets.some(
                        (sel) => sel.target_type === 'monitoring' && sel.target_id === t.id
                      );
                      return (
                        <label
                          key={t.id}
                          className="flex items-center gap-2 p-1.5 rounded-lg bg-bg-card hover:bg-bg-card-hover border border-border-base/60 text-[11px] cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleTarget('monitoring', t.id, t.name)}
                            className="rounded border-border-base bg-bg-dark text-accent-green focus:ring-0"
                          />
                          <span className="truncate text-text-main">{t.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* API Checks */}
                {apiChecks && apiChecks.length > 0 && (
                  <div className="pt-2 border-t border-border-base/50">
                    <div className="text-[11px] font-mono text-text-dim mb-1.5 flex items-center gap-1 font-bold">
                      <Plug size={12} className="text-accent-purple" /> API Endpoints:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {apiChecks.map((a: any) => {
                        const isChecked = selectedTargets.some(
                          (sel) => sel.target_type === 'api_check' && sel.target_id === a.id
                        );
                        return (
                          <label
                            key={a.id}
                            className="flex items-center gap-2 p-1.5 rounded-lg bg-bg-card hover:bg-bg-card-hover border border-border-base/60 text-[11px] cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleTarget('api_check', a.id, a.name)}
                              className="rounded border-border-base bg-bg-dark text-accent-green focus:ring-0"
                            />
                            <span className="truncate text-text-main">{a.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Opciones de Supresión & Asignación */}
          <div className="p-4 bg-bg-dark border border-border-base rounded-2xl space-y-3">
            <span className="font-bold text-text-main block mb-1">
              Políticas de Supresión y Cuadrilla Responsable
            </span>

            <div className="space-y-2">
              <label className="flex items-center justify-between p-2 rounded-xl bg-bg-card border border-border-base/70 cursor-pointer">
                <div className="flex items-center gap-2">
                  <BellOff size={15} className="text-accent-yellow" />
                  <div>
                    <div className="font-semibold text-text-main">Silenciar Notificaciones Externas</div>
                    <div className="text-[10px] text-text-dim">
                      No despacha alertas a Slack, Teams, Telegram ni Email durante la ventana
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={suppressNotifications}
                  onChange={(e) => setSuppressNotifications(e.target.checked)}
                  className="rounded border-border-base bg-bg-dark text-accent-green focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-xl bg-bg-card border border-border-base/70 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Shield size={15} className="text-accent-green" />
                  <div>
                    <div className="font-semibold text-text-main">Excluir de Penalización de SLA</div>
                    <div className="text-[10px] text-text-dim">
                      El downtime en este lapso no restará porcentaje de disponibilidad mensual
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={excludeFromSla}
                  onChange={(e) => setExcludeFromSla(e.target.checked)}
                  className="rounded border-border-base bg-bg-dark text-accent-green focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-xl bg-bg-card border border-border-base/70 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Globe size={15} className="text-accent-blue" />
                  <div>
                    <div className="font-semibold text-text-main">Publicar en Status Page de Clientes</div>
                    <div className="text-[10px] text-text-dim">
                      Sincroniza automáticamente este aviso y sus avances en el portal público
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={publishToStatusPage}
                  onChange={(e) => setPublishToStatusPage(e.target.checked)}
                  className="rounded border-border-base bg-bg-dark text-accent-green focus:ring-0"
                />
              </label>

              {publishToStatusPage && (
                <div className="p-3 bg-bg-dark border border-border-base/80 rounded-xl space-y-2 mt-1">
                  <label className="block text-text-dim text-[11px] font-mono">
                    Status Page de Publicación:
                  </label>
                  <select
                    value={statusPage}
                    onChange={(e) => setStatusPage(e.target.value)}
                    className="w-full bg-bg-card border border-border-base rounded-xl px-3 py-2 text-text-main font-mono focus:outline-none focus:border-accent-green text-xs"
                  >
                    <option value="">Status Page Predeterminada (Principal)</option>
                    {statusPagesData?.map((page: any) => (
                      <option key={page.id} value={page.id}>
                        {page.company_name} ({page.slug}){page.is_default ? ' • Principal' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-text-dim leading-relaxed">
                    Se mantendrán sincronizados en tiempo real el título, fechas de intervención y las notas de avance que publiques en la bitácora del NOC.
                  </p>
                </div>
              )}
            </div>

            {/* Cuadrilla */}
            <div className="pt-2 border-t border-border-base/50">
              <label className="block text-text-dim mb-1 flex items-center gap-1 font-mono">
                <Users size={12} className="text-accent-blue" /> Cuadrilla Operativa Asignada:
              </label>
              <select
                value={responsibleTeam}
                onChange={(e) => setResponsibleTeam(e.target.value)}
                className="w-full bg-bg-card border border-border-base rounded-xl px-3 py-2 text-text-main font-mono focus:outline-none focus:border-accent-green"
              >
                <option value="">Sin cuadrilla asignada</option>
                {teamsData?.map((team: any) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-border-base flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-border-base text-text-muted hover:bg-bg-dark hover:text-text-main font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-full bg-accent-green text-black font-bold hover:bg-accent-green/90 transition-all flex items-center gap-1.5 shadow-md shadow-accent-green/20 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Guardando...
                </>
              ) : (
                <>
                  <Wrench size={14} /> {initialData ? 'Actualizar Ventana' : 'Programar Mantenimiento'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
