import React, { useState } from 'react';
import type { NotificationChannel, NotificationItem, ChannelType } from '../../types/notifications';
import NOCDrawer from '../common/noc/NOCDrawer';
import { api } from '../../services/api';
import {
  Send,
  MessageSquare,
  Bell,
  Radio,
  Mail,
  Webhook as WebhookIcon,
  ShieldAlert,
  Moon,
  Gauge,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  Play,
  Loader2,
  Copy,
  Check,
  Code2,
  Sparkles,
  Info,
  Calendar,
  AlertTriangle,
} from 'lucide-react';

interface ChannelDetailDrawerProps {
  channel: NotificationChannel | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenEdit: (channel: NotificationChannel) => void;
  onTestChannel: (channel: NotificationChannel) => Promise<void>;
  channelLogs: NotificationItem[];
  isLoadingLogs: boolean;
  onRetryNotification: (notificationId: string) => Promise<void>;
  retryingId: string | null;
}

const TYPE_ICONS: Record<ChannelType, any> = {
  telegram: Send,
  slack: MessageSquare,
  teams: Bell,
  discord: Radio,
  email: Mail,
  webhook: WebhookIcon,
};

export default function ChannelDetailDrawer({
  channel,
  isOpen,
  onClose,
  onOpenEdit,
  onTestChannel,
  channelLogs,
  isLoadingLogs,
  onRetryNotification,
  retryingId,
}: ChannelDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'routing' | 'simulator' | 'logs'>('overview');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Live Simulator State
  const [testTitle, setTestTitle] = useState('[SIMULACIÓN] Sentinela NOC - Alerta de Prueba');
  const [testMessage, setTestMessage] = useState('Servicio payment-gateway responde con latencia anormal (1820ms).');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<{
    success: boolean;
    status_code: number | null;
    duration_ms: number;
    message: string;
  } | null>(null);

  if (!channel) return null;

  const Icon = TYPE_ICONS[channel.channel_type] || WebhookIcon;

  // Filter logs for this channel
  const thisChannelLogs = channelLogs.filter((log) => log.channel === channel.id);
  const totalSent = thisChannelLogs.filter((l) => l.status === 'sent').length;
  const totalFailed = thisChannelLogs.filter((l) => l.status === 'failed').length;
  const totalDeliveries = totalSent + totalFailed;
  const successRate = totalDeliveries > 0 ? Math.round((totalSent / totalDeliveries) * 100) : 100;

  const avgLatency =
    thisChannelLogs.length > 0
      ? Math.round(
          thisChannelLogs.reduce((acc, l) => acc + (l.duration_ms || 0), 0) / thisChannelLogs.length
        )
      : 0;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    setSimulationResult(null);
    try {
      const response = await api.post('notifications/test-connection/', {
        channel_type: channel.channel_type,
        config: channel.config,
        custom_title: testTitle,
        custom_message: testMessage,
      });
      setSimulationResult(response.data?.data);
    } catch (err: any) {
      setSimulationResult({
        success: false,
        status_code: err?.response?.status || null,
        duration_ms: 0,
        message: err?.response?.data?.message || err.message || 'Fallo de conexión.',
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const sanitizeSecret = (val?: string) => {
    if (!val) return 'No configurado';
    if (val.length <= 8) return '••••••••';
    return `${val.substring(0, 4)}••••••••${val.substring(val.length - 4)}`;
  };

  const tabs = [
    { id: 'overview', label: 'Resumen & Telemetría', icon: <Sparkles size={14} /> },
    { id: 'routing', label: 'Enrutamiento & Filtros', icon: <ShieldAlert size={14} /> },
    { id: 'simulator', label: 'Simulador en Vivo', icon: <Play size={14} /> },
    { id: 'logs', label: `Historial (${thisChannelLogs.length})`, icon: <Clock size={14} /> },
  ];

  return (
    <NOCDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={channel.name}
      subtitle={
        <div className="flex items-center gap-2 mt-1">
          <span className="inline-flex items-center gap-1 text-xs font-mono text-text-muted capitalize">
            <Icon size={13} className="text-accent-green" />
            {channel.channel_type}
          </span>
          <span className="text-text-dim text-xs">•</span>
          <span className="text-xs text-text-dim font-mono">ID: {channel.id.slice(0, 8)}...</span>
        </div>
      }
      statusBadge={
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
            channel.enabled
              ? 'bg-accent-green/10 text-accent-green border-accent-green/30'
              : 'bg-bg-dark text-text-dim border-border-base'
          }`}
        >
          {channel.enabled ? 'Activo' : 'Pausado'}
        </span>
      }
      maxWidthClass="max-w-2xl"
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(tabId) => setActiveTab(tabId as any)}
      quickKpis={
        <div className="grid grid-cols-4 gap-2.5 my-2">
          <div className="bg-bg-card border border-border-base/70 rounded-xl p-2.5 text-center">
            <p className="text-[10px] text-text-dim font-medium">Tasa de Éxito</p>
            <p className="text-base font-bold font-mono text-accent-green mt-0.5">{successRate}%</p>
          </div>
          <div className="bg-bg-card border border-border-base/70 rounded-xl p-2.5 text-center">
            <p className="text-[10px] text-text-dim font-medium">Entregados</p>
            <p className="text-base font-bold font-mono text-text-main mt-0.5">{totalSent}</p>
          </div>
          <div className="bg-bg-card border border-border-base/70 rounded-xl p-2.5 text-center">
            <p className="text-[10px] text-text-dim font-medium">Fallos</p>
            <p
              className={`text-base font-bold font-mono mt-0.5 ${
                totalFailed > 0 ? 'text-accent-red' : 'text-text-dim'
              }`}
            >
              {totalFailed}
            </p>
          </div>
          <div className="bg-bg-card border border-border-base/70 rounded-xl p-2.5 text-center">
            <p className="text-[10px] text-text-dim font-medium">Latencia Media</p>
            <p className="text-base font-bold font-mono text-accent-blue mt-0.5">
              {avgLatency > 0 ? `${avgLatency}ms` : '--'}
            </p>
          </div>
        </div>
      }
      footerActions={
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            onClick={() => onTestChannel(channel)}
            className="flex items-center gap-1.5 px-4 py-2 bg-accent-green/10 hover:bg-accent-green hover:text-black text-accent-green border border-accent-green/30 rounded-full text-xs font-semibold transition-all"
          >
            <Play size={13} />
            <span>Probar Canal Ahora</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-bg-dark border border-border-base rounded-full text-xs text-text-muted hover:text-text-main transition-colors"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenEdit(channel);
              }}
              className="px-4 py-2 bg-accent-green text-black font-semibold rounded-full text-xs hover:opacity-90 transition-opacity"
            >
              Editar Canal
            </button>
          </div>
        </div>
      }
    >
      <div className="p-6 space-y-6">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-5">
            {/* Description card */}
            <div className="bg-bg-dark border border-border-base rounded-2xl p-4">
              <h4 className="text-xs font-semibold text-text-muted mb-1 flex items-center gap-1.5">
                <Info size={14} className="text-accent-blue" />
                Descripción del Canal
              </h4>
              <p className="text-xs text-text-main">
                {channel.description || 'Sin descripción detallada registrada para este canal.'}
              </p>
            </div>

            {/* Sanitized Configuration */}
            <div className="bg-bg-dark border border-border-base rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-border-base/50 pb-2">
                <h4 className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                  <Code2 size={14} className="text-accent-green" />
                  Configuración de la Integración
                </h4>
                <span className="text-[10px] font-mono text-text-dim">Credenciales Sanitizadas</span>
              </div>

              {channel.channel_type === 'telegram' && (
                <div className="space-y-2.5 font-mono text-xs">
                  <div className="flex items-center justify-between bg-bg-card border border-border-base/50 rounded-xl p-2.5">
                    <div>
                      <span className="text-text-dim block text-[10px]">Chat ID / Grupo</span>
                      <span className="text-text-main font-semibold">{channel.config?.chat_id || 'N/A'}</span>
                    </div>
                    {channel.config?.chat_id && (
                      <button
                        type="button"
                        onClick={() => handleCopy(channel.config.chat_id, 'chat_id')}
                        className="p-1.5 text-text-dim hover:text-text-main transition-colors"
                      >
                        {copiedKey === 'chat_id' ? <Check size={13} className="text-accent-green" /> : <Copy size={13} />}
                      </button>
                    )}
                  </div>
                  <div className="bg-bg-card border border-border-base/50 rounded-xl p-2.5">
                    <span className="text-text-dim block text-[10px]">Bot Token</span>
                    <span className="text-text-dim">{sanitizeSecret(channel.config?.bot_token)}</span>
                  </div>
                </div>
              )}

              {['slack', 'teams', 'discord', 'webhook'].includes(channel.channel_type) && (
                <div className="space-y-2.5 font-mono text-xs">
                  <div className="flex items-start justify-between bg-bg-card border border-border-base/50 rounded-xl p-2.5">
                    <div className="overflow-hidden mr-2">
                      <span className="text-text-dim block text-[10px]">Webhook URL</span>
                      <span className="text-text-main break-all">{channel.config?.webhook_url || 'N/A'}</span>
                    </div>
                    {channel.config?.webhook_url && (
                      <button
                        type="button"
                        onClick={() => handleCopy(channel.config.webhook_url, 'webhook_url')}
                        className="p-1.5 text-text-dim hover:text-text-main transition-colors shrink-0"
                      >
                        {copiedKey === 'webhook_url' ? <Check size={13} className="text-accent-green" /> : <Copy size={13} />}
                      </button>
                    )}
                  </div>
                  {channel.config?.headers && Object.keys(channel.config.headers).length > 0 && (
                    <div className="bg-bg-card border border-border-base/50 rounded-xl p-2.5">
                      <span className="text-text-dim block text-[10px] mb-1">Encabezados Personalizados</span>
                      {Object.entries(channel.config.headers).map(([k, v]) => (
                        <div key={k} className="text-[11px] flex items-center justify-between">
                          <span className="text-accent-blue">{k}:</span>
                          <span className="text-text-muted">{sanitizeSecret(String(v))}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {channel.channel_type === 'email' && (
                <div className="space-y-2.5 font-mono text-xs">
                  <div className="bg-bg-card border border-border-base/50 rounded-xl p-2.5">
                    <span className="text-text-dim block text-[10px]">Destinatarios</span>
                    <span className="text-text-main font-semibold">
                      {Array.isArray(channel.config?.recipients)
                        ? channel.config.recipients.join(', ')
                        : (channel.config?.recipients || 'N/A')}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-bg-card border border-border-base/50 rounded-xl p-2.5">
                      <span className="text-text-dim block text-[10px]">Servidor SMTP</span>
                      <span className="text-text-main">{channel.config?.smtp_host || 'Default SMTP'}</span>
                    </div>
                    <div className="bg-bg-card border border-border-base/50 rounded-xl p-2.5">
                      <span className="text-text-dim block text-[10px]">Puerto</span>
                      <span className="text-text-main">{channel.config?.smtp_port || 587}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Metadata Timestamps */}
            <div className="bg-bg-dark/50 border border-border-base/40 rounded-xl p-3 flex items-center justify-between text-xs font-mono text-text-dim">
              <div className="flex items-center gap-1.5">
                <Calendar size={13} />
                <span>Creado: {new Date(channel.created_at).toLocaleDateString('es-ES')}</span>
              </div>
              <div>Actualizado: {new Date(channel.updated_at).toLocaleDateString('es-ES')}</div>
            </div>
          </div>
        )}

        {/* TAB 2: ROUTING */}
        {activeTab === 'routing' && (
          <div className="space-y-5">
            {/* Minimum Severity Card */}
            <div className="bg-bg-dark border border-border-base rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                  <ShieldAlert size={14} className="text-accent-red" />
                  Severidad Mínima Requerida
                </h4>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold font-mono bg-accent-blue/10 text-accent-blue border border-accent-blue/30">
                  {channel.min_severity}
                </span>
              </div>
              <p className="text-xs text-text-muted">
                {channel.min_severity === 'critical' &&
                  'Este canal solo se activará ante alertas de severidad Crítica. Evita el spam en horas no laborales.'}
                {channel.min_severity === 'warning' &&
                  'Recibe alertas de severidad Advertencia (Warning) y Crítica. Las alertas meramente informativas se ignoran.'}
                {channel.min_severity === 'info' &&
                  'Recibe absolutamente todas las alertas disparadas por las reglas del NOC.'}
              </p>
            </div>

            {/* Quiet Hours Card */}
            <div className="bg-bg-dark border border-border-base rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                  <Moon size={14} className="text-accent-purple" />
                  Horario de Silencio (Quiet Hours)
                </h4>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    channel.quiet_hours_enabled
                      ? 'bg-accent-purple/10 text-accent-purple border-accent-purple/30'
                      : 'bg-bg-card text-text-dim border-border-base'
                  }`}
                >
                  {channel.quiet_hours_enabled ? 'Configurado' : 'Desactivado'}
                </span>
              </div>

              {channel.quiet_hours_enabled ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-bg-card border border-border-base/50 rounded-xl p-3 text-xs font-mono">
                    <span className="text-text-muted">Ventana de Silencio:</span>
                    <span className="text-text-main font-bold">
                      {channel.quiet_hours_start} - {channel.quiet_hours_end} (Hora Servidor)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-text-dim">
                    <CheckCircle2 size={13} className="text-accent-green" />
                    <span>
                      Bypass crítico:{' '}
                      {channel.quiet_hours_critical_override
                        ? 'Las alertas críticas SI se entregan durante el silencio'
                        : 'Silencio total sin excepciones'}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-text-muted">
                  No hay horarios de silencio programados. Las notificaciones se enviarán 24/7 sin interrupciones.
                </p>
              )}
            </div>

            {/* Rate Limiting Card */}
            <div className="bg-bg-dark border border-border-base rounded-2xl p-4">
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                  <Gauge size={14} className="text-accent-yellow" />
                  Límite de Tasa por Hora (Rate Limiting)
                </h4>
                <span className="font-mono text-xs text-accent-yellow font-bold">
                  {channel.rate_limit_per_hour > 0 ? `${channel.rate_limit_per_hour} / hora` : 'Ilimitado'}
                </span>
              </div>
              <p className="text-xs text-text-muted">
                {channel.rate_limit_per_hour > 0
                  ? `Protege la integración contra agotamiento de cuotas de API o saturación por flapping. Máximo ${channel.rate_limit_per_hour} mensajes por cada 60 minutos.`
                  : 'Sin límite configurado. El canal despachará tantas notificaciones como se generen.'}
              </p>
            </div>
          </div>
        )}

        {/* TAB 3: SIMULATOR */}
        {activeTab === 'simulator' && (
          <div className="space-y-4">
            <div className="bg-bg-dark border border-border-base rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                <Play size={14} className="text-accent-green" />
                Simulador de Payload y Respuesta en Tiempo Real
              </h4>
              <p className="text-xs text-text-muted">
                Envía una petición de prueba inmediata a través de la configuración actual de este canal para evaluar el
                tiempo de respuesta y el código de estado HTTP recibido.
              </p>

              <div>
                <label className="block text-[11px] font-semibold text-text-dim mb-1">Título de la Alerta de Prueba</label>
                <input
                  type="text"
                  value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                  className="w-full bg-bg-card border border-border-base rounded-xl px-3 py-2 text-xs font-mono text-text-main focus:outline-none focus:border-accent-green"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-text-dim mb-1">Cuerpo / Mensaje</label>
                <textarea
                  rows={3}
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="w-full bg-bg-card border border-border-base rounded-xl px-3 py-2 text-xs font-mono text-text-main focus:outline-none focus:border-accent-green"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleRunSimulation}
                  disabled={isSimulating}
                  className="flex items-center gap-2 px-5 py-2 bg-accent-green text-black font-semibold rounded-full text-xs hover:opacity-90 transition-opacity disabled:opacity-50 shadow-md"
                >
                  {isSimulating ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                  <span>{isSimulating ? 'Despachando Petición...' : 'Ejecutar Prueba en Vivo'}</span>
                </button>
              </div>
            </div>

            {/* Simulation Feedback Result */}
            {simulationResult && (
              <div
                className={`border rounded-2xl p-4 font-mono text-xs space-y-2 animate-in fade-in duration-200 ${
                  simulationResult.success
                    ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
                    : 'bg-accent-red/10 border-accent-red/30 text-accent-red'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <div className="flex items-center gap-2">
                    {simulationResult.success ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                    <span>{simulationResult.success ? 'Entrega Exitosa' : 'Fallo en la Entrega'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {simulationResult.status_code && (
                      <span className="px-2 py-0.5 rounded-md bg-bg-dark/80 text-[11px]">
                        HTTP {simulationResult.status_code}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-md bg-bg-dark/80 text-[11px]">
                      {simulationResult.duration_ms}ms
                    </span>
                  </div>
                </div>
                <p className="text-text-main text-[11px] bg-bg-dark/60 p-2 rounded-lg break-words mt-2">
                  {simulationResult.message}
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: CHANNEL DELIVERY LOGS */}
        {activeTab === 'logs' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-text-muted">
                Últimos Envíos Registrados ({thisChannelLogs.length})
              </h4>
            </div>

            {isLoadingLogs ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={24} className="animate-spin text-accent-green" />
              </div>
            ) : thisChannelLogs.length > 0 ? (
              <div className="space-y-2.5">
                {thisChannelLogs.slice(0, 25).map((log) => {
                  const isRetrying = retryingId === log.id;
                  return (
                    <div
                      key={log.id}
                      className="bg-bg-dark border border-border-base/70 rounded-xl p-3 flex items-start justify-between gap-3 text-xs font-mono hover:border-border-base transition-colors"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              log.status === 'sent'
                                ? 'bg-accent-green'
                                : log.status === 'failed'
                                ? 'bg-accent-red'
                                : 'bg-accent-yellow'
                            }`}
                          />
                          <span className="font-bold text-text-main truncate text-xs" title={log.title}>
                            {log.title}
                          </span>
                        </div>
                        <p className="text-text-dim text-[11px] line-clamp-1 font-sans">
                          {log.error_message ? (
                            <span className="text-accent-red">{log.error_message}</span>
                          ) : (
                            <span>{log.response || 'Sin mensaje de confirmación'}</span>
                          )}
                        </p>
                        <div className="flex items-center gap-2.5 text-[10px] text-text-dim">
                          <span>{new Date(log.created_at).toLocaleTimeString('es-ES')}</span>
                          {log.http_status && <span>HTTP {log.http_status}</span>}
                          {log.duration_ms > 0 && <span>{log.duration_ms}ms</span>}
                          {log.retry_count > 0 && (
                            <span className="text-accent-yellow">x{log.retry_count} reintentos</span>
                          )}
                        </div>
                      </div>

                      {log.status === 'failed' && (
                        <button
                          type="button"
                          onClick={() => onRetryNotification(log.id)}
                          disabled={isRetrying}
                          className="flex items-center gap-1 px-2.5 py-1 bg-accent-yellow/10 hover:bg-accent-yellow hover:text-black text-accent-yellow border border-accent-yellow/30 rounded-lg text-[10px] font-semibold transition-all shrink-0 disabled:opacity-50"
                          title="Reintentar despacho"
                        >
                          {isRetrying ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                          <span>{isRetrying ? 'Reintentando...' : 'Reintentar'}</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 bg-bg-dark rounded-xl border border-border-base/50">
                <Clock size={28} className="mx-auto text-text-dim mb-2" />
                <p className="text-xs text-text-muted">No hay registros de envío para este canal aún.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </NOCDrawer>
  );
}
