import SelectionCheckbox from "../common/SelectionCheckbox";
import { TargetEnabledSwitch } from "./TargetTableControls";
import ResourceActionButtons from "../common/ResourceActionButtons";
import TargetLatency, { TargetDiagnostic } from "./TargetLatency";

import {
  Globe,
  Lock,
  Plug,
  Server,
  Trash2,
  Pencil,
  Bell,
  Activity,
  Layers,
} from "lucide-react";
import type { MonitoringTarget } from "../../types/monitoring";

const typeIcons: Record<string, typeof Globe> = {
  http: Globe,
  https: Globe,
  tcp: Server,
  dns: Globe,
  api: Plug,
  ssl: Lock,
};

const typeColors: Record<string, { bg: string; text: string; border: string }> =
  {
    https: {
      bg: "bg-sky-500/10",
      text: "text-sky-400",
      border: "border-sky-500/30",
    },
    http: {
      bg: "bg-blue-500/10",
      text: "text-blue-400",
      border: "border-blue-500/30",
    },
    tcp: {
      bg: "bg-purple-500/10",
      text: "text-purple-400",
      border: "border-purple-500/30",
    },
    dns: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      border: "border-emerald-500/30",
    },
    api: {
      bg: "bg-amber-500/10",
      text: "text-amber-400",
      border: "border-amber-500/30",
    },
    ssl: {
      bg: "bg-rose-500/10",
      text: "text-rose-400",
      border: "border-rose-500/30",
    },
  };

interface TargetCardProps {
  target: MonitoringTarget;
  onEdit: (target: MonitoringTarget) => void;
  onDelete: (target: MonitoringTarget) => void;
  onScan: (target: MonitoringTarget) => void;
  onToggle: (target: MonitoringTarget) => void;
  onAlert?: (target: MonitoringTarget) => void;
  isScanning?: boolean;
  onClick: (target: MonitoringTarget) => void;
  isSelected?: boolean;
  onSelectToggle?: (target: MonitoringTarget) => void;
}

