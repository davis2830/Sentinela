import ResourceActionButtons from "../common/ResourceActionButtons";
import SelectionCheckbox from "../common/SelectionCheckbox";
import {
  apiResponseTone,
  hasMeasurement,
  healthPalette,
} from "../../utils/healthPresentation";

import React from "react";
import type { APICheckTarget } from "../../types/api_checks";
import StatusBadge from "../common/StatusBadge";
import { Clock, Pencil, Trash2, ExternalLink, Code2 } from "lucide-react";

export interface APICheckCardProps {
  target: APICheckTarget;
  isSelected: boolean;
  onToggleSelect: () => void;
  onClick: () => void;
  onScan: (e: React.MouseEvent) => void;
  isScanning: boolean;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

export default function APICheckCard({
  target,
  isSelected,
  onToggleSelect,
  onClick,
  onEdit,
  onDelete,
}: APICheckCardProps) {
  const getMethodBadgeClass = (method: string) => {
    switch (method.toUpperCase()) {
      case "GET":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "POST":
        return "bg-sky-500/10 text-sky-400 border-sky-500/30";
      case "PUT":
      case "PATCH":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      case "DELETE":
        return "bg-rose-500/10 text-rose-400 border-rose-500/30";
      case "HEAD":
        return "bg-purple-500/10 text-purple-400 border-purple-500/30";
      default:
        return "bg-zinc-800 text-zinc-300 border-zinc-700";
    }
  };

  const isUp = target.enabled && target.last_status === "pass";
  const hasSchema =
    target.expected_schema &&
    typeof target.expected_schema === "object" &&
    Object.keys(target.expected_schema).length > 0;

  const latency = target.last_response_time_ms;
  const maxLatency = target.expected_response_time_ms;

  return (
    <div
      data-testid="connectivity-card"
      onClick={onClick}
      className={`bg-bg-card border rounded-2xl p-5 hover:border-accent-green/50 transition-all flex flex-col justify-between cursor-pointer group shadow-sm relative ${
        isSelected
          ? "border-accent-green bg-accent-green/[0.02] ring-1 ring-accent-green/40"
          : "border-border-base/70"
      }`}
    >
      <div>
        {/* Top bar: Checkbox + Method + Name + Radar & Status */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 overflow-hidden">
            {/* Selection Checkbox */}

            {/* Method Badge */}
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border shrink-0 font-mono ${getMethodBadgeClass(
                target.method,
              )}`}
            >
              {target.method}
            </span>

            {/* Name */}
            <h3
              className="font-bold text-text-main truncate text-base group-hover:text-accent-green transition-colors font-sans"
              title={target.name}
            >
              {target.name}
            </h3>
          </div>

          {/* Status & Live Radar */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isUp && (
              <span className="relative flex h-2 w-2 mr-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            )}
            <StatusBadge
              status={
                hasMeasurement(target.last_checked_at)
                  ? target.last_status || "desconocido"
                  : "desconocido"
              }
            />
          </div>
        </div>

        {/* Endpoint URL with external link */}
        <div className="flex items-center gap-1 text-xs font-mono text-text-dim truncate mb-4">
          <span className="truncate" title={target.url}>
            {target.url}
          </span>
          <a
            href={target.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-text-dim hover:text-accent-green shrink-0 ml-0.5"
            title="Abrir URL"
          >
            <ExternalLink size={12} />
          </a>
        </div>

        {/* Key Metrics Grid */}
        <div className="space-y-2 text-xs font-mono text-text-muted bg-bg-dark/50 rounded-xl p-3 border border-border-base/40">
          <div className="flex justify-between border-b border-border-base/40 pb-1.5 font-sans">
            <span className="text-text-dim font-medium">Status HTTP:</span>
            <div className="flex items-center gap-1.5 font-mono font-bold">
              {target.last_http_status && (
                <span className="text-text-main">
                  {target.last_http_status}
                </span>
              )}
              <span className="text-text-dim text-xs">
                (esperado {target.expected_status})
              </span>
            </div>
          </div>

          <div className="flex justify-between border-b border-border-base/40 pb-1.5 font-sans">
            <span className="text-text-dim font-medium">Latencia:</span>
            <div className="flex items-center gap-1.5 font-mono">
              {latency !== null && latency !== undefined ? (
                <span
                  className={`font-bold ${
                    healthPalette[apiResponseTone(target)].text
                  }`}
                >
                  {Math.round(latency)}ms
                </span>
              ) : (
                <span className="text-text-dim">-</span>
              )}
              <span className="text-text-dim text-xs">
                / &lt;{maxLatency}ms
              </span>
            </div>
          </div>

          <div className="flex justify-between font-sans">
            <span className="text-text-dim font-medium">Esquema:</span>
            {hasSchema ? (
              <span className="inline-flex items-center gap-1 text-accent-purple font-mono font-medium text-xs">
                <Code2 size={11} />
                {Object.keys(target.expected_schema || {}).length} Campos
              </span>
            ) : (
              <span className="text-text-dim font-mono text-xs">
                Sin Schema
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer: Last checked time + Actions */}
      <div className="mt-4 pt-3 border-t border-border-base/40 flex items-center justify-between text-xs text-text-dim relative pl-11">
        <div data-card-selection className="absolute bottom-0 left-0">
          <SelectionCheckbox
            checked={isSelected}
            label={`Seleccionar ${target.name}`}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            capability="api_checks.update"
          />
        </div>

        <span className="flex items-center gap-1 font-mono text-xs">
          <Clock size={12} />
          {target.last_checked_at
            ? new Date(target.last_checked_at).toLocaleTimeString("es-ES", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "Nunca"}
        </span>

        <div className="flex items-center gap-1">
          <ResourceActionButtons
            label={`Acciones de ${target.name}`}
            actions={[
              {
                label: "Editar target",
                onClick: onEdit,
                capability: "api_checks.update",
                icon: (
                  <>
                    <Pencil size={14} />
                  </>
                ),
              },
              {
                label: "Eliminar target",
                onClick: onDelete,
                capability: "api_checks.delete",
                danger: true,
                icon: (
                  <>
                    <Trash2 size={14} />
                  </>
                ),
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
