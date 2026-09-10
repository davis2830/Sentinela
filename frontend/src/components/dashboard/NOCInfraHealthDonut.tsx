import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sliders, ChevronRight } from 'lucide-react';

interface NOCInfraHealthDonutProps {
  total: number;
  online: number;
  degraded: number;
  down: number;
  healthScore: number;
}

export default function NOCInfraHealthDonut({
  total,
  online,
  degraded,
  down,
  healthScore,
}: NOCInfraHealthDonutProps) {
  const navigate = useNavigate();

  // SVG Donut slice stroke calculations
  const size = 160;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Segment proportions
  const safeTotal = total > 0 ? total : 1;
  const onlinePct = online / safeTotal;
  const degradedPct = degraded / safeTotal;
  const downPct = down / safeTotal;

  const onlineLength = onlinePct * circumference;
  const degradedLength = degradedPct * circumference;
  const downLength = downPct * circumference;

  // Stroke dash offsets
  const onlineOffset = 0;
  const degradedOffset = -onlineLength;
  const downOffset = -(onlineLength + degradedLength);

  return (
    <div className="bg-bg-card border border-border-base rounded-2xl p-5 md:p-6 shadow-sm flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sliders size={16} className="text-accent-green" />
          <h3 className="text-sm font-bold tracking-wide text-text-main">
            Estado de Infraestructura
          </h3>
        </div>
        <button
          type="button"
          onClick={() => navigate('/monitoring')}
          className="text-xs text-text-muted hover:text-accent-green flex items-center gap-1 transition-colors cursor-pointer"
        >
          <span>Ver detalle</span>
          <ChevronRight size={13} />
        </button>
      </div>

      {/* Donut Chart and Breakdown */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6 my-auto flex-1 py-2">
        {/* SVG Donut */}
        <div className="relative shrink-0 flex items-center justify-center">
          <svg className="w-36 h-36 -rotate-90" viewBox={`0 0 ${size} ${size}`}>
            {/* Background empty track */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#1e293b"
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {/* Online Segment */}
            {online > 0 && (
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="#10b981"
                strokeWidth={strokeWidth}
                strokeDasharray={`${onlineLength} ${circumference}`}
                strokeDashoffset={onlineOffset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-700"
              />
            )}
            {/* Degraded Segment */}
            {degraded > 0 && (
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="#f59e0b"
                strokeWidth={strokeWidth}
                strokeDasharray={`${degradedLength} ${circumference}`}
                strokeDashoffset={degradedOffset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-700"
              />
            )}
            {/* Down Segment */}
            {down > 0 && (
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="#ef4444"
                strokeWidth={strokeWidth}
                strokeDasharray={`${downLength} ${circumference}`}
                strokeDashoffset={downOffset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-700"
              />
            )}
          </svg>

          {/* Center Info Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold font-mono text-text-main tracking-tight">
              {total}
            </span>
            <span className="text-[10px] font-semibold text-text-dim tracking-wider uppercase">
              Total
            </span>
          </div>
        </div>

        {/* Legend Breakdown List */}
        <div className="space-y-3 w-full sm:w-auto">
          <div className="flex items-center justify-between sm:justify-start gap-4">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span className="h-2.5 w-2.5 rounded-full bg-accent-green shadow-sm shadow-accent-green/50" />
              <span>Online</span>
            </div>
            <span className="font-mono font-bold text-xs text-text-main">{online}</span>
          </div>

          <div className="flex items-center justify-between sm:justify-start gap-4">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span className="h-2.5 w-2.5 rounded-full bg-accent-yellow shadow-sm shadow-accent-yellow/50" />
              <span>Degradados</span>
            </div>
            <span className="font-mono font-bold text-xs text-text-main">{degraded}</span>
          </div>

          <div className="flex items-center justify-between sm:justify-start gap-4">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span className="h-2.5 w-2.5 rounded-full bg-accent-red shadow-sm shadow-accent-red/50" />
              <span>Caídos</span>
            </div>
            <span className="font-mono font-bold text-xs text-text-main">{down}</span>
          </div>
        </div>
      </div>

      {/* Bottom Health Bar */}
      <div className="mt-4 pt-3 border-t border-border-base/50">
        <div className="flex justify-between items-center text-xs mb-1.5">
          <span className="text-text-dim">Salud general</span>
          <span className="font-mono font-bold text-accent-green">{healthScore}%</span>
        </div>
        <div className="w-full bg-bg-dark h-2 rounded-full overflow-hidden border border-border-base/60">
          <div
            className="h-full bg-gradient-to-r from-accent-green via-accent-green-glow to-accent-green transition-all duration-700"
            style={{ width: `${healthScore}%` }}
          />
        </div>
      </div>
    </div>
  );
}
