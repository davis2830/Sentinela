import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Check,
  ChevronRight,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  Laptop,
  Loader2,
  Plus,
  RotateCw,
  Server,
  ShieldAlert,
  Terminal,
} from "lucide-react";
import { api } from "../../services/api";
import { apiFailure } from "../../services/errors";
import { useAuthStore } from "../../store/authStore";
import { useConnectivityRefresh } from "../../hooks/useConnectivityRefresh";
import { ActionFeedback, ReadFailure } from "../common/DirectoryState";
import RelativeTime, {
  formatExactDate,
  formatExactTime,
} from "../common/connectivity/RelativeTime";
import ResourceDetailDrawer from "../common/connectivity/ResourceDetailDrawer";
import RowActionMenu, {
  type RowActionMenuItem,
} from "../common/connectivity/RowActionMenu";
import { StatusShapeIcon } from "../common/connectivity/StatusPill";
import { TargetEnabledSwitch } from "./TargetTableControls";
import ProbeTelemetry from "./ProbeTelemetry";
import { InstallationInstructions } from "./Senti9Setup";
import { PlatformPicker } from "./Senti9Installation";
import {
  GUARDIAN_QUEUE_WARN_THRESHOLD,
  GUARDIAN_STATE_META,
  getGuardianHealthState,
  getGuardianPlatform,
  getGuardianQueueTotal,
  isGuardianVersionOutdated,
} from "./useGuardians";
import type { GuardianActionSection } from "./Senti9TableView";
import type { AgentProbe, ProbeInstallation } from "../../types/agent_probe";
import type { MonitoringTarget } from "../../types/monitoring";

type DetailProbe = AgentProbe & {
  impact?: { assigned: number; to_pause: number; pending: number };
};

interface Senti9DetailDrawerProps {
  probeId: string;
  probes: AgentProbe[];
  initialSection?: GuardianActionSection;
  admin: boolean;
  canCreateMonitor: boolean;
  onSelectProbeId: (id: string) => void;
  onCreateMonitor: (probeId: string) => void;
  onToggleProbe: (probe: AgentProbe) => void;
  onClose: () => void;
}

