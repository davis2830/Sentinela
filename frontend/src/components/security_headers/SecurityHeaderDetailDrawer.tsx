import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  BellOff,
  BellRing,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  ExternalLink,
  Loader2,
  Pause,
  Pencil,
  Play,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  DirectiveInfo,
  SecurityHeaderResult,
  SecurityHeaderTarget,
} from "../../types/security_headers";
import GradeBadge from "../common/GradeBadge";
import ScanAction from "../common/ScanAction";
import RelativeTime from "../common/connectivity/RelativeTime";
import ResourceDetailDrawer from "../common/connectivity/ResourceDetailDrawer";
import RowActionMenu, {
  type RowActionMenuItem,
} from "../common/connectivity/RowActionMenu";
import { securityHealthTone } from "../../utils/healthPresentation";
import {
  SECURITY_STATE_META,
  STANDARD_SECURITY_HEADERS,
  calculateSecurityGrade,
  getSecurityHeaderDisplayUrl,
  getSecurityHeaderHealthState,
  getSecurityHeaderIssueLabel,
  getSecurityLatencyColorClass,
} from "./useSecurityHeaders";

interface SecurityHeaderDetailDrawerProps {
  target: SecurityHeaderTarget;
  targets: SecurityHeaderTarget[];
  results?: SecurityHeaderResult[];
  isLoadingResults: boolean;
  isScanning: boolean;
  onSelectTarget: (target: SecurityHeaderTarget) => void;
  onScan: (id: string) => Promise<unknown>;
  onEdit: (target: SecurityHeaderTarget) => void;
  onToggleEnabled: (target: SecurityHeaderTarget) => void;
  onDelete: (target: SecurityHeaderTarget) => void;
  canUpdate: boolean;
  canDelete: boolean;
  onClose: () => void;
}

const DIRECTIVE_STATUS_META: Record<
  DirectiveInfo["status"],
  { label: string; badgeClass: string; boxClass: string }
> = {
  optimal: {
    label: "Óptima",
    badgeClass:
      "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
    boxClass: "bg-emerald-500/[0.04] border-emerald-500/30",
  },
  warning: {
    label: "Mejorable",
    badgeClass: "bg-amber-500/20 text-amber-300 border border-amber-500/35",
    boxClass: "bg-amber-500/[0.05] border-amber-500/35",
  },
  danger: {
    label: "Insegura",
    badgeClass: "bg-rose-500/20 text-rose-400 border border-rose-500/35",
    boxClass: "bg-rose-500/[0.05] border-rose-500/35",
  },
  invalid: {
    label: "Inválida",
    badgeClass: "bg-rose-500/20 text-rose-400 border border-rose-500/35",
    boxClass: "bg-rose-500/[0.05] border-rose-500/35",
  },
  missing: {
    label: "Ausente",
    badgeClass: "bg-rose-500/15 text-rose-400 border border-rose-500/25",
    boxClass: "bg-bg-dark/60 border-border-base/70",
  },
};

