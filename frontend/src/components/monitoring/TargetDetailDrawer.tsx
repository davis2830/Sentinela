import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  X,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  RefreshCw,
  MoreHorizontal,
  Copy,
  Check,
  Pause,
  Play,
  Pencil,
  Bell,
  Download,
  AlertTriangle,
  Globe,
  Server,
  Lock,
  ShieldCheck,
  Network,
  Waypoints,
  Webhook,
  Cloud,
} from "lucide-react";
import { useConnectivityRefresh } from "../../hooks/useConnectivityRefresh";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import { useAuthStore } from "../../store/authStore";
import { api } from "../../services/api";
import { formatMetric } from "../../utils/endpointPresentation";
import { resourceDate } from "../../utils/resourcePresentation";
import {
  getDownSinceDuration,
  formatShortDiagnostic,
  formatRelativeTime,
  latestTargetCheck,
} from "./TargetLatency";
import UptimeStatusBar from "./UptimeStatusBar";
import type {
  MonitoringTarget,
  MonitoringCheck,
  TimeseriesData,
} from "../../types/monitoring";

const icons: Record<string, typeof Globe> = {
  http: Globe,
  https: ShieldCheck,
  tcp: Network,
  dns: Waypoints,
  api: Webhook,
  ssl: Lock,
};

const states: Record<string, [string, string]> = {
  up: ["Operacional", "success"],
  slow: ["Degradado", "warning"],
  down: ["Caído", "danger"],
  error: ["Error", "danger"],
};

interface Props {
  target: MonitoringTarget;
  targets?: MonitoringTarget[];
  onSelectTarget?: (target: MonitoringTarget) => void;
  onClose: () => void;
  onScan: (target: MonitoringTarget) => void | Promise<unknown>;
  onEdit: (target: MonitoringTarget) => void;
  onAlert: (target: MonitoringTarget) => void;
  onTogglePause?: (target: MonitoringTarget) => void;
  onExport: (id: string, name: string) => void;
  isScanning: boolean;
}

