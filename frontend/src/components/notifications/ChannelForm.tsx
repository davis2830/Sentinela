import React, { useState, useEffect } from 'react';
import type { NotificationChannel, CreateChannelData, ChannelType } from '../../types/notifications';
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
    description: 'Envía alertas a grupos o chats privados de Telegram.',
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
    description: 'Envío de emails con servidor propio o default.',
    icon: Mail,
  },
  {
    type: 'webhook',
    name: 'Custom Webhook HTTP',
    description: 'Payload genérico POST con firmas opcionales.',
    icon: WebhookIcon,
  },
];

export default function ChannelForm({ channel, onSubmit, onClose }: ChannelFormProps) {
  const [name, setName] = useState('');
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

  useEffect(() => {
    if (channel) {
      setName(channel.name);
      setChannelType(channel.channel_type);
      setEnabled(channel.enabled);
      const conf = channel.config || {};

      if (channel.channel_type === 'telegram') {
        setBotToken(conf.bot_token || '');
        setChatId(conf.chat_id || '');
      } else if (['slack', 'teams', 'discord', 'webhook'].includes(channel.channel_type)) {
        setWebhookUrl(conf.webhook_url || conf.url || '');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const config: Record<string, any> = {};

    try {
      if (channelType === 'telegram') {
        if (!botToken.trim() || !chatId.trim()) {
          throw new Error('Por favor ingresa el Token del Bot y el Chat ID de Telegram.');
        }
        config.bot_token = botToken.trim();
        config.chat_id = chatId.trim();
      } else if (['slack', 'teams', 'discord', 'webhook'].includes(channelType)) {
        if (!webhookUrl.trim() || !webhookUrl.startsWith('http')) {
          throw new Error('Por favor ingresa una URL de Webhook válida (ej. https://...).');
        }
        config.webhook_url = webhookUrl.trim();
        if (channelType === 'webhook' && customHeaderKey.trim()) {
          config.headers = { [customHeaderKey.trim()]: customHeaderValue.trim() };
        }
      } else if (channelType === 'email') {
        const emailList = recipients
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && s.includes('@'));
        if (emailList.length === 0) {
          throw new Error('Por favor ingresa al menos un correo electrónico válido en la lista de destinatarios.');
        }
        config.recipients = emailList;
        if (smtpHost.trim()) {
          config.smtp_host = smtpHost.trim();
          config.smtp_port = Number(smtpPort) || 587;
          config.smtp_user = smtpUser.trim();
          config.smtp_password = smtpPassword;
          config.use_tls = useTls;
          config.from_email = fromEmail.trim() || smtpUser.trim();
        }
      }

      setSubmitting(true);
      await onSubmit({
        name: name.trim(),
        channel_type: channelType,
        config,
        enabled,
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
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-bg-card border border-border-base rounded-2xl p-6 w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5 border-b border-border-base pb-4">
          <h2 className="text-xl font-bold text-text-main flex items-center gap-2">
            <Send size={22} className="text-accent-green" />
            {channel ? 'Editar Canal de Notificación' : 'Nuevo Canal de Notificación'}
          </h2>
          <button onClick={onClose} className="p-1.5 text-text-muted hover:text-text-main rounded-full hover:bg-bg-dark transition-colors">
            <X size={20} />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-accent-red/10 border border-accent-red/30 rounded-xl text-accent-red text-xs flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Channel Name */}
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">
              Nombre del Canal
            </label>
            <input
              type="text"
              required
              placeholder="ej. Alertas Telegram DevOps / Canal Slack #incidencias"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green"
            />
          </div>

          {/* Channel Type Selector Grid */}
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-2">
              Seleccionar Integración de Canal
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {CHANNEL_TYPES.map((item) => {
                const Icon = item.icon;
                const isSelected = channelType === item.type;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => setChannelType(item.type)}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      isSelected
                        ? 'bg-accent-green/10 border-accent-green text-accent-green shadow-md'
                        : 'bg-bg-dark border-border-base text-text-muted hover:text-text-main hover:border-border-base/80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
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

          {/* Config Fields depending on channel_type */}
          <div className="bg-bg-dark border border-border-base rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-semibold text-text-muted border-b border-border-base/50 pb-2">
              Configuración de {CHANNEL_TYPES.find((c) => c.type === channelType)?.name}
            </h3>

            {channelType === 'telegram' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1">
                    Bot Token (Obtenido con @BotFather)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ej. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    className="w-full bg-bg-card border border-border-base rounded-lg px-3 py-2 text-xs font-mono text-text-main focus:outline-none focus:border-accent-green"
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
                    className="w-full bg-bg-card border border-border-base rounded-lg px-3 py-2 text-xs font-mono text-text-main focus:outline-none focus:border-accent-green"
                  />
                </div>
              </>
            )}

            {['slack', 'teams', 'discord', 'webhook'].includes(channelType) && (
              <div>
                <label className="block text-xs font-mono text-text-muted mb-1 font-semibold">
                  URL del Incoming Webhook
                </label>
                <input
                  type="url"
                  required
                  placeholder="ej. https://hooks.slack.com/services/... o https://discord.com/api/webhooks/..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full bg-bg-card border border-border-base rounded-lg px-3 py-2 text-xs font-mono text-text-main focus:outline-none focus:border-accent-green"
                />
              </div>
            )}

            {channelType === 'webhook' && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-mono text-text-dim mb-1">Encabezado Personalizado (Key)</label>
                  <input
                    type="text"
                    placeholder="ej. Authorization / X-Secret"
                    value={customHeaderKey}
                    onChange={(e) => setCustomHeaderKey(e.target.value)}
                    className="w-full bg-bg-card border border-border-base rounded-lg px-3 py-1.5 text-xs font-mono text-text-main"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-text-dim mb-1">Valor del Encabezado</label>
                  <input
                    type="text"
                    placeholder="ej. Bearer token123"
                    value={customHeaderValue}
                    onChange={(e) => setCustomHeaderValue(e.target.value)}
                    className="w-full bg-bg-card border border-border-base rounded-lg px-3 py-1.5 text-xs font-mono text-text-main"
                  />
                </div>
              </div>
            )}

            {channelType === 'email' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-mono text-text-muted mb-1 font-semibold">
                    Lista de Correos Destinatarios (separados por coma)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ej. devops@empresa.com, soporte@empresa.com"
                    value={recipients}
                    onChange={(e) => setRecipients(e.target.value)}
                    className="w-full bg-bg-card border border-border-base rounded-lg px-3 py-2 text-xs font-mono text-text-main focus:outline-none focus:border-accent-green"
                  />
                </div>

                <div className="pt-2 border-t border-border-base/50">
                  <h4 className="text-xs font-semibold text-accent-green mb-2">
                    Configuración de Servidor SMTP Personalizado (Opcional)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] text-text-dim mb-1 font-medium">Servidor SMTP Host</label>
                      <input
                        type="text"
                        placeholder="ej. smtp.gmail.com / smtp.sendgrid.net"
                        value={smtpHost}
                        onChange={(e) => setSmtpHost(e.target.value)}
                        className="w-full bg-bg-card border border-border-base rounded-xl px-3 py-1.5 text-xs font-mono text-text-main"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-text-dim mb-1 font-medium">Puerto (Port)</label>
                      <input
                        type="number"
                        placeholder="587"
                        value={smtpPort}
                        onChange={(e) => setSmtpPort(Number(e.target.value))}
                        className="w-full bg-bg-card border border-border-base rounded-xl px-3 py-1.5 text-xs font-mono text-text-main"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2.5">
                    <div>
                      <label className="block text-[11px] text-text-dim mb-1 font-medium">Usuario / Email SMTP</label>
                      <input
                        type="text"
                        placeholder="ej. alertas@miempresa.com"
                        value={smtpUser}
                        onChange={(e) => setSmtpUser(e.target.value)}
                        className="w-full bg-bg-card border border-border-base rounded-xl px-3 py-1.5 text-xs font-mono text-text-main"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-text-dim mb-1 font-medium">Contraseña / App Password</label>
                      <input
                        type="password"
                        placeholder="••••••••••••"
                        value={smtpPassword}
                        onChange={(e) => setSmtpPassword(e.target.value)}
                        className="w-full bg-bg-card border border-border-base rounded-xl px-3 py-1.5 text-xs font-mono text-text-main"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2.5 items-center">
                    <div>
                      <label className="block text-[11px] text-text-dim mb-1 font-medium">Email Remitente (From Email)</label>
                      <input
                        type="email"
                        placeholder="ej. no-reply@miempresa.com"
                        value={fromEmail}
                        onChange={(e) => setFromEmail(e.target.value)}
                        className="w-full bg-bg-card border border-border-base rounded-xl px-3 py-1.5 text-xs font-mono text-text-main"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-4">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-text-muted font-medium">
                        <input
                          type="checkbox"
                          checked={useTls}
                          onChange={(e) => setUseTls(e.target.checked)}
                          className="rounded accent-accent-green"
                        />
                        <span>Usar Encriptación TLS (Recomendado)</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-border-base">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-text-muted font-medium">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="rounded accent-accent-green"
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
                {channel ? 'Guardar Cambios' : 'Crear Canal'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