export default function SecurityHeaderDetailDrawer({
  target,
  targets,
  results,
  isLoadingResults,
  isScanning,
  onSelectTarget,
  onScan,
  onEdit,
  onToggleEnabled,
  onDelete,
  canUpdate,
  canDelete,
  onClose,
}: SecurityHeaderDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<"audit" | "leaks_raw">("audit");
  const [rawFilter, setRawFilter] = useState("");
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(
    null,
  );
  const [copiedUrl, setCopiedUrl] = useState(false);

  const currentIdx = targets.findIndex((t) => t.id === target.id);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx >= 0 && currentIdx < targets.length - 1;
  const goPrev = () => {
    if (hasPrev) onSelectTarget(targets[currentIdx - 1]);
  };
  const goNext = () => {
    if (hasNext) onSelectTarget(targets[currentIdx + 1]);
  };

  const state = getSecurityHeaderHealthState(target);
  const meta = SECURITY_STATE_META[state];
  const grade = target.last_grade || calculateSecurityGrade(target.last_score);
  const issueLabel = getSecurityHeaderIssueLabel(target);
  const displayUrl = getSecurityHeaderDisplayUrl(target.url);

  const latestResult: SecurityHeaderResult | null =
    results && results.length > 0 ? results[0] : null;

  const foundHeadersDict: Record<string, string> =
    latestResult?.headers_found &&
    typeof latestResult.headers_found === "object" &&
    !Array.isArray(latestResult.headers_found)
      ? (latestResult.headers_found as Record<string, string>)
      : {};

  const directivesAnalysis = latestResult?.directives_analysis || {};
  const infoLeaks = latestResult?.info_leaks || {};
  const rawHeaders = latestResult?.raw_headers || {};
  const foundCount =
    Object.keys(foundHeadersDict).length || target.headers_found_count || 0;
  const missingCount = Math.max(0, STANDARD_SECURITY_HEADERS.length - foundCount);
  const leakEntries = Object.entries(infoLeaks);
  const rawEntries = Object.entries(rawHeaders).filter(([k, v]) => {
    if (!rawFilter.trim()) return true;
    const q = rawFilter.toLowerCase();
    return k.toLowerCase().includes(q) || String(v).toLowerCase().includes(q);
  });

  const chartData = useMemo(() => {
    const src = (results || []).slice(0, 24).reverse();
    return src.map((r) => ({
      time: new Date(r.checked_at).toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      score: r.error_message ? 0 : r.score,
      latency: r.response_time_ms ?? 0,
      grade: r.grade,
      error: r.error_message,
    }));
  }, [results]);

  const rulesCount = target.alert_summary?.rules.length ?? 0;
  const destinationsCount = target.alert_summary?.destinations.length ?? 0;
  const hasNotifications = rulesCount > 0 && destinationsCount > 0;

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(target.url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 1600);
    } catch {
      // ignore clipboard errors
    }
  };

  const overflowItems: RowActionMenuItem[] = [
    ...(canUpdate
      ? [
          {
            id: "toggle",
            label: target.enabled ? "Pausar escaneo" : "Reanudar escaneo",
            icon: target.enabled ? (
              <Pause size={13} className="text-amber-400" />
            ) : (
              <Play size={13} className="text-emerald-400" />
            ),
            onClick: () => onToggleEnabled(target),
          },
        ]
      : []),
    {
      id: "copy",
      label: copiedUrl ? "URL copiada" : "Copiar URL",
      icon: copiedUrl ? (
        <Check size={13} className="text-accent-green" />
      ) : (
        <Copy size={13} />
      ),
      onClick: copyUrl,
    },
    ...(canDelete
      ? [
          {
            id: "delete",
            label: "Eliminar endpoint",
            icon: <Trash2 size={13} />,
            danger: true,
            dividerBefore: true,
            onClick: () => onDelete(target),
          },
        ]
      : []),
  ];

  const headerExtra = (
    <div className="space-y-2.5">
      {/* URL line */}
      <div className="flex items-center gap-1.5 text-[11px] font-mono text-text-muted min-w-0">
        <span className="truncate" title={target.url}>
          {displayUrl}
        </span>
        <a
          href={target.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-accent-green hover:underline inline-flex items-center gap-0.5"
          title="Abrir URL en nueva pestaña"
        >
          <ExternalLink size={11} />
        </a>
        {!target.last_error_message && grade && (
          <>
            <span>·</span>
            <GradeBadge
              grade={grade}
              score={target.last_score}
              tone={securityHealthTone(target)}
            />
          </>
        )}
      </div>

      {/* Action bar: ScanAction + Editar + ⋯ */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <ScanAction
            resource={target}
            route="security-headers"
            pending={isScanning}
            onScan={() => onScan(target.id)}
          />
          {canUpdate && (
            <button
              type="button"
              onClick={() => onEdit(target)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-base bg-bg-card text-xs font-medium text-text-main hover:bg-bg-card-hover transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green/60 !min-h-0"
            >
              <Pencil size={13} />
              <span>Editar</span>
            </button>
          )}
        </div>

        <RowActionMenu
          resourceLabel={target.name}
          forceVisible
          items={overflowItems}
          menuWidth={196}
          estimatedHeight={140}
        />
      </div>

      {/* 2 focused tabs */}
      <div className="flex items-center gap-1 border-b border-border-base/60 -mx-5 px-5 pt-0.5">
        <button
          type="button"
          onClick={() => setActiveTab("audit")}
          className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green/60 !min-h-0 ${
            activeTab === "audit"
              ? "border-accent-green text-accent-green"
              : "border-transparent text-text-muted hover:text-text-main"
          }`}
        >
          <ShieldCheck size={13} />
          <span>Auditoría e historial</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("leaks_raw")}
          className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green/60 !min-h-0 ${
            activeTab === "leaks_raw"
              ? "border-accent-green text-accent-green"
              : "border-transparent text-text-muted hover:text-text-main"
          }`}
        >
          {target.info_leak_detected ? (
            <ShieldAlert size={13} className="text-amber-400" />
          ) : (
            <Server size={13} />
          )}
          <span>
            Fugas y cabeceras
            {leakEntries.length > 0 ? ` (${leakEntries.length})` : ""}
          </span>
        </button>
      </div>
    </div>
  );

  const footer = (
    <div className="flex items-center justify-between gap-2">
      <span>
        Último chequeo{" "}
        <RelativeTime
          value={target.last_checked_at}
          emptyLabel="sin ejecutar"
        />{" "}
        · origen cloud
      </span>
      <span className="text-text-dim">
        {target.enabled ? "escaneo activo" : "pausado"}
      </span>
    </div>
  );

  return (
    <ResourceDetailDrawer
      focusKey={target.id}
      ariaLabel={target.name}
      title={target.name}
      status={{
        label: meta.label,
        tone: meta.tone,
        shape: meta.shape,
        iconClassName: meta.iconClassName,
      }}
      hasPrev={hasPrev}
      hasNext={hasNext}
      onPrev={goPrev}
      onNext={goNext}
      prevLabel="Endpoint anterior"
      nextLabel="Siguiente endpoint"
      headerExtra={headerExtra}
      footer={footer}
      onClose={onClose}
    >
      <div className="space-y-4 text-xs">
        {/* Contextual diagnostic banner */}
        {issueLabel && (
          <div
            className={`rounded-xl border p-3 flex items-start gap-2 ${
              state === "critical"
                ? "bg-rose-500/10 border-rose-500/35 text-rose-200"
                : "bg-amber-500/10 border-amber-500/35 text-amber-200"
            }`}
          >
            <AlertTriangle
              size={14}
              className={`shrink-0 mt-0.5 ${
                state === "critical" ? "text-rose-400" : "text-amber-400"
              }`}
            />
            <div className="min-w-0 space-y-0.5">
              <div className="font-semibold">{issueLabel}</div>
              {target.last_error_message && (
                <p className="font-mono text-[11px] opacity-90 break-all">
                  {target.last_error_message}
                </p>
              )}
            </div>
          </div>
        )}

        {/* 3 Real Operational KPIs */}
        <section className="grid grid-cols-3 gap-2 font-mono">
          <div className="rounded-xl border border-border-base bg-bg-dark/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-text-dim">
              Puntuación
            </div>
            <div className="mt-1 text-base font-bold text-text-main">
              {target.last_error_message
                ? "Error"
                : target.last_score !== null
                  ? `${target.last_score}/100`
                  : "—"}
            </div>
          </div>
          <div className="rounded-xl border border-border-base bg-bg-dark/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-text-dim">
              Cabeceras
            </div>
            <div className="mt-1 text-base font-bold text-text-main">
              {target.last_checked_at && !target.last_error_message
                ? `${foundCount}/${STANDARD_SECURITY_HEADERS.length}`
                : "—"}
            </div>
          </div>
          <div className="rounded-xl border border-border-base bg-bg-dark/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-text-dim">
              Latencia HTTP
            </div>
            <div
              className={`mt-1 text-base font-bold ${getSecurityLatencyColorClass(
                target.last_response_time_ms,
              )}`}
            >
              {target.last_response_time_ms !== null &&
              target.last_response_time_ms !== undefined
                ? `${target.last_response_time_ms} ms`
                : "—"}
            </div>
          </div>
        </section>

        {activeTab === "audit" ? (
          <>
            {/* Score evolution chart when 2+ real scans exist */}
            {chartData.length >= 2 && (
              <section className="rounded-xl border border-border-base bg-bg-dark/50 p-3 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-text-main">
                    Evolución de puntuación ({chartData.length} escaneos)
                  </span>
                  <span className="font-mono text-text-dim">
                    meta ≥ 70 pts
                  </span>
                </div>
                <div className="h-32 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 6, right: 6, left: -24, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="secScoreGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#10b981"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor="#10b981"
                            stopOpacity={0.02}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(255,255,255,0.06)"
                      />
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 10, fill: "#71717a" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 10, fill: "#71717a" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <ReferenceLine
                        y={70}
                        stroke="#f59e0b"
                        strokeDasharray="3 3"
                        strokeOpacity={0.6}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0c1117",
                          border: "1px solid rgba(255,255,255,0.12)",
                          borderRadius: "10px",
                          fontSize: "11px",
                        }}
                        formatter={(val) => [`${val ?? 0} / 100`, "Score"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="score"
                        stroke="#10b981"
                        strokeWidth={2}
                        fill="url(#secScoreGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            {/* 8 Standard Security Headers with real directive severity */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-text-main">
                  Evaluación de cabeceras estándar
                </h4>
                <span className="font-mono text-[11px] text-text-dim">
                  {foundCount} presentes · {missingCount} ausentes
                </span>
              </div>

              {isLoadingResults && !latestResult ? (
                <div className="flex items-center justify-center py-8 text-text-muted gap-2">
                  <Loader2 size={16} className="animate-spin text-accent-green" />
                  <span>Cargando auditoría...</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {STANDARD_SECURITY_HEADERS.map((hdr) => {
                    const isFound = hdr.key in foundHeadersDict;
                    const value = foundHeadersDict[hdr.key];
                    const directive = directivesAnalysis[hdr.key];
                    const directiveStatus: DirectiveInfo["status"] =
                      directive?.status || (isFound ? "optimal" : "missing");
                    const statusStyle =
                      DIRECTIVE_STATUS_META[directiveStatus] ||
                      DIRECTIVE_STATUS_META.missing;

                    return (
                      <div
                        key={hdr.key}
                        className={`p-3 rounded-xl border transition-all ${statusStyle.boxClass}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {directiveStatus === "optimal" ? (
                              <CheckCircle2
                                size={14}
                                className="text-emerald-400 shrink-0"
                              />
                            ) : directiveStatus === "warning" ? (
                              <AlertTriangle
                                size={14}
                                className="text-amber-400 shrink-0"
                              />
                            ) : (
                              <XCircle
                                size={14}
                                className="text-rose-400 shrink-0"
                              />
                            )}
                            <span className="font-mono text-xs font-semibold text-text-main truncate">
                              {hdr.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[11px] font-mono text-text-dim">
                              +{hdr.weight}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusStyle.badgeClass}`}
                            >
                              {statusStyle.label}
                            </span>
                          </div>
                        </div>

                        {isFound && value && (
                          <div className="mt-2 px-2.5 py-1.5 bg-bg-dark border border-border-base/60 rounded-lg text-[11px] font-mono text-emerald-300 break-all">
                            {value}
                          </div>
                        )}

                        <p className="mt-1.5 text-[11px] text-text-muted leading-relaxed">
                          {directive?.notes || hdr.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Recent Audit History (expandable rows) */}
            <section className="space-y-2">
              <h4 className="text-xs font-semibold text-text-main">
                Auditorías recientes
              </h4>
              {isLoadingResults ? (
                <div className="flex items-center gap-2 text-text-muted py-4">
                  <Loader2 size={14} className="animate-spin text-accent-green" />
                  <span>Cargando historial...</span>
                </div>
              ) : results && results.length > 0 ? (
                <div className="rounded-xl border border-border-base bg-bg-dark/50 divide-y divide-border-base/50 overflow-hidden">
                  {results.slice(0, 12).map((res) => {
                    const isExpanded = expandedHistoryId === res.id;
                    const leaksCount = res.info_leaks
                      ? Object.keys(res.info_leaks).length
                      : 0;
                    const missingInRun = Array.isArray(res.headers_missing)
                      ? res.headers_missing
                      : Object.keys(res.headers_missing || {});
                    return (
                      <div key={res.id}>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedHistoryId(isExpanded ? null : res.id)
                          }
                          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-white/[0.03] transition-colors cursor-pointer !min-h-0"
                        >
                          <div className="flex items-center gap-2 min-w-0 font-mono text-[11px]">
                            <ChevronRight
                              size={12}
                              className={`text-text-dim shrink-0 transition-transform ${
                                isExpanded ? "rotate-90" : ""
                              }`}
                            />
                            <span className="text-text-muted">
                              {new Date(res.checked_at).toLocaleTimeString(
                                "es-ES",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                },
                              )}
                            </span>
                            {res.error_message ? (
                              <span className="text-rose-400 font-semibold truncate">
                                Error de conexión
                              </span>
                            ) : (
                              <span className="text-text-main font-semibold">
                                {res.score}/100
                              </span>
                            )}
                            {leaksCount > 0 && (
                              <span className="text-amber-400">
                                · {leaksCount}{" "}
                                {leaksCount === 1 ? "fuga" : "fugas"}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                            {res.response_time_ms !== null &&
                              res.response_time_ms !== undefined && (
                                <span
                                  className={getSecurityLatencyColorClass(
                                    res.response_time_ms,
                                  )}
                                >
                                  {res.response_time_ms} ms
                                </span>
                              )}
                            {!res.error_message && (
                              <GradeBadge grade={res.grade} score={res.score} />
                            )}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="px-3 pb-3 pt-1 bg-bg-dark/80 border-t border-border-base/40 text-[11px] space-y-1.5">
                            {res.error_message ? (
                              <p className="font-mono text-rose-300 break-all">
                                {res.error_message}
                              </p>
                            ) : (
                              <>
                                <div className="text-text-muted">
                                  Ausentes ({missingInRun.length}):{" "}
                                  <span className="font-mono text-text-main">
                                    {missingInRun.length > 0
                                      ? missingInRun.join(", ")
                                      : "Ninguna"}
                                  </span>
                                </div>
                                {leaksCount > 0 && res.info_leaks && (
                                  <div className="text-amber-300 font-mono">
                                    Fugas:{" "}
                                    {Object.values(res.info_leaks)
                                      .map((l) => `${l.header}: ${l.value}`)
                                      .join(" · ")}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-border-base bg-bg-dark/40 p-4 text-center text-text-dim">
                  Sin auditorías previas registradas.
                </div>
              )}
            </section>

            {/* Alert notification notice */}
            <section
              className={`rounded-xl border p-3 flex items-center justify-between gap-2 ${
                hasNotifications
                  ? "border-border-base bg-bg-dark/40 text-text-muted"
                  : "border-amber-500/30 bg-amber-500/[0.07] text-amber-200"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {hasNotifications ? (
                  <BellRing size={14} className="text-accent-green shrink-0" />
                ) : (
                  <BellOff size={14} className="text-amber-400 shrink-0" />
                )}
                <span className="truncate">
                  {hasNotifications
                    ? `${rulesCount} ${rulesCount === 1 ? "regla activa" : "reglas activas"} · ${destinationsCount} ${destinationsCount === 1 ? "destino" : "destinos"}`
                    : "Nadie será notificado si baja el score o aparece una fuga"}
                </span>
              </div>
              <Link
                to={destinationsCount === 0 ? "/notifications" : "/alerts"}
                onClick={onClose}
                className="shrink-0 font-semibold text-accent-green hover:underline"
              >
                {destinationsCount === 0
                  ? "Agregar destino →"
                  : rulesCount === 0
                    ? "Crear regla →"
                    : "Ver alertas →"}
              </Link>
            </section>
          </>
        ) : (
          /* TAB 2: FUGAS DE TECNOLOGÍA & CABECERAS RAW */
          <div className="space-y-4">
            {target.info_leak_detected || leakEntries.length > 0 ? (
              <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3.5 space-y-2.5">
                <div className="flex items-center gap-2 font-semibold text-amber-300">
                  <ShieldAlert size={15} className="shrink-0" />
                  <span>Divulgación de tecnología detectada (CWE-200)</span>
                </div>
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  El servidor expone software o versiones en sus cabeceras HTTP,
                  facilitando el reconocimiento de vulnerabilidades.
                </p>
                <div className="space-y-2">
                  {leakEntries.map(([key, leak]) => (
                    <div
                      key={key}
                      className="rounded-lg border border-amber-500/25 bg-bg-dark/80 p-2.5 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                        <span className="font-bold text-amber-300">
                          {leak.header}:
                        </span>
                        <span className="text-text-main truncate">
                          {leak.value}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-muted">
                        {leak.recommendation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex items-center gap-2.5 text-emerald-300">
                <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
                <div>
                  <div className="font-semibold">
                    Sin fugas de stack detectadas
                  </div>
                  <p className="text-[11px] text-emerald-200/80 mt-0.5">
                    No se expusieron cabeceras Server ni X-Powered-By con
                    versiones identificables.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-semibold text-text-main">
                  Cabeceras HTTP recibidas ({Object.keys(rawHeaders).length})
                </h4>
                <div className="relative w-44">
                  <Search
                    size={12}
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim"
                  />
                  <input
                    type="search"
                    placeholder="Filtrar cabecera..."
                    value={rawFilter}
                    onChange={(e) => setRawFilter(e.target.value)}
                    className="h-7 w-full rounded-lg border border-border-base bg-bg-dark pl-7 pr-2 text-[11px] font-mono text-text-main placeholder:text-text-dim focus:border-accent-green focus:outline-none"
                  />
                </div>
              </div>

              {rawEntries.length > 0 ? (
                <div className="space-y-1.5 font-mono text-[11px] max-h-[360px] overflow-y-auto pr-1">
                  {rawEntries.map(([key, val]) => (
                    <div
                      key={key}
                      className="p-2 rounded-lg bg-bg-dark/80 border border-border-base/60 flex flex-col sm:flex-row sm:items-start justify-between gap-1 break-all"
                    >
                      <span className="text-text-muted font-semibold shrink-0">
                        {key}:
                      </span>
                      <span className="text-text-main text-left sm:text-right">
                        {String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-5 rounded-xl border border-border-base bg-bg-dark/40 text-center text-text-dim">
                  No hay cabeceras raw registradas para este escaneo.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ResourceDetailDrawer>
  );
}