export default function TargetCard({
  target,
  onEdit,
  onDelete,
  onToggle,
  onAlert,
  onClick,
  isSelected = false,
  onSelectToggle,
}: TargetCardProps) {
  const Icon = typeIcons[target.target_type] || Globe;
  const status = target.last_status || "unknown";
  const typeStyle = typeColors[target.target_type] || {
    bg: "bg-accent-green/10",
    text: "text-accent-green",
    border: "border-accent-green/30",
  };

  // Latency styling

  // Status badge with pulsing dot
  const renderStatusIndicator = () => {
    if (!target.enabled) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono bg-zinc-800 text-zinc-400 border border-zinc-700">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500"></span>
          Pausado
        </span>
      );
    }

    if (status === "up") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Online
        </span>
      );
    }

    if (status === "slow") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          Lento
        </span>
      );
    }

    if (status === "down" || status === "error") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
          </span>
          Caído
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-500"></span>
        Desconocido
      </span>
    );
  };

  // Generate 20 blocks for the mini uptime sparkline
  const recentChecks =
    target.recent_checks && target.recent_checks.length > 0
      ? target.recent_checks
      : Array.from({ length: 16 }).map((_, i) => ({
          status: target.enabled
            ? status === "up"
              ? "up"
              : status === "slow"
                ? "slow"
                : "down"
            : "disabled",
          latency: target.last_latency,
          checked_at: new Date(
            Date.now() - (15 - i) * (target.interval || 60) * 1000,
          ).toISOString(),
        }));

  return (
    <div
      data-testid="connectivity-card"
      className={`group relative flex h-full flex-col bg-bg-card border rounded-xl p-4 cursor-pointer transition-colors duration-200 ${
        isSelected
          ? "border-accent-green bg-accent-green/5 ring-2 ring-accent-green/30"
          : "border-border-base/70 hover:border-accent-green/40 hover:bg-bg-card"
      }`}
      onClick={() => onClick(target)}
    >
      {/* Top row: Checkbox, Icon, Title, Status & Actions */}
      <div className="flex items-start justify-between gap-3 mb-3.5">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {/* Custom Selection Checkbox Button */}

          {/* Type Icon */}
          <div
            className={`w-10 h-10 rounded-xl ${typeStyle.bg} border ${typeStyle.border} flex items-center justify-center shrink-0 shadow-inner`}
          >
            <Icon className={typeStyle.text} size={18} />
          </div>

          {/* Name & Endpoint with padding */}
          <div className="min-w-0 flex-1 pl-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className="font-semibold text-text-main text-sm truncate max-w-[170px]"
                title={target.name}
              >
                {target.name}
              </h3>
              {renderStatusIndicator()}
              {target.runner_type === "agent" && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                    target.agent_probe_online === false ||
                    target.agent_probe_status === "offline"
                      ? "bg-accent-red/10 text-accent-red border-accent-red/30"
                      : "bg-accent-purple/10 text-accent-purple border-accent-purple/30"
                  }`}
                  title={
                    target.agent_probe_online === false ||
                    target.agent_probe_status === "offline"
                      ? `Atención: Guardián Senti9 (${target.agent_probe_name || "LAN"}) desconectado`
                      : `Sondeado localmente por Guardián Senti9: ${target.agent_probe_name || "LAN"}`
                  }
                >
                  <Server size={10} />
                  <span>Senti9: {target.agent_probe_name || "LAN"}</span>
                  {(target.agent_probe_online === false ||
                    target.agent_probe_status === "offline") && (
                    <span className="text-xs text-accent-red font-mono">
                      (Offline)
                    </span>
                  )}
                </span>
              )}
            </div>
            <p
              className="text-xs text-text-dim font-mono truncate mt-1"
              title={target.endpoint}
            >
              {target.endpoint}
            </p>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center shrink-0">
          <ResourceActionButtons
            label={`Acciones de ${target.name}`}
            actions={[
              ...(onAlert
                ? [
                    {
                      label: "Vincular regla de alerta",
                      capability: "alerts.create" as const,
                      icon: <Bell size={16} />,
                      onClick: () => onAlert?.(target),
                    },
                  ]
                : []),
              {
                label: "Editar target",
                onClick: (e) => {
                  e.stopPropagation();
                  onEdit(target);
                },
                capability: "monitoring.update",
                icon: (
                  <>
                    <Pencil size={14} />
                  </>
                ),
              },
              {
                label: "Eliminar target",
                onClick: (e) => {
                  e.stopPropagation();
                  onDelete(target);
                },
                capability: "monitoring.delete",
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

      {/* Tags row */}
      {target.tags && target.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3.5">
          {target.tags.map((tag) => (
            <span
              key={tag}
              className="px-2.5 py-0.5 bg-bg-dark/80 border border-border-base/80 text-xs text-text-muted rounded-full font-medium"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Mini Uptime Sparkline / Blocks Bar */}
      <div className="mt-auto mb-3.5 pt-3 border-t border-border-base/40">
        <div className="flex items-center justify-between text-xs text-text-dim mb-2">
          <span className="flex items-center gap-1.5 font-medium">
            <Activity size={12} className="text-accent-green" /> Disponibilidad
            Reciente
          </span>
          <TargetLatency target={target} />
        </div>
        <TargetDiagnostic target={target} />
        <div className="flex items-center gap-1 h-2.5 w-full">
          {recentChecks.slice(-18).map((c, idx) => {
            let bgClass = "bg-zinc-700";
            if (c.status === "up")
              bgClass = "bg-emerald-500 hover:bg-emerald-400";
            else if (c.status === "slow")
              bgClass = "bg-amber-400 hover:bg-amber-300";
            else if (c.status === "down" || c.status === "error")
              bgClass = "bg-rose-500 hover:bg-rose-400";

            return (
              <div
                key={idx}
                className={`flex-1 h-full rounded-full transition-transform hover:scale-125 cursor-pointer ${bgClass}`}
                title={`Check ${idx + 1}: ${c.status.toUpperCase()} ${c.latency ? `(${c.latency.toFixed(0)}ms)` : ""}`}
              />
            );
          })}
        </div>
      </div>

      {/* Bottom row: Protocol, Interval, Latency & Switch */}
      <div className="flex items-center justify-between pt-2.5 border-t border-border-base/30 text-xs relative pl-11">
        <div data-card-selection className="absolute bottom-0 left-0">
          {onSelectToggle && (
            <SelectionCheckbox
              checked={isSelected}
              label={`Seleccionar ${target.name}`}
              onChange={() => onSelectToggle?.(target)}
            />
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}
          >
            {target.target_type}
          </span>
          <span className="text-text-dim text-xs">cada {target.interval}s</span>
          {target.owner_team_name && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border"
              style={{
                backgroundColor: `${target.owner_team_color || "#8B5CF6"}15`,
                borderColor: `${target.owner_team_color || "#8B5CF6"}40`,
                color: target.owner_team_color || "#A78BFA",
              }}
            >
              <Layers size={10} className="shrink-0" />
              <span className="truncate max-w-[100px]">
                {target.owner_team_name}
              </span>
            </span>
          )}
        </div>

        <TargetEnabledSwitch
          enabled={target.enabled}
          onChange={() => onToggle(target)}
        />
      </div>
    </div>
  );
}
