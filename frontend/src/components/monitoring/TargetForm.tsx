import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Loader2,
  Globe,
  Server,
  Plug,
  Lock,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Database,
  Play,
  Pause,
  ShieldCheck,
  Network,
  Waypoints,
  Webhook,
  Cloud,
} from "lucide-react";
import ModalSurface from "../common/ModalSurface";
import { useTargetFormWorkspace } from "./workspaces/useTargetFormWorkspace";
import type {
  MonitoringTarget,
  CreateTargetData,
} from "../../types/monitoring";

interface TargetFormProps {
  target: MonitoringTarget | null;
  existingTargets?: MonitoringTarget[];
  onSubmit: (data: CreateTargetData) => Promise<void>;
  onClose: () => void;
}

const protocols = [
  {
    type: "https" as const,
    label: "HTTPS",
    desc: "Web segura con TLS / SSL",
    icon: ShieldCheck,
    placeholder: "https://mi-servicio.com",
    namePlaceholder: "ej: Portal Web Principal",
  },
  {
    type: "http" as const,
    label: "HTTP",
    desc: "Web sin cifrado o interna",
    icon: Globe,
    placeholder: "http://192.168.1.50:8080",
    namePlaceholder: "ej: Servicio Interno",
  },
  {
    type: "tcp" as const,
    label: "TCP Port",
    desc: "Puertos de red (BD, LDAP, SSH)",
    icon: Network,
    placeholder: "10.138.15.10:5432",
    namePlaceholder: "ej: BD PostgreSQL Producción",
  },
  {
    type: "dns" as const,
    label: "DNS",
    desc: "Resolución de nombres y registros",
    icon: Waypoints,
    placeholder: "dominio.com.gt",
    namePlaceholder: "ej: DNS Corporativo Primario",
  },
  {
    type: "api" as const,
    label: "API REST",
    desc: "HTTP con método, headers y cuerpo",
    icon: Webhook,
    placeholder: "https://api.empresa.com/v1/health",
    namePlaceholder: "ej: API Gateway / Core",
  },
  {
    type: "ssl" as const,
    label: "SSL",
    desc: "Vencimiento y validez de certificado",
    icon: Lock,
    placeholder: "dominio.com.gt",
    namePlaceholder: "ej: Certificado Wildcard",
  },
];

const commonPorts = [
  { label: "5432 Postgres", port: "5432" },
  { label: "3306 MySQL", port: "3306" },
  { label: "389 LDAP/AD", port: "389" },
  { label: "6379 Redis", port: "6379" },
  { label: "8080 Web", port: "8080" },
  { label: "22 SSH", port: "22" },
];

const tagSuggestions = [
  "produccion",
  "core",
  "interno",
  "db",
  "api",
  "infra",
  "onboarding",
];

const COMMON_HTTP_STATUSES = [
  {
    group: "2xx · Éxito (Recomendado)",
    codes: [
      { code: 200, label: "200 — OK (Estándar para webs y APIs)" },
      { code: 201, label: "201 — Created (Recurso creado exitosamente)" },
      { code: 202, label: "202 — Accepted (Petición aceptada / En proceso)" },
      { code: 204, label: "204 — No Content (Éxito sin cuerpo de respuesta)" },
    ],
  },
  {
    group: "3xx · Redirecciones",
    codes: [
      { code: 301, label: "301 — Moved Permanently (Redirección fija)" },
      { code: 302, label: "302 — Found (Redirección temporal)" },
      { code: 304, label: "304 — Not Modified (Caché válida)" },
      { code: 307, label: "307 — Temporary Redirect (Redirección estricta)" },
      { code: 308, label: "308 — Permanent Redirect (Redirección estricta)" },
    ],
  },
  {
    group: "4xx · Respuestas de cliente (Casos especiales)",
    codes: [
      { code: 400, label: "400 — Bad Request" },
      { code: 401, label: "401 — Unauthorized (Requiere autenticación)" },
      { code: 403, label: "403 — Forbidden (Acceso denegado)" },
      { code: 404, label: "404 — Not Found (Validar recurso inexistente)" },
      { code: 405, label: "405 — Method Not Allowed" },
      { code: 422, label: "422 — Unprocessable Entity" },
      { code: 429, label: "429 — Too Many Requests (Rate limit)" },
    ],
  },
  {
    group: "5xx · Respuestas de servidor",
    codes: [
      { code: 500, label: "500 — Internal Server Error" },
      { code: 502, label: "502 — Bad Gateway" },
      { code: 503, label: "503 — Service Unavailable" },
    ],
  },
];

