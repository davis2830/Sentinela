import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type {
  NotificationChannel,
  NotificationItem,
  NotificationStats,
  CreateChannelData,
  ChannelType,
} from '../types/notifications';
import ChannelForm from '../components/notifications/ChannelForm';
import ChannelTableView from '../components/notifications/ChannelTableView';
import ChannelDetailDrawer from '../components/notifications/ChannelDetailDrawer';
import ConfirmDelete from '../components/common/ConfirmDelete';
import StatusBadge from '../components/common/StatusBadge';
import {
  NOCPageHeader,
  NOCKpiGrid,
  NOCKpiCard,
  NOCToolbar,
  NOCBulkActionBar,
} from '../components/common/noc';
import type { NOCStatusPill } from '../components/common/noc/NOCToolbar';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { usePersistentViewMode } from '../hooks/usePersistentViewMode';
import {
  Send,
  Plus,
  Loader2,
  Trash2,
  Play,
  RotateCcw,
  MessageSquare,
  Mail,
  Bell,
  Radio,
  Webhook as WebhookIcon,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  Power,
  SlidersHorizontal,
  Pencil,
  Copy,
  Check,
  FileCode2,
  Activity,
  Moon,
  Gauge,
} from 'lucide-react';

const TYPE_ICONS: Record<ChannelType, any> = {
  telegram: Send,
  slack: MessageSquare,
  teams: Bell,
  discord: Radio,
  email: Mail,
  webhook: WebhookIcon,
};