export default function Senti9DetailDrawer({
  probeId,
  probes,
  initialSection = "operation",
  admin,
  canCreateMonitor,
  onSelectProbeId,
  onCreateMonitor,
  onToggleProbe,
  onClose,
}: Senti9DetailDrawerProps) {
  const organization = useAuthStore((s) => s.user?.organization?.id);
  const queryClient = useQueryClient();
  const refresh = useConnectivityRefresh();

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [platform, setPlatform] = useState<"linux" | "windows">("linux");
  const [action, setAction] = useState<"rotate" | "revoke" | null>(
    initialSection === "revoke" ? "revoke" : null,
  );
  const [reason, setReason] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  // Prev/Next navigation across sorted guardians
  const currentIdx = probes.findIndex((p) => p.id === probeId);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx >= 0 && currentIdx < probes.length - 1;
  const goPrev = () => {
    if (hasPrev) onSelectProbeId(probes[currentIdx - 1].id);
  };
  const goNext = () => {
    if (hasNext) onSelectProbeId(probes[currentIdx + 1].id);
  };

  const detailQuery = useQuery<DetailProbe>({
    queryKey: ["agent-probe-detail", organization, probeId],
    queryFn: async ({ signal }) =>
      (await api.get(`agent-probes/${probeId}/detail/`, { signal })).data.data,
    refetchInterval: (q) => {
      refresh.refetchInterval(q);
      return refresh.enabled ? 15000 : false;
    },
    refetchIntervalInBackground: false,
  });

  const fallbackProbe = probes.find((p) => p.id === probeId);
  const probe = detailQuery.data || (fallbackProbe as DetailProbe | undefined);
  const state = probe ? getGuardianHealthState(probe) : "pending";
  const meta = GUARDIAN_STATE_META[state];
  const isRevoked = state === "revoked";
  const isPaused = state === "paused";
  const isPending = state === "pending";
  const isDisconnected = state === "disconnected";
  const isStale = state === "stale_signal";

  // Fetch assigned LAN monitors for this guardian
  const monitorsQuery = useQuery<MonitoringTarget[]>({
    queryKey: ["agent-probe-monitors", organization, probeId],
    queryFn: async ({ signal }) => {
      const res = await api.get("monitoring/", {
        params: { agent: probeId, page_size: 20 },
        signal,
      });
      return res.data?.data || [];
    },
    enabled: Boolean(probeId),
  });

  // Fetch installation profile when admin & not revoked
  const installQuery = useQuery<ProbeInstallation>({
    queryKey: ["agent-probe-install", organization, probeId, platform],
    queryFn: async ({ signal }) =>
      (
        await api.get(`agent-probes/${probeId}/installation/`, {
          params: { platform },
          signal,
        })
      ).data.data,
    enabled: admin && Boolean(probe) && !isRevoked,
  });

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  const applySecurityAction = async () => {
    if (!action) return;
    setBusy(true);
    setMessage("");
    try {
      const res = await api.post(
        `agent-probes/${probeId}/${action === "rotate" ? "rotate-token" : "revoke"}/`,
        action === "revoke" ? { reason } : {},
      );
      if (action === "rotate") {
        setToken(res.data.data.raw_token);
      }
      setAction(null);
      setReason("");
      setMessage(
        action === "rotate"
          ? "Token rotado. Guarda el nuevo secreto y actualiza el contenedor antes de reiniciar."
          : "Guardián revocado. Sus monitores LAN asignados quedaron pausados.",
      );
      await detailQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: ["agent-probes"] });
      void queryClient.invalidateQueries({ queryKey: ["monitoring-targets"] });
    } catch (e) {
      setMessage(
        apiFailure(e).message ||
          "No se pudo completar la operación. Revisa el estado actual e intenta nuevamente.",
      );
    } finally {
      setBusy(false);
    }
  };

  const assignedMonitors = monitorsQuery.data || [];
  const queueTotal = probe ? getGuardianQueueTotal(probe) : 0;
  const queueWarn = queueTotal >= GUARDIAN_QUEUE_WARN_THRESHOLD;
  const probePlatform = probe ? getGuardianPlatform(probe) : "linux";
  const outdated = probe ? isGuardianVersionOutdated(probe) : false;
  const identifier = probe?.hostname || probeId.slice(0, 12);
  const pendingDeliveries = probe?.delivery?.pending ?? 0;
  const overdueDeliveries = probe?.delivery?.overdue ?? 0;

  const iconClassName =
    meta.tone === "success"
      ? "text-emerald-400"
      : meta.tone === "danger"
        ? "text-rose-400"
        : meta.tone === "warning"
          ? "text-amber-400"
          : "text-slate-400";

  const overflowItems: RowActionMenuItem[] =
    admin && !isRevoked
      ? [
          {
            id: "rotate",
            label: "Rotar token",
            icon: <RotateCw size={13} className="text-amber-400" />,
            onClick: () => {
              setToken("");
              setAction("rotate");
            },
          },
          {
            id: "revoke",
            label: "Revocar guardián",
            icon: <ShieldAlert size={13} />,
            danger: true,
            dividerBefore: true,
            onClick: () => {
              setToken("");
              setAction("revoke");
            },
          },
        ]
      : [];

  const headerExtra = (
    <div className="space-y-2">
      {/* Metadata single line */}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-text-muted">
        <button
          type="button"
          onClick={() => void handleCopy(identifier, "id")}
          title="Copiar identificador"
          className="inline-flex items-center gap-1 hover:text-text-main transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green/60 rounded !min-h-0 !min-w-0"
        >
          <span>{identifier}</span>
          {copiedKey === "id" ? (
            <Check size={11} className="text-accent-green" />
          ) : (
            <Copy size={11} className="opacity-60" />
          )}
        </button>
        {probe?.ip_address && (
          <>
            <span>·</span>
            <span>{probe.ip_address}</span>
          </>
        )}
        <span>·</span>
        <span className="inline-flex items-center gap-1">
          {probePlatform === "windows" ? (
            <Laptop size={11} className="text-sky-400" />
          ) : (
            <Cpu size={11} className="text-emerald-400" />
          )}
          <span>{probePlatform === "windows" ? "Windows" : "Linux"}</span>
        </span>
        {probe?.version && (
          <>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <span>v{probe.version}</span>
              {outdated && (
                <span
                  className="px-1.5 py-0.2 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px]"
                  title={
                    probe.latest_version
                      ? `Última versión: v${probe.latest_version}`
                      : "Actualización disponible"
                  }
                >
                  Actualización disponible
                </span>
              )}
            </span>
          </>
        )}
      </div>

      {/* Primary CTA (+ Monitor) + Toggle + Shared RowActionMenu */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div className="flex items-center gap-2">
          {!isRevoked && canCreateMonitor && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onCreateMonitor(probeId);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent-green hover:bg-accent-green/90 text-black transition-colors cursor-pointer !min-h-0"
            >
              <Plus size={14} />
              <span>Monitor</span>
            </button>
          )}
          {(probe?.assigned_targets_count ?? 0) > 0 && (
            <Link
              to={`/monitoring?agent=${probeId}`}
              onClick={onClose}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-bg-card border border-border-base text-text-muted hover:text-text-main hover:bg-bg-card-hover transition-colors"
            >
              <span>Abrir en Uptime</span>
              <ExternalLink size={12} />
            </Link>
          )}
        </div>

        {admin && !isRevoked && probe && (
          <div className="flex items-center gap-2">
            <TargetEnabledSwitch
              enabled={probe.enabled !== false}
              onChange={() => onToggleProbe(probe)}
              size="compact"
              activeLabel="Pausar guardián"
              inactiveLabel="Activar guardián"
            />
            <RowActionMenu
              resourceLabel={probe.name}
              forceVisible
              triggerTitle="Rotar token o revocar guardián"
              items={overflowItems}
              menuWidth={196}
              estimatedHeight={104}
            />
          </div>
        )}
      </div>
    </div>
  );

  const footer = probe ? (
    <div className="flex items-center justify-between gap-2">
      <span>
        {probe.last_heartbeat ? (
          <>
            Último latido <RelativeTime value={probe.last_heartbeat} /> · agente
            Senti9
          </>
        ) : (
          "Esperando primera señal · agente Senti9"
        )}
      </span>
      {probe.version && (
        <span className="text-text-dim">v{probe.version}</span>
      )}
    </div>
  ) : undefined;

  return (
    <ResourceDetailDrawer
      focusKey={probeId}
      ariaLabel={probe?.name || "Detalle de guardián"}
      title={probe?.name || "Guardián Senti9"}
      status={{
        label: meta.label,
        tone: meta.tone,
        shape: meta.shape,
        iconClassName,
      }}
      hasPrev={hasPrev}
      hasNext={hasNext}
      onPrev={goPrev}
      onNext={goNext}
      prevLabel="Guardián anterior"
      nextLabel="Guardián siguiente"
      headerExtra={headerExtra}
      footer={footer}
      onClose={onClose}
    >
      <div className="space-y-4 text-xs">
        {detailQuery.isError && (
          <ReadFailure stale={!!probe} retry={detailQuery.refetch} />
        )}
        <ActionFeedback>{message}</ActionFeedback>

        {!probe && detailQuery.isLoading && (
          <div className="flex items-center justify-center py-12 text-text-muted gap-2">
            <Loader2 size={18} className="animate-spin text-accent-green" />
            <span>Consultando estado del guardián...</span>
          </div>
        )}

        {probe && (
          <>
            {/* Contextual Banner: Disconnected / Stale / Pending / Paused / Revoked */}
            {(isDisconnected || isStale) && (
              <div
                className={`rounded-xl border p-3.5 space-y-1 ${
                  isDisconnected
                    ? "bg-rose-500/10 border-rose-500/35 text-rose-200"
                    : "bg-amber-500/10 border-amber-500/35 text-amber-200"
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-xs">
                  <AlertTriangle
                    size={14}
                    className={
                      isDisconnected ? "text-rose-400" : "text-amber-400"
                    }
                  />
                  <span>
                    {isDisconnected && probe.last_heartbeat
                      ? `Desconectado desde las ${formatExactTime(probe.last_heartbeat)}`
                      : "Sin señal reciente · latido atrasado"}
                  </span>
                </div>
                <p className="text-[11px] opacity-90 pl-5">
                  {(probe.active_targets_count ?? probe.assigned_targets_count) >
                  0
                    ? `${probe.active_targets_count ?? probe.assigned_targets_count} monitor(es) LAN asignados no pueden reportar mientras el guardián esté sin señal.`
                    : "Verifica el contenedor Docker o la conectividad saliente HTTPS del host."}
                </p>
              </div>
            )}

            {isPending && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-amber-200">
                    Esperando primera señal del host
                  </span>
                  <RelativeTime
                    value={probe.created_at}
                    prefix="esperando"
                    className="text-[11px] text-amber-300"
                  />
                </div>
                {installQuery.data?.command ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-text-muted">
                      <span>Ejecuta este comando en el servidor destino:</span>
                      <button
                        type="button"
                        onClick={() =>
                          void handleCopy(installQuery.data!.command, "cmd")
                        }
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-bg-dark border border-border-base text-text-main hover:border-accent-green transition-colors cursor-pointer !min-h-0"
                      >
                        {copiedKey === "cmd" ? (
                          <>
                            <Check size={11} className="text-accent-green" />
                            <span>Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy size={11} />
                            <span>Copiar comando</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="p-2.5 rounded-lg bg-bg-dark border border-border-base font-mono text-[11px] text-emerald-300 overflow-x-auto whitespace-pre-wrap break-all">
                      {installQuery.data.command}
                    </pre>
                  </div>
                ) : (
                  <p className="text-[11px] text-text-muted">
                    Despliega el contenedor Senti9 con el token generado al
                    registrar este guardián. Los latidos aparecerán en menos de
                    15 s.
                  </p>
                )}
              </div>
            )}

            {isPaused && (
              <div className="rounded-xl border border-slate-700 bg-bg-dark/60 p-3.5 flex items-center justify-between gap-3 text-slate-300">
                <div className="space-y-0.5 min-w-0">
                  <p className="font-semibold text-xs text-slate-200">
                    Guardián pausado
                  </p>
                  <p className="text-[11px] text-slate-400">
                    No despacha nuevos chequeos LAN mientras esté desactivado.
                    Su token sigue activo.
                  </p>
                </div>
                {admin && (
                  <button
                    type="button"
                    onClick={() => onToggleProbe(probe)}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent-green/15 hover:bg-accent-green text-accent-green hover:text-black border border-accent-green/35 transition-colors cursor-pointer !min-h-0"
                  >
                    Reactivar
                  </button>
                )}
              </div>
            )}

            {isRevoked && (
              <div className="rounded-xl border border-slate-700 bg-bg-dark/60 p-3.5 space-y-1 text-slate-400">
                <p className="font-semibold text-slate-300">
                  Guardián revocado el {formatExactDate(probe.revoked_at)}
                </p>
                {probe.revocation_reason && (
                  <p className="text-[11px]">
                    Motivo: {probe.revocation_reason}
                  </p>
                )}
                <p className="text-[11px] text-slate-500">
                  El token fue invalidado permanentemente y los monitores
                  asociados quedaron pausados.
                </p>
              </div>
            )}

            {/* Inline Security Confirmation Form (Rotate / Revoke) */}
            {action && admin && !isRevoked && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void applySecurityAction();
                }}
                className={`rounded-xl border p-4 space-y-3 ${
                  action === "revoke"
                    ? "border-rose-500/40 bg-rose-500/10"
                    : "border-amber-500/40 bg-amber-500/10"
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-text-main">
                  <AlertTriangle
                    size={15}
                    className={
                      action === "revoke" ? "text-rose-400" : "text-amber-400"
                    }
                  />
                  <span>
                    {action === "revoke"
                      ? "Confirmar revocación definitiva"
                      : "Confirmar rotación de token"}
                  </span>
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  {action === "revoke"
                    ? `Se pausarán automáticamente ${probe.impact?.to_pause ?? probe.active_targets_count ?? 0} monitor(es) LAN asignados. El token será destruido y el guardián no podrá volver a conectarse.`
                    : "El token anterior dejará de funcionar de inmediato. Actualiza el archivo o variable en el host antes de reiniciar el contenedor."}
                </p>
                {action === "revoke" && (
                  <label className="block space-y-1">
                    <span className="text-[11px] font-medium text-text-main">
                      Motivo (registro de auditoría):
                    </span>
                    <textarea
                      required
                      minLength={3}
                      maxLength={500}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Ej. Servidor retirado por migración de red..."
                      className="w-full min-h-[72px] rounded-lg bg-bg-dark border border-border-base p-2.5 text-xs text-text-main focus:border-accent-green focus:outline-none"
                    />
                  </label>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 !min-h-0 ${
                      action === "revoke"
                        ? "bg-rose-500 text-white hover:bg-rose-600"
                        : "bg-accent-green text-black hover:bg-accent-green/90"
                    }`}
                  >
                    {busy
                      ? "Procesando..."
                      : action === "revoke"
                        ? "Revocar y pausar monitores"
                        : "Generar nuevo token"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setAction(null)}
                    className="px-3 py-1.5 rounded-lg text-xs text-text-muted hover:text-text-main bg-bg-dark border border-border-base cursor-pointer !min-h-0"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {token && (
              <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-3.5 space-y-2">
                <p className="font-semibold text-emerald-400">
                  Nuevo token emitido. Solo se mostrará esta vez.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const url = URL.createObjectURL(
                      new Blob([token], { type: "text/plain" }),
                    );
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `senti9-${probeId.slice(0, 8)}-token.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-green text-black font-semibold text-xs cursor-pointer !min-h-0"
                >
                  <Download size={13} />
                  <span>Descargar archivo de token</span>
                </button>
              </div>
            )}

            {/* 3 Real Operational KPIs (no synthesized history) */}
            <section className="grid grid-cols-3 gap-2 font-mono">
              <div className="rounded-xl border border-border-base bg-bg-dark/60 p-3">
                <div className="text-[10px] uppercase tracking-wider text-text-dim">
                  Último latido
                </div>
                <div
                  className={`mt-1 text-sm font-bold truncate ${
                    isDisconnected
                      ? "text-rose-400"
                      : isStale
                        ? "text-amber-400"
                        : "text-text-main"
                  }`}
                >
                  <RelativeTime
                    value={probe.last_heartbeat}
                    emptyLabel="Sin señal"
                  />
                </div>
              </div>
              <div className="rounded-xl border border-border-base bg-bg-dark/60 p-3">
                <div className="text-[10px] uppercase tracking-wider text-text-dim">
                  Cola local
                </div>
                <div
                  className={`mt-1 text-sm font-bold ${
                    queueWarn ? "text-amber-400" : "text-text-main"
                  }`}
                  title="Mediciones locales en cola reportadas por telemetría del guardián"
                >
                  {probe.telemetry?.snapshot ? queueTotal : "—"}
                </div>
              </div>
              <div className="rounded-xl border border-border-base bg-bg-dark/60 p-3">
                <div className="text-[10px] uppercase tracking-wider text-text-dim">
                  Entregas
                </div>
                <div
                  className={`mt-1 text-sm font-bold truncate ${
                    overdueDeliveries > 0
                      ? "text-rose-400"
                      : pendingDeliveries > 0
                        ? "text-amber-300"
                        : "text-text-main"
                  }`}
                  title={`${pendingDeliveries} pendientes · ${overdueDeliveries} vencidas (registro del servidor)`}
                >
                  {overdueDeliveries > 0
                    ? `${overdueDeliveries} venc.`
                    : pendingDeliveries > 0
                      ? `${pendingDeliveries} pend.`
                      : "Al día"}
                </div>
              </div>
            </section>

            {/* Monitores LAN Asignados */}
            <section className="rounded-xl border border-border-base bg-bg-dark/50 overflow-hidden">
              <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border-base/70">
                <div className="flex items-center gap-2 font-semibold text-text-main">
                  <Server size={13} className="text-accent-green" />
                  <span>
                    Monitores LAN (
                    {probe.assigned_targets_count ?? assignedMonitors.length})
                  </span>
                </div>
                {(probe.assigned_targets_count ?? 0) > 0 && (
                  <Link
                    to={`/monitoring?agent=${probeId}`}
                    onClick={onClose}
                    className="text-[11px] text-accent-green hover:underline"
                  >
                    Ver todos
                  </Link>
                )}
              </div>

              {monitorsQuery.isLoading ? (
                <div className="p-4 flex items-center gap-2 text-text-muted">
                  <Loader2 size={13} className="animate-spin" />
                  <span>Cargando monitores...</span>
                </div>
              ) : assignedMonitors.length > 0 ? (
                <ul className="divide-y divide-border-base/50">
                  {assignedMonitors.map((m) => {
                    const mPaused = !m.enabled || isPaused;
                    const mGuardianPaused = m.enabled && isPaused;
                    const mGuardianDown =
                      !mPaused && (isDisconnected || isStale);
                    const mDown =
                      !mPaused &&
                      !mGuardianDown &&
                      (m.last_status === "down" || m.last_status === "error");

                    return (
                      <li key={m.id}>
                        <Link
                          to={`/monitoring?agent=${probeId}&target=${m.id}`}
                          onClick={onClose}
                          className="flex items-center justify-between gap-2 px-3.5 py-2 hover:bg-white/[0.03] transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <StatusShapeIcon
                              size={13}
                              shape={
                                mPaused
                                  ? "pause"
                                  : mGuardianDown
                                    ? "alert"
                                    : mDown
                                      ? "error"
                                      : "check"
                              }
                              className={
                                mPaused
                                  ? "text-slate-400"
                                  : mGuardianDown
                                    ? "text-amber-400"
                                    : mDown
                                      ? "text-rose-400"
                                      : "text-emerald-400"
                              }
                            />
                            <span className="truncate font-medium text-text-main">
                              {m.name}
                            </span>
                          </div>
                          <span className="font-mono text-[11px] shrink-0 text-text-muted">
                            {mGuardianPaused
                              ? "Pausado: guardián detenido"
                              : mPaused
                                ? "Pausado"
                                : mGuardianDown
                                  ? "Sin datos"
                                  : mDown
                                    ? "Caído"
                                    : m.last_latency != null
                                      ? `${Math.round(m.last_latency)} ms`
                                      : "—"}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="p-4 text-text-muted text-[11px]">
                  Este guardián aún no tiene monitores LAN asignados.
                </div>
              )}
            </section>

            {/* Collapsible Sections: Telemetría · Despliegue · Configuración & Seguridad */}
            <div className="space-y-2">
              <details
                className="group rounded-xl border border-border-base bg-bg-dark/40 overflow-hidden"
                open={initialSection === "operation" && !isPending}
              >
                <summary className="flex items-center justify-between px-3.5 py-2.5 cursor-pointer select-none font-semibold text-text-main hover:bg-white/[0.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green/60">
                  <span className="inline-flex items-center gap-2">
                    <ChevronRight
                      size={14}
                      className="text-text-dim group-open:rotate-90 transition-transform"
                    />
                    <Activity size={13} className="text-accent-green" />
                    <span>Telemetría y entrega</span>
                  </span>
                  <span className="font-mono text-[11px] text-text-dim font-normal">
                    Pendientes: {pendingDeliveries}
                  </span>
                </summary>
                <div className="p-3.5 pt-2 border-t border-border-base/60 space-y-3">
                  <div className="grid grid-cols-3 gap-2 font-mono">
                    <div className="p-2.5 rounded-lg bg-bg-dark border border-border-base/70">
                      <div className="text-[10px] text-text-dim uppercase">
                        Pendientes
                      </div>
                      <div className="text-sm font-bold text-text-main mt-0.5">
                        {pendingDeliveries}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-bg-dark border border-border-base/70">
                      <div className="text-[10px] text-text-dim uppercase">
                        Vencidas
                      </div>
                      <div
                        className={`text-sm font-bold mt-0.5 ${
                          overdueDeliveries > 0
                            ? "text-amber-400"
                            : "text-text-main"
                        }`}
                      >
                        {overdueDeliveries}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-bg-dark border border-border-base/70">
                      <div className="text-[10px] text-text-dim uppercase">
                        Últ. entrega
                      </div>
                      <div className="text-[11px] text-text-main mt-1 truncate">
                        <RelativeTime
                          value={probe.delivery?.last_received_at}
                          emptyLabel="—"
                        />
                      </div>
                    </div>
                  </div>
                  <ProbeTelemetry
                    probe={probe}
                    queryFailed={detailQuery.isError}
                    variant="card"
                  />
                </div>
              </details>

              {admin && !isRevoked && (
                <details
                  className="group rounded-xl border border-border-base bg-bg-dark/40 overflow-hidden"
                  open={initialSection === "install"}
                >
                  <summary className="flex items-center justify-between px-3.5 py-2.5 cursor-pointer select-none font-semibold text-text-main hover:bg-white/[0.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green/60">
                    <span className="inline-flex items-center gap-2">
                      <ChevronRight
                        size={14}
                        className="text-text-dim group-open:rotate-90 transition-transform"
                      />
                      <Terminal size={13} className="text-sky-400" />
                      <span>Despliegue y actualización Docker</span>
                    </span>
                  </summary>
                  <div className="p-3.5 pt-2 border-t border-border-base/60 space-y-3">
                    <PlatformPicker value={platform} onChange={setPlatform} />
                    {installQuery.isError && (
                      <ReadFailure retry={installQuery.refetch} />
                    )}
                    {installQuery.data && (
                      <InstallationInstructions
                        key={installQuery.data.platform}
                        profile={installQuery.data}
                        verificationHint="Al ejecutar el contenedor en el host, Sentinel detectará los latidos automáticamente en menos de 15 s."
                      />
                    )}
                  </div>
                </details>
              )}

              {admin && (
                <details
                  className="group rounded-xl border border-border-base bg-bg-dark/40 overflow-hidden"
                  open={
                    initialSection === "security" || initialSection === "revoke"
                  }
                >
                  <summary className="flex items-center justify-between px-3.5 py-2.5 cursor-pointer select-none font-semibold text-text-main hover:bg-white/[0.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green/60">
                    <span className="inline-flex items-center gap-2">
                      <ChevronRight
                        size={14}
                        className="text-text-dim group-open:rotate-90 transition-transform"
                      />
                      <ShieldAlert size={13} className="text-amber-400" />
                      <span>Configuración y seguridad</span>
                    </span>
                  </summary>
                  <div className="p-3.5 pt-2 border-t border-border-base/60 space-y-3">
                    <dl className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2 rounded-lg bg-bg-dark border border-border-base/60">
                        <dt className="text-text-dim">Sistema operativo</dt>
                        <dd className="font-mono text-text-main truncate mt-0.5">
                          {probe.os_info || "Sin reporte"}
                        </dd>
                      </div>
                      <div className="p-2 rounded-lg bg-bg-dark border border-border-base/60">
                        <dt className="text-text-dim">Registrado</dt>
                        <dd className="font-mono text-text-main truncate mt-0.5">
                          {formatExactDate(probe.created_at)}
                        </dd>
                      </div>
                    </dl>

                    {!isRevoked && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setToken("");
                            setAction("rotate");
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-card border border-border-base text-text-main hover:bg-bg-card-hover transition-colors cursor-pointer !min-h-0"
                        >
                          <RotateCw size={13} className="text-amber-400" />
                          <span>Rotar token</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setToken("");
                            setAction("revoke");
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer !min-h-0"
                        >
                          <ShieldAlert size={13} />
                          <span>Revocar guardián</span>
                        </button>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>
          </>
        )}
      </div>
    </ResourceDetailDrawer>
  );
}
