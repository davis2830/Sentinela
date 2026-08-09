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
import ConfirmDelete from '../components/common/ConfirmDelete';
import StatusBadge from '../components/common/StatusBadge';
import {
  Send,
  Plus,
  Loader2,
  Trash2,
  Pencil,
  RefreshCw,
  MessageSquare,
  Mail,
  Bell,
  Webhook as WebhookIcon,
  Radio,
  CheckCircle2,
  XCircle,
  Clock,
  Radio as ChannelIcon,
  FileCode2,
  Sparkles,
} from 'lucide-react';

const TYPE_ICONS: Record<ChannelType, any> = {
  telegram: Send,
  slack: MessageSquare,
  teams: Bell,
  discord: Radio,
  email: Mail,
  webhook: WebhookIcon,
};

const TYPE_NAMES: Record<ChannelType, string> = {
  telegram: 'Telegram Bot',
  slack: 'Slack Webhook',
  teams: 'Microsoft Teams',
  discord: 'Discord Webhook',
  email: 'Correo SMTP',
  webhook: 'Custom Webhook',
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingChannel, setEditingChannel] = useState<NotificationChannel | null>(null);
  const [deleteChannel, setDeleteChannel] = useState<NotificationChannel | null>(null);
  const [testingChannelId, setTestingChannelId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; msg: string } | null>(null);

  // Stats Query
  const { data: stats } = useQuery({
    queryKey: ['notification-stats'],
    queryFn: async () => {
      const response = await api.get('notifications/stats/');
      return (response.data?.data || {}) as NotificationStats;
    },
    refetchInterval: 15000,
  });

  // Channels Query
  const { data: channels, isLoading: isLoadingChannels, refetch: refetchChannels, isRefetching } = useQuery({
    queryKey: ['notification-channels'],
    queryFn: async () => {
      const response = await api.get('notifications/channels/');
      return (response.data?.data || []) as NotificationChannel[];
    },
    refetchInterval: 30000,
  });

  // Delivery Logs Query
  const { data: deliveryLogs, isLoading: isLoadingLogs } = useQuery({
    queryKey: ['notification-logs'],
    queryFn: async () => {
      const response = await api.get('notifications/');
      return (response.data?.data || []) as NotificationItem[];
    },
    refetchInterval: 15000,
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
    },
  });

  // Test Notification Action
  const handleTestChannel = async (channel: NotificationChannel, e: React.MouseEvent) => {
    e.stopPropagation();
    setTestingChannelId(channel.id);
    setTestResult(null);
    try {
      const response = await api.post(`notifications/channels/${channel.id}/test/`);
      const notifData = response.data?.data;
      if (notifData?.status === 'sent') {
        setTestResult({ id: channel.id, success: true, msg: '¡Notificación de prueba enviada con éxito!' });
      } else {
        setTestResult({ id: channel.id, success: false, msg: notifData?.error_message || 'Fallo al entregar la notificación.' });
      }
      queryClient.invalidateQueries({ queryKey: ['notification-logs'] });
      queryClient.invalidateQueries({ queryKey: ['notification-stats'] });
    } catch (err: any) {
      setTestResult({
        id: channel.id,
        success: false,
        msg: err?.response?.data?.message || 'Error de conexión al probar el canal.',
      });
    } finally {
      setTestingChannelId(null);
    }
  };

  const handleOpenCreate = () => {
    setEditingChannel(null);
    setShowForm(true);
  };

  const handleOpenEdit = (channel: NotificationChannel, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChannel(channel);
    setShowForm(true);
  };

  return (
    <div>
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
            <Send className="text-accent-green" size={28} />
            Canales de Notificación
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Configuración multicanal (Telegram, Slack, Teams, Discord, Email, Webhooks) para entrega de alertas
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetchChannels()}
            disabled={isRefetching}
            className="p-2 border border-border-base rounded-md text-text-muted hover:text-text-main hover:bg-bg-card-hover transition-colors disabled:opacity-50"
            title="Refrescar canales"
          >
            <RefreshCw size={18} className={isRefetching ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-accent-green text-black font-semibold px-4 py-2 rounded-md text-sm hover:opacity-90 transition-opacity"
          >
            <Plus size={18} />
            Nuevo Canal
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-bg-card border border-border-base rounded-xl p-4 flex items-center gap-3 shadow-md">
          <div className="w-10 h-10 rounded-lg bg-accent-blue/10 flex items-center justify-center text-accent-blue shrink-0">
            <ChannelIcon size={20} />
          </div>
          <div>
            <p className="text-xs font-mono uppercase text-text-muted">Total Canales</p>
            <p className="text-xl font-bold font-mono text-text-main">{stats?.total_channels || 0}</p>
          </div>
        </div>

        <div className="bg-bg-card border border-border-base rounded-xl p-4 flex items-center gap-3 shadow-md">
          <div className="w-10 h-10 rounded-lg bg-accent-green/10 flex items-center justify-center text-accent-green shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-xs font-mono uppercase text-text-muted">Envíos Exitosos</p>
            <p className="text-xl font-bold font-mono text-accent-green">{stats?.total_sent || 0}</p>
          </div>
        </div>

        <div className="bg-bg-card border border-border-base rounded-xl p-4 flex items-center gap-3 shadow-md">
          <div className="w-10 h-10 rounded-lg bg-accent-red/10 flex items-center justify-center text-accent-red shrink-0">
            <XCircle size={20} />
          </div>
          <div>
            <p className="text-xs font-mono uppercase text-text-muted">Envíos Fallidos</p>
            <p className="text-xl font-bold font-mono text-accent-red">{stats?.total_failed || 0}</p>
          </div>
        </div>

        <div className="bg-bg-card border border-border-base rounded-xl p-4 flex items-center gap-3 shadow-md">
          <div className="w-10 h-10 rounded-lg bg-accent-yellow/10 flex items-center justify-center text-accent-yellow shrink-0">
            <Sparkles size={20} />
          </div>
          <div>
            <p className="text-xs font-mono uppercase text-text-muted">Tipos Activos</p>
            <p className="text-xl font-bold font-mono text-accent-yellow">{stats?.active_types_count || 0}</p>
          </div>
        </div>
      </div>

      {/* Channels Grid Header */}
      <h2 className="text-lg font-bold text-text-main mb-4 flex items-center gap-2">
        <Send size={20} className="text-accent-green" />
        Canales de Entrega Configurados ({channels?.length || 0})
      </h2>

      {/* Channels Cards Grid */}
      {isLoadingChannels ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-accent-green" size={32} />
        </div>
      ) : channels && channels.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          {channels.map((channel: NotificationChannel) => {
            const Icon = TYPE_ICONS[channel.channel_type] || WebhookIcon;
            const isTesting = testingChannelId === channel.id;
            const res = testResult?.id === channel.id ? testResult : null;

            return (
              <div
                key={channel.id}
                className="bg-bg-card border border-border-base rounded-xl p-5 hover:border-accent-green/50 transition-all flex flex-col justify-between shadow-lg"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className="w-9 h-9 rounded-lg bg-accent-green/10 border border-accent-green/30 flex items-center justify-center shrink-0 text-accent-green">
                        <Icon size={18} />
                      </div>
                      <div className="overflow-hidden">
                        <h3 className="font-bold text-text-main truncate text-base" title={channel.name}>
                          {channel.name}
                        </h3>
                        <p className="text-[11px] font-mono text-text-dim">
                          {TYPE_NAMES[channel.channel_type] || channel.channel_type}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={channel.enabled ? 'active' : 'inactive'} />
                  </div>

                  {/* Channel Summary Info */}
                  <div className="bg-bg-dark border border-border-base/50 rounded-lg p-2.5 font-mono text-xs text-text-muted space-y-1 mb-4">
                    {channel.channel_type === 'telegram' && (
                      <p className="truncate">Chat ID: <span className="text-text-main">{channel.config?.chat_id || 'N/A'}</span></p>
                    )}
                    {['slack', 'teams', 'discord', 'webhook'].includes(channel.channel_type) && (
                      <p className="truncate" title={channel.config?.webhook_url}>URL: <span className="text-text-main">{channel.config?.webhook_url || 'N/A'}</span></p>
                    )}
                    {channel.channel_type === 'email' && (
                      <p className="truncate">Destinatarios: <span className="text-text-main">{Array.isArray(channel.config?.recipients) ? channel.config.recipients.join(', ') : 'N/A'}</span></p>
                    )}
                  </div>

                  {/* Test Result Message Feedback */}
                  {res && (
                    <div className={`p-2.5 rounded-lg text-xs font-mono mb-3 ${res.success ? 'bg-accent-green/10 text-accent-green border border-accent-green/30' : 'bg-accent-red/10 text-accent-red border border-accent-red/30'}`}>
                      {res.msg}
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-border-base flex items-center justify-between">
                  <button
                    onClick={(e) => handleTestChannel(channel, e)}
                    disabled={isTesting}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-green/10 border border-accent-green/30 text-accent-green hover:bg-accent-green hover:text-black rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                  >
                    {isTesting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                    {isTesting ? 'Enviando...' : 'Probar Canal'}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleOpenEdit(channel, e)}
                      className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded transition-colors"
                      title="Editar canal"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteChannel(channel);
                      }}
                      className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded transition-colors"
                      title="Eliminar canal"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-bg-card border border-border-base rounded-xl p-8 text-center mb-10">
          <Send className="mx-auto text-text-dim mb-3" size={40} />
          <p className="text-text-muted text-sm font-mono mb-3">No has configurado canales de notificación aún.</p>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 bg-accent-green text-black font-semibold px-4 py-2 rounded-md text-xs hover:opacity-90 transition-opacity"
          >
            <Plus size={16} />
            Crear Primer Canal
          </button>
        </div>
      )}

      {/* Recent Delivery Logs Table */}
      <div className="bg-bg-card border border-border-base rounded-xl p-6 shadow-xl">
        <h3 className="text-base font-bold text-text-main mb-4 flex items-center gap-2 border-b border-border-base pb-3">
          <FileCode2 size={20} className="text-accent-blue" />
          Historial Reciente de Envíos (Delivery Logs)
        </h3>

        {isLoadingLogs ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin text-accent-green" size={24} />
          </div>
        ) : deliveryLogs && deliveryLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-border-base/50 text-text-dim uppercase text-[10px]">
                  <th className="pb-3 font-semibold">Fecha</th>
                  <th className="pb-3 font-semibold">Canal</th>
                  <th className="pb-3 font-semibold">Título</th>
                  <th className="pb-3 font-semibold">Estado</th>
                  <th className="pb-3 font-semibold">Respuesta / Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-base/30">
                {deliveryLogs.slice(0, 15).map((log: NotificationItem) => (
                  <tr key={log.id} className="hover:bg-bg-dark/50 transition-colors">
                    <td className="py-3 text-text-dim whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('es-ES', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 text-text-main font-bold whitespace-nowrap">
                      {log.channel_name || 'Desconocido'}
                    </td>
                    <td className="py-3 text-accent-green font-semibold truncate max-w-xs" title={log.title}>
                      {log.title}
                    </td>
                    <td className="py-3 whitespace-nowrap">
                      <StatusBadge status={log.status === 'sent' ? 'pass' : log.status === 'failed' ? 'fail' : 'slow'} />
                    </td>
                    <td className="py-3 text-text-muted truncate max-w-sm" title={log.error_message || log.response}>
                      {log.error_message ? (
                        <span className="text-accent-red font-semibold">{log.error_message}</span>
                      ) : (
                        <span>{log.response || 'Enviado correctamente'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-text-dim text-xs py-4 text-center">No hay registros de envío recientes.</p>
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