export default function TargetForm({
  target,
  existingTargets = [],
  onSubmit,
  onClose,
}: TargetFormProps) {
  const {
    showTemplates,
    setShowTemplates,
    templatesRef,
    name,
    setName,
    targetType,
    setTargetType,
    endpoint,
    setEndpoint,
    interval,
    setInterval,
    enabled,
    setEnabled,
    autoCoverage,
    canAutoProvision,
    setAutoCoverage,
    ownerTeam,
    setOwnerTeam,
    runnerType,
    setRunnerType,
    agentProbeId,
    setAgentProbeId,
    teams,
    probes,
    tcpHost,
    setTcpHost,
    tcpPort,
    setTcpPort,
    tags,
    tagInputText,
    setTagInputText,
    httpMethod,
    setHttpMethod,
    expectedStatus,
    setExpectedStatus,
    maxLatencyMs,
    setMaxLatencyMs,
    headersJson,
    setHeadersJson,
    requestBody,
    setRequestBody,
    testingConnection,
    testResult,
    setTestResult,
    loading,
    error,
    handleProtocolChange,
    applyTemplate,
    addTag,
    removeTag,
    handleTestConnection,
    handleSubmit,
    isHttpType,
  } = useTargetFormWorkspace({ target, onSubmit, onClose });

  const [hasManuallyEditedName, setHasManuallyEditedName] = useState(
    Boolean(target?.name),
  );
  const [consecutiveFailures, setConsecutiveFailures] = useState(2);
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Autofocus on URL upon open
  useEffect(() => {
    urlInputRef.current?.focus();
  }, []);

  // Extract host from current endpoint
  const extractedHost = useMemo(() => {
    if (!endpoint) return "";
    const clean = endpoint.trim().replace(/^https?:\/\//i, "");
    return clean.split("/")[0].split(":")[0];
  }, [endpoint]);

  // Duplicate detection against existing targets in current organization
  const duplicateTarget = useMemo(() => {
    if (!existingTargets || !endpoint) return null;
    const currentNorm = endpoint
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/\/$/, "")
      .toLowerCase();
    if (!currentNorm || currentNorm.length < 3) return null;
    return existingTargets.find((t) => {
      if (target && t.id === target.id) return false;
      const otherNorm = t.endpoint
        .trim()
        .replace(/^https?:\/\//i, "")
        .replace(/\/$/, "")
        .toLowerCase();
      return otherNorm === currentNorm;
    });
  }, [existingTargets, endpoint, target]);

  // Internal address detection (suggesting Senti9 private runner)
  const isInternalHost = useMemo(() => {
    if (!extractedHost) return false;
    return /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|.*\.local|.*\.internal|backend)/i.test(
      extractedHost,
    );
  }, [extractedHost]);

  // Auto-detect protocol, host and suggest name on typing/pasting URL
  const handleEndpointChange = (val: string) => {
    setEndpoint(val);
    setTestResult(null);

    const trimmed = val.trim();

    // 1. Auto-detect Protocol from URL
    if (trimmed.startsWith("https://") && targetType !== "https" && targetType !== "api") {
      setTargetType("https");
    } else if (trimmed.startsWith("http://") && targetType !== "http" && targetType !== "api") {
      setTargetType("http");
    } else if (
      !trimmed.startsWith("http") &&
      /^[a-zA-Z0-9.-]+:\d+$/.test(trimmed) &&
      targetType !== "tcp"
    ) {
      setTargetType("tcp");
      const parts = trimmed.split(":");
      setTcpHost(parts[0]);
      setTcpPort(parts[1]);
    }

    // 2. Auto-derive target name from host if user hasn't typed a custom name
    if (!hasManuallyEditedName) {
      const hostPart = trimmed
        .replace(/^https?:\/\//i, "")
        .split("/")[0]
        .split(":")[0];
      if (hostPart && hostPart.length > 2) {
        setName(hostPart);
      }
    }

    // 3. Auto-suggest internal runner if private IP / localhost
    const hostToCheck = trimmed
      .replace(/^https?:\/\//i, "")
      .split("/")[0]
      .split(":")[0];
    if (
      /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|.*\.local|.*\.internal|backend)/i.test(
        hostToCheck,
      )
    ) {
      if (runnerType === "cloud" && probes.length > 0) {
        setRunnerType("agent");
        if (!agentProbeId && probes[0]?.id) {
          setAgentProbeId(probes[0].id);
        }
      }
    }
  };

  // Normalization on blur: if user typed "mi-servicio.com" without protocol, prepend https://
  const handleEndpointBlur = () => {
    const trimmed = endpoint.trim();
    if (
      (targetType === "https" || targetType === "http") &&
      trimmed &&
      !trimmed.startsWith("http://") &&
      !trimmed.startsWith("https://") &&
      !trimmed.includes(":")
    ) {
      setEndpoint(`https://${trimmed}`);
      if (!hasManuallyEditedName && !name) {
        setName(trimmed.split("/")[0]);
      }
    }
  };

  const currentProtocolObj =
    protocols.find((p) => p.type === targetType) || protocols[0];

  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <ModalSurface
        label={target ? "Editar target" : "Nuevo target de monitoreo"}
        onClose={onClose}
        className="bg-bg-card border border-border-base rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl font-sans text-sm overflow-hidden"
      >
        {/* Header */}
        <header className="px-5 py-4 border-b border-border-base bg-bg-dark/95 backdrop-blur-md flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-bold text-base text-text-main">
              {target ? "Editar target" : "Nuevo target"}
            </h2>
            <p className="text-xs text-text-muted">
              Disponibilidad, latencia y cobertura continua
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!target && (
              <div className="relative" ref={templatesRef}>
                <button
                  type="button"
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-base bg-bg-card hover:bg-bg-card-hover text-xs font-medium text-text-muted hover:text-text-main transition-colors shadow-sm"
                  title="Cargar configuración rápida"
                >
                  <Sparkles size={13} className="text-accent-green" />
                  <span>Plantillas</span>
                  <ChevronDown
                    size={12}
                    className={`transition-transform duration-150 ${
                      showTemplates ? "rotate-180 text-accent-green" : ""
                    }`}
                  />
                </button>

                {showTemplates && (
                  <div className="absolute right-0 top-full mt-1.5 w-64 bg-bg-dark border border-border-base rounded-xl shadow-2xl p-1 z-50 space-y-0.5 animate-in fade-in duration-100 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        applyTemplate("web");
                        setShowTemplates(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-text-muted hover:text-text-main hover:bg-bg-card-hover transition-colors"
                    >
                      <Globe size={15} className="text-sky-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-text-main">
                          Web pública HTTPS
                        </div>
                        <div className="text-[11px] text-text-dim">
                          HTTPS · Código 200 · 60 s
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        applyTemplate("api");
                        setShowTemplates(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-text-muted hover:text-text-main hover:bg-bg-card-hover transition-colors"
                    >
                      <Plug size={15} className="text-amber-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-text-main">
                          API REST
                        </div>
                        <div className="text-[11px] text-text-dim">
                          JSON · Método GET · 30 s
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        applyTemplate("db");
                        setShowTemplates(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-text-muted hover:text-text-main hover:bg-bg-card-hover transition-colors"
                    >
                      <Database size={15} className="text-purple-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-text-main">
                          Base de datos (TCP)
                        </div>
                        <div className="text-[11px] text-text-dim">
                          PostgreSQL 5432 · 30 s
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        applyTemplate("ad");
                        setShowTemplates(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-text-muted hover:text-text-main hover:bg-bg-card-hover transition-colors"
                    >
                      <Server size={15} className="text-indigo-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-text-main">
                          Active Directory / LDAP
                        </div>
                        <div className="text-[11px] text-text-dim">
                          TCP 389 · 30 s
                        </div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-bg-card-hover transition-colors"
              title="Cerrar (Esc)"
              aria-label="Cerrar modal"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Scrollable Form Body */}
        <form
          onSubmit={handleSubmit}
          className="p-5 space-y-4 overflow-y-auto flex-1 text-xs"
        >
          {error && (
            <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. URL o Endpoint (Primer campo, foco inicial) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="target-endpoint"
                className="font-semibold text-xs text-text-main"
              >
                URL o endpoint <span className="text-accent-green">*</span>
              </label>
              {targetType === "tcp" && (
                <span className="text-[11px] text-text-dim">
                  Formato: host:puerto
                </span>
              )}
            </div>

            <input
              ref={urlInputRef}
              id="target-endpoint"
              type="text"
              required
              value={endpoint}
              onChange={(e) => handleEndpointChange(e.target.value)}
              onBlur={handleEndpointBlur}
              placeholder={currentProtocolObj.placeholder}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border-base bg-bg-dark font-mono text-xs text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green transition-colors"
            />

            {/* Duplicates warning */}
            {duplicateTarget && (
              <div className="flex items-center gap-1.5 text-amber-400 font-medium text-[11px] mt-1">
                <AlertTriangle size={13} className="shrink-0" />
                <span>
                  Ya existe un target registrado (
                  <strong>{duplicateTarget.name}</strong>) con esta misma URL.
                </span>
              </div>
            )}

            {/* Internal network suggestion notice */}
            {isInternalHost && runnerType === "cloud" && (
              <div className="flex items-center gap-1.5 text-sky-400 text-[11px] mt-1 bg-sky-500/10 border border-sky-500/20 p-2 rounded-lg">
                <AlertCircle size={13} className="shrink-0" />
                <span>
                  Esta dirección parece ser privada o interna. Te sugerimos
                  usar el ejecutor <strong>Guardián Senti9</strong> para
                  alcanzarla.
                </span>
              </div>
            )}
          </div>

          {/* 2. Nombre y Protocolo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="target-name"
                className="font-semibold text-xs text-text-main"
              >
                Nombre del target <span className="text-accent-green">*</span>
              </label>
              <input
                id="target-name"
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setHasManuallyEditedName(true);
                }}
                placeholder={currentProtocolObj.namePlaceholder}
                className="w-full px-3.5 py-2 rounded-xl border border-border-base bg-bg-dark text-xs text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green transition-colors"
              />
            </div>

            {/* Protocol Chips */}
            <div className="space-y-1.5">
              <label className="font-semibold text-xs text-text-main block">
                Protocolo
              </label>
              <div className="flex flex-wrap items-center gap-1">
                {protocols.map((p) => {
                  const active = targetType === p.type;
                  const IconComponent = p.icon;
                  return (
                    <button
                      key={p.type}
                      type="button"
                      onClick={() => handleProtocolChange(p.type)}
                      title={p.desc}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all ${
                        active
                          ? "bg-accent-green/15 border-accent-green text-accent-green font-semibold shadow-sm"
                          : "bg-bg-dark/70 border-border-base text-text-muted hover:text-text-main hover:bg-bg-card-hover"
                      }`}
                    >
                      <IconComponent size={13} />
                      <span>{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* TCP Specific Fields (if TCP selected) */}
          {targetType === "tcp" && (
            <div className="p-3 rounded-xl border border-border-base bg-bg-dark/40 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-text-muted mb-1 font-medium">
                    Host o IP
                  </label>
                  <input
                    type="text"
                    value={tcpHost}
                    onChange={(e) => setTcpHost(e.target.value)}
                    placeholder="10.138.15.10"
                    className="w-full px-3 py-1.5 rounded-lg border border-border-base bg-bg-dark font-mono text-xs text-text-main"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-text-muted mb-1 font-medium">
                    Puerto TCP
                  </label>
                  <input
                    type="text"
                    value={tcpPort}
                    onChange={(e) => setTcpPort(e.target.value)}
                    placeholder="5432"
                    className="w-full px-3 py-1.5 rounded-lg border border-border-base bg-bg-dark font-mono text-xs text-text-main"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1 pt-1">
                <span className="text-[10px] text-text-dim mr-1">
                  Puertos comunes:
                </span>
                {commonPorts.map((cp) => (
                  <button
                    key={cp.port}
                    type="button"
                    onClick={() => setTcpPort(cp.port)}
                    className="px-2 py-0.5 rounded bg-bg-card border border-border-base text-[10px] text-text-muted hover:text-text-main hover:bg-bg-card-hover transition-colors font-mono"
                  >
                    {cp.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. Ejecutor del Sondeo */}
          <div className="space-y-1.5">
            <label className="font-semibold text-xs text-text-main block">
              Ejecutor del sondeo
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRunnerType("cloud")}
                className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                  runnerType === "cloud"
                    ? "bg-accent-green/10 border-accent-green text-text-main shadow-sm"
                    : "bg-bg-dark/50 border-border-base text-text-muted hover:text-text-main hover:bg-bg-card-hover"
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                    runnerType === "cloud"
                      ? "border-accent-green"
                      : "border-border-base"
                  }`}
                >
                  {runnerType === "cloud" && (
                    <div className="w-1.5 h-1.5 rounded-full bg-accent-green" />
                  )}
                </div>
                <div>
                  <div className="font-semibold text-xs text-text-main flex items-center gap-1.5">
                    <Cloud size={14} className="text-accent-cyan shrink-0" />
                    <span>Nube Sentinel (Público)</span>
                  </div>
                  <div className="text-[11px] text-text-dim mt-0.5">
                    Sondeo externo desde Internet
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRunnerType("agent")}
                className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                  runnerType === "agent"
                    ? "bg-accent-green/10 border-accent-green text-text-main shadow-sm"
                    : "bg-bg-dark/50 border-border-base text-text-muted hover:text-text-main hover:bg-bg-card-hover"
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                    runnerType === "agent"
                      ? "border-accent-green"
                      : "border-border-base"
                  }`}
                >
                  {runnerType === "agent" && (
                    <div className="w-1.5 h-1.5 rounded-full bg-accent-green" />
                  )}
                </div>
                <div>
                  <div className="font-semibold text-xs text-text-main flex items-center gap-1.5">
                    <Server size={14} className="text-emerald-400 shrink-0" />
                    <span>Guardián Senti9 (Privado)</span>
                  </div>
                  <div className="text-[11px] text-text-dim mt-0.5">
                    Sondeo dentro de tu red LAN o VPC
                  </div>
                </div>
              </button>
            </div>

            {/* Senti9 Agent selector if agent mode */}
            {runnerType === "agent" && (
              <div className="p-3 rounded-xl border border-border-base bg-bg-dark/60 mt-2 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-text-muted">
                    Selecciona el Guardián Senti9 asignado:
                  </span>
                  {probes.length === 0 && (
                    <span className="text-[10px] text-amber-400">
                      Sin agentes activos
                    </span>
                  )}
                </div>

                {probes.length > 0 ? (
                  <select
                    value={agentProbeId}
                    onChange={(e) => setAgentProbeId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border-base bg-bg-card text-xs text-text-main focus:outline-none focus:border-accent-green"
                  >
                    <option value="">— Seleccionar Guardián Senti9 —</option>
                    {probes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.is_online ? "En línea" : "Desconectado"})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-[11px] text-text-muted">
                    No tienes agentes Senti9 registrados aún. Puedes descargar y
                    activar uno desde el módulo <strong>Senti9</strong>.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 4. Cobertura adicional vinculada (SSL, DNS, Cabeceras) */}
          {isHttpType && canAutoProvision && (
            <label className="flex items-start gap-3 p-3 rounded-xl border border-border-base bg-bg-dark/50 hover:bg-bg-card-hover cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={autoCoverage}
                onChange={(e) => setAutoCoverage(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-accent-green bg-bg-card border-border-base focus:ring-accent-green"
              />
              <div className="text-xs">
                <span className="font-semibold text-text-main block">
                  Monitorear también SSL, DNS y cabeceras
                  {extractedHost ? ` de ${extractedHost}` : ""}
                </span>
                <span className="text-text-muted text-[11px]">
                  Crea automáticamente 3 chequeos vinculados para evitar
                  recursos huérfanos.
                </span>
              </div>
            </label>
          )}

          {/* 5. Intervalo & Umbral de Alertas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Intervalo */}
            <div className="space-y-1.5">
              <label className="font-semibold text-xs text-text-main block">
                Frecuencia de sondeo
              </label>
              <div className="flex items-center gap-1.5">
                {[
                  { label: "15 s", val: 15, locked: true },
                  { label: "30 s", val: 30, locked: true },
                  { label: "1 min", val: 60, recommended: true },
                  { label: "5 min", val: 300 },
                ].map((item) => {
                  const active = interval === item.val;
                  return (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() => !item.locked && setInterval(item.val)}
                      disabled={item.locked}
                      title={
                        item.locked
                          ? "Disponible en planes superiores"
                          : item.recommended
                            ? "Intervalo recomendado"
                            : undefined
                      }
                      className={`flex-1 py-1.5 px-2 rounded-lg border text-xs font-medium text-center transition-all ${
                        active
                          ? "bg-accent-green/15 border-accent-green text-accent-green font-semibold shadow-sm"
                          : item.locked
                            ? "bg-bg-dark/40 border-border-base/50 text-text-dim opacity-50 cursor-not-allowed"
                            : "bg-bg-dark/60 border-border-base text-text-muted hover:text-text-main hover:bg-bg-card-hover"
                      }`}
                    >
                      <span className="inline-flex items-center justify-center gap-1.5">
                        {item.locked && (
                          <Lock size={11} className="text-amber-400 shrink-0" />
                        )}
                        <span>{item.label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Alertas & Squad */}
            <div className="space-y-1.5">
              <label className="font-semibold text-xs text-text-main block">
                Parámetros de alerta
              </label>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-[11px] text-text-muted whitespace-nowrap">
                  <span>Alertar tras</span>
                  <select
                    value={consecutiveFailures}
                    onChange={(e) =>
                      setConsecutiveFailures(Number(e.target.value))
                    }
                    className="px-2 py-1.5 rounded-lg border border-border-base bg-bg-dark font-mono text-xs text-text-main focus:outline-none"
                  >
                    <option value={1}>1 fallo</option>
                    <option value={2}>2 fallos</option>
                    <option value={3}>3 fallos</option>
                    <option value={5}>5 fallos</option>
                  </select>
                </div>

                <div className="flex-1 min-w-0">
                  <select
                    value={ownerTeam}
                    onChange={(e) => setOwnerTeam(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-border-base bg-bg-dark text-xs text-text-main focus:outline-none truncate"
                  >
                    <option value="">Equipo: Sin asignar</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        Equipo: {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* 6. Opciones avanzadas (Colapsado por defecto) */}
          <details className="group border border-border-base rounded-xl bg-bg-dark/40 overflow-hidden transition-all">
            <summary className="px-3.5 py-2.5 cursor-pointer text-xs font-semibold text-text-muted hover:text-text-main flex items-center justify-between select-none">
              <span className="flex items-center gap-2">
                <ChevronRight
                  size={14}
                  className="text-text-dim group-open:rotate-90 transition-transform shrink-0"
                />
                <span>Opciones HTTP, etiquetas y parámetros avanzados</span>
              </span>
            </summary>

            <div className="p-3.5 pt-1 space-y-3 border-t border-border-base/50 text-xs">
              {/* HTTP Method, Expected Status, Max Latency */}
              {isHttpType && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] text-text-muted mb-1 font-medium">
                      Método HTTP
                    </label>
                    <select
                      value={httpMethod}
                      onChange={(e) => setHttpMethod(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-border-base bg-bg-dark text-xs text-text-main font-mono"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="HEAD">HEAD</option>
                      <option value="PUT">PUT</option>
                      <option value="PATCH">PATCH</option>
                      <option value="DELETE">DELETE</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-text-muted mb-1 font-medium">
                      Código esperado
                    </label>
                    <select
                      value={expectedStatus}
                      onChange={(e) => setExpectedStatus(Number(e.target.value))}
                      className="w-full px-2 py-1.5 rounded-lg border border-border-base bg-bg-dark font-mono text-xs text-text-main focus:outline-none focus:border-accent-green cursor-pointer"
                    >
                      {!COMMON_HTTP_STATUSES.some((g) =>
                        g.codes.some((c) => c.code === expectedStatus),
                      ) && (
                        <option value={expectedStatus}>
                          {expectedStatus} (Personalizado)
                        </option>
                      )}
                      {COMMON_HTTP_STATUSES.map((group) => (
                        <optgroup key={group.group} label={group.group}>
                          {group.codes.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-text-muted mb-1 font-medium">
                      Límite latencia (ms)
                    </label>
                    <input
                      type="number"
                      value={maxLatencyMs}
                      onChange={(e) => setMaxLatencyMs(Number(e.target.value))}
                      placeholder="2000"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-border-base bg-bg-dark font-mono text-xs text-text-main"
                    />
                  </div>
                </div>
              )}

              {/* Custom Headers JSON */}
              {isHttpType && (
                <div>
                  <label className="block text-[11px] text-text-muted mb-1 font-medium">
                    Cabeceras personalizadas (JSON)
                  </label>
                  <textarea
                    rows={2}
                    value={headersJson}
                    onChange={(e) => setHeadersJson(e.target.value)}
                    placeholder='{"Authorization": "Bearer token", "X-Custom": "val"}'
                    className="w-full px-3 py-1.5 rounded-lg border border-border-base bg-bg-dark font-mono text-xs text-text-main"
                  />
                </div>
              )}

              {/* Request Body (API / POST) */}
              {targetType === "api" && (
                <div>
                  <label className="block text-[11px] text-text-muted mb-1 font-medium">
                    Cuerpo de la petición (Payload)
                  </label>
                  <textarea
                    rows={2}
                    value={requestBody}
                    onChange={(e) => setRequestBody(e.target.value)}
                    placeholder='{"query": "health"}'
                    className="w-full px-3 py-1.5 rounded-lg border border-border-base bg-bg-dark font-mono text-xs text-text-main"
                  />
                </div>
              )}

              {/* Tags */}
              <div className="space-y-1.5">
                <label className="block text-[11px] text-text-muted font-medium">
                  Etiquetas (Tags)
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded-md bg-bg-card-hover border border-border-base text-[11px] text-text-main font-mono flex items-center gap-1"
                    >
                      <span>{t}</span>
                      <button
                        type="button"
                        onClick={() => removeTag(t)}
                        className="text-text-muted hover:text-rose-400 inline-flex items-center"
                        title="Eliminar etiqueta"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={tagInputText}
                    onChange={(e) => setTagInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addTag(tagInputText);
                      }
                    }}
                    placeholder="+ Añadir tag"
                    className="px-2 py-0.5 rounded-md border border-border-base bg-bg-dark text-[11px] text-text-main w-24"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  <span className="text-[10px] text-text-dim">Sugeridos:</span>
                  {tagSuggestions.map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => addTag(st)}
                      className="text-[10px] text-text-muted hover:text-text-main hover:underline"
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Initial State Toggle */}
              <div className="pt-1 flex items-center justify-between">
                <div>
                  <span className="font-medium text-text-main block">
                    Estado inicial
                  </span>
                  <span className="text-[11px] text-text-muted">
                    Activa o pausa el monitoreo inmediatamente tras guardar
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setEnabled(!enabled)}
                  className={`px-3 py-1 rounded-lg border text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                    enabled
                      ? "bg-accent-green/15 border-accent-green text-accent-green"
                      : "bg-bg-dark border-border-base text-text-muted"
                  }`}
                >
                  {enabled ? <Play size={12} /> : <Pause size={12} />}
                  <span>{enabled ? "Habilitado" : "Pausado"}</span>
                </button>
              </div>
            </div>
          </details>

          {/* Inline Diagnostic Test Result (if test executed) */}
          {testingConnection && (
            <div className="p-3 rounded-xl border border-border-base bg-bg-dark/80 text-xs text-text-muted flex items-center gap-2 animate-pulse">
              <Loader2 size={14} className="animate-spin text-accent-green" />
              <span>
                Comprobando conexión con{" "}
                <strong className="text-text-main font-mono">
                  {endpoint || tcpHost}
                </strong>
                …
              </span>
            </div>
          )}

          {testResult && !testingConnection && (
            <div
              className={`p-3 rounded-xl border text-xs space-y-1 ${
                testResult.status === "up"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold">
                  {testResult.status === "up" ? (
                    <CheckCircle2 size={15} className="text-emerald-400" />
                  ) : (
                    <AlertTriangle size={15} className="text-amber-400" />
                  )}
                  <span>
                    {testResult.status === "up"
                      ? "Comprobación exitosa"
                      : "La comprobación falló"}
                  </span>
                </div>
                {testResult.latency_ms != null && (
                  <span className="font-mono text-[11px]">
                    {Math.round(testResult.latency_ms)} ms
                  </span>
                )}
              </div>
              <p className="text-[11px] opacity-90 pl-6">
                {testResult.message ||
                  (testResult.status === "up"
                    ? "El endpoint respondió correctamente según los parámetros definidos."
                    : "No se obtuvo la respuesta esperada. Puedes crear el target de todos modos.")}
              </p>
            </div>
          )}

          {/* Footer Actions */}
          <footer className="pt-3 border-t border-border-base flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testingConnection || runnerType === "agent"}
              className="px-3.5 py-2 rounded-xl border border-border-base bg-bg-dark hover:bg-bg-card-hover text-text-muted hover:text-text-main transition-colors text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40"
              title={
                runnerType === "agent"
                  ? "Las pruebas de red interna se ejecutan directamente en el agente Senti9"
                  : "Probar conexión antes de guardar"
              }
            >
              <Loader2
                size={13}
                className={testingConnection ? "animate-spin" : "hidden"}
              />
              <span>Probar configuración</span>
            </button>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-border-base text-text-muted hover:text-text-main hover:bg-bg-card-hover transition-colors text-xs font-medium"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-accent-green hover:bg-accent-green-glow text-slate-950 text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                {loading && <Loader2 size={13} className="animate-spin" />}
                <span>
                  {target
                    ? "Guardar cambios"
                    : duplicateTarget
                      ? "Crear de todos modos"
                      : "Crear target"}
                </span>
              </button>
            </div>
          </footer>
        </form>
      </ModalSurface>
    </div>,
    document.body,
  );
}
