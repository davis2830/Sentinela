import { Fragment, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Terminal,
  Trash2,
  XCircle,
} from "lucide-react";
import { useCapability } from "../../hooks/useCapability";
import { useConnectivityRefresh } from "../../hooks/useConnectivityRefresh";
import { api } from "../../services/api";
import type { APICheckResult, APICheckTarget } from "../../types/api_checks";
import { healthPalette } from "../../utils/healthPresentation";
import AdminButton from "../common/AdminButton";
import RelativeTime from "../common/connectivity/RelativeTime";
import ResourceDetailDrawer from "../common/connectivity/ResourceDetailDrawer";
import {
  API_STATE_META,
  buildSafeCurl,
  formatApiInterval,
  formatResultStatusEs,
  getAPICheckHealthState,
  getApiFailureReason,
  getLatencyOwnColor,
  getMethodBadgeClass,
  stripProtocol,
} from "./useAPIChecks";

export interface APICheckDetailDrawerProps {
  target: APICheckTarget | null;
  targets: APICheckTarget[];
  onSelectTarget: (target: APICheckTarget) => void;
  onClose: () => void;
  onScan: (id: string) => Promise<unknown>;
  isScanning: boolean;
  onEdit: (target: APICheckTarget) => void;
  onDelete: (target: APICheckTarget) => void;
}

