import React, { useState } from 'react';
import type { NotificationChannel, ChannelType } from '../../types/notifications';
import {
  Send,
  MessageSquare,
  Bell,
  Radio,
  Mail,
  Webhook as WebhookIcon,
  Check,
  Copy,
  Pencil,
  Trash2,
  Play,
  Loader2,
  SlidersHorizontal,
  Moon,
  ShieldAlert,
  Gauge,
  Power,
  ChevronRight,
} from 'lucide-react';

interface ChannelTableViewProps {
  channels: NotificationChannel[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onOpenEdit: (channel: NotificationChannel) => void;
  onOpenDelete: (channel: NotificationChannel) => void;
  onInspect: (channel: NotificationChannel) => void;
  onTestChannel: (channel: NotificationChannel) => Promise<void>;
  onToggleEnable: (channel: NotificationChannel) => Promise<void>;
  testingChannelId: string | null;
}

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

const SEVERITY_BADGES: Record<string, { label: string; style: string }> = {
  critical: { label: 'Solo críticas', style: 'bg-accent-red/10 text-accent-red border-accent-red/30' },
  warning: { label: 'Warning y críticas', style: 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30' },
  info: { label: 'Todas las alertas', style: 'bg-accent-blue/10 text-accent-blue border-accent-blue/30' },
};

export default function ChannelTableView({
  channels,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onOpenEdit,
  onOpenDelete,
  onInspect,
  onTestChannel,
  onToggleEnable,
  testingChannelId,
}: ChannelTableViewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isAllSelected = channels.length > 0 && selectedIds.length === channels.length;
  const isIndeterminate = selectedIds.length > 0 && selectedIds.length < channels.length;

  const handleCopyEndpoint = (channel: NotificationChannel, e: React.MouseEvent) => {
    e.stopPropagation();
    let textToCopy = '';
    if (channel.channel_type === 'telegram') {
      textToCopy = channel.config?.chat_id || '';
    } else if (channel.channel_type === 'email') {
      textToCopy = Array.isArray(channel.config?.recipients)
        ? channel.config.recipients.join(', ')
        : (channel.config?.recipients || '');
    } else {
      textToCopy = channel.config?.webhook_url || '';
    }
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopiedId(channel.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  return (
    <div className="bg-bg-card border border-border-base rounded-2xl overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-sans">
          <thead>
            <tr className="border-b border-border-base bg-bg-dark/60 text-text-dim text-[11px] font-semibold">
              <th className="py-3 px-4 w-10 text-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = isIndeterminate;
                  }}
                  onChange={onSelectAll}
                  className="rounded accent-accent-green cursor-pointer"
                />
              </th>
              <th className="py-3 px-3">Canal de Notificación</th>
              <th className="py-3 px-3">Tipo & Destino</th>
              <th className="py-3 px-3">Reglas de Enrutamiento</th>
              <th className="py-3 px-3 text-center">Estado</th>
              <th className="py-3 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-base/40">
            {channels.map((channel) => {
              const isSelected = selectedIds.includes(channel.id);
              const Icon = TYPE_ICONS[channel.channel_type] || WebhookIcon;
              const typeColor = TYPE_COLORS[channel.channel_type] || TYPE_COLORS.webhook;
              const sevBadge = SEVERITY_BADGES[channel.min_severity] || SEVERITY_BADGES.info;
              const isTesting = testingChannelId === channel.id;

              let endpointPreview = '';
              if (channel.channel_type === 'telegram') {
                endpointPreview = `Chat ID: ${channel.config?.chat_id || 'N/A'}`;
              } else if (channel.channel_type === 'email') {
                const recipients = Array.isArray(channel.config?.recipients)
                  ? channel.config.recipients.join(', ')
                  : (channel.config?.recipients || 'N/A');
                endpointPreview = recipients;
              } else {
                endpointPreview = channel.config?.webhook_url || 'URL no configurada';
              }

              return (
                <tr
                  key={channel.id}
                  onClick={() => onInspect(channel)}
                  className={`hover:bg-bg-dark/50 transition-colors cursor-pointer group ${
                    isSelected ? 'bg-accent-green/5' : ''
                  }`}
                >
                  {/* Checkbox */}
                  <td
                    className="py-3 px-4 text-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelect(channel.id);
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(channel.id)}
                      className="rounded accent-accent-green cursor-pointer"
                    />
                  </td>

                  {/* Channel info */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl ${typeColor.bg} border ${typeColor.border} flex items-center justify-center shrink-0 ${typeColor.text}`}
                      >
                        <Icon size={17} />
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-text-main group-hover:text-accent-green transition-colors text-sm flex items-center gap-1.5 truncate">
                          {channel.name}
                        </span>
                        <p className="text-[11px] text-text-dim truncate max-w-xs mt-0.5 font-sans">
                          {channel.description || 'Sin descripción adicional'}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Type & Endpoint */}
                  <td className="py-3 px-3">
                    <div className="space-y-1">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${typeColor.bg} ${typeColor.text} ${typeColor.border}`}
                      >
                        <Icon size={11} />
                        {channel.channel_type}
                      </span>
                      <div className="flex items-center gap-1.5 text-text-muted font-mono text-[11px]">
                        <span className="truncate max-w-[200px]" title={endpointPreview}>
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
                    </div>
                  </td>

                  {/* Smart Routing */}
                  <td className="py-3 px-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${sevBadge.style}`}
                        title="Severidad mínima para despachar alertas"
                      >
                        <ShieldAlert size={11} />
                        {sevBadge.label}
                      </span>

                      {channel.quiet_hours_enabled && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-bg-dark border border-border-base text-text-muted"
                          title={`Horario de silencio: ${channel.quiet_hours_start} a ${channel.quiet_hours_end}`}
                        >
                          <Moon size={11} className="text-accent-purple" />
                          {channel.quiet_hours_start}-{channel.quiet_hours_end}
                        </span>
                      )}

                      {channel.rate_limit_per_hour > 0 && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-bg-dark border border-border-base text-text-dim"
                          title={`Límite de tasa: máx ${channel.rate_limit_per_hour} alertas/hora`}
                        >
                          <Gauge size={11} className="text-accent-yellow" />
                          {channel.rate_limit_per_hour}/h
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Enabled status */}
                  <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onToggleEnable(channel)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                        channel.enabled
                          ? 'bg-accent-green/10 text-accent-green border-accent-green/30 hover:bg-accent-green/20'
                          : 'bg-bg-dark text-text-dim border-border-base hover:text-text-main'
                      }`}
                      title={channel.enabled ? 'Click para pausar canal' : 'Click para activar canal'}
                    >
                      <Power size={11} />
                      {channel.enabled ? 'Activo' : 'Pausado'}
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onTestChannel(channel)}
                        disabled={isTesting}
                        className="flex items-center gap-1 px-2.5 py-1 bg-accent-green/10 hover:bg-accent-green hover:text-black text-accent-green border border-accent-green/30 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                        title="Enviar notificación de prueba"
                      >
                        {isTesting ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Play size={12} />
                        )}
                        <span>Probar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onInspect(channel)}
                        className="p-1.5 text-text-dim hover:text-accent-blue hover:bg-accent-blue/10 rounded-lg transition-colors"
                        title="Inspeccionar configuración y telemetría"
                      >
                        <SlidersHorizontal size={14} />
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenEdit(channel)}
                        className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-lg transition-colors"
                        title="Editar canal"
                      >
                        <Pencil size={14} />
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenDelete(channel)}
                        className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded-lg transition-colors"
                        title="Eliminar canal"
                      >
                        <Trash2 size={14} />
                      </button>

                      <ChevronRight size={14} className="text-text-dim ml-1" />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
