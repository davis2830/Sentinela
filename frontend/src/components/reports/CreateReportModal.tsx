import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { CreateReportData, ReportType } from '../../types/reports';
import {
  X,
  FileText,
  ShieldCheck,
  Activity,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Layers,
  Search,
  CheckSquare,
  Square,
  Loader2,
  Sparkles,
} from 'lucide-react';

interface CreateReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateReportData) => void;
  isSubmitting: boolean;
}

export default function CreateReportModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}: CreateReportModalProps) {
  const [reportTitle, setReportTitle] = useState(
    `Reporte Ejecutivo SLA - ${new Date().toLocaleDateString('es-ES', {
      month: 'long',
      year: 'numeric',
    })}`
  );
  const [reportType, setReportType] = useState<ReportType>('sla');
  const [periodPreset, setPeriodPreset] = useState<'24h' | '7d' | 'current_month' | 'prev_month' | 'custom'>('current_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [slaTarget, setSlaTarget] = useState<number>(99.9);

  // Target Scope
  const [scopeMode, setScopeMode] = useState<'all' | 'specific'>('all');
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [targetSearch, setTargetSearch] = useState('');

  // Fetch monitoring targets for the picker
  const { data: monitoringTargets } = useQuery({
    queryKey: ['monitoring-targets-picker'],
    queryFn: async () => {
      const res = await api.get('monitoring/');
      return (res.data?.data || []) as {
        id: string;
        name: string;
        endpoint: string;
        target_type: string;
      }[];
    },
    enabled: isOpen && scopeMode === 'specific',
  });

  if (!isOpen) return null;

  const filteredTargets = (monitoringTargets || []).filter(
    (t) =>
      t.name.toLowerCase().includes(targetSearch.toLowerCase()) ||
      t.endpoint.toLowerCase().includes(targetSearch.toLowerCase())
  );

  const handleToggleTarget = (id: string) => {
    setSelectedTargetIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllTargets = () => {
    if (selectedTargetIds.length === filteredTargets.length) {
      setSelectedTargetIds([]);
    } else {
      setSelectedTargetIds(filteredTargets.map((t) => t.id));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTitle.trim()) return;

    let startISO: string | undefined;
    let endISO: string | undefined;
    const now = new Date();

    if (periodPreset === '24h') {
      startISO = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
      endISO = now.toISOString();
    } else if (periodPreset === '7d') {
      startISO = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
      endISO = now.toISOString();
    } else if (periodPreset === 'current_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      startISO = firstDay.toISOString();
      endISO = now.toISOString();
    } else if (periodPreset === 'prev_month') {
      const firstDayPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayPrev = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      startISO = firstDayPrev.toISOString();
      endISO = lastDayPrev.toISOString();
    } else if (periodPreset === 'custom' && customStart && customEnd) {
      startISO = new Date(customStart).toISOString();
      endISO = new Date(customEnd).toISOString();
    }

    const payload: CreateReportData = {
      title: reportTitle.trim(),
      report_type: reportType,
      period_start: startISO,
      period_end: endISO,
      sla_target: slaTarget,
      target_ids: scopeMode === 'specific' ? selectedTargetIds : [],
    };

    onSubmit(payload);
  };

  const typeOptions: { type: ReportType; label: string; desc: string; icon: any }[] = [
    {
      type: 'sla',
      label: 'SLA Contractual',
      desc: 'Disponibilidad, Error Budget y cumplimiento de acuerdos SRE',
      icon: <ShieldCheck size={16} className="text-accent-green" />,
    },
    {
      type: 'availability',
      label: 'Disponibilidad & Uptime',
      desc: 'Desglose granular de chequeos Up, Down, Slow y Error',
      icon: <Activity size={16} className="text-sky-400" />,
    },
    {
      type: 'incidents',
      label: 'Incidentes & MTTR',
      desc: 'Análisis de causas raíz, tiempos de reparación y post-mortems',
      icon: <AlertTriangle size={16} className="text-accent-red" />,
    },
    {
      type: 'trends',
      label: 'Tendencias & Latencia',
      desc: 'Comportamiento de tiempos de respuesta a lo largo del tiempo',
      icon: <TrendingUp size={16} className="text-accent-yellow" />,
    },
    {
      type: 'ssl',
      label: 'Certificados SSL',
      desc: 'Inventario criptográfico, fechas de vencimiento y vigencia TLS',
      icon: <ShieldCheck size={16} className="text-accent-purple" />,
    },
    {
      type: 'summary',
      label: 'Resumen Ejecutivo Global',
      desc: 'Visión 360° consolidada para directores y comités de auditoría',
      icon: <FileText size={16} className="text-text-main" />,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-bg-card border border-border-base rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-base">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-accent-green/10 text-accent-green border border-accent-green/20">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-main">
                Generar Informe Oficial de Auditoría
              </h2>
              <p className="text-xs text-text-dim">
                Cálculo automatizado de métricas SLA, MTTR y Error Budget
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-text-dim hover:text-text-main rounded-lg hover:bg-bg-card-hover transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase mb-1.5">
              Título del Reporte
            </label>
            <input
              type="text"
              required
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              placeholder="Ej. Reporte Ejecutivo SLA Mensual"
              className="w-full px-3.5 py-2.5 bg-bg-main border border-border-base rounded-xl text-xs text-text-main placeholder-text-dim focus:outline-none focus:border-accent-green transition-colors"
            />
          </div>

          {/* Report Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase mb-2">
              Tipo de Informe
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {typeOptions.map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => setReportType(opt.type)}
                  className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                    reportType === opt.type
                      ? 'border-accent-green bg-accent-green/[0.04] ring-1 ring-accent-green/30'
                      : 'border-border-base bg-bg-main/50 hover:bg-bg-main hover:border-border-accent'
                  }`}
                >
                  <div className="p-1 rounded-lg bg-bg-card border border-border-base mt-0.5">
                    {opt.icon}
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-text-main block">
                      {opt.label}
                    </span>
                    <span className="text-[11px] text-text-dim line-clamp-1">
                      {opt.desc}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Contractual SLA Goal (if SLA report) */}
          {(reportType === 'sla' || reportType === 'summary') && (
            <div className="p-3.5 bg-bg-main/60 border border-border-base/70 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-accent-green" />
                  Meta Contractual de SLA (Objetivo)
                </label>
                <span className="text-xs font-mono font-bold text-accent-green">
                  {slaTarget}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                {[99.0, 99.5, 99.9, 99.99].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setSlaTarget(val)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium font-mono transition-all ${
                      slaTarget === val
                        ? 'bg-accent-green text-black font-semibold shadow-sm'
                        : 'bg-bg-card border border-border-base text-text-muted hover:text-text-main'
                    }`}
                  >
                    {val}%
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Period Presets */}
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase mb-1.5">
              Período de Análisis
            </label>
            <div className="grid grid-cols-5 gap-1.5 text-xs">
              {[
                { id: '24h', label: '24 Horas' },
                { id: '7d', label: '7 Días' },
                { id: 'current_month', label: 'Mes en Curso' },
                { id: 'prev_month', label: 'Mes Anterior' },
                { id: 'custom', label: 'Personalizado' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriodPreset(p.id as any)}
                  className={`py-2 px-1 text-center rounded-xl text-[11px] font-medium transition-all ${
                    periodPreset === p.id
                      ? 'bg-accent-green/10 text-accent-green border border-accent-green/30 font-semibold'
                      : 'bg-bg-main border border-border-base text-text-muted hover:text-text-main'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom Range pickers */}
            {periodPreset === 'custom' && (
              <div className="grid grid-cols-2 gap-3 mt-3 animate-in fade-in">
                <div>
                  <label className="text-[11px] text-text-dim block mb-1">Fecha Inicio</label>
                  <input
                    type="date"
                    required={periodPreset === 'custom'}
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full px-3 py-2 bg-bg-main border border-border-base rounded-xl text-xs text-text-main focus:outline-none focus:border-accent-green"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-text-dim block mb-1">Fecha Fin</label>
                  <input
                    type="date"
                    required={periodPreset === 'custom'}
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full px-3 py-2 bg-bg-main border border-border-base rounded-xl text-xs text-text-main focus:outline-none focus:border-accent-green"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Target Scope Picker */}
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase mb-1.5">
              Alcance de Objetivos (Scope)
            </label>
            <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
              <button
                type="button"
                onClick={() => setScopeMode('all')}
                className={`py-2 px-3 rounded-xl border text-center transition-all ${
                  scopeMode === 'all'
                    ? 'border-accent-green bg-accent-green/10 text-accent-green font-semibold'
                    : 'border-border-base bg-bg-main text-text-muted hover:text-text-main'
                }`}
              >
                Todos los Objetivos
              </button>
              <button
                type="button"
                onClick={() => setScopeMode('specific')}
                className={`py-2 px-3 rounded-xl border text-center transition-all ${
                  scopeMode === 'specific'
                    ? 'border-accent-purple bg-accent-purple/10 text-accent-purple font-semibold'
                    : 'border-border-base bg-bg-main text-text-muted hover:text-text-main'
                }`}
              >
                Objetivos Específicos ({selectedTargetIds.length})
              </button>
            </div>

            {/* Target Picker List */}
            {scopeMode === 'specific' && (
              <div className="border border-border-base rounded-xl p-3 bg-bg-main/70 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between gap-2">
                  <div className="relative flex-1">
                    <Search
                      size={13}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim"
                    />
                    <input
                      type="text"
                      value={targetSearch}
                      onChange={(e) => setTargetSearch(e.target.value)}
                      placeholder="Filtrar por nombre o URL..."
                      className="w-full pl-8 pr-3 py-1.5 bg-bg-card border border-border-base rounded-lg text-xs text-text-main placeholder-text-dim focus:outline-none focus:border-accent-purple"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSelectAllTargets}
                    className="text-[11px] text-text-dim hover:text-text-main underline px-2 py-1 shrink-0"
                  >
                    {selectedTargetIds.length === filteredTargets.length
                      ? 'Deseleccionar'
                      : 'Seleccionar todos'}
                  </button>
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1 divide-y divide-border-base/20 pr-1">
                  {filteredTargets.map((t) => {
                    const isChecked = selectedTargetIds.includes(t.id);
                    return (
                      <div
                        key={t.id}
                        onClick={() => handleToggleTarget(t.id)}
                        className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-bg-card-hover/50 cursor-pointer transition-colors"
                      >
                        <button type="button" className="text-text-dim">
                          {isChecked ? (
                            <CheckSquare size={15} className="text-accent-purple" />
                          ) : (
                            <Square size={15} />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-text-main text-xs block truncate">
                            {t.name}
                          </span>
                          <span className="text-[10px] text-text-dim font-mono truncate block">
                            {t.endpoint}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono uppercase bg-border-base/40 px-1.5 py-0.5 rounded text-text-muted shrink-0">
                          {t.target_type}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="pt-3 border-t border-border-base flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-xs font-medium text-text-muted hover:text-text-main hover:bg-bg-card-hover transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (scopeMode === 'specific' && selectedTargetIds.length === 0)}
              className="flex items-center gap-2 bg-accent-green text-black font-semibold px-6 py-2 rounded-full text-xs hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Generando Informe...
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  Generar Informe Oficial
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