export default function TargetDetailDrawer({
  target,
  targets = [],
  onSelectTarget,
  onClose,
  onScan,
  onEdit,
  onAlert,
  onTogglePause,
  onExport,
  isScanning,
}: Props) {
  const dialogRef = useDialogFocus(true);
  const location = useLocation();
  const organizationId = useAuthStore((s) => s.user?.organization?.id);
  const refresh = useConnectivityRefresh();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Targets navigation
  const currentIndex = useMemo(
    () => targets.findIndex((t) => t.id === target.id),
    [targets, target.id],
  );
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < targets.length - 1;

  const handlePrev = useCallback(() => {
    if (hasPrev && onSelectTarget) {
      onSelectTarget(targets[currentIndex - 1]);
    }
  }, [hasPrev, onSelectTarget, targets, currentIndex]);

  const handleNext = useCallback(() => {
    if (hasNext && onSelectTarget) {
      onSelectTarget(targets[currentIndex + 1]);
    }
  }, [hasNext, onSelectTarget, targets, currentIndex]);

  // Keyboard navigation: Esc to close, ArrowUp/ArrowDown to navigate
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement)?.tagName,
        )
      ) {
        return;
      }
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePrev, handleNext, onClose]);

  // Click outside to close More menu
  useEffect(() => {
    if (!showMoreMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMoreMenu]);

  // Queries
  const telemetry = useQuery<TimeseriesData>({
    queryKey: ["target-timeseries", organizationId, target.id, "24h"],
    queryFn: async () =>
      (
        await api.get(`monitoring/${target.id}/timeseries/`, {
          params: { period: "24h" },
        })
      ).data.data,
    refetchInterval: refresh.refetchInterval,
    refetchOnWindowFocus: false,
  });

  const checks = useQuery<MonitoringCheck[]>({
    queryKey: ["drawer-checks", organizationId, target.id],
    queryFn: async () => {
      const data = (
        await api.get(`monitoring/${target.id}/checks/`, {
          params: { limit: 20 },
        })
      ).data.data;
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: refresh.refetchInterval,
    refetchOnWindowFocus: false,
  });

  const summary = telemetry.isError ? null : telemetry.data?.summary;
  const measured = Boolean(summary && summary.total_checks > 0);
  const guardianPaused =
    target.enabled &&
    target.runner_type === "agent" &&
    target.agent_probe_enabled === false;
  const failedCurrent =
    !guardianPaused && ["down", "error"].includes(target.last_status || "");
  const isSlow = !guardianPaused && target.last_status === "slow";
  const currentMeasured = Boolean(
    target.last_checked_at &&
    Number.isFinite(Date.parse(target.last_checked_at)),
  );

  const [status, tone] = !target.enabled
    ? ["Pausado", "muted"]
    : guardianPaused
      ? ["Pausado: guardián detenido", "muted"]
      : currentMeasured
        ? states[target.last_status || ""] || ["Sin datos", "muted"]
        : ["Sin datos", "muted"];

  const Icon = icons[target.target_type] || Globe;
  const full = ["http", "https"].includes(target.target_type);
  const fullViewUrl = `/monitoring/${target.id}?returnTo=${encodeURIComponent(
    location.pathname + location.search,
  )}`;

  // Last check & error diagnosis extraction
  const firstMonitoringCheck = checks.data?.[0];
  const latestCheck = firstMonitoringCheck || latestTargetCheck(target);
  const checkDetails = (firstMonitoringCheck?.details || {}) as Record<string, unknown>;
  const statusCode: string | undefined =
    typeof checkDetails.status_code === "number" || typeof checkDetails.status_code === "string"
      ? String(checkDetails.status_code)
      : latestCheck?.diagnostic?.match(/HTTP\s*(\d+)/i)?.[1] ||
      (target.expected_status ? String(target.expected_status) : undefined);
  const expectedStatus =
    typeof checkDetails.expected_status === "number" || typeof checkDetails.expected_status === "string"
      ? String(checkDetails.expected_status)
      : String(target.expected_status || 200);
  const redirectCount =
    typeof checkDetails.redirect_count === "number"
      ? checkDetails.redirect_count
      : typeof checkDetails.redirects === "number"
        ? checkDetails.redirects
        : 0;
  const responseTime = latestCheck?.latency ?? target.last_latency;
  const diagnosticMsg =
    latestCheck?.diagnostic ||
    (typeof checkDetails.error === "string" ? checkDetails.error : "") ||
    (typeof checkDetails.error_message === "string" ? checkDetails.error_message : "") ||
    (typeof checkDetails.reason === "string" ? checkDetails.reason : "");

  // Last known healthy latency when down
  const lastHealthyCheck = (target.recent_checks || []).find(
    (c) => ["up", "slow"].includes(c.status) && c.latency != null,
  );
  const lastKnownLatency =
    lastHealthyCheck?.latency != null
      ? formatMetric(lastHealthyCheck.latency)
      : null;
  const lastKnownTimeAgo = lastHealthyCheck
    ? formatRelativeTime(lastHealthyCheck.checked_at)
    : null;

  // Target age calculation for "calculado sobre X h"
  const targetAgeHours = Math.floor(
    (Date.now() - Date.parse(target.created_at)) / (1000 * 60 * 60),
  );

  // Group checks into previous resolved incidents
  const previousIncidents = useMemo(() => {
    if (!checks.data || checks.data.length === 0) return [];
    const list: { startedAt: string; duration: string; reason: string }[] = [];
    const sorted = [...checks.data].sort(
      (a, b) => Date.parse(b.checked_at) - Date.parse(a.checked_at),
    );

    // Skip the current active outage window if currently failed
    let startIdx = 0;
    if (failedCurrent) {
      while (
        startIdx < sorted.length &&
        ["down", "error"].includes(sorted[startIdx].status)
      ) {
        startIdx++;
      }
    }

    let incidentEnd: MonitoringCheck | null = null;
    let incidentStart: MonitoringCheck | null = null;

    for (let i = startIdx; i < sorted.length; i++) {
      const c = sorted[i];
      if (["down", "error"].includes(c.status)) {
        if (!incidentEnd) incidentEnd = c;
        incidentStart = c;
      } else if (incidentEnd && incidentStart) {
        const diffMs = Math.max(
          60000,
          Date.parse(incidentEnd.checked_at) -
          Date.parse(incidentStart.checked_at),
        );
        const mins = Math.max(1, Math.round(diffMs / 60000));
        list.push({
          startedAt: resourceDate(incidentStart.checked_at),
          duration: `${mins} min`,
          reason:
            formatShortDiagnostic(incidentStart.diagnostic || "") ||
            "Fallo de conexión",
        });
        incidentEnd = null;
        incidentStart = null;
        if (list.length >= 2) break;
      }
    }

    return list;
  }, [checks.data, failedCurrent]);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(target.endpoint);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleCopyBody = async () => {
    try {
      const textToCopy =
        typeof checkDetails.body === "string"
          ? checkDetails.body
          : typeof checkDetails.response_body === "string"
            ? checkDetails.response_body
            : JSON.stringify(checkDetails, null, 2);
      await navigator.clipboard.writeText(textToCopy);
      setCopiedBody(true);
      setTimeout(() => setCopiedBody(false), 2000);
    } catch {
      // fallback
    }
  };

  const content = (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-end animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={target.name}
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-[540px] h-full bg-bg-card border-l border-border-base flex flex-col overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Sticky Header: Name, state badge, URL & navigation */}
        <header className="sticky top-0 z-20 bg-bg-dark/95 backdrop-blur-md border-b border-border-base p-4 space-y-2">
          {/* Line 1: Icon + Name + Badge on left, Nav + Fullscreen + Close on right */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Icon size={18} className="text-text-muted shrink-0" />
              <h2
                className="text-base font-bold text-text-main truncate"
                title={target.name}
              >
                {target.name}
              </h2>
              <span
                className="ui-status shrink-0 text-xs px-2 py-0.5"
                data-tone={tone}
              >
                {status}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0 text-text-muted">
              <button
                type="button"
                className="p-1.5 rounded-lg hover:bg-bg-card-hover hover:text-text-main transition-colors disabled:opacity-30 disabled:pointer-events-none"
                onClick={handlePrev}
                disabled={!hasPrev}
                title="Target anterior (↑)"
                aria-label="Target anterior"
              >
                <ChevronUp size={18} />
              </button>
              <button
                type="button"
                className="p-1.5 rounded-lg hover:bg-bg-card-hover hover:text-text-main transition-colors disabled:opacity-30 disabled:pointer-events-none"
                onClick={handleNext}
                disabled={!hasNext}
                title="Target siguiente (↓)"
                aria-label="Target siguiente"
              >
                <ChevronDown size={18} />
              </button>
              {full && (
                <Link
                  to={fullViewUrl}
                  className="p-1.5 rounded-lg hover:bg-bg-card-hover hover:text-text-main transition-colors"
                  title="Abrir vista completa (⤢)"
                  aria-label="Abrir vista completa"
                >
                  <ExternalLink size={18} />
                </Link>
              )}
              <button
                type="button"
                className="p-1.5 rounded-lg hover:bg-bg-card-hover hover:text-text-main transition-colors ml-1"
                onClick={onClose}
                title="Cerrar (Esc)"
                aria-label="Cerrar panel"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Line 2: URL or Endpoint */}
          <div className="flex items-center gap-1.5 min-w-0">
            <a
              href={
                target.endpoint.startsWith("http")
                  ? target.endpoint
                  : `https://${target.endpoint}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-text-muted hover:text-text-main truncate transition-colors flex items-center gap-1 max-w-full"
              title={`Abrir ${target.endpoint}`}
            >
              <span className="truncate">{target.endpoint}</span>
              <ExternalLink size={11} className="shrink-0 opacity-60" />
            </a>
          </div>

          {/* Line 3: Single-line Metadata & ⋯ Menu inline */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="text-[11px] text-text-muted flex flex-wrap items-center gap-1.5 min-w-0">
              <span className="inline-flex items-center gap-1 uppercase font-semibold tracking-wider text-text-main">
                <Icon size={12} className="shrink-0" />
                <span>{target.target_type}</span>
              </span>
              <span>·</span>
              <span>Cada {target.interval} s</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                {target.runner_type === "agent" ? (
                  <>
                    <Server size={11} className="text-emerald-400 shrink-0" />
                    <span>Senti9: {target.agent_probe_name || "Agente"}</span>
                  </>
                ) : (
                  <>
                    <Cloud size={11} className="text-accent-cyan shrink-0" />
                    <span>Cloud</span>
                  </>
                )}
              </span>
              {target.tags && target.tags.length > 0 && (
                <>
                  <span>·</span>
                  <span className="truncate text-text-muted">
                    {target.tags
                      .map((t) => t.replace(/^Senti9:\s*/, ""))
                      .join(", ")}
                  </span>
                </>
              )}
            </div>

            {/* ⋯ More Menu directly next to tags */}
            <div className="relative shrink-0" ref={menuRef}>
              <button
                type="button"
                onClick={() => setShowMoreMenu((prev) => !prev)}
                className="p-1 rounded-lg border border-border-base text-text-muted hover:text-text-main hover:bg-bg-card-hover transition-colors"
                title="Más acciones"
                aria-label="Más acciones"
              >
                <MoreHorizontal size={15} />
              </button>

              {showMoreMenu && (
                <div className="absolute right-0 top-full mt-1 z-30 min-w-[190px] rounded-xl border border-border-base bg-bg-dark shadow-2xl p-1 text-xs text-text-main space-y-0.5 animate-in fade-in duration-100">
                  <button
                    type="button"
                    onClick={() => {
                      onScan(target);
                      setShowMoreMenu(false);
                    }}
                    disabled={isScanning}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-bg-card-hover transition-colors text-left text-emerald-400 font-medium disabled:opacity-50"
                  >
                    <RefreshCw
                      size={14}
                      className={isScanning ? "animate-spin" : ""}
                    />
                    <span>{isScanning ? "Comprobando…" : "Comprobar ahora"}</span>
                  </button>

                  {full && (
                    <a
                      href={
                        target.endpoint.startsWith("http")
                          ? target.endpoint
                          : `https://${target.endpoint}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-bg-card-hover transition-colors"
                      onClick={() => setShowMoreMenu(false)}
                    >
                      <ExternalLink size={14} className="text-text-muted" />
                      <span>Abrir URL</span>
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      handleCopyUrl();
                      setShowMoreMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-bg-card-hover transition-colors text-left"
                  >
                    {copiedUrl ? (
                      <Check size={14} className="text-emerald-400" />
                    ) : (
                      <Copy size={14} className="text-text-muted" />
                    )}
                    <span>{copiedUrl ? "¡URL copiada!" : "Copiar URL"}</span>
                  </button>

                  {onTogglePause && (
                    <button
                      type="button"
                      onClick={() => {
                        onTogglePause(target);
                        setShowMoreMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-bg-card-hover transition-colors text-left"
                    >
                      {target.enabled ? (
                        <>
                          <Pause size={14} className="text-amber-400" />
                          <span>Pausar monitoreo</span>
                        </>
                      ) : (
                        <>
                          <Play size={14} className="text-emerald-400" />
                          <span>Reanudar monitoreo</span>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      onEdit(target);
                      setShowMoreMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-bg-card-hover transition-colors text-left"
                  >
                    <Pencil size={14} className="text-text-muted" />
                    <span>Editar target</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onAlert(target);
                      setShowMoreMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-bg-card-hover transition-colors text-left"
                  >
                    <Bell size={14} className="text-text-muted" />
                    <span>Crear alerta</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onExport(target.id, target.name);
                      setShowMoreMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-bg-card-hover transition-colors text-left"
                  >
                    <Download size={14} className="text-text-muted" />
                    <span>Exportar CSV</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Drawer Scrollable Content */}
        <div className="p-4 space-y-4 flex-1">
          {/* 2. Banner de incidente como elemento principal */}
          {failedCurrent && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300 space-y-1.5 shadow-sm">
              <div className="flex items-center gap-2 font-semibold text-rose-400 text-sm">
                <AlertTriangle size={16} className="shrink-0 text-rose-400" />
                <span>Caído desde hace {getDownSinceDuration(target)}</span>
              </div>
              <p className="text-text-dim text-xs pl-6 flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-rose-300 font-semibold">
                  {statusCode
                    ? `HTTP ${statusCode} (esperado ${expectedStatus})`
                    : diagnosticMsg || "Comprobación fallida"}
                </span>
                <span>·</span>
                <span>{summary?.down_checks ?? 1} fallos registrados</span>
              </p>
            </div>
          )}

          {isSlow && !failedCurrent && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-300 space-y-1 shadow-sm">
              <div className="flex items-center gap-2 font-semibold text-amber-400 text-sm">
                <AlertTriangle size={16} className="shrink-0 text-amber-400" />
                <span>Respuesta lenta registrada</span>
              </div>
              <p className="text-text-dim text-xs pl-6">
                Latencia actual:{" "}
                {target.last_latency != null
                  ? `${formatMetric(target.last_latency)} ms`
                  : "—"}{" "}
                · Límite:{" "}
                {target.max_latency_ms != null
                  ? `${formatMetric(target.max_latency_ms)} ms`
                  : "Sin configurar"}
              </p>
            </div>
          )}

          {/* 4. KPIs reducidos a 3 y más compactos */}
          <div className="grid grid-cols-3 gap-2">
            {/* 1. Disponibilidad */}
            <div className="rounded-xl border border-border-base bg-bg-dark/70 p-3 flex flex-col justify-between shadow-sm">
              <span className="text-[11px] text-text-muted font-medium">
                Disp. 24h
              </span>
              <div className="mt-1">
                <span
                  className={`text-lg font-bold font-mono ${summary?.uptime_percentage != null
                    ? summary.uptime_percentage >= 99
                      ? "text-emerald-400"
                      : summary.uptime_percentage >= 95
                        ? "text-amber-400"
                        : "text-rose-400"
                    : "text-text-muted"
                    }`}
                >
                  {measured && summary?.uptime_percentage != null
                    ? `${formatMetric(summary.uptime_percentage, 2)} %`
                    : "—"}
                </span>
              </div>
              <span className="text-[10px] text-text-dim mt-0.5">
                {targetAgeHours < 24 && targetAgeHours >= 0
                  ? `calculado sobre ${Math.max(1, targetAgeHours)} h`
                  : "Últimas 24 h"}
              </span>
            </div>

            {/* 2. Última latencia */}
            <div className="rounded-xl border border-border-base bg-bg-dark/70 p-3 flex flex-col justify-between shadow-sm">
              <span className="text-[11px] text-text-muted font-medium">
                Última lat.
              </span>
              <div className="mt-1">
                <span className="text-lg font-bold font-mono text-text-main">
                  {failedCurrent
                    ? lastKnownLatency
                      ? `${lastKnownLatency} ms`
                      : "—"
                    : currentMeasured &&
                      target.last_latency != null &&
                      target.last_latency >= 0
                      ? `${formatMetric(target.last_latency)} ms`
                      : "—"}
                </span>
              </div>
              <span
                className="text-[10px] text-text-dim mt-0.5 truncate"
                title={`Límite: ${target.max_latency_ms || 2000} ms`}
              >
                {failedCurrent && lastKnownTimeAgo
                  ? `hace ${lastKnownTimeAgo.replace(/^caído\s*/, "")}`
                  : `Límite: ${target.max_latency_ms || 2000} ms`}
              </span>
            </div>

            {/* 3. Incidentes */}
            <div className="rounded-xl border border-border-base bg-bg-dark/70 p-3 flex flex-col justify-between shadow-sm">
              <span className="text-[11px] text-text-muted font-medium">
                Incidentes
              </span>
              <div className="mt-1">
                <span
                  className={`text-lg font-bold font-mono ${summary?.incidents_count || failedCurrent
                    ? "text-rose-400"
                    : "text-text-main"
                    }`}
                >
                  {summary?.incidents_count != null
                    ? formatMetric(summary.incidents_count)
                    : failedCurrent
                      ? 1
                      : 0}
                </span>
              </div>
              <span className="text-[10px] text-text-dim mt-0.5">
                {failedCurrent ? "1 activo" : "Últimas 24 h"}
              </span>
            </div>
          </div>

          {/* 5. Gráfica de curva reemplazada por barra de estado (Uptime Bar 24h) */}
          <UptimeStatusBar
            timeseries={telemetry.data?.timeseries || []}
            summary={summary}
            targetCreatedAt={target.created_at}
            isLoading={telemetry.isLoading}
          />

          {/* 7. Diagnóstico del fallo útil y plegable */}
          {failedCurrent && (
            <details
              open={true}
              className="rounded-xl border border-border-base bg-bg-dark/60 p-3.5 text-xs group"
            >
              <summary className="font-semibold text-sm cursor-pointer select-none flex items-center justify-between text-text-main hover:text-white transition-colors">
                <span className="flex items-center gap-2">
                  <span className="text-text-muted group-open:rotate-90 transition-transform">
                    ▸
                  </span>
                  <span>Diagnóstico del último fallo</span>
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  {statusCode ? `${statusCode} ≠ ${expectedStatus}` : "Fallo"}
                </span>
              </summary>

              <div className="mt-3.5 pt-3 border-t border-border-base space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-bg-card p-2 border border-border-base">
                    <span className="block text-[10px] text-text-muted">
                      Código HTTP
                    </span>
                    <strong className="text-rose-400 font-mono text-sm">
                      {statusCode || "—"}
                    </strong>
                  </div>
                  <div className="rounded-lg bg-bg-card p-2 border border-border-base">
                    <span className="block text-[10px] text-text-muted">
                      Redirecciones
                    </span>
                    <strong className="text-text-main font-mono text-sm">
                      {redirectCount}
                    </strong>
                  </div>
                  <div className="rounded-lg bg-bg-card p-2 border border-border-base">
                    <span className="block text-[10px] text-text-muted">
                      Tiempo resp.
                    </span>
                    <strong className="text-text-main font-mono text-sm">
                      {responseTime != null
                        ? `${formatMetric(responseTime)} ms`
                        : "—"}
                    </strong>
                  </div>
                </div>

                {diagnosticMsg && (
                  <div className="rounded-lg bg-rose-950/20 border border-rose-900/30 p-2.5">
                    <span className="text-[10px] text-rose-400 block font-semibold mb-1">
                      Mensaje / Diagnóstico
                    </span>
                    <p className="font-mono text-xs text-rose-300 break-words">
                      {diagnosticMsg}
                    </p>
                  </div>
                )}

                {/* Response snippet & copy button */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-text-muted font-medium">
                      Parámetros de respuesta
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyBody}
                      className="text-[11px] text-accent-cyan hover:underline inline-flex items-center gap-1"
                    >
                      {copiedBody ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedBody ? "¡Copiado!" : "Copiar"}</span>
                    </button>
                  </div>
                  <pre className="p-2.5 rounded-lg bg-bg-dark border border-border-base font-mono text-[11px] text-text-main overflow-x-auto max-h-36">
                    {typeof checkDetails.body === "string"
                      ? checkDetails.body
                      : typeof checkDetails.response_body === "string"
                        ? checkDetails.response_body
                        : JSON.stringify(checkDetails, null, 2)}
                  </pre>
                </div>
              </div>
            </details>
          )}

          {/* 6. Incidentes en lugar de comprobaciones repetidas */}
          <section aria-label="Incidentes" className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-text-main">
                Incidentes
              </h3>
              {full && (
                <Link
                  className="text-xs text-accent-cyan hover:underline"
                  to={`${fullViewUrl}&tab=availability`}
                >
                  Ver historial →
                </Link>
              )}
            </div>

            <div className="space-y-2">
              {failedCurrent && (
                <div className="rounded-xl border border-rose-500/25 bg-rose-500/5 p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30">
                        Actual
                      </span>
                      <span className="text-text-main font-medium">
                        Desde{" "}
                        {resourceDate(
                          target.down_since || target.last_checked_at,
                        )}
                      </span>
                    </div>
                    <strong className="text-rose-400 font-mono text-xs">
                      {getDownSinceDuration(target)}
                    </strong>
                  </div>
                  <p className="text-text-muted text-[11px]">
                    Causa:{" "}
                    <span className="text-rose-300 font-mono">
                      {formatShortDiagnostic(diagnosticMsg) || "HTTP 404"}
                    </span>
                  </p>
                </div>
              )}

              {previousIncidents.map((inc, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border-base bg-bg-dark/50 p-3 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-bg-card-hover text-text-muted border border-border-base">
                        Anterior
                      </span>
                      <span className="text-text-main font-medium">
                        {inc.startedAt}
                      </span>
                    </div>
                    <span className="font-mono text-text-main text-xs">
                      {inc.duration}
                    </span>
                  </div>
                  <p className="text-text-muted text-[11px]">
                    Causa: <span className="text-text-main">{inc.reason}</span>
                  </p>
                </div>
              ))}

              {!failedCurrent && previousIncidents.length === 0 && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-300 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  <span>
                    Sin incidentes en las últimas 24 horas · 100% operativo
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* 8. Pie mínimo */}
          <footer className="pt-4 border-t border-border-base/30 text-center text-xs text-text-muted">
            Última comprobación {resourceDate(target.last_checked_at)} · origen{" "}
            {target.runner_type === "agent"
              ? `Senti9: ${target.agent_probe_name || "Agente"}`
              : "cloud"}
          </footer>
        </div>
      </div>
    </div>
  );

  return typeof document === "undefined"
    ? null
    : createPortal(content, document.body);
}