function formatCooldownMMSS(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, "0")}`;
}

function LatencyThresholdChart({
  results,
  limitMs,
}: {
  results: APICheckResult[];
  limitMs: number;
}) {
  const points = [...results]
    .reverse()
    .filter((r) => r.response_time_ms !== null && r.response_time_ms !== undefined)
    .slice(-24);

  if (points.length === 0) return null;

  const width = 460;
  const height = 92;
  const padX = 8;
  const padY = 12;
  const maxVal = Math.max(
    limitMs * 1.15,
    ...points.map((p) => p.response_time_ms || 0),
    100,
  );
  const toY = (v: number) =>
    height - padY - (v / maxVal) * (height - padY * 2);
  const toX = (i: number) =>
    points.length === 1
      ? width / 2
      : padX + (i / (points.length - 1)) * (width - padX * 2);

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(p.response_time_ms || 0).toFixed(1)}`)
    .join(" ");
  const limitY = toY(limitMs);

  return (
    <div className="rounded-xl border border-border-base/70 bg-bg-dark/70 p-3 space-y-2">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-medium text-text-muted">
          Latencia reciente ({points.length} ejecuciones)
        </span>
        <span className="font-mono text-text-dim">
          límite {limitMs} ms
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-24 overflow-visible"
        role="img"
        aria-label="Gráfica de latencia reciente con línea de límite"
      >
        {/* Dashed threshold line */}
        <line
          x1={padX}
          x2={width - padX}
          y1={limitY}
          y2={limitY}
          stroke="rgba(251, 191, 36, 0.55)"
          strokeDasharray="4 4"
          strokeWidth="1.2"
        />
        <text
          x={width - padX}
          y={Math.max(10, limitY - 4)}
          textAnchor="end"
          fill="rgba(251, 191, 36, 0.85)"
          fontSize="9"
          fontFamily="monospace"
        >
          {limitMs} ms
        </text>

        {/* Latency line */}
        {points.length > 1 && (
          <path
            d={linePath}
            fill="none"
            stroke="rgba(52, 211, 153, 0.85)"
            strokeWidth="1.8"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Data dots colored by own latency & status */}
        {points.map((p, i) => {
          const val = p.response_time_ms || 0;
          const cx = toX(i);
          const cy = toY(val);
          const fill =
            p.status === "fail" || p.status === "error" || val > limitMs
              ? "#fb7185"
              : p.status === "slow" || p.status === "rate_limited"
                ? "#fbbf24"
                : "#34d399";
          return (
            <circle key={p.id} cx={cx} cy={cy} r="3" fill={fill}>
              <title>
                {`${formatResultStatusEs(p.status)} · ${Math.round(val)} ms · HTTP ${p.http_status ?? "—"}`}
              </title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
}

export default function APICheckDetailDrawer({
  target,
  targets,
  onSelectTarget,
  onClose,
  onScan,
  isScanning,
  onEdit,
  onDelete,
}: APICheckDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<"results" | "config">("results");
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const autoRefresh = useConnectivityRefresh();
  const canScan = useCapability("api_checks.scan");
  const canDelete = useCapability("api_checks.delete");

  const retrySeconds =
    target?.scan_availability?.status === "cooldown"
      ? target.scan_availability.retry_after_seconds || 0
      : 0;

  useEffect(() => {
    setCooldownLeft(retrySeconds);
  }, [retrySeconds, target?.id]);

  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownLeft]);

  useEffect(() => {
    setExpandedRowId(null);
    setMenuOpen(false);
  }, [target?.id]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [menuOpen]);

  const { data: results, isLoading: isLoadingResults } = useQuery({
    queryKey: ["api-check-results", target?.id],
    queryFn: async () => {
      if (!target) return [];
      const response = await api.get(`api-checks/${target.id}/results/`);
      return (response.data?.data || []) as APICheckResult[];
    },
    enabled: Boolean(target),
    refetchInterval: autoRefresh.refetchInterval,
  });

  if (!target) return null;

  const state = getAPICheckHealthState(target);
  const meta = API_STATE_META[state];
  const failureReason = getApiFailureReason(target);
  const consecutive = target.consecutive_failures || 0;
  const currentIdx = targets.findIndex((t) => t.id === target.id);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx >= 0 && currentIdx < targets.length - 1;
  const goPrev = () => {
    if (hasPrev) onSelectTarget(targets[currentIdx - 1]);
  };
  const goNext = () => {
    if (hasNext) onSelectTarget(targets[currentIdx + 1]);
  };

  const curlCommand = buildSafeCurl(target);
  const cleanUrl = stripProtocol(target.url);
  const schemaEntries = Object.entries(target.expected_schema || {});
  const latestResult = results?.[0];
  const latestFailureMap = new Map(
    (latestResult?.schema_failures || target.last_schema_failures || []).map(
      (f) => [f.field, f],
    ),
  );
  const destinations = target.alert_summary?.destinations || [];
  const alertAfter = target.alert_after_failures ?? 2;

  const scanBlockedByCooldown = cooldownLeft > 0;
  const scanBlockedByStatus =
    target.scan_availability?.status === "disabled" ||
    target.scan_availability?.status === "pending" ||
    target.scan_availability?.status === "read_only" ||
    target.scan_availability?.status === "subscription_required";
  const scanDisabled =
    isScanning || scanBlockedByCooldown || scanBlockedByStatus;

  const handleCopyCurl = async () => {
    try {
      await navigator.clipboard.writeText(curlCommand);
      setCopiedCurl(true);
    } catch {
      setCopiedCurl(false);
    }
    setTimeout(() => setCopiedCurl(false), 1800);
  };

  return (
    <ResourceDetailDrawer
      focusKey={target.id}
      ariaLabel={`Detalle del endpoint ${target.name}`}
      title={target.name}
      status={{
        label: meta.label,
        tone: meta.tone,
        shape: meta.shape,
        iconClassName: meta.textClass,
      }}
      hasPrev={hasPrev}
      hasNext={hasNext}
      onPrev={goPrev}
      onNext={goNext}
      prevLabel="Endpoint anterior"
      nextLabel="Siguiente endpoint"
      onEscapeIntercept={() => {
        if (!menuOpen) return false;
        setMenuOpen(false);
        return true;
      }}
      onClose={onClose}
      headerExtra={
        <>
          {/* Row 2: Neutral METHOD + stripped host/path ↗ · cada X min */}
          <div className="flex items-center gap-1.5 text-xs font-mono text-text-muted min-w-0">
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border shrink-0 leading-none ${getMethodBadgeClass()}`}
            >
              {target.method}
            </span>
            <a
              href={target.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-text-main hover:text-accent-green transition-colors truncate min-w-0"
              title={target.url}
            >
              <span className="truncate">{cleanUrl}</span>
              <ExternalLink size={11} className="text-text-dim shrink-0" />
            </a>
            <span aria-hidden="true" className="text-text-dim shrink-0">
              ·
            </span>
            <span className="text-text-dim shrink-0">
              {formatApiInterval(target.check_interval)}
            </span>
          </div>

          {/* Row 3: [Comprobar ahora · 2:12] [Editar] ... [⋯] */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              {canScan && (
                <button
                  type="button"
                  disabled={scanDisabled}
                  onClick={(e) => {
                    if (e.detail > 0) e.currentTarget.blur();
                    void onScan(target.id);
                  }}
                  className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-accent-green text-black font-semibold text-xs hover:bg-accent-green/90 disabled:opacity-55 disabled:cursor-not-allowed transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green/60 !min-h-0"
                  title={
                    scanBlockedByCooldown
                      ? `Disponible en ${formatCooldownMMSS(cooldownLeft)}`
                      : "Ejecutar comprobación ahora"
                  }
                >
                  <RefreshCw
                    size={13}
                    className={isScanning ? "animate-spin" : ""}
                  />
                  <span>
                    {isScanning
                      ? "Comprobando..."
                      : scanBlockedByCooldown
                        ? `Comprobar ahora · ${formatCooldownMMSS(cooldownLeft)}`
                        : "Comprobar ahora"}
                  </span>
                </button>
              )}

              <AdminButton
                capability="api_checks.update"
                type="button"
                onClick={(e) => {
                  if (e.detail > 0) e.currentTarget.blur();
                  onEdit(target);
                }}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-border-base bg-bg-card text-text-main hover:border-accent-green/50 hover:text-accent-green text-xs font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green/60 !min-h-0"
              >
                <Pencil size={12} />
                <span>Editar</span>
              </AdminButton>
            </div>

            {/* Overflow Menu (Copiar cURL, Eliminar) */}
            <div ref={menuRef} className="relative shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  if (e.detail > 0) e.currentTarget.blur();
                  setMenuOpen((prev) => !prev);
                }}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Más acciones del endpoint"
                className="h-8 w-8 grid place-items-center rounded-full border border-border-base bg-bg-card text-text-muted hover:text-text-main hover:bg-bg-card-hover cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green/60 !min-h-0 !min-w-0"
              >
                <MoreHorizontal size={15} />
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-9 z-50 w-48 rounded-xl border border-border-accent/70 bg-bg-dark p-1 shadow-2xl text-xs"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      void handleCopyCurl();
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-text-main hover:bg-bg-card-hover cursor-pointer !min-h-0"
                  >
                    <Copy size={13} className="text-sky-400 shrink-0" />
                    <span>Copiar cURL</span>
                  </button>
                  {canDelete && (
                    <>
                      <div className="my-1 border-t border-border-base/70" />
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          onDelete(target);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-rose-400 hover:bg-rose-500/15 cursor-pointer !min-h-0"
                      >
                        <Trash2 size={13} className="shrink-0" />
                        <span>Eliminar endpoint</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Two clean tabs: Resultados | Configuración */}
          <div
            role="tablist"
            className="grid grid-cols-2 gap-1 rounded-xl bg-bg-card border border-border-base/70 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "results"}
              onClick={(e) => {
                if (e.detail > 0) e.currentTarget.blur();
                setActiveTab("results");
              }}
              className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green/60 !min-h-0 ${
                activeTab === "results"
                  ? "bg-accent-green/15 text-accent-green font-semibold"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              Resultados
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "config"}
              onClick={(e) => {
                if (e.detail > 0) e.currentTarget.blur();
                setActiveTab("config");
              }}
              className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green/60 !min-h-0 ${
                activeTab === "config"
                  ? "bg-accent-green/15 text-accent-green font-semibold"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              Configuración
            </button>
          </div>
        </>
      }
      footer={
        <>
          Último chequeo{" "}
          <RelativeTime
            value={target.last_checked_at}
            emptyLabel="sin ejecutar"
            className="text-text-muted"
          />{" "}
          · origen {target.scan_availability?.measurement?.origin || "cloud"}
        </>
      }
    >
      {/* Active Failure / Rate Limit / Slow Callout */}
      {failureReason && (
        <div
          className={`rounded-xl border px-3.5 py-2.5 text-xs flex items-start gap-2 ${
            state === "fail"
              ? "border-rose-500/35 bg-rose-500/10 text-rose-200"
              : "border-amber-500/35 bg-amber-500/10 text-amber-200"
          }`}
        >
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <div className="min-w-0 font-mono text-[11px] leading-relaxed">
            {target.failing_since ? (
              <>
                Fallando desde{" "}
                <RelativeTime
                  value={target.failing_since}
                  className="font-semibold"
                />
                {" · "}
              </>
            ) : null}
            <span className="font-semibold">{failureReason}</span>
            {consecutive >= 2 ? ` · ${consecutive} seguidos` : ""}
          </div>
        </div>
      )}

      {/* TAB 1: RESULTADOS */}
      {activeTab === "results" && (
        <div className="space-y-4 font-sans">
          {/* 3 Real Result KPIs (24h) */}
          <div className="grid grid-cols-3 gap-2.5 text-xs">
            <div className="rounded-xl border border-border-base/70 bg-bg-dark/70 px-3 py-2.5">
              <div className="text-[11px] text-text-dim">Disp. 24 h</div>
              <div className="text-base font-bold font-mono text-text-main mt-0.5 tabular-nums">
                {target.uptime_24h !== null && target.uptime_24h !== undefined
                  ? `${target.uptime_24h}%`
                  : "—"}
              </div>
            </div>

            <div className="rounded-xl border border-border-base/70 bg-bg-dark/70 px-3 py-2.5">
              <div className="text-[11px] text-text-dim">Latencia p95</div>
              <div
                className={`text-base font-bold font-mono mt-0.5 tabular-nums ${getLatencyOwnColor(
                  target.p95_latency_24h,
                  target.expected_response_time_ms,
                )}`}
              >
                {target.p95_latency_24h !== null &&
                target.p95_latency_24h !== undefined
                  ? `${Math.round(target.p95_latency_24h)} ms`
                  : "—"}
              </div>
            </div>

            <div className="rounded-xl border border-border-base/70 bg-bg-dark/70 px-3 py-2.5">
              <div className="text-[11px] text-text-dim">Fallos 24 h</div>
              <div
                className={`text-base font-bold font-mono mt-0.5 tabular-nums ${
                  (target.failures_24h || 0) > 0
                    ? "text-rose-400"
                    : "text-text-main"
                }`}
              >
                {target.checks_24h ? (target.failures_24h ?? 0) : "—"}
              </div>
            </div>
          </div>

          {/* Latency Sparkline Chart with Limit Line */}
          {results && results.length > 0 && (
            <LatencyThresholdChart
              results={results}
              limitMs={target.expected_response_time_ms}
            />
          )}

          {/* Expandable Recent Verifications */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-text-muted">
                Verificaciones recientes
              </h3>
              <span className="text-[11px] text-text-dim font-mono">
                {results?.length || 0} registros · haz clic para inspeccionar
              </span>
            </div>

            {isLoadingResults ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="animate-spin text-accent-green" size={24} />
              </div>
            ) : results && results.length > 0 ? (
              <div className="bg-bg-dark/80 border border-border-base rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border-base text-text-dim text-[11px] bg-bg-card/80">
                      <th className="py-2 px-2.5">Hora</th>
                      <th className="py-2 px-2">Estado</th>
                      <th className="py-2 px-2">HTTP</th>
                      <th className="py-2 px-2">Latencia</th>
                      <th
                        className="py-2 px-2 text-center"
                        title="JSON · Schema · Headers"
                      >
                        J · S · H
                      </th>
                      <th className="py-2 px-2 w-6" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-base/40 font-mono">
                    {results.map((res) => {
                      const isExpanded = expandedRowId === res.id;
                      const isBad = res.status !== "pass";
                      const statusTone =
                        res.status === "pass"
                          ? "text-emerald-400"
                          : res.status === "slow" ||
                              res.status === "rate_limited"
                            ? "text-amber-400"
                            : "text-rose-400";

                      return (
                        <Fragment key={res.id}>
                          <tr
                            onClick={() =>
                              setExpandedRowId(isExpanded ? null : res.id)
                            }
                            className={`cursor-pointer transition-colors ${
                              isExpanded
                                ? "bg-bg-card/80"
                                : "hover:bg-bg-card-hover/70"
                            }`}
                          >
                            <td className="py-2 px-2.5 text-text-muted text-[11px] whitespace-nowrap">
                              {new Date(res.checked_at).toLocaleTimeString(
                                "es-ES",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                },
                              )}
                            </td>
                            <td
                              className={`py-2 px-2 text-[11px] font-sans font-semibold ${statusTone}`}
                            >
                              {formatResultStatusEs(res.status)}
                            </td>
                            <td className="py-2 px-2 text-[11px] text-text-main tabular-nums">
                              {res.http_status ?? "—"}
                            </td>
                            <td
                              className={`py-2 px-2 text-[11px] tabular-nums ${getLatencyOwnColor(
                                res.response_time_ms,
                                target.expected_response_time_ms,
                              )}`}
                            >
                              {res.response_time_ms !== null
                                ? `${Math.round(res.response_time_ms)} ms`
                                : "—"}
                            </td>
                            <td className="py-2 px-2">
                              <div className="flex items-center justify-center gap-1.5">
                                {[
                                  { val: res.json_valid, label: "JSON" },
                                  { val: res.schema_valid, label: "Schema" },
                                  { val: res.headers_valid, label: "Headers" },
                                ].map((chk) =>
                                  chk.val === true ? (
                                    <CheckCircle2
                                      key={chk.label}
                                      size={12}
                                      className={healthPalette.success.text}
                                      aria-label={`${chk.label} correcto`}
                                    />
                                  ) : chk.val === false ? (
                                    <XCircle
                                      key={chk.label}
                                      size={12}
                                      className={healthPalette.danger.text}
                                      aria-label={`${chk.label} fallido`}
                                    />
                                  ) : (
                                    <span
                                      key={chk.label}
                                      className="text-text-dim text-[10px]"
                                      title={`${chk.label}: no aplica`}
                                    >
                                      ·
                                    </span>
                                  ),
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-2 text-text-dim">
                              {isExpanded ? (
                                <ChevronDown size={13} />
                              ) : (
                                <ChevronRight
                                  size={13}
                                  className={isBad ? "text-text-muted" : "opacity-50"}
                                />
                              )}
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr className="bg-bg-card/60">
                              <td colSpan={6} className="p-3 space-y-2.5 font-sans">
                                {res.error_message && (
                                  <div className="text-xs text-rose-300 font-mono">
                                    Error: {res.error_message}
                                  </div>
                                )}

                                {res.http_status != null &&
                                  res.http_status !== target.expected_status && (
                                    <div className="text-xs text-rose-300 font-mono">
                                      HTTP {res.http_status} ≠ esperado{" "}
                                      {target.expected_status}
                                    </div>
                                  )}

                                {!!res.schema_failures?.length && (
                                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 space-y-1 text-[11px]">
                                    <div className="font-semibold text-rose-300">
                                      Contrato Schema roto:
                                    </div>
                                    {res.schema_failures.map((f) => (
                                      <div
                                        key={f.field}
                                        className="font-mono text-text-main"
                                      >
                                        <span className="text-rose-300">
                                          &quot;{f.field}&quot;
                                        </span>{" "}
                                        esperado{" "}
                                        <span className="text-emerald-300">
                                          {f.expected}
                                        </span>
                                        , recibido{" "}
                                        <span className="text-amber-300">
                                          {f.received}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {res.response_preview && (
                                  <div className="space-y-1">
                                    <div className="text-[11px] font-medium text-text-muted">
                                      Respuesta (enmascarada, máx. 2 KB)
                                    </div>
                                    <pre className="max-h-44 overflow-auto rounded-lg border border-border-base/70 bg-bg-dark p-2.5 text-[11px] font-mono text-text-muted whitespace-pre-wrap break-all">
                                      {res.response_preview}
                                    </pre>
                                  </div>
                                )}

                                {res.response_headers &&
                                  Object.keys(res.response_headers).length >
                                    0 && (
                                    <details className="text-[11px]">
                                      <summary className="cursor-pointer text-text-muted hover:text-text-main select-none">
                                        Headers de respuesta (
                                        {Object.keys(res.response_headers).length}
                                        )
                                      </summary>
                                      <div className="mt-1.5 max-h-32 overflow-auto rounded-lg border border-border-base/60 bg-bg-dark p-2 font-mono text-[10px] space-y-0.5 text-text-dim">
                                        {Object.entries(
                                          res.response_headers,
                                        ).map(([k, v]) => (
                                          <div key={k} className="truncate">
                                            <span className="text-text-muted">
                                              {k}:
                                            </span>{" "}
                                            {v}
                                          </div>
                                        ))}
                                      </div>
                                    </details>
                                  )}

                                {!res.error_message &&
                                  !res.schema_failures?.length &&
                                  !res.response_preview &&
                                  res.status === "pass" && (
                                    <div className="text-[11px] text-emerald-400">
                                      Verificación correcta: código HTTP,
                                      latencia y contrato cumplidos.
                                    </div>
                                  )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-bg-dark/50 border border-border-base rounded-xl p-6 text-center">
                <p className="text-text-dim text-xs">
                  Sin ejecuciones registradas todavía.
                </p>
              </div>
            )}
          </div>

          {/* Alert Destinations & Consecutive Failures Callout */}
          {destinations.length === 0 ? (
            <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-amber-200 min-w-0">
                <Bell size={14} className="shrink-0 text-amber-400" />
                <span className="truncate">
                  Nadie será notificado si este endpoint falla
                </span>
              </div>
              <Link
                to="/notifications"
                className="inline-flex items-center gap-1 text-amber-300 hover:text-amber-200 font-semibold whitespace-nowrap shrink-0"
              >
                <span>Agregar destino</span>
                <ArrowUpRight size={12} />
              </Link>
            </div>
          ) : (
            <div className="rounded-xl border border-border-base/70 bg-bg-dark/60 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-text-muted min-w-0">
                <Bell size={13} className="shrink-0 text-accent-green" />
                <span className="truncate">
                  Alertar tras{" "}
                  <strong className="text-text-main">
                    {alertAfter} {alertAfter === 1 ? "fallo" : "fallos"}{" "}
                    {alertAfter === 1 ? "seguido" : "seguidos"}
                  </strong>{" "}
                  a{" "}
                  {destinations.map((d) => d.name).join(", ")}
                </span>
              </div>
              <Link
                to="/notifications"
                className="text-[11px] text-text-dim hover:text-accent-green shrink-0"
              >
                Canales →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CONFIGURACIÓN (Contrato por campo + Reglas + cURL) */}
      {activeTab === "config" && (
        <div className="space-y-4 font-sans">
          {/* Per-field Schema Contract with live status */}
          <div className="bg-bg-dark/80 border border-border-base rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                <Code2 size={14} className="text-accent-green" />
                <span>Contrato JSON (Schema)</span>
              </h4>
              {schemaEntries.length > 0 && (
                <span className="text-[11px] font-mono text-text-dim">
                  {schemaEntries.length}{" "}
                  {schemaEntries.length === 1 ? "campo" : "campos"}
                </span>
              )}
            </div>

            {schemaEntries.length > 0 ? (
              <div className="divide-y divide-border-base/50 rounded-lg border border-border-base/70 bg-bg-card/60">
                {schemaEntries.map(([field, expectedType]) => {
                  const failure = latestFailureMap.get(field);
                  const checked = target.last_schema_valid !== null && target.last_schema_valid !== undefined;
                  return (
                    <div
                      key={field}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-xs font-mono"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-text-main font-semibold truncate">
                          {field}
                        </span>
                        <span className="text-text-dim">·</span>
                        <span className="text-text-muted">
                          {String(expectedType)}
                        </span>
                      </div>
                      <div className="shrink-0">
                        {failure ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-rose-400">
                            <XCircle size={12} />
                            <span>
                              {failure.received === "missing"
                                ? "falta"
                                : `recibido ${failure.received}`}
                            </span>
                          </span>
                        ) : checked ? (
                          <CheckCircle2
                            size={13}
                            className="text-emerald-400"
                            aria-label="Campo válido"
                          />
                        ) : (
                          <span className="text-[11px] text-text-dim">
                            pendiente
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-text-dim">
                Sin contrato de campos configurado. Puedes agregarlo en{" "}
                <strong className="text-text-muted">Editar</strong>.
              </p>
            )}
          </div>

          {/* Static evaluation thresholds */}
          <div className="bg-bg-dark/80 border border-border-base rounded-xl p-3.5 space-y-2 text-xs">
            <div className="flex justify-between border-b border-border-base/40 pb-1.5">
              <span className="text-text-dim">Código HTTP esperado</span>
              <span className="font-mono font-semibold text-text-main">
                {target.expected_status}
              </span>
            </div>
            <div className="flex justify-between border-b border-border-base/40 pb-1.5">
              <span className="text-text-dim">Límite de latencia</span>
              <span className="font-mono font-semibold text-text-main">
                {target.expected_response_time_ms} ms
              </span>
            </div>
            <div className="flex justify-between border-b border-border-base/40 pb-1.5">
              <span className="text-text-dim">Regla anti-ruido</span>
              <span className="font-mono font-semibold text-text-main">
                Alertar tras {alertAfter}{" "}
                {alertAfter === 1 ? "fallo seguido" : "fallos seguidos"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-dim">Estado del monitor</span>
              <span
                className={`font-semibold ${
                  target.enabled ? "text-emerald-400" : "text-text-dim"
                }`}
              >
                {target.enabled ? "Activo" : "Pausado"}
              </span>
            </div>
          </div>

          {/* Reproducible cURL */}
          <div className="bg-bg-dark/80 border border-border-base rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-muted flex items-center gap-1.5">
                <Terminal size={14} className="text-accent-green" />
                <span>Solicitud y cURL</span>
              </span>
              <button
                type="button"
                onClick={() => void handleCopyCurl()}
                className="flex items-center gap-1 text-xs text-accent-green hover:underline font-semibold cursor-pointer !min-h-0"
              >
                {copiedCurl ? (
                  <>
                    <Check size={13} />
                    <span>Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Copiar cURL</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-3 bg-bg-card border border-border-base/60 rounded-lg text-[11px] font-mono text-text-muted overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
              {curlCommand}
            </pre>
          </div>
        </div>
      )}
    </ResourceDetailDrawer>
  );
}