const TYPE_COLORS: Record<ChannelType, { bg: string; text: string; border: string }> = {
  telegram: { bg: 'bg-accent-blue/10', text: 'text-accent-blue', border: 'border-accent-blue/30' },
  slack: { bg: 'bg-accent-purple/10', text: 'text-accent-purple', border: 'border-accent-purple/30' },
  teams: { bg: 'bg-accent-blue/10', text: 'text-accent-blue', border: 'border-accent-blue/30' },
  discord: { bg: 'bg-accent-purple/10', text: 'text-accent-purple', border: 'border-accent-purple/30' },
  email: { bg: 'bg-accent-yellow/10', text: 'text-accent-yellow', border: 'border-accent-yellow/30' },
  webhook: { bg: 'bg-accent-green/10', text: 'text-accent-green', border: 'border-accent-green/30' },
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  // View mode and search state
  const [viewMode, setViewMode] = usePersistentViewMode('notifications_channels_view', 'grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals & Drawers
  const [showForm, setShowForm] = useState(false);
  const [editingChannel, setEditingChannel] = useState<NotificationChannel | null>(null);
  const [inspectingChannel, setInspectingChannel] = useState<NotificationChannel | null>(null);
  const [deleteChannel, setDeleteChannel] = useState<NotificationChannel | null>(null);

  // Actions in progress
  const [testingChannelId, setTestingChannelId] = useState<string | null>(null);
  const [retryingLogId, setRetryingLogId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [logStatusFilter, setLogStatusFilter] = useState<'all' | 'sent' | 'failed'>('all');

  // Auto-refresh hook (20s countdown)
  const autoRefresh = useAutoRefresh({
    intervalSeconds: 20,
    initialEnabled: true,
  });

  // 1. Stats Query
  const { data: stats } = useQuery<NotificationStats>({
    queryKey: ['notification-stats'],
    queryFn: async () => {
      const response = await api.get('notifications/stats/');
      return response.data?.data as NotificationStats;
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  // 2. Channels Query
  const {
    data: channels = [],
    isLoading: isLoadingChannels,
    refetch: refetchChannels,
  } = useQuery<NotificationChannel[]>({
    queryKey: ['notification-channels'],
    queryFn: async () => {
      const response = await api.get('notifications/channels/');
      return (response.data?.data || []) as NotificationChannel[];
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  // 3. Delivery Logs Query
  const {
    data: deliveryLogs = [],
    isLoading: isLoadingLogs,
    refetch: refetchLogs,
  } = useQuery<NotificationItem[]>({
    queryKey: ['notification-logs'],
    queryFn: async () => {
      const response = await api.get('notifications/');
      return (response.data?.data || []) as NotificationItem[];
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  // Create / Update Mutation
  const saveMutation = useMutation({
    mutationFn: async (data: CreateChannelData) => {
      if (editingChannel) {
        await api.patch(`notifications/channels/${editingChannel.id}/`, data);
      } else {
        await api.post('notifications/channels/', data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-channels'] });
      queryClient.invalidateQueries({ queryKey: ['notification-stats'] });
      setShowForm(false);
      setEditingChannel(null);
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`notifications/channels/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-channels'] });
      queryClient.invalidateQueries({ queryKey: ['notification-stats'] });
      setDeleteChannel(null);
      setSelectedIds((prev) => prev.filter((item) => item !== deleteChannel?.id));
    },
  });

  // Toggle Enable / Pause
  const handleToggleEnable = async (channel: NotificationChannel) => {
    try {
      await api.patch(`notifications/channels/${channel.id}/`, {
        enabled: !channel.enabled,
      });
      queryClient.invalidateQueries({ queryKey: ['notification-channels'] });
      queryClient.invalidateQueries({ queryKey: ['notification-stats'] });
    } catch (err: any) {
      console.error('Error toggling channel enabled state', err);
    }
  };

  // Test Notification Action
  const handleTestChannel = async (channel: NotificationChannel) => {
    setTestingChannelId(channel.id);
    try {
      await api.post(`notifications/channels/${channel.id}/test/`);
      queryClient.invalidateQueries({ queryKey: ['notification-logs'] });
      queryClient.invalidateQueries({ queryKey: ['notification-stats'] });
    } catch (err: any) {
      console.error('Error sending test notification', err);
    } finally {
      setTestingChannelId(null);
    }
  };

  // Retry Failed Notification
  const handleRetryNotification = async (notificationId: string) => {
    setRetryingLogId(notificationId);
    try {
      await api.post(`notifications/${notificationId}/retry/`);
      queryClient.invalidateQueries({ queryKey: ['notification-logs'] });
      queryClient.invalidateQueries({ queryKey: ['notification-stats'] });
    } catch (err: any) {
      console.error('Error retrying notification', err);
    } finally {
      setRetryingLogId(null);
    }
  };

  // Bulk Actions
  const handleBulkAction = async (action: 'enable' | 'disable' | 'test' | 'delete') => {
    if (selectedIds.length === 0) return;
    try {
      await api.post('notifications/channels/bulk-action/', {
        action,
        channel_ids: selectedIds,
      });
      queryClient.invalidateQueries({ queryKey: ['notification-channels'] });
      queryClient.invalidateQueries({ queryKey: ['notification-logs'] });
      queryClient.invalidateQueries({ queryKey: ['notification-stats'] });
      if (action === 'delete') {
        setSelectedIds([]);
      }
    } catch (err: any) {
      console.error('Error executing bulk action', err);
    }
  };

  // Export CSV
  const handleExportCSV = async () => {
    try {
      const response = await api.get('notifications/export-csv/', { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `sentinel_notificaciones_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      console.error('Error exporting CSV', err);
    }
  };

  // Copy helper
  const handleCopyEndpoint = (channel: NotificationChannel, e: React.MouseEvent) => {
    e.stopPropagation();
    let text = '';
    if (channel.channel_type === 'telegram') text = channel.config?.chat_id || '';
    else if (channel.channel_type === 'email') {
      text = Array.isArray(channel.config?.recipients)
        ? channel.config.recipients.join(', ')
        : (channel.config?.recipients || '');
    } else text = channel.config?.webhook_url || '';

    if (text) {
      navigator.clipboard.writeText(text);
      setCopiedId(channel.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Filter channels logic
  const filteredChannels = channels.filter((ch) => {
    const matchesSearch =
      ch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ch.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ch.channel_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      JSON.stringify(ch.config || {}).toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === 'all') return true;
    if (filterType === 'active') return ch.enabled;
    if (filterType === 'inactive') return !ch.enabled;
    return ch.channel_type === filterType;
  });

  // Filter logs logic
  const filteredLogs = deliveryLogs.filter((log) => {
    if (logStatusFilter === 'all') return true;
    return log.status === logStatusFilter;
  });

  // Multi-select handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredChannels.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredChannels.map((c) => c.id));
    }
  };

  // Status pills for NOCToolbar
  const statusPills: NOCStatusPill[] = [
    { id: 'all', label: 'Todos', count: channels.length, variant: 'all' },
    { id: 'active', label: 'Activos', count: channels.filter((c) => c.enabled).length, variant: 'success' },
    { id: 'inactive', label: 'Pausados', count: channels.filter((c) => !c.enabled).length, variant: 'neutral' },
    { id: 'telegram', label: 'Telegram', count: channels.filter((c) => c.channel_type === 'telegram').length, variant: 'info' },
    { id: 'slack', label: 'Slack', count: channels.filter((c) => c.channel_type === 'slack').length, variant: 'info' },
    { id: 'teams', label: 'Teams', count: channels.filter((c) => c.channel_type === 'teams').length, variant: 'info' },
    { id: 'discord', label: 'Discord', count: channels.filter((c) => c.channel_type === 'discord').length, variant: 'info' },
    { id: 'email', label: 'Email', count: channels.filter((c) => c.channel_type === 'email').length, variant: 'warning' },
    { id: 'webhook', label: 'Webhooks', count: channels.filter((c) => c.channel_type === 'webhook').length, variant: 'neutral' },
  ];

  return (
    <div className="space-y-6 pb-24">
      {/* 1. Header Toolbar */}
      <NOCPageHeader
        badgeText="Canales de Notificación"
        title="Canales de Notificación & Enrutamiento"
        description="Configuración multicanal (Telegram, Slack, Teams, Discord, Email, Webhooks) con telemetría de latencia en tiempo real"
        icon={<Send size={24} />}
        actions={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-bg-card border border-border-base rounded-full text-xs font-semibold text-text-muted hover:text-text-main hover:bg-bg-dark transition-all shadow-sm"
              title="Exportar auditoría de envíos a CSV"
            >
              <Download size={14} />
              <span>Exportar CSV</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingChannel(null);
                setShowForm(true);
              }}
              className="flex items-center gap-2 bg-accent-green text-black font-semibold px-4 py-2 rounded-full text-xs hover:opacity-90 transition-opacity shadow-md"
            >
              <Plus size={15} />
              <span>Nuevo Canal</span>
            </button>
          </div>
        }
        autoRefresh={{
          enabled: autoRefresh.enabled,
          countdown: autoRefresh.countdown,
          onToggle: autoRefresh.toggle,
        }}
      />

      {/* 2. Top-level KPI Cards */}
      <NOCKpiGrid columns={4}>
        <NOCKpiCard
          title="Canales Configurados"
          value={stats?.total_channels || 0}
          icon={<Radio size={18} />}
          badge={{ text: `${stats?.enabled_channels || 0} activos`, variant: 'info' }}
          subtitle={`${(stats?.total_channels || 0) - (stats?.enabled_channels || 0)} canales pausados`}
        />
        <NOCKpiCard
          title="Tasa de Entrega Exitosa"
          value={`${stats?.success_rate || 100}%`}
          icon={<Activity size={18} />}
          badge={{ text: 'Disponibilidad', variant: (stats?.success_rate || 100) >= 95 ? 'success' : 'warning' }}
          progress={{
            value: stats?.success_rate || 100,
            color: (stats?.success_rate || 100) >= 95 ? '#10b981' : '#F59E0B',
          }}
          subtitle="Porcentaje global de envíos completados sin error"
        />
        <NOCKpiCard
          title="Envíos Exitosos"
          value={stats?.total_sent || 0}
          icon={<CheckCircle2 size={18} />}
          badge={{ text: 'Entregados', variant: 'success' }}
          subtitle="Total acumulado de notificaciones entregadas"
        />
        <NOCKpiCard
          title="Envíos Fallidos & Latencia"
          value={stats?.total_failed || 0}
          icon={<XCircle size={18} />}
          badge={{
            text: (stats?.total_failed || 0) > 0 ? 'Fallas' : 'Óptimo',
            variant: (stats?.total_failed || 0) > 0 ? 'danger' : 'success',
          }}
          subtitle={`Latencia promedio: ${stats?.avg_duration_ms || 0}ms`}
        />
      </NOCKpiGrid>

      {/* 3. NOC Toolbar */}
      <NOCToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por canal, tipo, chat ID, URL o destinatario..."
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        statusPills={statusPills}
        selectedStatus={filterType}
        onStatusChange={setFilterType}
      />

      {/* 4. Channels Content View: Grid or Compact Table */}
      {isLoadingChannels ? (
        <div className="flex items-center justify-center py-20 bg-bg-card rounded-2xl border border-border-base">
          <Loader2 className="animate-spin text-accent-green" size={32} />
        </div>
      ) : filteredChannels.length === 0 ? (
        <div className="bg-bg-card border border-border-base rounded-2xl p-12 text-center shadow-lg">
          <Send className="mx-auto text-text-dim mb-3" size={40} />
          <h3 className="text-sm font-bold text-text-main mb-1">No se encontraron canales de notificación</h3>
          <p className="text-text-muted text-xs font-sans max-w-sm mx-auto mb-4">
            {searchTerm
              ? 'No hay integraciones que coincidan con los términos de búsqueda.'
              : 'Configura canales como Telegram, Slack, Teams o Email para recibir alertas instantáneas.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setEditingChannel(null);
              setShowForm(true);
            }}
            className="inline-flex items-center gap-1.5 bg-accent-green text-black font-semibold px-4 py-2 rounded-full text-xs hover:opacity-90 transition-opacity"
          >
            <Plus size={14} />
            <span>Crear Primer Canal</span>
          </button>
        </div>
      ) : viewMode === 'table' ? (
        <ChannelTableView
          channels={filteredChannels}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAll}
          onOpenEdit={(c) => {
            setEditingChannel(c);
            setShowForm(true);
          }}
          onOpenDelete={(c) => setDeleteChannel(c)}
          onInspect={(c) => setInspectingChannel(c)}
          onTestChannel={handleTestChannel}
          onToggleEnable={handleToggleEnable}
          testingChannelId={testingChannelId}
        />
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredChannels.map((channel) => {
            const Icon = TYPE_ICONS[channel.channel_type] || WebhookIcon;
            const typeColor = TYPE_COLORS[channel.channel_type] || TYPE_COLORS.webhook;
            const isTesting = testingChannelId === channel.id;
            const isSelected = selectedIds.includes(channel.id);

            let endpointPreview = '';
            if (channel.channel_type === 'telegram') {
              endpointPreview = `Chat ID: ${channel.config?.chat_id || 'N/A'}`;
            } else if (channel.channel_type === 'email') {
              const rec = Array.isArray(channel.config?.recipients)
                ? channel.config.recipients.join(', ')
                : (channel.config?.recipients || 'N/A');
              endpointPreview = rec;
            } else {
              endpointPreview = channel.config?.webhook_url || 'URL no configurada';
            }

            return (
              <div
                key={channel.id}
                onClick={() => setInspectingChannel(channel)}
                className={`bg-bg-card border rounded-2xl p-5 hover:border-accent-green/50 transition-all flex flex-col justify-between shadow-lg cursor-pointer group ${
                  isSelected ? 'border-accent-green bg-accent-green/5' : 'border-border-base'
                }`}
              >
                <div>
                  {/* Card Top: Checkbox, Icon, Name, Enabled Badge */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSelect(channel.id);
                        }}
                        className="cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(channel.id)}
                          className="rounded accent-accent-green cursor-pointer"
                        />
                      </div>
                      <div
                        className={`w-10 h-10 rounded-xl ${typeColor.bg} border ${typeColor.border} flex items-center justify-center shrink-0 ${typeColor.text}`}
                      >
                        <Icon size={19} />
                      </div>
                      <div className="overflow-hidden">
                        <h3 className="font-bold text-text-main truncate text-sm group-hover:text-accent-green transition-colors">
                          {channel.name}
                        </h3>
                        <p className="text-[11px] font-mono text-text-dim capitalize">
                          {channel.channel_type}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleEnable(channel);
                      }}
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border transition-all ${
                        channel.enabled
                          ? 'bg-accent-green/10 text-accent-green border-accent-green/30 hover:bg-accent-green/20'
                          : 'bg-bg-dark text-text-dim border-border-base hover:text-text-main'
                      }`}
                      title={channel.enabled ? 'Click para pausar' : 'Click para activar'}
                    >
                      {channel.enabled ? 'Activo' : 'Pausado'}
                    </button>
                  </div>

                  {/* Channel Description */}
                  {channel.description && (
                    <p className="text-xs text-text-muted line-clamp-1 mb-3 font-sans">
                      {channel.description}
                    </p>
                  )}

                  {/* Destination snippet with copy */}
                  <div className="bg-bg-dark border border-border-base/60 rounded-xl p-2.5 font-mono text-xs text-text-muted flex items-center justify-between gap-2 mb-3">
                    <span className="truncate text-[11px]" title={endpointPreview}>
                      {endpointPreview}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleCopyEndpoint(channel, e)}
                      className="p-1 text-text-dim hover:text-text-main rounded transition-colors shrink-0"
                      title="Copiar destino"
                    >
                      {copiedId === channel.id ? (
                        <Check size={12} className="text-accent-green" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  </div>

                  {/* Smart Routing Indicators */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        channel.min_severity === 'critical'
                          ? 'bg-accent-red/10 text-accent-red border-accent-red/30'
                          : channel.min_severity === 'warning'
                          ? 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30'
                          : 'bg-accent-blue/10 text-accent-blue border-accent-blue/30'
                      }`}
                    >
                      {channel.min_severity === 'critical'
                        ? 'Solo Críticas'
                        : channel.min_severity === 'warning'
                        ? 'Warning & Críticas'
                        : 'Todas las Alertas'}
                    </span>

                    {channel.quiet_hours_enabled && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-bg-dark border border-border-base text-text-dim"
                        title={`Horario de silencio: ${channel.quiet_hours_start} a ${channel.quiet_hours_end}`}
                      >
                        <Moon size={10} className="text-accent-purple" />
                        {channel.quiet_hours_start}-{channel.quiet_hours_end}
                      </span>
                    )}

                    {channel.rate_limit_per_hour > 0 && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-bg-dark border border-border-base text-text-dim"
                        title={`Límite: máx ${channel.rate_limit_per_hour} alertas/hora`}
                      >
                        <Gauge size={10} className="text-accent-yellow" />
                        {channel.rate_limit_per_hour}/h
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div
                  className="pt-3 border-t border-border-base flex items-center justify-between"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => handleTestChannel(channel)}
                    disabled={isTesting}
                    className="flex items-center gap-1 px-3 py-1.5 bg-accent-green/10 border border-accent-green/30 text-accent-green hover:bg-accent-green hover:text-black rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                  >
                    {isTesting ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                    <span>{isTesting ? 'Probando...' : 'Probar Canal'}</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setInspectingChannel(channel)}
                      className="p-1.5 text-text-dim hover:text-accent-blue hover:bg-accent-blue/10 rounded-lg transition-colors"
                      title="Inspeccionar telemetría"
                    >
                      <SlidersHorizontal size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingChannel(channel);
                        setShowForm(true);
                      }}
                      className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-lg transition-colors"
                      title="Editar canal"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteChannel(channel)}
                      className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded-lg transition-colors"
                      title="Eliminar canal"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Sticky Bottom Bulk Action Bar */}
      <NOCBulkActionBar
        selectedCount={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        itemLabel="canales"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleBulkAction('enable')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-green/10 hover:bg-accent-green hover:text-black text-accent-green border border-accent-green/30 rounded-xl text-xs font-semibold transition-all"
            >
              <Power size={13} />
              <span>Activar</span>
            </button>
            <button
              type="button"
              onClick={() => handleBulkAction('disable')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-dark hover:bg-bg-card text-text-muted hover:text-text-main border border-border-base rounded-xl text-xs font-semibold transition-all"
            >
              <Power size={13} />
              <span>Pausar</span>
            </button>
            <button
              type="button"
              onClick={() => handleBulkAction('test')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-blue/10 hover:bg-accent-blue hover:text-white text-accent-blue border border-accent-blue/30 rounded-xl text-xs font-semibold transition-all"
            >
              <Play size={13} />
              <span>Probar en Lote</span>
            </button>
            <button
              type="button"
              onClick={() => handleBulkAction('delete')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-red/10 hover:bg-accent-red hover:text-white text-accent-red border border-accent-red/30 rounded-xl text-xs font-semibold transition-all"
            >
              <Trash2 size={13} />
              <span>Eliminar</span>
            </button>
          </div>
        }
      />

      {/* 6. Recent Delivery Logs Section */}
      <div className="bg-bg-card border border-border-base rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-base pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-blue/10 border border-accent-blue/30 flex items-center justify-center text-accent-blue">
              <FileCode2 size={17} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-main">
                Historial Global de Auditoría & Envíos (Delivery Logs)
              </h3>
              <p className="text-xs text-text-dim">
                Registro secuencial de eventos despachados con código de estado HTTP y tiempo de respuesta
              </p>
            </div>
          </div>

          {/* Log Status Filter Pills */}
          <div className="flex items-center gap-1.5 bg-bg-dark border border-border-base p-1 rounded-full text-xs">
            <button
              type="button"
              onClick={() => setLogStatusFilter('all')}
              className={`px-3 py-1 rounded-full font-medium transition-all ${
                logStatusFilter === 'all'
                  ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/40 shadow-xs'
                  : 'text-text-dim hover:text-text-main'
              }`}
            >
              Todos ({deliveryLogs.length})
            </button>
            <button
              type="button"
              onClick={() => setLogStatusFilter('sent')}
              className={`px-3 py-1 rounded-full font-medium transition-all ${
                logStatusFilter === 'sent'
                  ? 'bg-accent-green/20 text-accent-green border border-accent-green/40 shadow-xs'
                  : 'text-text-dim hover:text-text-main'
              }`}
            >
              Exitosos ({deliveryLogs.filter((l) => l.status === 'sent').length})
            </button>
            <button
              type="button"
              onClick={() => setLogStatusFilter('failed')}
              className={`px-3 py-1 rounded-full font-medium transition-all ${
                logStatusFilter === 'failed'
                  ? 'bg-accent-red/20 text-accent-red border border-accent-red/40 shadow-xs'
                  : 'text-text-dim hover:text-text-main'
              }`}
            >
              Fallidos ({deliveryLogs.filter((l) => l.status === 'failed').length})
            </button>
          </div>
        </div>

        {/* Logs Table */}
        {isLoadingLogs ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="animate-spin text-accent-green" size={26} />
          </div>
        ) : filteredLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-border-base/50 text-text-dim text-[11px] font-semibold">
                  <th className="pb-3 px-2">Fecha y Hora</th>
                  <th className="pb-3 px-2">Canal</th>
                  <th className="pb-3 px-2">Título de la Notificación</th>
                  <th className="pb-3 px-2">Severidad</th>
                  <th className="pb-3 px-2 text-center">Estado</th>
                  <th className="pb-3 px-2 text-center">HTTP / Latencia</th>
                  <th className="pb-3 px-2">Respuesta / Error</th>
                  <th className="pb-3 px-2 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-base/30">
                {filteredLogs.slice(0, 20).map((log) => {
                  const isRetrying = retryingLogId === log.id;
                  return (
                    <tr key={log.id} className="hover:bg-bg-dark/50 transition-colors">
                      <td className="py-3 px-2 text-text-dim whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-2 text-text-main font-bold whitespace-nowrap">
                        {log.channel_name || 'Canal eliminado'}
                      </td>
                      <td className="py-3 px-2 text-text-main font-semibold truncate max-w-xs" title={log.title}>
                        {log.title}
                      </td>
                      <td className="py-3 px-2 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            log.severity === 'critical'
                              ? 'bg-accent-red/10 text-accent-red border-accent-red/30'
                              : log.severity === 'warning'
                              ? 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30'
                              : 'bg-accent-blue/10 text-accent-blue border-accent-blue/30'
                          }`}
                        >
                          {log.severity || 'info'}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center whitespace-nowrap">
                        <StatusBadge
                          status={log.status === 'sent' ? 'pass' : log.status === 'failed' ? 'fail' : 'slow'}
                        />
                      </td>
                      <td className="py-3 px-2 text-center whitespace-nowrap text-text-muted font-mono">
                        {log.http_status ? `HTTP ${log.http_status}` : '--'} • {log.duration_ms || 0}ms
                      </td>
                      <td className="py-3 px-2 text-text-muted truncate max-w-sm font-sans" title={log.error_message || log.response}>
                        {log.error_message ? (
                          <span className="text-accent-red font-semibold">{log.error_message}</span>
                        ) : (
                          <span>{log.response || 'Despachado correctamente'}</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right whitespace-nowrap">
                        {log.status === 'failed' && (
                          <button
                            type="button"
                            onClick={() => handleRetryNotification(log.id)}
                            disabled={isRetrying}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-accent-yellow/10 hover:bg-accent-yellow hover:text-black text-accent-yellow border border-accent-yellow/30 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-50"
                            title="Reintentar entrega"
                          >
                            {isRetrying ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                            <span>Reintentar</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-text-dim text-xs py-8 text-center">No hay registros de envío para el filtro seleccionado.</p>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <ChannelForm
          channel={editingChannel}
          onSubmit={async (data) => {
            await saveMutation.mutateAsync(data);
          }}
          onClose={() => {
            setShowForm(false);
            setEditingChannel(null);
          }}
        />
      )}

      {/* Detail Drawer */}
      <ChannelDetailDrawer
        channel={inspectingChannel}
        isOpen={!!inspectingChannel}
        onClose={() => setInspectingChannel(null)}
        onOpenEdit={(c) => {
          setInspectingChannel(null);
          setEditingChannel(c);
          setShowForm(true);
        }}
        onTestChannel={handleTestChannel}
        channelLogs={deliveryLogs}
        isLoadingLogs={isLoadingLogs}
        onRetryNotification={handleRetryNotification}
        retryingId={retryingLogId}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmDelete
        isOpen={!!deleteChannel}
        itemName={deleteChannel?.name || 'este canal'}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => deleteChannel && deleteMutation.mutate(deleteChannel.id)}
        onClose={() => setDeleteChannel(null)}
      />
    </div>
  );
}
