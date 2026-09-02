import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Loader2,
  Play,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Globe,
  Server,
  Plug,
  Lock,
  Sparkles,
  Plus,
  Tag as TagIcon,
  Check,
  Sliders,
  Activity,
  Code2,
  ChevronDown,
  Database,
} from 'lucide-react';
import { api } from '../../services/api';
import type { MonitoringTarget, CreateTargetData } from '../../types/monitoring';

interface TargetFormProps {
  target: MonitoringTarget | null;
  onSubmit: (data: CreateTargetData) => Promise<void>;
  onClose: () => void;
}

const protocols = [
  {
    type: 'https' as const,
    label: 'HTTPS',
    desc: 'Web seguro con TLS',
    icon: Globe,
    color: 'text-sky-400',
    border: 'border-sky-500/30',
    bg: 'bg-sky-500/10',
    activeBg: 'bg-sky-500/15 border-sky-400 text-sky-300 ring-2 ring-sky-400/40 shadow-lg shadow-sky-950/40',
    defaultEndpoint: 'https://',
    placeholder: 'https://mi-servicio.com',
  },
  {
    type: 'http' as const,
    label: 'HTTP',
    desc: 'Web sin cifrado o interno',
    icon: Globe,
    color: 'text-blue-400',
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/10',
    activeBg: 'bg-blue-500/15 border-blue-400 text-blue-300 ring-2 ring-blue-400/40 shadow-lg shadow-blue-950/40',
    defaultEndpoint: 'http://',
    placeholder: 'http://192.168.1.50:8080',
  },
  {
    type: 'tcp' as const,
    label: 'TCP Port',
    desc: 'Puertos de BD, AD, SSH',
    icon: Server,
    color: 'text-purple-400',
    border: 'border-purple-500/30',
    bg: 'bg-purple-500/10',
    activeBg: 'bg-purple-500/15 border-purple-400 text-purple-300 ring-2 ring-purple-400/40 shadow-lg shadow-purple-950/40',
    defaultEndpoint: '',
    placeholder: '10.138.15.10:389',
  },
  {
    type: 'dns' as const,
    label: 'DNS',
    desc: 'Resolución de nombres',
    icon: Globe,
    color: 'text-emerald-400',
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/10',
    activeBg: 'bg-emerald-500/15 border-emerald-400 text-emerald-300 ring-2 ring-emerald-400/40 shadow-lg shadow-emerald-950/40',
    defaultEndpoint: '',
    placeholder: 'micoope.com.gt',
  },
  {
    type: 'api' as const,
    label: 'API REST',
    desc: 'Microservicios con JSON/Auth',
    icon: Plug,
    color: 'text-amber-400',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/10',
    activeBg: 'bg-amber-500/15 border-amber-400 text-amber-300 ring-2 ring-amber-400/40 shadow-lg shadow-amber-950/40',
    defaultEndpoint: 'https://',
    placeholder: 'https://api.empresa.com/v1/health',
  },
  {
    type: 'ssl' as const,
    label: 'SSL',
    desc: 'Vencimiento de certificado',
    icon: Lock,
    color: 'text-rose-400',
    border: 'border-rose-500/30',
    bg: 'bg-rose-500/10',
    activeBg: 'bg-rose-500/15 border-rose-400 text-rose-300 ring-2 ring-rose-400/40 shadow-lg shadow-rose-950/40',
    defaultEndpoint: '',
    placeholder: 'dominio.com.gt',
  },
];

const commonPorts = [
  { label: '389 LDAP / AD', port: '389' },
  { label: '5432 PostgreSQL', port: '5432' },
  { label: '3306 MySQL', port: '3306' },
  { label: '6379 Redis', port: '6379' },
  { label: '8080 Web App', port: '8080' },
  { label: '22 SSH', port: '22' },
];

const intervalPresets = [
  { label: '15s (Crítico)', value: 15 },
  { label: '30s (Alta)', value: 30 },
  { label: '60s (Estándar)', value: 60 },
  { label: '300s (5 min)', value: 300 },
];

const tagSuggestions = ['produccion', 'core', 'interno', 'db', 'dns', 'infra', 'api'];

