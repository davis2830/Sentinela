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

export interface APICheckTableViewProps {
  targets: APICheckTarget[];
  selectedIds: string[];
  onToggleSelect: (target: APICheckTarget) => void;
  onSelectAll: () => void;
  onSelectTarget: (target: APICheckTarget) => void;
  onScan: (id: string, e: React.MouseEvent) => void;
  scanningId: string | null;
  onEdit: (target: APICheckTarget, e: React.MouseEvent) => void;
  onDelete: (target: APICheckTarget, e: React.MouseEvent) => void;
}

export default function APICheckTableView({
  targets,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onSelectTarget,
  onEdit,
  onDelete,
}: APICheckTableViewProps) {
  const allSelected =
    targets.length > 0 && selectedIds.length === targets.length;

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

  return (
    <div
      data-testid="connectivity-table"
      className="connectivity-directory-table min-w-0 max-w-full bg-bg-card border border-border-base/70 rounded-2xl overflow-hidden shadow-sm"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border-base text-text-muted text-xs bg-bg-dark/80">
              {/* Checkbox select all */}
              <th scope="col" className="py-3 px-3.5 w-10">
                <SelectionCheckbox
                  checked={allSelected}
                  label="Seleccionar todos los recursos de esta página"
                  onChange={onSelectAll}
                />
              </th>
              <th scope="col" className="py-3 px-3">
                Método
              </th>
              <th scope="col" className="py-3 px-4">
                Servicio & Endpoint URL
              </th>
              <th scope="col" className="py-3 px-3">
                Estado HTTP
              </th>
              <th scope="col" className="py-3 px-3">
                Latencia Real vs Max
              </th>
              <th scope="col" className="py-3 px-3">
                Schema & Validación
              </th>
              <th scope="col" className="py-3 px-3">
                Frecuencia
              </th>
              <th scope="col" className="py-3 px-3">
                Último Check
              </th>
              <th scope="col" className="py-3 px-4 text-right">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-base/40 font-sans">
            {targets.map((target) => {
              const isSelected = selectedIds.includes(target.id);
              const hasSchema =
                target.expected_schema &&
                typeof target.expected_schema === "object" &&
                Object.keys(target.expected_schema).length > 0;

              const latency = target.last_response_time_ms;
              const maxLatency = target.expected_response_time_ms;

              return (
                <tr
                  key={target.id}
                  onClick={() => onSelectTarget(target)}
                  tabIndex={0}
                  aria-label={target.name}
                  onKeyDown={(e) => {
                    if (
                      e.target === e.currentTarget &&
                      (e.key === "Enter" || e.key === " ")
                    ) {
                      e.preventDefault();
                      onSelectTarget(target);
                    }
                  }}
                  className={`hover:bg-bg-card-hover/80 transition-colors cursor-pointer group ${
                    isSelected ? "bg-accent-green/[0.03]" : ""
                  }`}
                >
                  {/* Row checkbox */}
                  <td
                    className="py-3 px-3.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelect(target);
                    }}
                  >
                    <SelectionCheckbox
                      checked={isSelected}
                      label={`Seleccionar ${target.name}`}
                      onChange={() => onToggleSelect(target)}
                    />
                  </td>

                  {/* HTTP Method */}
                  <td className="py-3 px-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getMethodBadgeClass(
                        target.method,
                      )}`}
                    >
                      {target.method}
                    </span>
                  </td>

                  {/* Name and URL */}
                  <td className="py-3 px-4">
                    <div className="font-bold text-text-main group-hover:text-accent-green transition-colors text-sm">
                      {target.name}
                    </div>
                    <div className="text-xs font-mono text-text-dim truncate max-w-[280px] flex items-center gap-1 mt-0.5">
                      <span className="truncate">{target.url}</span>
                      <a
                        href={target.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-text-dim hover:text-accent-green shrink-0"
                        title="Abrir URL"
                      >
                        <ExternalLink size={11} />
                      </a>
                    </div>
                  </td>

                  {/* Status Badge & HTTP Code */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <StatusBadge
                        status={
                          hasMeasurement(target.last_checked_at)
                            ? target.last_status || "desconocido"
                            : "desconocido"
                        }
                      />
                      {target.last_http_status && (
                        <span className="font-mono text-xs text-text-muted font-bold">
                          {target.last_http_status}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Real Latency vs Max Expected */}
                  <td className="py-3 px-3 font-mono">
                    {latency !== null && latency !== undefined ? (
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-bold text-xs ${
                            healthPalette[apiResponseTone(target)].text
                          }`}
                        >
                          {Math.round(latency)}ms
                        </span>
                        <span className="text-text-dim text-xs">
                          / &lt;{maxLatency}ms
                        </span>
                      </div>
                    ) : (
                      <span className="text-text-dim font-mono text-xs">
                        &lt;{maxLatency}ms
                      </span>
                    )}
                  </td>

                  {/* Schema validation badge */}
                  <td className="py-3 px-3">
                    {hasSchema ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-accent-purple/10 text-accent-purple border border-accent-purple/30 font-mono">
                        <Code2 size={10} />
                        {Object.keys(target.expected_schema || {}).length}{" "}
                        Campos
                      </span>
                    ) : (
                      <span className="text-text-dim text-xs font-mono">
                        Sin Schema
                      </span>
                    )}
                  </td>

                  {/* Interval */}
                  <td className="py-3 px-3 text-sky-400 font-mono text-xs">
                    Cada {target.check_interval || 60}s
                  </td>

                  {/* Last Checked */}
                  <td className="py-3 px-3 text-text-dim font-mono text-xs whitespace-nowrap">
                    {target.last_checked_at ? (
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(target.last_checked_at).toLocaleTimeString(
                          "es-ES",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </span>
                    ) : (
                      "Nunca"
                    )}
                  </td>

                  {/* Inline Actions */}
                  <td className="py-3 px-4 text-right">
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ResourceActionButtons
                        label={`Acciones de ${target.name}`}
                        actions={[
                          {
                            label: "Editar target",
                            onClick: (e) => onEdit(target, e),
                            capability: "api_checks.update",
                            icon: (
                              <>
                                <Pencil size={14} />
                              </>
                            ),
                          },
                          {
                            label: "Eliminar target",
                            onClick: (e) => onDelete(target, e),
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
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
