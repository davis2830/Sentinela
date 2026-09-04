import React, { useState, useEffect } from 'react';
import type {
  NotificationChannel,
  CreateChannelData,
  ChannelType,
  NotificationSeverity,
  TestChannelResult,
} from '../../types/notifications';
import { api } from '../../services/api';
import {
  X,
  Loader2,
  Send,
  MessageSquare,
  Mail,
  Webhook as WebhookIcon,
  Bell,
  CheckCircle2,
  Radio,
  AlertTriangle,
  ShieldAlert,
  Moon,
  Play,
  Gauge,
  Sparkles,
  Link,
  Layers,
  HelpCircle,
} from 'lucide-react';

interface ChannelFormProps {
  channel?: NotificationChannel | null;
  onSubmit: (data: CreateChannelData) => Promise<void>;
  onClose: () => void;
}

const CHANNEL_TYPES: { type: ChannelType; name: string; description: string; icon: any }[] = [
  {
    type: 'telegram',
    name: 'Telegram Bot',
    description: 'Envía alertas a grupos o chats privados de Telegram vía Bot API.',
    icon: Send,
  },
  {
    type: 'slack',
    name: 'Slack Webhook',
    description: 'Notificaciones en canales de Slack vía Incoming Webhook.',
    icon: MessageSquare,
  },
  {
    type: 'teams',
    name: 'Microsoft Teams',
    description: 'Conector de Office 365 / Workflows de Teams.',
    icon: Radio,
  },
  {
    type: 'discord',
    name: 'Discord Webhook',
    description: 'Canales de anuncios en servidores Discord.',
    icon: Bell,
  },
  {
    type: 'email',
    name: 'Correo Electrónico (SMTP)',
    description: 'Envío de emails con servidor SMTP propio o predeterminado.',
    icon: Mail,
  },
  {
    type: 'webhook',
    name: 'Custom Webhook HTTP',
    description: 'Payload genérico JSON vía POST con encabezados custom.',
    icon: WebhookIcon,
  },
];

const AVAILABLE_EVENTS = [
  { id: 'alert_triggered', label: 'Alerta Disparada', desc: 'Cuando una métrica cruza el umbral' },
  { id: 'alert_resolved', label: 'Alerta Resuelta', desc: 'Cuando el servicio vuelve a la normalidad' },
  { id: 'incident_opened', label: 'Incidente Creado', desc: 'Cuando se abre un incidente operativo' },
  { id: 'incident_resolved', label: 'Incidente Resuelto', desc: 'Cuando el post-mortem/resolución concluye' },
  { id: 'maintenance', label: 'Mantenimiento Programado', desc: 'Avisos de ventanas de mantenimiento' },
];

