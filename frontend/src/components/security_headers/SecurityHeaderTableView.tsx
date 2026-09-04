import React from 'react';
import type { SecurityHeaderTarget } from '../../types/security_headers';
import GradeBadge from '../common/GradeBadge';
import {
  Clock,
  Pencil,
  Trash2,
  RefreshCw,
  ExternalLink,
  CheckSquare,
  Square,
  Shield,
  ShieldAlert,
  Lock,
  FileCode2,
  Layers,
  Zap,
} from 'lucide-react';

export interface SecurityHeaderTableViewProps {
  targets: SecurityHeaderTarget[];
  selectedIds: string[];
  onToggleSelect: (target: SecurityHeaderTarget) => void;
  onSelectAll: () => void;
  onSelectTarget: (target: SecurityHeaderTarget) => void;
  onScan: (id: string, e: React.MouseEvent) => void;
  scanningId: string | null;
  onEdit: (target: SecurityHeaderTarget, e: React.MouseEvent) => void;
  onDelete: (target: SecurityHeaderTarget, e: React.MouseEvent) => void;
}

export default function SecurityHeaderTableView({
  targets,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onSelectTarget,
  onScan,
  scanningId,
  onEdit,
  onDelete,
}: SecurityHeaderTableViewProps) {
  const allSelected =
    targets.length > 0 && selectedIds.length === targets.length;

  const calculateGrade = (target: SecurityHeaderTarget) => {
    if (target.last_grade) return target.last_grade;
    const score = target.last_score;
    if (score === null) return null;
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  };

  return (
    <div className="bg-bg-card/95 border border-border-base/70 rounded-2xl overflow-hidden shadow-sm font-sans">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border-base text-text-dim text-xs bg-bg-card/50">
              <th className="py-3 px-3.5 w-10">
                <button
                  type="button"
                  onClick={onSelectAll}
                  className="text-text-dim hover:text-accent-green transition-colors"
                  title={allSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
                >
                  {allSelected ? (
                    <CheckSquare size={16} className="text-accent-green" />
                  ) : (
                    <Square size={16} />
                  )}
                </button>
              </th>
              <th className="py-3 px-4">Endpoint / Servicio</th>
              <th className="py-3 px-3">Calificación</th>
              <th className="py-3 px-3">Blindaje Crítico</th>
              <th className="py-3 px-3">Latencia</th>
              <th className="py-3 px-3">Fuga de Stack</th>
              <th className="py-3 px-3">Monitoreo</th>
              <th className="py-3 px-3">Último Análisis</th>
              <th className="py-3 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-base/40">
            {targets.map((target) => {
              const isSelected = selectedIds.includes(target.id);
              const isScanning = scanningId === target.id;
              const grade = calculateGrade(target);

              return (
                <tr
                  key={target.id}
                  onClick={() => onSelectTarget(target)}
                  className={`hover:bg-bg-card-hover/80 transition-colors cursor-pointer group ${
                    isSelected ? 'bg-accent-green/[0.03]' : ''
                  }`}
                >
                  {/* Row Checkbox */}
                  <td
                    className="py-3 px-3.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelect(target);
                    }}
                  >
                    <button
                      type="button"
                      className="text-text-dim hover:text-accent-green transition-colors"
                    >
                      {isSelected ? (
                        <CheckSquare size={16} className="text-accent-green" />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                  </td>

                  {/* Name and URL */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Shield size={14} className="text-accent-green shrink-0" />
                      <span className="font-bold text-text-main group-hover:text-accent-green transition-colors text-sm">
                        {target.name}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-text-dim truncate max-w-[260px] flex items-center gap-1 mt-0.5">
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

                  {/* Grade & Score */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <GradeBadge grade={grade} score={target.last_score} />
                      {target.last_score !== null && (
                        <span className="font-mono font-bold text-xs text-text-muted">
                          {target.last_score} pts
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Critical Protections (HSTS, CSP, XFO) */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1 font-mono text-[10px]">
                      <span
                        className={`px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                          target.has_hsts
                            ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold'
                            : 'bg-bg-dark border border-border-base/40 text-text-dim'
                        }`}
                        title={target.has_hsts ? 'HSTS Activo' : 'HSTS Ausente'}
                      >
                        <Lock size={9} />
                        HSTS
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                          target.has_csp
                            ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold'
                            : 'bg-bg-dark border border-border-base/40 text-text-dim'
                        }`}
                        title={target.has_csp ? 'CSP Activo' : 'CSP Ausente'}
                      >
                        <FileCode2 size={9} />
                        CSP
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                          target.has_xfo
                            ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold'
                            : 'bg-bg-dark border border-border-base/40 text-text-dim'
                        }`}
                        title={target.has_xfo ? 'X-Frame-Options Activo' : 'XFO Ausente'}
                      >
                        <Layers size={9} />
                        XFO
                      </span>
                    </div>
                  </td>

                  {/* Latency */}
                  <td className="py-3 px-3 font-mono text-xs">
                    {target.last_response_time_ms !== null && target.last_response_time_ms !== undefined ? (
                      <span
                        className={`flex items-center gap-1 font-semibold ${
                          target.last_response_time_ms < 150
                            ? 'text-emerald-400'
                            : target.last_response_time_ms < 400
                            ? 'text-sky-400'
                            : 'text-amber-400'
                        }`}
                      >
                        <Zap size={11} />
                        {target.last_response_time_ms} ms
                      </span>
                    ) : (
                      <span className="text-text-dim">-</span>
                    )}
                  </td>

                  {/* Server Leak Detection */}
                  <td className="py-3 px-3">
                    {target.info_leak_detected ? (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-400 animate-pulse"
                        title={target.server_header || target.powered_by_header || 'Expone software de servidor'}
                      >
                        <ShieldAlert size={11} />
                        Fuga detectada
                      </span>
                    ) : (
                      <span className="text-emerald-400/80 text-[11px] font-mono">
                        Protegido
                      </span>
                    )}
                  </td>

                  {/* Monitoring Status */}
                  <td className="py-3 px-3 text-xs font-medium">
                    {target.enabled ? (
                      <span className="text-accent-green flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-green" /> Activo
                      </span>
                    ) : (
                      <span className="text-text-dim">Pausado</span>
                    )}
                  </td>

                  {/* Last Checked */}
                  <td className="py-3 px-3 text-text-dim font-mono text-xs whitespace-nowrap">
                    {target.last_checked_at ? (
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(target.last_checked_at).toLocaleTimeString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    ) : (
                      'Nunca'
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={(e) => onScan(target.id, e)}
                        disabled={isScanning}
                        className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors disabled:opacity-50"
                        title="Escanear cabeceras ahora"
                      >
                        <RefreshCw
                          size={14}
                          className={isScanning ? 'animate-spin' : ''}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => onEdit(target, e)}
                        className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors"
                        title="Editar endpoint"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => onDelete(target, e)}
                        className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded-full transition-colors"
                        title="Eliminar endpoint"
                      >
                        <Trash2 size={14} />
                      </button>
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
