import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type {
  StatusPageConfigData,
  ScheduledMaintenanceItem,
  MaintenanceStatus,
  StatusPageAdminStats,
  AvailableTargetItem,
  ComponentSettingItem,
  StatusPageSubscriberItem,
  StatusPageSummaryItem,
  StatusPageCreatePayload,
  AnnouncementType,
} from '../types/status_page';
import StatusBadge from '../components/common/StatusBadge';
import ConfirmDelete from '../components/common/ConfirmDelete';
import ComponentPickerModal from '../components/status_page/ComponentPickerModal';
import CreateStatusPageModal from '../components/status_page/CreateStatusPageModal';
import StatusPageDirectoryModal from '../components/status_page/StatusPageDirectoryModal';
import MaintenanceTableView from '../components/status_page/MaintenanceTableView';
import MaintenanceUpdateModal from '../components/status_page/MaintenanceUpdateModal';
import {
  NOCPageHeader,
  NOCKpiGrid,
  NOCKpiCard,
  NOCBulkActionBar,
} from '../components/common/noc';
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
  Radio,
  Layers,
  Users,
  ShieldCheck,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Download,
  Info,
  Sliders,
  Eye,
  Clock,
} from 'lucide-react';

export default function StatusPageAdmin() {
  const queryClient = useQueryClient();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'branding' | 'components' | 'maintenances' | 'broadcast'>('branding');

  // Config Form States
  const [companyName, setCompanyName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [showUptimePct, setShowUptimePct] = useState(true);
  const [showLatency24h, setShowLatency24h] = useState(true);

  // Broadcast Announcement States
  const [customAnnouncement, setCustomAnnouncement] = useState('');
  const [announcementType, setAnnouncementType] = useState<AnnouncementType>('info');
  const [announcementActive, setAnnouncementActive] = useState(false);

  // Component Picker Modal State
  const [showComponentPicker, setShowComponentPicker] = useState(false);

  // Maintenance States
  const [showMaintModal, setShowMaintModal] = useState(false);
  const [editingMaint, setEditingMaint] = useState<ScheduledMaintenanceItem | null>(null);
  const [maintTitle, setMaintTitle] = useState('');
  const [maintDesc, setMaintDesc] = useState('');
  const [maintStatus, setMaintStatus] = useState<MaintenanceStatus>('scheduled');
  const [maintStart, setMaintStart] = useState('');
  const [maintEnd, setMaintEnd] = useState('');
  const [initialUpdate, setInitialUpdate] = useState('');
  const [selectedMaintIds, setSelectedMaintIds] = useState<string[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Maintenance Update Modal State
  const [updatingMaint, setUpdatingMaint] = useState<ScheduledMaintenanceItem | null>(null);

  // Multi-Status Pages Query
  const { data: pages = [], isLoading: isLoadingPages } = useQuery<StatusPageSummaryItem[]>({
    queryKey: ['status-page-pages'],
    queryFn: async () => {
      const response = await api.get('status-page/pages/');
      return (response.data?.data || []) as StatusPageSummaryItem[];
    },
  });

  // Active Selected Status Page ID
  const [activePageId, setActivePageId] = useState<string>(() => {
    return localStorage.getItem('sentinel_active_status_page_id') || '';
  });

  // Multi-page modals
  const [showCreatePageModal, setShowCreatePageModal] = useState(false);
  const [showDirectoryModal, setShowDirectoryModal] = useState(false);
  const [pageToDelete, setPageToDelete] = useState<string | null>(null);

  // Sync activePageId when pages load
  useEffect(() => {
    if (pages.length > 0) {
      const exists = pages.some((p) => p.id === activePageId);
      if (!activePageId || !exists) {
        const defaultPage = pages.find((p) => p.is_default) || pages[0];
        setActivePageId(defaultPage.id);
        localStorage.setItem('sentinel_active_status_page_id', defaultPage.id);
      }
    }
  }, [pages, activePageId]);

  const handleSelectPage = (pageId: string) => {
    setActivePageId(pageId);
    localStorage.setItem('sentinel_active_status_page_id', pageId);
  };

  const activePage = pages.find((p) => p.id === activePageId) || pages[0];

  // Delete Targets
  const [deleteTarget, setDeleteTarget] = useState<ScheduledMaintenanceItem | null>(null);
  const [subscriberToDelete, setSubscriberToDelete] = useState<string | null>(null);

  // 1. Config Query
  const { data: config, isLoading: isLoadingConfig } = useQuery({
    queryKey: ['status-page-config', activePageId],
    queryFn: async () => {
      const response = await api.get('status-page/config/', {
        params: activePageId ? { page_id: activePageId } : {},
      });
      return response.data?.data as StatusPageConfigData;
    },
    enabled: pages.length > 0 || !activePageId,
  });

  // 2. Admin Stats Query
  const { data: stats } = useQuery({
    queryKey: ['status-page-stats', activePageId],
    queryFn: async () => {
      const response = await api.get('status-page/stats/', {
        params: activePageId ? { page_id: activePageId } : {},
      });
      return response.data?.data as StatusPageAdminStats;
    },
    refetchInterval: 15000,
    enabled: pages.length > 0 || !activePageId,
  });

  // 3. Available Targets Query
  const { data: availableTargets = [] } = useQuery<AvailableTargetItem[]>({
    queryKey: ['status-page-available-targets'],
    queryFn: async () => {
      const response = await api.get('status-page/available-targets/');
      return (response.data?.data || []) as AvailableTargetItem[];
    },
  });

  // 4. Maintenances List Query
  const { data: maintenances = [], isLoading: isLoadingMaint } = useQuery<ScheduledMaintenanceItem[]>({
    queryKey: ['status-page-maintenances', activePageId],
    queryFn: async () => {
      const response = await api.get('status-page/maintenances/', {
        params: activePageId ? { page_id: activePageId } : {},
      });
      return (response.data?.data || []) as ScheduledMaintenanceItem[];
    },
    enabled: pages.length > 0 || !activePageId,
  });

  // 5. Subscribers List Query
  const { data: subscribers = [] } = useQuery<StatusPageSubscriberItem[]>({
    queryKey: ['status-page-subscribers', activePageId],
    queryFn: async () => {
      const response = await api.get('status-page/subscribers/', {
        params: activePageId ? { page_id: activePageId } : {},
      });
      return (response.data?.data || []) as StatusPageSubscriberItem[];
    },
    enabled: pages.length > 0 || !activePageId,
  });

  // Populate config fields
  useEffect(() => {
    if (config) {
      setCompanyName(config.company_name || '');
      setSlug(config.slug || '');
      setDescription(config.description || '');
      setLogoUrl(config.logo_url || '');
      setWebsiteUrl(config.website_url || '');
      setSupportEmail(config.support_email || '');
      setIsPublic(config.is_public ?? true);
      setShowUptimePct(config.show_uptime_pct ?? true);
      setShowLatency24h(config.show_latency_24h ?? true);
      setCustomAnnouncement(config.custom_announcement || '');
      setAnnouncementType(config.announcement_type || 'info');
      setAnnouncementActive(config.announcement_active ?? false);
    }
  }, [config]);

  // Mutations
  const saveConfigMutation = useMutation({
    mutationFn: async (data: Partial<StatusPageConfigData>) => {
      await api.patch('status-page/config/', data, {
        params: activePageId ? { page_id: activePageId } : {},
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status-page-config', activePageId] });
      queryClient.invalidateQueries({ queryKey: ['status-page-stats', activePageId] });
      queryClient.invalidateQueries({ queryKey: ['status-page-pages'] });
    },
  });

  const createPageMutation = useMutation({
    mutationFn: async (payload: StatusPageCreatePayload) => {
      const res = await api.post('status-page/pages/', payload);
      return res.data?.data;
    },
    onSuccess: (newPage) => {
      queryClient.invalidateQueries({ queryKey: ['status-page-pages'] });
      if (newPage?.id) {
        handleSelectPage(newPage.id);
      }
    },
  });

  const setDefaultPageMutation = useMutation({
    mutationFn: async (pageId: string) => {
      await api.post(`status-page/pages/${pageId}/set-default/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status-page-pages'] });
      queryClient.invalidateQueries({ queryKey: ['status-page-stats', activePageId] });
    },
  });

  const deletePageMutation = useMutation({
    mutationFn: async (pageId: string) => {
      await api.delete(`status-page/pages/${pageId}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status-page-pages'] });
      setPageToDelete(null);
    },
  });

  const saveMaintMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingMaint) {
        await api.patch(`status-page/maintenances/${editingMaint.id}/`, data);
      } else {
        await api.post('status-page/maintenances/', {
          ...data,
          status_page_id: activePageId || undefined,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status-page-maintenances', activePageId] });
      queryClient.invalidateQueries({ queryKey: ['status-page-stats', activePageId] });
      queryClient.invalidateQueries({ queryKey: ['status-page-pages'] });
      setShowMaintModal(false);
      setEditingMaint(null);
    },
  });

  const deleteMaintMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`status-page/maintenances/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status-page-maintenances', activePageId] });
      queryClient.invalidateQueries({ queryKey: ['status-page-stats', activePageId] });
      queryClient.invalidateQueries({ queryKey: ['status-page-pages'] });
      setDeleteTarget(null);
    },
  });

  const postUpdateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { message: string; status?: MaintenanceStatus } }) => {
      await api.post(`status-page/maintenances/${id}/updates/`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status-page-maintenances', activePageId] });
      setUpdatingMaint(null);
    },
  });

  const deleteSubscriberMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`status-page/subscribers/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status-page-subscribers', activePageId] });
      queryClient.invalidateQueries({ queryKey: ['status-page-stats', activePageId] });
      queryClient.invalidateQueries({ queryKey: ['status-page-pages'] });
      setSubscriberToDelete(null);
    },
  });

  // Handlers
  const handleSaveBranding = (e: React.FormEvent) => {
    e.preventDefault();
    saveConfigMutation.mutate({
      company_name: companyName.trim(),
      slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      description: description.trim(),
      logo_url: logoUrl.trim(),
      website_url: websiteUrl.trim(),
      support_email: supportEmail.trim(),
      is_public: isPublic,
      show_uptime_pct: showUptimePct,
      show_latency_24h: showLatency24h,
    });
  };

  const handleSaveAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    saveConfigMutation.mutate({
      custom_announcement: customAnnouncement.trim(),
      announcement_type: announcementType,
      announcement_active: announcementActive,
    });
  };

  const handleSaveComponentSettings = async (settings: ComponentSettingItem[]) => {
    await saveConfigMutation.mutateAsync({
      component_settings: settings,
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
    setInitialUpdate('Mantenimiento planificado registrado en la plataforma.');
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
      initial_update: initialUpdate.trim(),
    });
  };

  // Bulk Maintenance Handlers
  const handleToggleSelectMaint = (id: string) => {
    setSelectedMaintIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllMaint = () => {
    if (selectedMaintIds.length === maintenances.length) {
      setSelectedMaintIds([]);
    } else {
      setSelectedMaintIds(maintenances.map((m) => m.id));
    }
  };

  const handleBulkMaintAction = async (action: 'completed' | 'cancelled' | 'delete') => {
    if (selectedMaintIds.length === 0) return;
    if (action === 'delete') {
      if (
        !window.confirm(
          `¿Deseas eliminar permanentemente los ${selectedMaintIds.length} mantenimientos seleccionados?`
        )
      ) {
        return;
      }
    }
    setBulkProcessing(true);
    try {
      await api.post('status-page/maintenances/bulk-action/', {
        action,
        maintenance_ids: selectedMaintIds,
      });
      setSelectedMaintIds([]);
      queryClient.invalidateQueries({ queryKey: ['status-page-maintenances'] });
      queryClient.invalidateQueries({ queryKey: ['status-page-stats'] });
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleExportSubscribersCSV = () => {
    const url = `${api.defaults.baseURL}status-page/subscribers/export/${
      activePageId ? `?page_id=${activePageId}` : ''
    }`;
    window.open(url, '_blank');
  };

  const publicUrl = `/status/${activePage?.slug || slug || 'demo'}`;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-sans">
      {/* 1. TOP HEADER (Standard NOC Header) */}
      <NOCPageHeader
        title="Administración de Status Page"
        badgeText="NOC PUBLIC VISIBILITY"
        description="Portales de transparencia multi-empresa, publicación de componentes, mantenimientos y suscriptores."
        icon={<Activity size={26} />}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDirectoryModal(true)}
              className="flex items-center gap-1.5 bg-bg-card border border-border-base text-text-main hover:border-accent-green font-semibold px-3.5 py-2 rounded-full text-xs transition-all shadow-xs cursor-pointer"
            >
              <Layers size={14} className="text-accent-blue" />
              Directorio ({pages.length})
            </button>
            <button
              type="button"
              onClick={() => setShowCreatePageModal(true)}
              className="flex items-center gap-1.5 bg-accent-green text-black font-semibold px-4 py-2 rounded-full text-xs hover:bg-accent-green/90 transition-all shadow-xs cursor-pointer"
            >
              <Plus size={14} />
              Nueva Status Page
            </button>
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-accent-green/10 border border-accent-green/30 text-accent-green hover:bg-accent-green hover:text-black font-semibold px-4 py-2 rounded-full text-xs transition-all shadow-xs cursor-pointer"
            >
              <ExternalLink size={14} />
              Ver en Vivo
            </a>
          </div>
        }
      />

      {/* 2. ACTIVE STATUS PAGE SELECTOR BAR */}
      <div className="bg-bg-card border border-border-base/80 rounded-2xl p-4 shadow-sm font-sans flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-bg-dark border border-border-base flex items-center justify-center text-accent-green shrink-0 overflow-hidden">
            {activePage?.logo_url ? (
              <img
                src={activePage.logo_url}
                alt={activePage.company_name}
                className="w-full h-full object-contain p-1"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <Building size={20} />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-text-dim font-mono uppercase tracking-wider">
                Portal Activo:
              </span>
              <h2 className="text-sm font-bold text-text-main">
                {activePage?.company_name || companyName || 'Cargando...'}
              </h2>
              {activePage?.is_default && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Principal
                </span>
              )}
              {activePage?.is_public ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Pública
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-500/10 text-text-muted border border-border-base">
                  Privada
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs">
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-accent-green hover:underline flex items-center gap-1"
              >
                /status/{activePage?.slug || slug}
                <ExternalLink size={11} />
              </a>
              <span className="text-text-dim text-[11px]">
                {activePage?.published_components_count ?? 0} componentes publicados
              </span>
            </div>
          </div>
        </div>

        {/* Switcher selector */}
        <div className="flex items-center gap-2 shrink-0">
          <label className="text-xs text-text-muted font-medium shrink-0">Cambiar Empresa:</label>
          <select
            value={activePageId}
            onChange={(e) => handleSelectPage(e.target.value)}
            className="bg-bg-dark border border-border-base rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:border-accent-green cursor-pointer min-w-[200px]"
          >
            {pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.company_name} {p.is_default ? '★ (Principal)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. NOC COMMAND CENTER: KPI STRIP */}
      <NOCKpiGrid columns={4}>
        {/* KPI 1: Estado General Proyectado */}
        <NOCKpiCard
          title="Salud Proyectada"
          icon={
            stats?.projected_status === 'outage' ? (
              <Flame size={16} className="text-accent-red" />
            ) : (
              <ShieldCheck size={16} className="text-accent-green" />
            )
          }
          badge={{
            text: stats?.projected_status === 'outage' ? 'Interrupción' : 'Operacional',
            variant: stats?.projected_status === 'outage' ? 'danger' : 'success',
          }}
          value={stats?.projected_status === 'outage' ? 'Alerta Crítica' : '100% Estable'}
          valueColor={stats?.projected_status === 'outage' ? 'text-accent-red' : 'text-accent-green'}
          valueSuffix="en vivo"
          subtitle="Estado visible para visitantes"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Visibilidad Pública</span>
              <span className={config?.is_public ? 'text-accent-green' : 'text-text-muted'}>
                {config?.is_public ? 'Habilitada' : 'Privada'}
              </span>
            </div>
          }
        />

        {/* KPI 2: Componentes Publicados */}
        <NOCKpiCard
          title="Componentes Públicos"
          icon={<Layers size={16} className="text-accent-blue" />}
          badge={{
            text: `${stats?.published_components || 0} de ${stats?.total_components || 0}`,
            variant: 'info',
          }}
          value={stats?.published_components || 0}
          valueColor="text-text-main"
          valueSuffix="servicios"
          subtitle="Monitores visibles en la status page"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Total Inventario</span>
              <span>{stats?.total_components || 0} targets</span>
            </div>
          }
        />

        {/* KPI 3: Mantenimientos Programados */}
        <NOCKpiCard
          title="Mantenimientos"
          icon={<Calendar size={16} className="text-amber-400" />}
          badge={{
            text: `${stats?.scheduled_maintenances || 0} Activos`,
            variant: (stats?.scheduled_maintenances || 0) > 0 ? 'warning' : 'neutral',
          }}
          value={stats?.scheduled_maintenances || 0}
          valueColor={(stats?.scheduled_maintenances || 0) > 0 ? 'text-amber-400' : 'text-text-main'}
          valueSuffix="ventanas"
          subtitle="Intervenciones planificadas"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Impacto Preventivo</span>
              <span className="text-amber-400 font-medium">NOC Schedule</span>
            </div>
          }
        />

        {/* KPI 4: Suscriptores Conectados */}
        <NOCKpiCard
          title="Suscriptores Clientes"
          icon={<Users size={16} className="text-purple-400" />}
          badge={{
            text: `${stats?.active_subscribers || 0} Correos`,
            variant: 'neutral',
          }}
          value={stats?.active_subscribers || 0}
          valueColor="text-purple-400"
          valueSuffix="usuarios"
          subtitle="Reciben notificaciones por email"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Audiencia Externa</span>
              <span className="text-purple-400 font-medium">Alertas automáticas</span>
            </div>
          }
        />
      </NOCKpiGrid>

      {/* 3. NAVIGATION TABS */}
      <div className="flex items-center gap-2 border-b border-border-base/70 pb-2 overflow-x-auto text-xs font-sans">
        <button
          type="button"
          onClick={() => setActiveTab('branding')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold transition-all cursor-pointer ${
            activeTab === 'branding'
              ? 'bg-accent-green text-black shadow-sm'
              : 'text-text-muted hover:text-text-main hover:bg-bg-dark'
          }`}
        >
          <Building size={14} />
          Marca & Configuración
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('components')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold transition-all cursor-pointer ${
            activeTab === 'components'
              ? 'bg-accent-green text-black shadow-sm'
              : 'text-text-muted hover:text-text-main hover:bg-bg-dark'
          }`}
        >
          <Layers size={14} />
          Componentes Públicos ({stats?.published_components || 0})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('maintenances')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold transition-all cursor-pointer ${
            activeTab === 'maintenances'
              ? 'bg-accent-green text-black shadow-sm'
              : 'text-text-muted hover:text-text-main hover:bg-bg-dark'
          }`}
        >
          <Calendar size={14} />
          Mantenimientos ({maintenances.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('broadcast')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold transition-all cursor-pointer ${
            activeTab === 'broadcast'
              ? 'bg-accent-green text-black shadow-sm'
              : 'text-text-muted hover:text-text-main hover:bg-bg-dark'
          }`}
        >
          <Radio size={14} />
          Anuncio Broadcast & Suscriptores ({subscribers.length})
        </button>
      </div>

      {/* 4. TAB CONTENTS */}

      {/* Tab 1: Branding & General Configuration */}
      {activeTab === 'branding' && (
        <div className="bg-bg-card border border-border-base/70 rounded-3xl p-6 shadow-sm w-full font-sans space-y-6">
          <div className="border-b border-border-base/60 pb-3">
            <h3 className="text-base font-bold text-text-main flex items-center gap-2">
              <Building size={18} className="text-accent-green" />
              Identidad de Marca & Enlaces Corporativos
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Personaliza el nombre, logo, slug público y visibilidad de tu portal de transparencia.
            </p>
          </div>

          <form onSubmit={handleSaveBranding} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  Nombre de la Empresa o Portal <span className="text-accent-red">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Micoope en Línea"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-3.5 py-2.5 text-xs text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  Slug / URL Pública <span className="text-accent-red">*</span>
                </label>
                <div className="flex items-center gap-2 bg-bg-dark border border-border-base rounded-xl px-3.5 py-2">
                  <span className="text-text-dim font-mono text-xs">/status/</span>
                  <input
                    type="text"
                    required
                    placeholder="micoope"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full bg-transparent text-xs font-mono text-accent-green focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5">
                Descripción & Propósito del Portal
              </label>
              <textarea
                rows={2}
                placeholder="Descripción visible en el encabezado para clientes y usuarios..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-bg-dark border border-border-base rounded-xl px-3.5 py-2.5 text-xs text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green resize-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  URL del Logo (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="https://empresa.com/logo.png"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-3.5 py-2.5 text-xs font-mono text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  Sitio Web Principal (Website URL)
                </label>
                <input
                  type="url"
                  placeholder="https://empresa.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-3.5 py-2.5 text-xs font-mono text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  Email de Soporte Técnico
                </label>
                <input
                  type="email"
                  placeholder="soporte@empresa.com"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-3.5 py-2.5 text-xs font-mono text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green"
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="pt-3 border-t border-border-base/50 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-bg-dark/80 border border-border-base cursor-pointer hover:border-accent-green/40 transition-colors">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="rounded accent-accent-green"
                />
                <div>
                  <span className="font-semibold text-text-main block">Acceso Público</span>
                  <span className="text-[10px] text-text-dim">Visible sin autenticación</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-bg-dark/80 border border-border-base cursor-pointer hover:border-accent-green/40 transition-colors">
                <input
                  type="checkbox"
                  checked={showUptimePct}
                  onChange={(e) => setShowUptimePct(e.target.checked)}
                  className="rounded accent-accent-green"
                />
                <div>
                  <span className="font-semibold text-text-main block">Porcentaje Uptime</span>
                  <span className="text-[10px] text-text-dim">Muestra % en barra de 90d</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-bg-dark/80 border border-border-base cursor-pointer hover:border-accent-green/40 transition-colors">
                <input
                  type="checkbox"
                  checked={showLatency24h}
                  onChange={(e) => setShowLatency24h(e.target.checked)}
                  className="rounded accent-accent-green"
                />
                <div>
                  <span className="font-semibold text-text-main block">Latencia 24h</span>
                  <span className="text-[10px] text-text-dim">Muestra badge ms de respuesta</span>
                </div>
              </label>
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="submit"
                disabled={saveConfigMutation.isPending}
                className="px-6 py-2.5 bg-accent-green text-black font-semibold rounded-full text-xs hover:bg-accent-green/90 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {saveConfigMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                Guardar Configuración de Marca
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 2: Public Components & Categories */}
      {activeTab === 'components' && (
        <div className="bg-bg-card border border-border-base/70 rounded-3xl p-6 shadow-sm space-y-5 font-sans">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-base/60 pb-4">
            <div>
              <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                <Layers size={18} className="text-accent-blue" />
                Componentes de Monitoreo Publicados
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                Controla con precisión qué servicios de Uptime y API Checks son visibles para los clientes.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowComponentPicker(true)}
              className="flex items-center gap-2 px-4 py-2 bg-accent-blue/10 border border-accent-blue/30 text-accent-blue hover:bg-accent-blue hover:text-black font-semibold rounded-full text-xs transition-all shadow-xs cursor-pointer"
            >
              <Sliders size={14} />
              Gestionar Componentes & Categorías
            </button>
          </div>

          {config?.component_settings && config.component_settings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {config.component_settings.map((comp: ComponentSettingItem) => (
                <div
                  key={comp.id}
                  className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    comp.is_visible
                      ? 'bg-bg-dark/80 border-border-base'
                      : 'bg-bg-dark/30 border-border-base/40 opacity-50'
                  }`}
                >
                  <div className="min-w-0">
                    <span className="font-semibold text-text-main text-xs truncate block">
                      {comp.display_name}
                    </span>
                    <span className="text-[10px] text-text-dim block mt-0.5">
                      Categoría: <strong className="text-accent-green">{comp.category}</strong>
                    </span>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      comp.is_visible
                        ? 'bg-accent-green/10 text-accent-green border-accent-green/30'
                        : 'bg-bg-dark text-text-dim border-border-base'
                    }`}
                  >
                    {comp.is_visible ? 'Visible' : 'Oculto'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-bg-dark/50 border border-border-base rounded-2xl p-8 text-center space-y-3">
              <Layers size={32} className="text-text-dim mx-auto opacity-50" />
              <p className="text-xs text-text-muted max-w-md mx-auto leading-relaxed">
                Aún no has configurado reglas personalizadas de visibilidad. Por defecto, todos los monitores activos se publican automáticamente.
              </p>
              <button
                type="button"
                onClick={() => setShowComponentPicker(true)}
                className="px-4 py-2 bg-accent-green text-black font-semibold rounded-full text-xs hover:bg-accent-green/90 transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
              >
                <Sliders size={14} />
                Seleccionar Servicios Específicos
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Scheduled Maintenances */}
      {activeTab === 'maintenances' && (
        <div className="space-y-4 font-sans">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                <Calendar size={18} className="text-amber-400" />
                Ventanas de Mantenimiento Programadas
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                Informa a los clientes de interrupciones planificadas y publica avances en tiempo real.
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenCreateMaint}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black font-semibold rounded-full text-xs hover:bg-amber-400 transition-all shadow-sm cursor-pointer"
            >
              <Plus size={15} />
              Nuevo Mantenimiento
            </button>
          </div>

          {/* Maintenance Table View */}
          <MaintenanceTableView
            maintenances={maintenances}
            selectedIds={selectedMaintIds}
            onToggleSelect={handleToggleSelectMaint}
            onSelectAll={handleSelectAllMaint}
            onAddUpdate={(m: ScheduledMaintenanceItem) => setUpdatingMaint(m)}
            onEdit={(m: ScheduledMaintenanceItem) => handleOpenEditMaint(m)}
            onDelete={(m: ScheduledMaintenanceItem) => setDeleteTarget(m)}
          />

          {/* Floating Bulk Action Bar */}
          <NOCBulkActionBar
            selectedCount={selectedMaintIds.length}
            onClearSelection={() => setSelectedMaintIds([])}
            itemLabel="mantenimientos"
            actions={
              <>
                <button
                  type="button"
                  onClick={() => handleBulkMaintAction('completed')}
                  disabled={bulkProcessing}
                  className="px-3.5 py-1.5 bg-accent-green text-black font-semibold rounded-full text-xs hover:bg-accent-green/90 transition-all disabled:opacity-50 cursor-pointer"
                >
                  Marcar Completados
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkMaintAction('cancelled')}
                  disabled={bulkProcessing}
                  className="px-3.5 py-1.5 bg-bg-card border border-border-base text-text-muted hover:text-text-main font-semibold rounded-full text-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkMaintAction('delete')}
                  disabled={bulkProcessing}
                  className="px-3.5 py-1.5 bg-accent-red text-white font-semibold rounded-full text-xs hover:bg-accent-red/90 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {bulkProcessing ? 'Eliminando...' : 'Eliminar'}
                </button>
              </>
            }
          />
        </div>
      )}

      {/* Tab 4: Broadcast Announcement & Subscribers */}
      {activeTab === 'broadcast' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-sans">
          {/* Sub-section 1: Broadcast Announcement Banner */}
          <div className="bg-bg-card border border-border-base/70 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="border-b border-border-base/60 pb-3">
              <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                <Radio size={18} className="text-amber-400" />
                Banner de Anuncio Global (Broadcast)
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                Publica un comunicado destacado en la parte superior de la Status Page pública.
              </p>
            </div>

            <form onSubmit={handleSaveAnnouncement} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  Mensaje del Comunicado
                </label>
                <textarea
                  rows={3}
                  placeholder="ej. Estamos monitoreando una intermitencia con nuestro proveedor de nube en la región US-East..."
                  value={customAnnouncement}
                  onChange={(e) => setCustomAnnouncement(e.target.value)}
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-3.5 py-2.5 text-xs text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    Nivel de Severidad
                  </label>
                  <select
                    value={announcementType}
                    onChange={(e) => setAnnouncementType(e.target.value as AnnouncementType)}
                    className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:border-accent-green cursor-pointer"
                  >
                    <option value="info">Informativo (Azul)</option>
                    <option value="warning">Advertencia (Amarillo)</option>
                    <option value="critical">Alerta Crítica (Rojo)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    Estado del Banner
                  </label>
                  <label className="flex items-center gap-2 h-10 px-3.5 bg-bg-dark border border-border-base rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={announcementActive}
                      onChange={(e) => setAnnouncementActive(e.target.checked)}
                      className="rounded accent-accent-green"
                    />
                    <span className="font-semibold text-text-main text-xs">
                      {announcementActive ? 'Activo en Vivo' : 'Inactivo / Oculto'}
                    </span>
                  </label>
                </div>
              </div>

              {/* Live Preview Box */}
              {customAnnouncement && announcementActive && (
                <div className="space-y-1.5 pt-2">
                  <span className="text-[10px] text-text-dim font-mono">Previsualización en vivo:</span>
                  <div
                    className={`p-3.5 rounded-2xl border flex items-center gap-2.5 text-xs ${
                      announcementType === 'critical'
                        ? 'bg-accent-red/10 border-accent-red/30 text-accent-red'
                        : announcementType === 'warning'
                        ? 'bg-accent-yellow/10 border-accent-yellow/30 text-accent-yellow'
                        : 'bg-accent-blue/10 border-accent-blue/30 text-accent-blue'
                    }`}
                  >
                    <Info size={16} className="shrink-0" />
                    <span className="font-medium text-text-main">{customAnnouncement}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={saveConfigMutation.isPending}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-full text-xs transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {saveConfigMutation.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  Actualizar Anuncio
                </button>
              </div>
            </form>
          </div>

          {/* Sub-section 2: Subscribers Management */}
          <div className="bg-bg-card border border-border-base/70 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border-base/60 pb-3">
              <div>
                <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                  <Users size={18} className="text-purple-400" />
                  Suscriptores por Correo ({subscribers.length})
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Lista de usuarios y clientes que reciben avisos de incidentes.
                </p>
              </div>

              <button
                type="button"
                onClick={handleExportSubscribersCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-dark border border-border-base text-text-muted hover:text-text-main rounded-full text-xs transition-colors cursor-pointer"
                title="Exportar a CSV"
              >
                <Download size={13} />
                Exportar CSV
              </button>
            </div>

            {subscribers.length > 0 ? (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {subscribers.map((sub) => (
                  <div
                    key={sub.id}
                    className="p-3 bg-bg-dark/80 border border-border-base/70 rounded-2xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <Mail size={14} className="text-purple-400 shrink-0" />
                      <div>
                        <span className="font-semibold text-text-main font-mono text-xs block">
                          {sub.email}
                        </span>
                        <span className="text-[10px] text-text-dim">
                          Suscrito el: {new Date(sub.created_at).toLocaleDateString('es-ES')}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSubscriberToDelete(sub.id)}
                      className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded-full transition-colors cursor-pointer"
                      title="Dar de baja suscriptor"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center text-text-dim text-xs">
                <Users size={28} className="mx-auto mb-2 opacity-50" />
                Aún no hay clientes suscritos a través de la Status Page pública.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. MODALS */}

      {/* Component Picker Modal */}
      <ComponentPickerModal
        isOpen={showComponentPicker}
        onClose={() => setShowComponentPicker(false)}
        availableTargets={availableTargets}
        currentSettings={config?.component_settings || []}
        onSave={handleSaveComponentSettings}
      />

      {/* Maintenance Create / Edit Modal */}
      {showMaintModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200 font-sans"
          onClick={() => setShowMaintModal(false)}
        >
          <div
            className="bg-bg-card border border-border-base rounded-3xl p-6 w-full max-w-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-border-base/60">
              <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                <Calendar size={18} className="text-amber-400" />
                {editingMaint ? 'Editar Mantenimiento' : 'Programar Nueva Ventana de Mantenimiento'}
              </h3>
              <button
                onClick={() => setShowMaintModal(false)}
                className="text-text-muted hover:text-text-main p-1.5 rounded-full hover:bg-bg-dark transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveMaint} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  Título del Mantenimiento <span className="text-accent-red">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Migración de Base de Datos y Actualización de Parches"
                  value={maintTitle}
                  onChange={(e) => setMaintTitle(e.target.value)}
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-3.5 py-2.5 text-xs text-text-main focus:outline-none focus:border-accent-green"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  Detalles & Alcance Técnico
                </label>
                <textarea
                  rows={3}
                  placeholder="Descripción del impacto anticipado para usuarios..."
                  value={maintDesc}
                  onChange={(e) => setMaintDesc(e.target.value)}
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-3.5 py-2.5 text-xs text-text-main focus:outline-none focus:border-accent-green resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    Fecha y Hora de Inicio
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={maintStart}
                    onChange={(e) => setMaintStart(e.target.value)}
                    className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2 text-xs font-mono text-text-main focus:outline-none focus:border-accent-green"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    Fecha y Hora de Fin Estimada
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={maintEnd}
                    onChange={(e) => setMaintEnd(e.target.value)}
                    className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2 text-xs font-mono text-text-main focus:outline-none focus:border-accent-green"
                  />
                </div>
              </div>

              {!editingMaint && (
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    Nota Inicial para Bitácora Pública
                  </label>
                  <input
                    type="text"
                    placeholder="ej. Mantenimiento planificado registrado en la plataforma."
                    value={initialUpdate}
                    onChange={(e) => setInitialUpdate(e.target.value)}
                    className="w-full bg-bg-dark border border-border-base rounded-xl px-3.5 py-2 text-xs text-text-main focus:outline-none focus:border-accent-green"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border-base/60">
                <button
                  type="button"
                  onClick={() => setShowMaintModal(false)}
                  className="px-4 py-2 border border-border-base rounded-full text-xs text-text-muted hover:text-text-main hover:bg-bg-dark transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saveMaintMutation.isPending}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-full text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {saveMaintMutation.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  {editingMaint ? 'Guardar Cambios' : 'Programar Mantenimiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Maintenance Live Update Modal */}
      <MaintenanceUpdateModal
        maintenance={updatingMaint}
        onClose={() => setUpdatingMaint(null)}
        onSubmit={async (data: { message: string; status?: MaintenanceStatus }) => {
          if (updatingMaint) {
            await postUpdateMutation.mutateAsync({ id: updatingMaint.id, data });
          }
        }}
      />

      {/* Delete Maintenance Confirmation */}
      <ConfirmDelete
        isOpen={!!deleteTarget}
        itemName={deleteTarget?.title || 'este mantenimiento'}
        isDeleting={deleteMaintMutation.isPending}
        onConfirm={() => deleteTarget && deleteMaintMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />

      {/* Delete Subscriber Confirmation */}
      <ConfirmDelete
        isOpen={!!subscriberToDelete}
        itemName="este suscriptor"
        isDeleting={deleteSubscriberMutation.isPending}
        onConfirm={() => subscriberToDelete && deleteSubscriberMutation.mutate(subscriberToDelete)}
        onClose={() => setSubscriberToDelete(null)}
      />

      {/* Create Status Page Modal */}
      <CreateStatusPageModal
        isOpen={showCreatePageModal}
        onClose={() => setShowCreatePageModal(false)}
        existingPages={pages}
        onCreate={async (payload) => {
          await createPageMutation.mutateAsync(payload);
        }}
      />

      {/* Status Page Directory Modal */}
      <StatusPageDirectoryModal
        isOpen={showDirectoryModal}
        onClose={() => setShowDirectoryModal(false)}
        pages={pages}
        activePageId={activePageId}
        onSelectPage={handleSelectPage}
        onOpenCreate={() => setShowCreatePageModal(true)}
        onSetDefault={async (pageId) => {
          await setDefaultPageMutation.mutateAsync(pageId);
        }}
        onDeletePage={async (pageId) => {
          setPageToDelete(pageId);
        }}
      />

      {/* Delete Status Page Confirmation */}
      <ConfirmDelete
        isOpen={!!pageToDelete}
        itemName="esta Status Page y toda su configuración"
        isDeleting={deletePageMutation.isPending}
        onConfirm={() => pageToDelete && deletePageMutation.mutate(pageToDelete)}
        onClose={() => setPageToDelete(null)}
      />
    </div>
  );
}