export default function ChannelForm({ channel, onSubmit, onClose }: ChannelFormProps) {
  const [activeFormTab, setActiveFormTab] = useState<'connection' | 'routing' | 'quiet_hours'>('connection');

  // Basic Info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [channelType, setChannelType] = useState<ChannelType>('telegram');
  const [enabled, setEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Telegram fields
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');

  // Slack / Teams / Discord / Webhook fields
  const [webhookUrl, setWebhookUrl] = useState('');

  // Email & SMTP fields
  const [recipients, setRecipients] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState<number | ''>(587);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [useTls, setUseTls] = useState(true);
  const [fromEmail, setFromEmail] = useState('');

  // Custom Webhook headers
  const [customHeaderKey, setCustomHeaderKey] = useState('');
  const [customHeaderValue, setCustomHeaderValue] = useState('');

  // Smart Routing & Fatigue
  const [minSeverity, setMinSeverity] = useState<NotificationSeverity>('info');
  const [subscribedEvents, setSubscribedEvents] = useState<string[]>([
    'alert_triggered',
    'alert_resolved',
    'incident_opened',
  ]);
  const [rateLimitPerHour, setRateLimitPerHour] = useState<number | ''>(0);

  // Quiet Hours
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState('22:00');
  const [quietHoursEnd, setQuietHoursEnd] = useState('08:00');
  const [quietHoursCriticalOverride, setQuietHoursCriticalOverride] = useState(true);

  // Live Pre-flight Test State
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<TestChannelResult | null>(null);

  useEffect(() => {
    if (channel) {
      setName(channel.name);
      setDescription(channel.description || '');
      setChannelType(channel.channel_type);
      setEnabled(channel.enabled);
      setMinSeverity(channel.min_severity || 'info');
      setSubscribedEvents(channel.subscribed_events || ['alert_triggered', 'alert_resolved']);
      setRateLimitPerHour(channel.rate_limit_per_hour ?? 0);
      setQuietHoursEnabled(channel.quiet_hours_enabled ?? false);
      setQuietHoursStart(channel.quiet_hours_start || '22:00');
      setQuietHoursEnd(channel.quiet_hours_end || '08:00');
      setQuietHoursCriticalOverride(channel.quiet_hours_critical_override ?? true);

      const conf = channel.config || {};
      if (channel.channel_type === 'telegram') {
        setBotToken(conf.bot_token || '');
        setChatId(conf.chat_id || '');
      } else if (['slack', 'teams', 'discord', 'webhook'].includes(channel.channel_type)) {
        setWebhookUrl(conf.webhook_url || conf.url || '');
        if (channel.channel_type === 'webhook' && conf.headers) {
          const firstKey = Object.keys(conf.headers)[0];
          if (firstKey) {
            setCustomHeaderKey(firstKey);
            setCustomHeaderValue(conf.headers[firstKey]);
          }
        }
      } else if (channel.channel_type === 'email') {
        setRecipients(Array.isArray(conf.recipients) ? conf.recipients.join(', ') : (conf.recipients || ''));
        setSmtpHost(conf.smtp_host || '');
        setSmtpPort(conf.smtp_port || 587);
        setSmtpUser(conf.smtp_user || '');
        setSmtpPassword(conf.smtp_password || '');
        setUseTls(conf.use_tls ?? true);
        setFromEmail(conf.from_email || '');
      }
    }
  }, [channel]);

  // Build current config object
  const buildCurrentConfig = (): Record<string, any> => {
    const conf: Record<string, any> = {};
    if (channelType === 'telegram') {
      conf.bot_token = botToken.trim();
      conf.chat_id = chatId.trim();
    } else if (['slack', 'teams', 'discord', 'webhook'].includes(channelType)) {
      conf.webhook_url = webhookUrl.trim();
      if (channelType === 'webhook' && customHeaderKey.trim()) {
        conf.headers = { [customHeaderKey.trim()]: customHeaderValue.trim() };
      }
    } else if (channelType === 'email') {
      const emailList = recipients
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.includes('@'));
      conf.recipients = emailList;
      if (smtpHost.trim()) {
        conf.smtp_host = smtpHost.trim();
        conf.smtp_port = Number(smtpPort) || 587;
        conf.smtp_user = smtpUser.trim();
        conf.smtp_password = smtpPassword;
        conf.use_tls = useTls;
        conf.from_email = fromEmail.trim() || smtpUser.trim();
      }
    }
    return conf;
  };

  // Pre-flight test
  const handleTestConnection = async () => {
    setErrorMsg(null);
    setTestResult(null);

    const conf = buildCurrentConfig();
    if (channelType === 'telegram' && (!botToken.trim() || !chatId.trim())) {
      setErrorMsg('Ingresa el Bot Token y Chat ID para probar la conexión.');
      return;
    }
    if (['slack', 'teams', 'discord', 'webhook'].includes(channelType) && !webhookUrl.trim()) {
      setErrorMsg('Ingresa la URL del Webhook para probar la conexión.');
      return;
    }
    if (channelType === 'email' && !recipients.trim()) {
      setErrorMsg('Ingresa al menos un correo destinatario para probar la conexión.');
      return;
    }

    setTestingConnection(true);
    try {
      const response = await api.post('notifications/test-connection/', {
        channel_type: channelType,
        config: conf,
      });
      setTestResult(response.data?.data);
    } catch (err: any) {
      setTestResult({
        success: false,
        status_code: err?.response?.status || null,
        duration_ms: 0,
        message: err?.response?.data?.message || err.message || 'Error de red al probar conexión.',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleToggleEvent = (eventId: string) => {
    setSubscribedEvents((prev) =>
      prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    try {
      const conf = buildCurrentConfig();
      if (channelType === 'telegram' && (!botToken.trim() || !chatId.trim())) {
        throw new Error('Por favor ingresa el Token del Bot y el Chat ID de Telegram.');
      }
      if (['slack', 'teams', 'discord', 'webhook'].includes(channelType) && !webhookUrl.startsWith('http')) {
        throw new Error('Por favor ingresa una URL de Webhook válida (ej. https://...).');
      }
      if (channelType === 'email' && (!conf.recipients || conf.recipients.length === 0)) {
        throw new Error('Por favor ingresa al menos un correo electrónico válido.');
      }

      setSubmitting(true);
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        channel_type: channelType,
        config: conf,
        enabled,
        min_severity: minSeverity,
        subscribed_events: subscribedEvents,
        rate_limit_per_hour: Number(rateLimitPerHour) || 0,
        quiet_hours_enabled: quietHoursEnabled,
        quiet_hours_start: quietHoursStart,
        quiet_hours_end: quietHoursEnd,
        quiet_hours_critical_override: quietHoursCriticalOverride,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al guardar el canal de notificación.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-bg-card border border-border-base rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-border-base bg-bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-green/10 border border-accent-green/30 flex items-center justify-center text-accent-green">
              <Send size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-main">
                {channel ? 'Editar Canal de Notificación' : 'Nuevo Canal de Notificación'}
              </h2>
              <p className="text-xs text-text-dim mt-0.5">
                Configura integración multicanal con reglas de enrutamiento inteligente
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-text-dim hover:text-text-main rounded-full hover:bg-bg-dark transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Tabs Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-border-base bg-bg-dark/40 text-xs">
          <button
            type="button"
            onClick={() => setActiveFormTab('connection')}
            className={`pb-2.5 px-3 font-semibold flex items-center gap-1.5 border-b-2 transition-all ${
              activeFormTab === 'connection'
                ? 'border-accent-green text-accent-green'
                : 'border-transparent text-text-dim hover:text-text-main'
            }`}
          >
            <Link size={14} />
            <span>Conexión & Credenciales</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFormTab('routing')}
            className={`pb-2.5 px-3 font-semibold flex items-center gap-1.5 border-b-2 transition-all ${
              activeFormTab === 'routing'
                ? 'border-accent-green text-accent-green'
                : 'border-transparent text-text-dim hover:text-text-main'
            }`}
          >
            <ShieldAlert size={14} />
            <span>Enrutamiento & Filtros</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFormTab('quiet_hours')}
            className={`pb-2.5 px-3 font-semibold flex items-center gap-1.5 border-b-2 transition-all ${
              activeFormTab === 'quiet_hours'
                ? 'border-accent-green text-accent-green'
                : 'border-transparent text-text-dim hover:text-text-main'
            }`}
          >
            <Moon size={14} />
            <span>Horario de Silencio</span>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5 flex-1">
          {errorMsg && (
            <div className="p-3 bg-accent-red/10 border border-accent-red/30 rounded-xl text-accent-red text-xs flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: CONNECTION */}
          {activeFormTab === 'connection' && (
            <div className="space-y-5">
              {/* Channel Name & Description */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">Nombre del Canal</label>
                  <input
                    type="text"
                    required
                    placeholder="ej. Alertas Telegram NOC / Slack #incidentes"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-bg-dark border border-border-base rounded-xl px-3.5 py-2 text-xs text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">Descripción (Opcional)</label>
                  <input
                    type="text"
                    placeholder="ej. Destinado a guardias On-Call y contingencias"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-bg-dark border border-border-base rounded-xl px-3.5 py-2 text-xs text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green"
                  />
                </div>
              </div>

              {/* Channel Type Selector Grid */}
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-2">
                  Tipo de Servicio / Integración
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {CHANNEL_TYPES.map((item) => {
                    const Icon = item.icon;
                    const isSelected = channelType === item.type;
                    return (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => {
                          setChannelType(item.type);
                          setTestResult(null);
                        }}
                        className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                          isSelected
                            ? 'bg-accent-green/10 border-accent-green text-accent-green shadow-md'
                            : 'bg-bg-dark border-border-base text-text-muted hover:text-text-main'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <Icon size={18} className={isSelected ? 'text-accent-green' : 'text-text-dim'} />
                          {isSelected && <CheckCircle2 size={14} className="text-accent-green" />}
                        </div>
                        <div>
                          <h4 className="font-bold text-xs truncate">{item.name}</h4>
                          <p className="text-[10px] text-text-dim line-clamp-2 mt-0.5 font-sans leading-tight">
                            {item.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Config Fields */}
              <div className="bg-bg-dark border border-border-base rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-border-base/50 pb-2">
                  <h3 className="text-xs font-semibold text-text-main">
                    Configuración de {CHANNEL_TYPES.find((c) => c.type === channelType)?.name}
                  </h3>
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testingConnection}
                    className="flex items-center gap-1.5 px-3 py-1 bg-accent-green/10 hover:bg-accent-green hover:text-black text-accent-green border border-accent-green/30 rounded-full text-[11px] font-semibold transition-all disabled:opacity-50 shadow-sm"
                  >
                    {testingConnection ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                    <span>{testingConnection ? 'Probando...' : 'Probar Conexión en Vivo'}</span>
                  </button>
                </div>

                {/* Pre-flight Test Feedback */}
                {testResult && (
                  <div
                    className={`p-3 rounded-xl font-mono text-xs flex items-start gap-2.5 ${
                      testResult.success
                        ? 'bg-accent-green/10 text-accent-green border border-accent-green/30'
                        : 'bg-accent-red/10 text-accent-red border border-accent-red/30'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between font-bold text-xs">
                        <span>{testResult.success ? 'Conexión Exitosa' : 'Fallo en la Conexión'}</span>
                        <span>{testResult.duration_ms}ms</span>
                      </div>
                      <p className="text-[11px] mt-0.5 break-words opacity-90">{testResult.message}</p>
                    </div>
                  </div>
                )}

                {channelType === 'telegram' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-mono text-text-muted mb-1 font-semibold">
                        Bot Token (Obtenido en @BotFather)
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="ej. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                        value={botToken}
                        onChange={(e) => setBotToken(e.target.value)}
                        className="w-full bg-bg-card border border-border-base rounded-xl px-3 py-2 text-xs font-mono text-text-main focus:outline-none focus:border-accent-green"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-text-muted mb-1 font-semibold">
                        Chat ID o ID del Canal / Grupo
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="ej. -100123456789 o 987654321"
                        value={chatId}
                        onChange={(e) => setChatId(e.target.value)}
                        className="w-full bg-bg-card border border-border-base rounded-xl px-3 py-2 text-xs font-mono text-text-main focus:outline-none focus:border-accent-green"
                      />
                    </div>
                  </div>
                )}

                {['slack', 'teams', 'discord', 'webhook'].includes(channelType) && (
                  <div>
                    <label className="block text-xs font-mono text-text-muted mb-1 font-semibold">
                      URL del Incoming Webhook
                    </label>
                    <input
                      type="url"
                      required
                      placeholder="https://hooks.slack.com/services/... o https://discord.com/api/webhooks/..."
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      className="w-full bg-bg-card border border-border-base rounded-xl px-3 py-2 text-xs font-mono text-text-main focus:outline-none focus:border-accent-green"
                    />
                  </div>
                )}

                {channelType === 'webhook' && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-[11px] font-mono text-text-dim mb-1">Encabezado Custom (Key)</label>
                      <input
                        type="text"
                        placeholder="ej. Authorization / X-NOC-Secret"
                        value={customHeaderKey}
                        onChange={(e) => setCustomHeaderKey(e.target.value)}
                        className="w-full bg-bg-card border border-border-base rounded-xl px-3 py-1.5 text-xs font-mono text-text-main"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-text-dim mb-1">Valor del Encabezado</label>
                      <input
                        type="text"
                        placeholder="ej. Bearer token123"
                        value={customHeaderValue}
                        onChange={(e) => setCustomHeaderValue(e.target.value)}
                        className="w-full bg-bg-card border border-border-base rounded-xl px-3 py-1.5 text-xs font-mono text-text-main"
                      />
                    </div>
                  </div>
                )}

                {channelType === 'email' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-mono text-text-muted mb-1 font-semibold">
                        Destinatarios (separados por coma)
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="devops@miempresa.com, soporte@miempresa.com"
                        value={recipients}
                        onChange={(e) => setRecipients(e.target.value)}
                        className="w-full bg-bg-card border border-border-base rounded-xl px-3 py-2 text-xs font-mono text-text-main focus:outline-none focus:border-accent-green"
                      />
                    </div>
                    <div className="pt-2 border-t border-border-base/50">
                      <h4 className="text-xs font-semibold text-accent-green mb-2">
                        Configuración SMTP Opcional (Servidor Corporativo)
                      </h4>
                      <div className="grid grid-cols-3 gap-2.5">
                        <div className="col-span-2">
                          <label className="block text-[10px] text-text-dim mb-1">Servidor SMTP Host</label>
                          <input
                            type="text"
                            placeholder="smtp.office365.com"
                            value={smtpHost}
                            onChange={(e) => setSmtpHost(e.target.value)}
                            className="w-full bg-bg-card border border-border-base rounded-xl px-3 py-1.5 text-xs font-mono text-text-main"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-text-dim mb-1">Puerto</label>
                          <input
                            type="number"
                            placeholder="587"
                            value={smtpPort}
                            onChange={(e) => setSmtpPort(Number(e.target.value))}
                            className="w-full bg-bg-card border border-border-base rounded-xl px-3 py-1.5 text-xs font-mono text-text-main"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5 mt-2">
                        <div>
                          <label className="block text-[10px] text-text-dim mb-1">Usuario / Correo Remitente</label>
                          <input
                            type="text"
                            placeholder="alertas@miempresa.com"
                            value={smtpUser}
                            onChange={(e) => setSmtpUser(e.target.value)}
                            className="w-full bg-bg-card border border-border-base rounded-xl px-3 py-1.5 text-xs font-mono text-text-main"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-text-dim mb-1">Contraseña SMTP</label>
                          <input
                            type="password"
                            placeholder="••••••••••••"
                            value={smtpPassword}
                            onChange={(e) => setSmtpPassword(e.target.value)}
                            className="w-full bg-bg-card border border-border-base rounded-xl px-3 py-1.5 text-xs font-mono text-text-main"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ROUTING & FILTERS */}
          {activeFormTab === 'routing' && (
            <div className="space-y-5">
              {/* Minimum Severity Selector */}
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-2">
                  Severidad Mínima Requerida
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'info', label: 'Informativo (Todas)', desc: 'Recibe info, warning y críticas' },
                    { id: 'warning', label: 'Advertencias & Críticas', desc: 'Filtra alertas informativas' },
                    { id: 'critical', label: 'Solo Críticas', desc: 'Ideal para On-Call y canales de guardia' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setMinSeverity(s.id as NotificationSeverity)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        minSeverity === s.id
                          ? 'bg-accent-green/10 border-accent-green text-accent-green shadow-sm'
                          : 'bg-bg-dark border-border-base text-text-dim hover:text-text-main'
                      }`}
                    >
                      <h4 className="font-bold text-xs">{s.label}</h4>
                      <p className="text-[10px] text-text-dim mt-1 line-clamp-2">{s.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Subscribed Events Multiselect */}
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-2">
                  Eventos Suscritos
                </label>
                <div className="space-y-2">
                  {AVAILABLE_EVENTS.map((ev) => {
                    const isChecked = subscribedEvents.includes(ev.id);
                    return (
                      <label
                        key={ev.id}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-bg-dark border-border-base text-text-main'
                            : 'bg-bg-dark/50 border-border-base/40 text-text-dim'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleEvent(ev.id)}
                          className="mt-0.5 rounded accent-accent-green cursor-pointer"
                        />
                        <div>
                          <p className="text-xs font-bold">{ev.label}</p>
                          <p className="text-[11px] text-text-dim mt-0.5">{ev.desc}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Rate Limit */}
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5 flex items-center justify-between">
                  <span>Límite de Alertas por Hora (Anti-Spam)</span>
                  <span className="text-text-dim font-mono text-[11px]">0 = Sin límite</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    value={rateLimitPerHour}
                    onChange={(e) => setRateLimitPerHour(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-40 bg-bg-dark border border-border-base rounded-xl px-3 py-2 text-xs font-mono text-text-main focus:outline-none focus:border-accent-green"
                  />
                  <span className="text-xs text-text-dim">máximo de mensajes por hora hacia este canal</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: QUIET HOURS */}
          {activeFormTab === 'quiet_hours' && (
            <div className="space-y-5">
              <div className="bg-bg-dark border border-border-base rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-text-main flex items-center gap-1.5">
                      <Moon size={15} className="text-accent-purple" />
                      Activar Horario de Silencio (Quiet Hours)
                    </h4>
                    <p className="text-xs text-text-dim mt-0.5">
                      Silencia el envío de notificaciones durante la noche o fuera de guardia
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={quietHoursEnabled}
                    onChange={(e) => setQuietHoursEnabled(e.target.checked)}
                    className="rounded accent-accent-green w-4 h-4 cursor-pointer"
                  />
                </div>

                {quietHoursEnabled && (
                  <div className="space-y-4 pt-3 border-t border-border-base/50">
                    <div className="grid grid-cols-2 gap-4 font-mono">
                      <div>
                        <label className="block text-[11px] text-text-dim mb-1">Hora Inicio de Silencio</label>
                        <input
                          type="time"
                          value={quietHoursStart}
                          onChange={(e) => setQuietHoursStart(e.target.value)}
                          className="w-full bg-bg-card border border-border-base rounded-xl px-3 py-2 text-xs text-text-main"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-text-dim mb-1">Hora Fin de Silencio</label>
                        <input
                          type="time"
                          value={quietHoursEnd}
                          onChange={(e) => setQuietHoursEnd(e.target.value)}
                          className="w-full bg-bg-card border border-border-base rounded-xl px-3 py-2 text-xs text-text-main"
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-2.5 cursor-pointer text-xs text-text-main pt-1">
                      <input
                        type="checkbox"
                        checked={quietHoursCriticalOverride}
                        onChange={(e) => setQuietHoursCriticalOverride(e.target.checked)}
                        className="rounded accent-accent-green cursor-pointer"
                      />
                      <span className="font-semibold">Bypass de Emergencia para Alertas Críticas</span>
                    </label>
                    <p className="text-[11px] text-text-dim pl-6">
                      Si está activo, las alertas de severidad Crítica ignorarán el silencio y se entregarán de todas
                      formas para no desatender caídas totales de servicio.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Form Actions Bar */}
          <div className="flex items-center justify-between pt-4 border-t border-border-base">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-text-muted font-medium">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="rounded accent-accent-green cursor-pointer"
              />
              <span>Canal Activo</span>
            </label>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-bg-dark border border-border-base rounded-full text-xs font-semibold text-text-muted hover:text-text-main transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2 bg-accent-green text-black font-semibold rounded-full text-xs hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
                <span>{channel ? 'Guardar Cambios' : 'Crear Canal'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
