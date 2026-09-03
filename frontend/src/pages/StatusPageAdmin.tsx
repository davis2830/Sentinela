import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type {
  StatusPageConfigData,
  ScheduledMaintenanceItem,
  MaintenanceStatus,
} from '../types/status_page';
import StatusBadge from '../components/common/StatusBadge';
import ConfirmDelete from '../components/common/ConfirmDelete';
import {
  Globe,
  Save,
  Plus,
  Loader2,
  Calendar,
  ExternalLink,
  Trash2,
  Pencil,
  RefreshCw,
  X,
  Check,
  Activity,
  Mail,
  FileText,
  Building,
  Lock,
} from 'lucide-react';

export default function StatusPageAdmin() {
  const queryClient = useQueryClient();

  // Config States
  const [companyName, setCompanyName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  // Maintenance Modal States
  const [showMaintModal, setShowMaintModal] = useState(false);
  const [editingMaint, setEditingMaint] = useState<ScheduledMaintenanceItem | null>(null);
  const [maintTitle, setMaintTitle] = useState('');
  const [maintDesc, setMaintDesc] = useState('');
  const [maintStatus, setMaintStatus] = useState<MaintenanceStatus>('scheduled');
  const [maintStart, setMaintStart] = useState('');
  const [maintEnd, setMaintEnd] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ScheduledMaintenanceItem | null>(null);

  // Config Query
  const { data: config, isLoading: isLoadingConfig, refetch: refetchConfig } = useQuery({
    queryKey: ['status-page-config'],
    queryFn: async () => {
      const response = await api.get('status-page/config/');
      return response.data?.data as StatusPageConfigData;
    },
  });

  // Maintenances List Query
  const { data: maintenances, isLoading: isLoadingMaint, refetch: refetchMaint } = useQuery({
    queryKey: ['status-page-maintenances'],
    queryFn: async () => {
      const response = await api.get('status-page/maintenances/');
      return (response.data?.data || []) as ScheduledMaintenanceItem[];
    },
  });

  useEffect(() => {
    if (config) {
      setCompanyName(config.company_name || '');
      setSlug(config.slug || '');
      setDescription(config.description || '');
      setLogoUrl(config.logo_url || '');
      setSupportEmail(config.support_email || '');
      setIsPublic(config.is_public ?? true);
    }
  }, [config]);

  // Config Save Mutation
  const saveConfigMutation = useMutation({
    mutationFn: async (data: Partial<StatusPageConfigData>) => {
      await api.patch('status-page/config/', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status-page-config'] });
    },
  });

  // Maintenance Save Mutation
  const saveMaintMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingMaint) {
        await api.patch(`status-page/maintenances/${editingMaint.id}/`, data);
      } else {
        await api.post('status-page/maintenances/', data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status-page-maintenances'] });
      setShowMaintModal(false);
      setEditingMaint(null);
    },
  });

  // Maintenance Delete Mutation
  const deleteMaintMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`status-page/maintenances/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status-page-maintenances'] });
      setDeleteTarget(null);
    },
  });

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    saveConfigMutation.mutate({
      company_name: companyName.trim(),
      slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      description: description.trim(),
      logo_url: logoUrl.trim(),
      support_email: supportEmail.trim(),
      is_public: isPublic,
    });
  };

  const handleOpenCreateMaint = () => {
    setEditingMaint(null);
    setMaintTitle('');
    setMaintDesc('');
    setMaintStatus('scheduled');
    const nowISO = new Date().toISOString().slice(0, 16);
    const endISO = new Date(Date.now() + 3600000 * 2).toISOString().slice(0, 16);
    setMaintStart(nowISO);
    setMaintEnd(endISO);
    setShowMaintModal(true);
  };

  const handleOpenEditMaint = (m: ScheduledMaintenanceItem) => {
    setEditingMaint(m);
    setMaintTitle(m.title);
    setMaintDesc(m.description);
    setMaintStatus(m.status);
    setMaintStart(new Date(m.start_time).toISOString().slice(0, 16));
    setMaintEnd(new Date(m.end_time).toISOString().slice(0, 16));
    setShowMaintModal(true);
  };

  const handleSaveMaint = (e: React.FormEvent) => {
    e.preventDefault();
    saveMaintMutation.mutate({
      title: maintTitle.trim(),
      description: maintDesc.trim(),
      status: maintStatus,
      start_time: new Date(maintStart).toISOString(),
      end_time: new Date(maintEnd).toISOString(),
    });
  };

  const publicUrl = `/status/${slug || 'demo'}`;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
            <Globe className="text-accent-green" size={28} />
            Administración de Status Page
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Configura la Status Page de tu empresa, visibilidad pública y mantenimientos programados
          </p>
        </div>

        <a
          href={publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 bg-accent-green/10 border border-accent-green/30 text-accent-green hover:bg-accent-green hover:text-black font-semibold px-4 py-2 rounded-md text-sm transition-all"
        >
          <ExternalLink size={16} />
          Ver Status Page Pública
        </a>
      </div>

      {/* Main Grid: Settings & Maintenances */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Configuration Settings */}
        <div className="lg:col-span-1">
          <div className="bg-bg-card border border-border-base rounded-xl p-6 shadow-xl space-y-5">
            <h2 className="text-base font-bold text-text-main flex items-center gap-2 border-b border-border-base pb-3">
              <Building size={18} className="text-accent-blue" />
              Configuración de Marca
            </h2>

            {isLoadingConfig ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-accent-green" size={24} />
              </div>
            ) : (
              <form onSubmit={handleSaveConfig} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1">
                    Nombre de la Empresa / Marca
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ej. Micoope en línea"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:border-accent-green"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1">
                    Slug Público (URL)
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-mono text-text-dim">/status/</span>
                    <input
                      type="text"
                      required
                      placeholder="ej. micoope"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2 text-xs font-mono text-text-main focus:outline-none focus:border-accent-green"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1">
                    Descripción / Subtítulo
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Descripción visible en el encabezado público..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:border-accent-green resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1">
                    URL del Logo (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2 text-xs font-mono text-text-main focus:outline-none focus:border-accent-green"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1">
                    Email de Soporte Técnico
                  </label>
                  <input
                    type="email"
                    placeholder="soporte@empresa.com"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    className="w-full bg-bg-dark border border-border-base rounded-lg px-3 py-2 text-xs font-mono text-text-main focus:outline-none focus:border-accent-green"
                  />
                </div>

                <div className="pt-2 border-t border-border-base/50">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-mono text-text-muted">
                    <input
                      type="checkbox"
                      checked={isPublic}
                      onChange={(e) => setIsPublic(e.target.checked)}
                      className="rounded accent-accent-green"
                    />
                    <span>Permitir Acceso Público sin Autenticación</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={saveConfigMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-accent-green text-black font-semibold rounded-lg text-xs hover:opacity-90 transition-opacity disabled:opacity-50 mt-4"
                >
                  {saveConfigMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Guardar Configuración
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Right Column: Scheduled Maintenances */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-bg-card border border-border-base rounded-xl p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-border-base pb-4 mb-4">
              <h2 className="text-base font-bold text-text-main flex items-center gap-2">
                <Calendar size={18} className="text-accent-yellow" />
                Mantenimientos Programados ({maintenances?.length || 0})
              </h2>

              <button
                onClick={handleOpenCreateMaint}
                className="flex items-center gap-1.5 bg-accent-yellow text-black font-semibold px-3 py-1.5 rounded-lg text-xs hover:opacity-90 transition-opacity"
              >
                <Plus size={16} />
                Nuevo Mantenimiento
              </button>
            </div>

            {isLoadingMaint ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-accent-green" size={24} />
              </div>
            ) : maintenances && maintenances.length > 0 ? (
              <div className="space-y-3 font-mono text-xs">
                {maintenances.map((m) => (
                  <div
                    key={m.id}
                    className="bg-bg-dark border border-border-base rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2.5 mb-1">
                        <h3 className="font-bold text-text-main text-sm">{m.title}</h3>
                        <StatusBadge
                          status={m.status === 'in_progress' ? 'investigating' : m.status === 'completed' ? 'pass' : 'active'}
                          label={m.status === 'in_progress' ? 'En Progreso' : m.status === 'completed' ? 'Completado' : 'Programado'}
                        />
                      </div>
                      <p className="text-xs text-text-muted font-sans">{m.description || 'Sin detalles.'}</p>
                      <div className="flex items-center gap-3 text-[10px] text-text-dim mt-2">
                        <span>Inicio: {new Date(m.start_time).toLocaleString('es-ES')}</span>
                        <span>&bull;</span>
                        <span>Fin: {new Date(m.end_time).toLocaleString('es-ES')}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenEditMaint(m)}
                        className="p-1.5 text-text-dim hover:text-accent-green rounded transition-colors"
                        title="Editar mantenimiento"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(m)}
                        className="p-1.5 text-text-dim hover:text-accent-red rounded transition-colors"
                        title="Eliminar mantenimiento"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-dim text-xs py-6 text-center font-mono">
                No hay ventanas de mantenimiento programadas.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Maintenance Form Modal */}
      {showMaintModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={() => setShowMaintModal(false)}
        >
          <div
            className="bg-bg-card border border-border-base rounded-2xl p-6 w-full max-w-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 border-b border-border-base pb-3">
              <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                <Calendar size={18} className="text-accent-yellow" />
                {editingMaint ? 'Editar Mantenimiento' : 'Nuevo Mantenimiento Programado'}
              </h3>
              <button onClick={() => setShowMaintModal(false)} className="text-text-muted hover:text-text-main">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveMaint} className="space-y-4 font-sans">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">
                  Título del Mantenimiento
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Mantenimiento de servidores de base de datos"
                  value={maintTitle}
                  onChange={(e) => setMaintTitle(e.target.value)}
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:border-accent-green"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">
                  Detalles / Descripción de Impacto
                </label>
                <textarea
                  rows={3}
                  placeholder="Explicación técnica del mantenimiento planificado..."
                  value={maintDesc}
                  onChange={(e) => setMaintDesc(e.target.value)}
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:border-accent-green resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">
                  Estado Actual
                </label>
                <select
                  value={maintStatus}
                  onChange={(e) => setMaintStatus(e.target.value as MaintenanceStatus)}
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:border-accent-green"
                >
                  <option value="scheduled">Programado (Scheduled)</option>
                  <option value="in_progress">En Progreso (In Progress)</option>
                  <option value="completed">Completado (Completed)</option>
                  <option value="cancelled">Cancelado (Cancelled)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-text-muted mb-1">Fecha / Hora Inicio</label>
                  <input
                    type="datetime-local"
                    required
                    value={maintStart}
                    onChange={(e) => setMaintStart(e.target.value)}
                    className="w-full bg-bg-dark border border-border-base rounded-lg px-3 py-1.5 text-xs font-mono text-text-main"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-text-muted mb-1">Fecha / Hora Fin Estimada</label>
                  <input
                    type="datetime-local"
                    required
                    value={maintEnd}
                    onChange={(e) => setMaintEnd(e.target.value)}
                    className="w-full bg-bg-dark border border-border-base rounded-lg px-3 py-1.5 text-xs font-mono text-text-main"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-base">
                <button
                  type="button"
                  onClick={() => setShowMaintModal(false)}
                  className="px-3 py-1.5 bg-bg-dark border border-border-base rounded-lg text-xs text-text-muted hover:text-text-main"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saveMaintMutation.isPending}
                  className="px-4 py-1.5 bg-accent-yellow text-black font-semibold rounded-lg text-xs hover:opacity-90 disabled:opacity-50"
                >
                  {editingMaint ? 'Guardar Cambios' : 'Crear Mantenimiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Maintenance Modal */}
      <ConfirmDelete
        isOpen={!!deleteTarget}
        itemName={deleteTarget?.title || 'este mantenimiento'}
        isDeleting={deleteMaintMutation.isPending}
        onConfirm={() => deleteTarget && deleteMaintMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