export default function TargetForm({ target, onSubmit, onClose }: TargetFormProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'http' | 'diagnostic'>('general');
  const [showTemplates, setShowTemplates] = useState(false);
  const templatesRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState(target?.name || '');
  const [targetType, setTargetType] = useState<MonitoringTarget['target_type']>(target?.target_type || 'https');
  const [endpoint, setEndpoint] = useState(target?.endpoint || '');
  const [interval, setInterval] = useState(target?.interval || 60);
  const [enabled, setEnabled] = useState(target?.enabled ?? true);

  // TCP dedicated helper state
  const [tcpHost, setTcpHost] = useState('');
  const [tcpPort, setTcpPort] = useState('80');

  // Tag chip management
  const [tags, setTags] = useState<string[]>(target?.tags || []);
  const [tagInputText, setTagInputText] = useState('');

  // Advanced fields
  const [httpMethod, setHttpMethod] = useState(target?.http_method || 'GET');
  const [expectedStatus, setExpectedStatus] = useState(target?.expected_status || 200);
  const [maxLatencyMs, setMaxLatencyMs] = useState(target?.max_latency_ms || 2000);
  const [headersJson, setHeadersJson] = useState(
    target?.custom_headers ? JSON.stringify(target.custom_headers, null, 2) : ''
  );
  const [requestBody, setRequestBody] = useState(target?.request_body || '');

  // Live test diagnostic state
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: string;
    message: string;
    latency_ms?: number;
    status_code?: number;
    headers?: Record<string, string>;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Close templates dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (templatesRef.current && !templatesRef.current.contains(event.target as Node)) {
        setShowTemplates(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize TCP fields from endpoint if editing TCP
  useEffect(() => {
    if (target?.target_type === 'tcp' && target.endpoint.includes(':')) {
      const parts = target.endpoint.split(':');
      setTcpHost(parts[0]);
      setTcpPort(parts[1] || '80');
    }
  }, [target]);

  // Keep endpoint in sync if TCP mode
  const getActualEndpoint = () => {
    if (targetType === 'tcp') {
      return `${tcpHost.trim()}:${tcpPort.trim()}`;
    }
    return endpoint.trim();
  };

  const handleProtocolChange = (type: MonitoringTarget['target_type']) => {
    setTargetType(type);
    setTestResult(null);
    setError('');

    // If switching to TCP and endpoint has a port, parse it
    if (type === 'tcp' && endpoint.includes(':')) {
      const [h, p] = endpoint.split(':');
      setTcpHost(h);
      setTcpPort(p || '80');
    } else if (type === 'https' && (!endpoint || endpoint === 'http://')) {
      setEndpoint('https://');
    } else if (type === 'http' && (!endpoint || endpoint === 'https://')) {
      setEndpoint('http://');
    }
  };

  // 1-Click Templates (Strictly NO emojis)
  const applyTemplate = (template: 'ad' | 'db' | 'web' | 'api') => {
    if (template === 'ad') {
      setName('Active Directory / DNS LDAP');
      setTargetType('tcp');
      setTcpHost('10.138.15.10');
      setTcpPort('389');
      setInterval(30);
      setTags(['infra', 'ad', 'ldap']);
    } else if (template === 'db') {
      setName('Base de Datos PostgreSQL');
      setTargetType('tcp');
      setTcpHost('10.138.10.5');
      setTcpPort('5432');
      setInterval(30);
      setTags(['db', 'postgres', 'core']);
    } else if (template === 'web') {
      setName('Portal Web Corporativo');
      setTargetType('https');
      setEndpoint('https://micoope.com.gt');
      setInterval(60);
      setExpectedStatus(200);
      setTags(['web', 'publico']);
    } else if (template === 'api') {
      setName('API Gateway Core');
      setTargetType('api');
      setEndpoint('https://micoopeenlinea.com.gt/api/v1/health');
      setHttpMethod('GET');
      setExpectedStatus(200);
      setInterval(30);
      setTags(['api', 'core', 'produccion']);
    }
  };

  // Tag chip handlers
  const addTag = (text: string) => {
    const cleaned = text.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
    if (cleaned && !tags.includes(cleaned)) {
      setTags([...tags, cleaned]);
    }
    setTagInputText('');
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  // Live Test Connection handler
  const handleTestConnection = async () => {
    const targetEndpoint = getActualEndpoint();
    if (!targetEndpoint || targetEndpoint === 'https://' || targetEndpoint === 'http://') {
      setError('Por favor ingresa un host, URL o IP válido para probar.');
      return;
    }

    if (targetType === 'tcp' && (!tcpHost.trim() || !tcpPort.trim())) {
      setError('En modo TCP debes especificar Host y Puerto.');
      return;
    }

    setTestingConnection(true);
    setTestResult(null);
    setError('');

    try {
      let custom_headers = {};
      if (headersJson.trim()) {
        try {
          custom_headers = JSON.parse(headersJson);
        } catch {
          setError('El formato JSON de los encabezados es inválido.');
          setTestingConnection(false);
          return;
        }
      }

      const res = await api.post('/monitoring/test-connection/', {
        endpoint: targetEndpoint,
        target_type: targetType,
        http_method: httpMethod,
        expected_status: expectedStatus,
        max_latency_ms: maxLatencyMs,
        custom_headers,
        request_body: requestBody,
      });

      setTestResult(res.data?.data || null);
    } catch (err: any) {
      setTestResult({
        status: 'down',
        message: err.response?.data?.message || 'Error al contactar el servidor de diagnóstico.',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const targetEndpoint = getActualEndpoint();

    if (!name.trim()) {
      setError('El nombre del objetivo es requerido.');
      setActiveTab('general');
      return;
    }

    if (!targetEndpoint || targetEndpoint === 'https://' || targetEndpoint === 'http://') {
      setError('El endpoint o dirección de destino es requerido.');
      setActiveTab('general');
      return;
    }

    if (targetType === 'tcp' && (!tcpHost.trim() || !tcpPort.trim())) {
      setError('Para conexiones TCP debes especificar Host y Puerto (ej: 10.138.15.10:389).');
      setActiveTab('general');
      return;
    }

    let parsedHeaders = {};
    if (headersJson.trim()) {
      try {
        parsedHeaders = JSON.parse(headersJson);
      } catch {
        setError('El JSON de encabezados no es válido.');
        setActiveTab('http');
        return;
      }
    }

    setLoading(true);
    try {
      await onSubmit({
        name: name.trim(),
        target_type: targetType,
        endpoint: targetEndpoint,
        interval: Number(interval),
        enabled,
        http_method: httpMethod,
        expected_status: Number(expectedStatus),
        custom_headers: parsedHeaders,
        request_body: requestBody,
        max_latency_ms: Number(maxLatencyMs),
        tags,
      });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Error al guardar el target de monitoreo.');
    } finally {
      setLoading(false);
    }
  };

  const isHttpType = targetType === 'http' || targetType === 'https' || targetType === 'api';

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-bg-card/95 border border-border-base/70 rounded-3xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-7 py-5 border-b border-border-base/60 bg-bg-card/95 backdrop-blur flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-accent-green/10 border border-accent-green/25 flex items-center justify-center shadow-inner">
              <Activity className="text-accent-green" size={22} />
            </div>
            <div>
              <h2 className="font-bold text-lg text-text-main tracking-tight">
                {target ? 'Editar Objetivo de Monitoreo' : 'Nuevo Objetivo de Monitoreo'}
              </h2>
              <p className="text-xs text-text-muted">
                Configura protocolo, frecuencia de sondeo y parámetros de alerta.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Clean Templates Dropdown in Header */}
            {!target && (
              <div className="relative" ref={templatesRef}>
                <button
                  type="button"
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-border-base/80 bg-bg-dark/70 text-xs font-medium text-text-muted hover:text-text-main hover:border-accent-green/50 transition-all shadow-sm"
                  title="Cargar configuración predeterminada"
                >
                  <Sparkles size={13} className="text-accent-green" />
                  <span>Plantillas</span>
                  <ChevronDown
                    size={12}
                    className={`transition-transform duration-200 ${
                      showTemplates ? 'rotate-180 text-accent-green' : ''
                    }`}
                  />
                </button>

                {showTemplates && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-bg-card/95 backdrop-blur-md border border-border-base/80 rounded-2xl shadow-2xl p-2 z-50 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-1.5 text-[11px] font-medium text-text-dim uppercase tracking-wider">
                      Plantillas Preconfiguradas
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        applyTemplate('ad');
                        setShowTemplates(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs text-text-muted hover:text-text-main hover:bg-bg-dark/80 transition-all"
                    >
                      <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                        <Server size={14} className="text-purple-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-text-main truncate">Active Directory (389)</div>
                        <div className="text-[11px] text-text-dim">TCP · Frecuencia 30s</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        applyTemplate('db');
                        setShowTemplates(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs text-text-muted hover:text-text-main hover:bg-bg-dark/80 transition-all"
                    >
                      <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                        <Database size={14} className="text-blue-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-text-main truncate">PostgreSQL (5432)</div>
                        <div className="text-[11px] text-text-dim">TCP · Frecuencia 30s</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        applyTemplate('web');
                        setShowTemplates(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs text-text-muted hover:text-text-main hover:bg-bg-dark/80 transition-all"
                    >
                      <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                        <Globe size={14} className="text-sky-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-text-main truncate">Portal Web HTTPS</div>
                        <div className="text-[11px] text-text-dim">HTTPS · Código 200 · 60s</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        applyTemplate('api');
                        setShowTemplates(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs text-text-muted hover:text-text-main hover:bg-bg-dark/80 transition-all"
                    >
                      <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                        <Plug size={14} className="text-amber-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-text-main truncate">API REST Microservicio</div>
                        <div className="text-[11px] text-text-dim">API · Headers Auth · 30s</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={onClose}
              className="p-2 text-text-muted hover:text-text-main hover:bg-bg-dark/80 rounded-full transition-colors"
            >
              <X size={19} />
            </button>
          </div>
        </div>

        {/* Modal Navigation Pill Tabs */}
        <div className="px-7 pt-4 pb-2">
          <div className="flex items-center gap-1.5 p-1 bg-bg-dark/60 border border-border-base/60 rounded-2xl text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('general')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl transition-all duration-150 ${
                activeTab === 'general'
                  ? 'bg-accent-green text-black font-semibold shadow-sm'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              <Sliders size={14} />
              1. General & Red
            </button>
            {isHttpType && (
              <button
                type="button"
                onClick={() => setActiveTab('http')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl transition-all duration-150 ${
                  activeTab === 'http'
                    ? 'bg-accent-green text-black font-semibold shadow-sm'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                <Code2 size={14} />
                2. Opciones HTTP
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('diagnostic')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl transition-all duration-150 ${
                activeTab === 'diagnostic'
                  ? 'bg-accent-green text-black font-semibold shadow-sm'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              <Activity size={14} />
              {isHttpType ? '3. Diagnóstico en Vivo' : '2. Diagnóstico en Vivo'}
            </button>
          </div>
        </div>

        {/* Form Body with Smooth Scroll */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-7 py-5 space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 text-xs font-medium flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: GENERAL & RED */}
          {activeTab === 'general' && (
            <div className="space-y-5">
              {/* Protocol Selector Cards */}
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-2.5">
                  Protocolo de Monitoreo
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {protocols.map((proto) => {
                    const ProtoIcon = proto.icon;
                    const isSelected = targetType === proto.type;
                    return (
                      <button
                        key={proto.type}
                        type="button"
                        onClick={() => handleProtocolChange(proto.type)}
                        className={`p-3.5 rounded-2xl border text-left transition-all duration-200 flex flex-col justify-between ${
                          isSelected
                            ? proto.activeBg
                            : 'bg-bg-dark/50 border-border-base/60 hover:border-border-base hover:bg-bg-dark/80'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className="font-semibold text-sm">{proto.label}</span>
                          <ProtoIcon size={16} className={proto.color} />
                        </div>
                        <span className="text-[11px] text-text-dim leading-snug">{proto.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target Name & State */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    Nombre Descriptivo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ej: DNS Corporativo LDAP / Portal Clientes"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-bg-dark/80 border border-border-base/80 rounded-xl px-4 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green focus:ring-2 focus:ring-accent-green/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    Estado Inicial
                  </label>
                  <button
                    type="button"
                    onClick={() => setEnabled(!enabled)}
                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-2 ${
                      enabled
                        ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400'
                        : 'bg-zinc-800/80 border-zinc-700/80 text-zinc-400'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${enabled ? 'bg-emerald-400 animate-ping' : 'bg-zinc-500'}`} />
                    {enabled ? 'Activo (Sondeando)' : 'Pausado'}
                  </button>
                </div>
              </div>

              {/* Dynamic Target Endpoint Input */}
              {targetType === 'tcp' ? (
                <div className="bg-bg-dark/40 border border-purple-500/25 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-purple-400">
                    <Server size={14} /> Configuración de Conexión TCP
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-text-muted mb-1">Host o Dirección IP</label>
                      <input
                        type="text"
                        required
                        placeholder="10.138.15.10 o db.midominio.com"
                        value={tcpHost}
                        onChange={(e) => setTcpHost(e.target.value)}
                        className="w-full bg-bg-dark/80 border border-border-base/80 rounded-xl p-2.5 text-sm text-text-main font-mono focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400/20 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Puerto</label>
                      <input
                        type="number"
                        required
                        placeholder="389"
                        value={tcpPort}
                        onChange={(e) => setTcpPort(e.target.value)}
                        className="w-full bg-bg-dark/80 border border-border-base/80 rounded-xl p-2.5 text-sm text-text-main font-mono focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400/20 transition-all"
                      />
                    </div>
                  </div>

                  {/* Common Port Quick Pills */}
                  <div>
                    <span className="text-[11px] font-medium text-text-dim block mb-2">Puertos Comunes de Infraestructura:</span>
                    <div className="flex flex-wrap gap-2">
                      {commonPorts.map((cp) => (
                        <button
                          key={cp.port}
                          type="button"
                          onClick={() => setTcpPort(cp.port)}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                            tcpPort === cp.port
                              ? 'bg-purple-500/20 border-purple-400 text-purple-300 font-semibold shadow-sm'
                              : 'bg-bg-dark/60 border-border-base/70 text-text-muted hover:text-text-main hover:border-purple-400/50'
                          }`}
                        >
                          {cp.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    {targetType === 'dns'
                      ? 'Nombre de Dominio a Resolver *'
                      : targetType === 'ssl'
                      ? 'Dominio del Certificado SSL *'
                      : 'Dirección URL o Endpoint *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={protocols.find((p) => p.type === targetType)?.placeholder}
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    className="w-full bg-bg-dark/80 border border-border-base/80 rounded-xl px-4 py-2.5 text-sm text-text-main font-mono placeholder:text-text-dim focus:outline-none focus:border-accent-green focus:ring-2 focus:ring-accent-green/20 transition-all"
                  />
                  <p className="text-[11px] text-text-dim mt-1.5">
                    {targetType === 'dns'
                      ? 'Introduce el dominio sin https:// (ej. micoope.local o google.com)'
                      : targetType === 'ssl'
                      ? 'Se verificará la cadena criptográfica y días restantes de expiración.'
                      : 'Asegúrate de incluir http:// o https:// para peticiones web.'}
                  </p>
                </div>
              )}

              {/* Interval & Presets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-text-muted">
                    Intervalo de Chequeo (Frecuencia)
                  </label>
                  <span className="text-xs font-semibold text-accent-green">Cada {interval} segundos</span>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  {intervalPresets.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setInterval(preset.value)}
                      className={`py-1.5 px-4 rounded-full border text-center transition-all font-medium ${
                        interval === preset.value
                          ? 'bg-accent-green/20 border-accent-green text-accent-green font-semibold shadow-sm'
                          : 'bg-bg-dark/60 border-border-base/70 text-text-muted hover:text-text-main hover:border-accent-green/40'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tag Chips Management */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-text-muted">
                  Etiquetas & Agrupación (Tags)
                </label>
                <div className="flex flex-wrap items-center gap-2 p-2.5 bg-bg-dark/60 border border-border-base/80 rounded-2xl min-h-[46px]">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-bg-card border border-border-base rounded-full text-xs font-medium text-accent-green"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="text-text-dim hover:text-rose-400 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  <div className="flex items-center gap-1 flex-1 min-w-[140px]">
                    <input
                      type="text"
                      placeholder="Escribe un tag y pulsa Enter..."
                      value={tagInputText}
                      onChange={(e) => setTagInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault();
                          addTag(tagInputText);
                        }
                      }}
                      className="bg-transparent text-xs text-text-main placeholder:text-text-dim focus:outline-none w-full px-2"
                    />
                    {tagInputText.trim() && (
                      <button
                        type="button"
                        onClick={() => addTag(tagInputText)}
                        className="p-1 text-accent-green hover:bg-accent-green/10 rounded-full"
                      >
                        <Plus size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Suggestions */}
                <div className="flex items-center gap-2 flex-wrap text-[11px] text-text-dim pt-0.5">
                  <span className="flex items-center gap-1">
                    <TagIcon size={12} /> Sugerencias:
                  </span>
                  {tagSuggestions
                    .filter((s) => !tags.includes(s))
                    .map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => addTag(s)}
                        className="hover:text-accent-green transition-colors underline decoration-dotted"
                      >
                        #{s}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: OPCIONES HTTP & HEADERS */}
          {activeTab === 'http' && isHttpType && (
            <div className="space-y-5 animate-in fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    Método HTTP
                  </label>
                  <select
                    value={httpMethod}
                    onChange={(e) => setHttpMethod(e.target.value)}
                    className="w-full bg-bg-dark/80 border border-border-base/80 rounded-xl px-4 py-2.5 text-sm text-text-main font-mono focus:border-accent-green focus:outline-none focus:ring-2 focus:ring-accent-green/20"
                  >
                    <option value="GET">GET (Lectura estándar)</option>
                    <option value="POST">POST (Envío de payload)</option>
                    <option value="PUT">PUT (Actualización)</option>
                    <option value="HEAD">HEAD (Solo headers - ultra ligero)</option>
                    <option value="DELETE">DELETE (Borrado)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    Código de Estado Esperado
                  </label>
                  <input
                    type="number"
                    value={expectedStatus}
                    onChange={(e) => setExpectedStatus(Number(e.target.value))}
                    className="w-full bg-bg-dark/80 border border-border-base/80 rounded-xl px-4 py-2.5 text-sm text-text-main font-mono focus:border-accent-green focus:outline-none focus:ring-2 focus:ring-accent-green/20"
                  />
                  <div className="flex gap-2 mt-2 text-xs text-text-dim">
                    <span>Comunes:</span>
                    {[200, 201, 204, 301].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setExpectedStatus(c)}
                        className="px-2 py-0.5 rounded-full bg-bg-dark border border-border-base/60 hover:text-accent-green hover:border-accent-green/40 transition-colors"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  Latencia Máxima Permitida (Umbral de Alerta)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="100"
                    max="5000"
                    step="100"
                    value={maxLatencyMs}
                    onChange={(e) => setMaxLatencyMs(Number(e.target.value))}
                    className="flex-1 accent-accent-green bg-bg-dark cursor-pointer h-2 rounded-lg"
                  />
                  <span className="font-mono text-xs font-semibold text-accent-yellow bg-bg-dark border border-border-base px-3 py-1.5 rounded-full shadow-sm">
                    {maxLatencyMs}ms
                  </span>
                </div>
                <p className="text-[11px] text-text-dim mt-1.5">
                  Si la respuesta supera este tiempo, el target cambiará a estado LENTO (Warning).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  Encabezados Personalizados (JSON)
                </label>
                <textarea
                  rows={3}
                  placeholder={`{\n  "Authorization": "Bearer token_secreto",\n  "X-Custom-Header": "Sentinel"\n}`}
                  value={headersJson}
                  onChange={(e) => setHeadersJson(e.target.value)}
                  className="w-full bg-bg-dark/80 border border-border-base/80 rounded-xl p-3 text-xs text-text-main font-mono focus:border-accent-green focus:outline-none focus:ring-2 focus:ring-accent-green/20"
                />
              </div>

              {httpMethod !== 'GET' && httpMethod !== 'HEAD' && (
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    Cuerpo de la Petición (Request Body)
                  </label>
                  <textarea
                    rows={3}
                    placeholder='{"action": "ping", "client": "sentinel"}'
                    value={requestBody}
                    onChange={(e) => setRequestBody(e.target.value)}
                    className="w-full bg-bg-dark/80 border border-border-base/80 rounded-xl p-3 text-xs text-text-main font-mono focus:border-accent-green focus:outline-none focus:ring-2 focus:ring-accent-green/20"
                  />
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DIAGNÓSTICO & TEST EN VIVO */}
          {activeTab === 'diagnostic' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-bg-dark/40 border border-border-base/70 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-text-main flex items-center gap-2">
                      <Play size={14} className="text-accent-green" /> Diagnóstico de Conexión en Vivo
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5">
                      Verifica que el endpoint responda adecuadamente antes de darlo de alta en el sistema.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testingConnection}
                    className="px-4 py-2 bg-accent-green text-black font-semibold rounded-full text-xs hover:bg-accent-green/90 transition-all flex items-center gap-2 disabled:opacity-50 shadow-md shadow-accent-green/10"
                  >
                    {testingConnection ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} />}
                    {testingConnection ? 'Probando...' : 'Ejecutar Test Ahora'}
                  </button>
                </div>

                <div className="text-xs bg-bg-dark/80 p-3.5 rounded-xl border border-border-base/60 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Target evaluado:</span>
                    <span className="text-text-main font-mono font-medium">{getActualEndpoint() || 'Sin especificar'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Protocolo:</span>
                    <span className="text-accent-green uppercase font-semibold text-[11px] px-2 py-0.5 rounded-full bg-accent-green/10 border border-accent-green/20">
                      {targetType}
                    </span>
                  </div>
                </div>

                {testResult && (
                  <div
                    className={`p-4 rounded-2xl border text-xs space-y-3 animate-in fade-in ${
                      testResult.status === 'up'
                        ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-400'
                        : testResult.status === 'slow'
                        ? 'bg-amber-500/10 border-amber-500/35 text-amber-400'
                        : 'bg-rose-500/10 border-rose-500/35 text-rose-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold flex items-center gap-2">
                        {testResult.status === 'up' && <CheckCircle2 size={16} />}
                        {testResult.status === 'slow' && <AlertTriangle size={16} />}
                        {testResult.status === 'down' && <AlertCircle size={16} />}
                        {testResult.status === 'up'
                          ? 'Conexión Exitosa'
                          : testResult.status === 'slow'
                          ? 'Conexión con Retardo'
                          : 'Fallo de Conexión'}
                      </span>
                      {testResult.latency_ms !== undefined && (
                        <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-black/30">
                          {testResult.latency_ms} ms
                        </span>
                      )}
                    </div>

                    <div className="text-xs opacity-90">{testResult.message}</div>

                    {testResult.headers && (
                      <div className="pt-2 border-t border-current/20">
                        <span className="block text-[10px] uppercase font-bold mb-1 opacity-70">Headers Recibidos:</span>
                        <pre className="text-[10px] font-mono bg-black/40 p-2.5 rounded-xl max-h-32 overflow-y-auto">
                          {JSON.stringify(testResult.headers, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Modal Actions Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-border-base/60 gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="px-4 py-2 border border-accent-green/40 bg-accent-green/10 text-accent-green text-xs font-semibold rounded-full hover:bg-accent-green/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {testingConnection ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} />}
                Test Rápido
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 border border-border-base/80 rounded-full text-xs font-medium text-text-muted hover:bg-bg-dark/80 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-accent-green text-black font-semibold rounded-full text-xs hover:bg-accent-green/90 transition-all flex items-center gap-2 shadow-md shadow-accent-green/20"
              >
                {loading ? <Loader2 className="animate-spin" size={14} /> : <Check size={16} />}
                {target ? 'Actualizar Target' : 'Crear Target'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}