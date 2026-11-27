import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  Copy,
  ExternalLink,
  Loader2,
  Pencil,
  Settings,
  Terminal,
  Trash2,
  XCircle,
} from "lucide-react";
import { useConnectivityRefresh } from "../../hooks/useConnectivityRefresh";
import { api } from "../../services/api";
import type { APICheckResult, APICheckTarget } from "../../types/api_checks";
import { healthPalette } from "../../utils/healthPresentation";
import AdminButton from "../common/AdminButton";
import MeasurementStatus from "../common/MeasurementStatus";
import ScanAction from "../common/ScanAction";
import StatusBadge from "../common/StatusBadge";
import RelativeTime from "../common/connectivity/RelativeTime";
import ResourceDetailDrawer from "../common/connectivity/ResourceDetailDrawer";
import {
  API_STATE_META,
  buildSafeCurl,
  formatApiInterval,
  getAPICheckHealthState,
  getMethodBadgeClass,
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
  const [activeTab, setActiveTab] = useState<"results" | "schema" | "config">(
    "results",
  );
  const [copiedCurl, setCopiedCurl] = useState(false);
  const autoRefresh = useConnectivityRefresh();

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

  const handleCopyCurl = async () => {
    try {
      await navigator.clipboard.writeText(curlCommand);
      setCopiedCurl(true);
    } catch {
      setCopiedCurl(false);
      window.dispatchEvent(
        new CustomEvent("sentinel:scan-feedback", {
          detail: "No se pudo copiar el ejemplo. Selecciona el texto.",
        }),
      );
    }
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  const tabs = [
    {
      id: "results" as const,
      label: "Historial",
      icon: <Activity size={13} />,
    },
    {
      id: "schema" as const,
      label: "Schema",
      icon: <Code2 size={13} />,
    },
    {
      id: "config" as const,
      label: "HTTP & cURL",
      icon: <Settings size={13} />,
    },
  ];

  return (
    <ResourceDetailDrawer
      focusKey={target.id}
      ariaLabel={`Detalle del endpoint ${target.name}`}
      title={target.name}
      titleBadge={
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border font-mono shrink-0 ${getMethodBadgeClass(
            target.method,
          )}`}
        >
          {target.method}
        </span>
      }
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
      onClose={onClose}
      headerExtra={
        <>
          {/* URL Row */}
          <div className="flex items-center gap-1.5 text-xs font-mono text-text-muted min-w-0">
            <span className="truncate" title={target.url}>
              {target.url}
            </span>
            <a
              href={target.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-green hover:underline shrink-0"
              title="Abrir en pestaña nueva"
            >
              <ExternalLink size={12} />
            </a>
          </div>

          {/* Actions Bar */}
          <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
            <ScanAction
              resource={target}
              route="api-checks"
              pending={isScanning}
              onScan={() => onScan(target.id)}
            />
            <div className="flex items-center gap-1.5">
              <AdminButton
                capability="api_checks.update"
                type="button"
                onClick={() => onEdit(target)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-border-base bg-bg-card text-text-muted hover:text-text-main hover:border-border-accent text-xs font-medium transition-colors cursor-pointer !min-h-0"
              >
                <Pencil size={12} />
                <span>Editar</span>
              </AdminButton>
              <AdminButton
                capability="api_checks.delete"
                type="button"
                onClick={() => onDelete(target)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white text-xs font-medium transition-colors cursor-pointer !min-h-0"
              >
                <Trash2 size={12} />
                <span>Eliminar</span>
              </AdminButton>
            </div>
          </div>

          {/* Quick KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
            <div className="bg-bg-card/80 border border-border-base/70 rounded-xl px-2.5 py-2">
              <div className="text-[10px] text-text-dim">Status esperado</div>
              <div className="text-sm font-bold font-mono text-text-main mt-0.5 tabular-nums">
                {target.last_http_status ?? "—"} / {target.expected_status}
              </div>
            </div>
            <div className="bg-bg-card/80 border border-border-base/70 rounded-xl px-2.5 py-2">
              <div className="text-[10px] text-text-dim">Última latencia</div>
              <div className="text-sm font-bold font-mono text-text-main mt-0.5 tabular-nums">
                {target.last_response_time_ms !== null &&
                target.last_response_time_ms !== undefined
                  ? `${Math.round(target.last_response_time_ms)} ms`
                  : "Sin medición"}
              </div>
            </div>
            <div className="bg-bg-card/80 border border-border-base/70 rounded-xl px-2.5 py-2">
              <div className="text-[10px] text-text-dim">Monitoreo</div>
              <div className="text-sm font-semibold mt-0.5">
                {target.enabled ? (
                  <span className="text-accent-green">Activo</span>
                ) : (
                  <span className="text-text-dim">Pausado</span>
                )}
              </div>
            </div>
            <div className="bg-bg-card/80 border border-border-base/70 rounded-xl px-2.5 py-2">
              <div className="text-[10px] text-text-dim">Frecuencia</div>
              <div className="text-sm font-semibold font-mono text-sky-400 mt-0.5">
                {formatApiInterval(target.check_interval)}
              </div>
            </div>
          </div>

          {/* Segmented Tabs */}
          <div
            role="tablist"
            className="grid grid-cols-3 gap-1 rounded-xl bg-bg-card border border-border-base/70 p-1"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors cursor-pointer !min-h-0 ${
                  activeTab === tab.id
                    ? "bg-accent-green/15 text-accent-green font-semibold"
                    : "text-text-muted hover:text-text-main"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </>
      }
      footer={
        <>
          Último chequeo{" "}
          <RelativeTime
            value={target.last_checked_at}
            emptyLabel="nunca"
            className="text-text-muted"
          />{" "}
          · límite {target.expected_response_time_ms} ms ·{" "}
          {formatApiInterval(target.check_interval)}
        </>
      }
    >
      <MeasurementStatus snapshot={target.scan_availability} />

      {/* TAB 1: RESULTS HISTORY */}
      {activeTab === "results" && (
        <div className="space-y-3 font-sans">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-text-muted">
              Últimas verificaciones ejecutadas
            </h3>
            <span className="text-xs text-text-dim font-mono">
              {results?.length || 0} registros
            </span>
          </div>

          {isLoadingResults ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-accent-green" size={26} />
            </div>
          ) : results && results.length > 0 ? (
            <div className="bg-bg-dark/80 border border-border-base rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border-base text-text-dim text-[11px] bg-bg-card">
                      <th className="py-2 px-3">Hora</th>
                      <th className="py-2 px-2.5">Estado</th>
                      <th className="py-2 px-2.5">HTTP</th>
                      <th className="py-2 px-2.5">Latencia</th>
                      <th className="py-2 px-2 text-center">JSON</th>
                      <th className="py-2 px-2 text-center">Schema</th>
                      <th className="py-2 px-2 text-center">Headers</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-base/40 font-mono">
                    {results.map((res: APICheckResult) => (
                      <tr
                        key={res.id}
                        className="hover:bg-bg-card-hover transition-colors"
                      >
                        <td className="py-2 px-3 text-text-muted text-[11px] whitespace-nowrap">
                          <span className="flex items-center gap-1">
                            <Clock size={11} className="text-text-dim" />
                            {new Date(res.checked_at).toLocaleTimeString(
                              "es-ES",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              },
                            )}
                          </span>
                        </td>
                        <td className="py-2 px-2.5">
                          <StatusBadge status={res.status} />
                        </td>
                        <td className="py-2 px-2.5 font-bold text-text-main">
                          {res.http_status ?? "N/A"}
                        </td>
                        <td className="py-2 px-2.5 font-bold text-sky-400 tabular-nums">
                          {res.response_time_ms !== null
                            ? `${Math.round(res.response_time_ms)} ms`
                            : "N/A"}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {res.json_valid === true ? (
                            <CheckCircle2
                              size={14}
                              className={`${healthPalette.success.text} mx-auto`}
                            />
                          ) : res.json_valid === false ? (
                            <XCircle
                              size={14}
                              className={`${healthPalette.danger.text} mx-auto`}
                            />
                          ) : (
                            <span className="text-text-dim text-xs">—</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {res.schema_valid === true ? (
                            <CheckCircle2
                              size={14}
                              className={`${healthPalette.success.text} mx-auto`}
                            />
                          ) : res.schema_valid === false ? (
                            <XCircle
                              size={14}
                              className={`${healthPalette.danger.text} mx-auto`}
                            />
                          ) : (
                            <span className="text-text-dim text-xs">—</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {res.headers_valid === true ? (
                            <CheckCircle2
                              size={14}
                              className={`${healthPalette.success.text} mx-auto`}
                            />
                          ) : res.headers_valid === false ? (
                            <XCircle
                              size={14}
                              className={`${healthPalette.danger.text} mx-auto`}
                            />
                          ) : (
                            <span className="text-text-dim text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-bg-dark/50 border border-border-base rounded-2xl p-8 text-center">
              <p className="text-text-dim text-xs">
                No hay ejecuciones registradas para esta API todavía.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SCHEMA VALIDATION */}
      {activeTab === "schema" && (
        <div className="space-y-3 font-sans">
          {!!results?.[0]?.schema_failures?.length && (
            <section className="border border-rose-500/35 bg-rose-500/10 rounded-xl p-3.5 text-xs space-y-1.5">
              <h4 className="font-semibold text-rose-300">
                Diferencias en la última respuesta
              </h4>
              {results[0].schema_failures.map((item) => (
                <p key={item.field} className="text-text-main">
                  <code className="font-mono text-rose-300">{item.field}</code>:
                  esperado {item.expected}; recibido {item.received}.{" "}
                  {item.code === "INVALID_JSON_OBJECT"
                    ? "Se requiere un objeto JSON válido."
                    : ""}
                </p>
              ))}
              <p className="text-[11px] text-text-muted">
                Se muestran tipos; no valores de la respuesta.
              </p>
            </section>
          )}

          <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-semibold text-text-muted flex items-center gap-1.5">
              <Code2 size={14} className="text-accent-green" />
              Campos y tipos requeridos en respuesta JSON
            </h4>
            {target.expected_schema &&
            Object.keys(target.expected_schema).length > 0 ? (
              <pre className="p-3.5 bg-bg-card border border-border-base rounded-xl text-xs font-mono text-accent-green overflow-x-auto leading-relaxed">
                {JSON.stringify(target.expected_schema, null, 2)}
              </pre>
            ) : (
              <p className="text-xs text-text-dim">
                Sin contrato de campos configurado. Se admiten seis tipos y
                campos de primer nivel; no es una validación completa de JSON
                Schema.
              </p>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: HTTP CONFIG & CURL REPRODUCTION */}
      {activeTab === "config" && (
        <div className="space-y-3 font-sans">
          <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4 space-y-2.5 text-xs font-mono">
            <div className="flex justify-between border-b border-border-base/40 pb-2">
              <span className="text-text-dim font-sans font-medium">
                Método HTTP
              </span>
              <span className="font-bold text-sky-400">{target.method}</span>
            </div>
            <div className="flex justify-between gap-3 border-b border-border-base/40 pb-2">
              <span className="text-text-dim font-sans font-medium shrink-0">
                URL completa
              </span>
              <span className="font-bold text-text-main truncate">
                {target.url}
              </span>
            </div>
            <div className="flex justify-between border-b border-border-base/40 pb-2">
              <span className="text-text-dim font-sans font-medium">
                Código esperado
              </span>
              <span className="font-bold text-accent-green">
                {target.expected_status}
              </span>
            </div>
            <div className="flex justify-between border-b border-border-base/40 pb-2">
              <span className="text-text-dim font-sans font-medium">
                Latencia máxima
              </span>
              <span className="font-bold text-text-main">
                {target.expected_response_time_ms} ms
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-dim font-sans font-medium">
                Frecuencia
              </span>
              <span className="font-bold text-text-main">
                {formatApiInterval(target.check_interval)}
              </span>
            </div>
          </div>

          <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-muted flex items-center gap-1.5 font-sans">
                <Terminal size={14} className="text-accent-green" />
                Comando cURL reproducible
              </span>
              <button
                type="button"
                onClick={handleCopyCurl}
                className="flex items-center gap-1 text-xs text-accent-green hover:underline font-semibold cursor-pointer font-sans !min-h-0"
              >
                {copiedCurl ? (
                  <>
                    <Check size={13} />
                    <span>¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Copiar cURL</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-3 bg-bg-card border border-border-base/60 rounded-xl text-xs font-mono text-text-muted overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
              {curlCommand}
            </pre>
          </div>
        </div>
      )}
    </ResourceDetailDrawer>
  );
}
