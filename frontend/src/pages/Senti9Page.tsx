import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Server,
  BookOpen,
  Radio,
  ShieldAlert,
  Loader2,
  Download,
  AlertTriangle,
  RotateCw,
} from "lucide-react";
import {
  NOCPageHeader,
  NOCToolbar,
  NOCDrawer,
  type NOCStatusPill,
} from "../components/common/noc";
import {
  ReadFailure,
  DirectoryPagination,
  ActionFeedback,
} from "../components/common/DirectoryState";
import CreateProbeModal from "../components/monitoring/CreateProbeModal";
import { InstallationInstructions } from "../components/monitoring/Senti9Setup";
import {
  Senti9InstallGuide,
  PlatformPicker,
} from "../components/monitoring/Senti9Installation";
import { useCapability } from "../hooks/useCapability";
import Senti9Operation from "../components/monitoring/Senti9Operation";
import { DetailBadge } from "../components/monitoring/Senti9DetailUI";
import Senti9AgentCard from "../components/monitoring/Senti9AgentCard";
import Senti9TableView from "../components/monitoring/Senti9TableView";
import Senti9Quota from "../components/monitoring/Senti9Quota";
import { usePersistentViewMode } from "../hooks/usePersistentViewMode";
import { useConnectivityDirectory } from "../hooks/useConnectivityDirectory";
import { useConnectivityRefresh } from "../hooks/useConnectivityRefresh";
import { useAuthStore } from "../store/authStore";
import { api } from "../services/api";
import { apiFailure } from "../services/errors";
import type { AgentProbe, ProbeInstallation } from "../types/agent_probe";

type Detail = AgentProbe & {
  impact: { assigned: number; to_pause: number; pending: number };
};

const lifecycle = (p: AgentProbe) =>
  p.revoked_at
    ? "Revocado"
    : !p.last_heartbeat
      ? "Sin conexión inicial"
      : p.is_online
        ? "Conectado"
        : "Desconectado";

const date = (v: string | null) =>
  v ? new Date(v).toLocaleString() : "Sin señal registrada";

function ProbeDetail({
  id,
  initialTab,
  onClose,
  admin,
}: {
  id: string;
  initialTab: "operation" | "install";
  onClose: () => void;
  admin: boolean;
}) {
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  const organization = useAuthStore((s) => s.user?.organization?.id);
  const [tab, setTab] = useState<string>(admin ? initialTab : "operation");
  const canCreateMonitor = useCapability("monitoring.create");
  const [reason, setReason] = useState("");
  const [action, setAction] = useState<"rotate" | "revoke" | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [platform, setPlatform] = useState<"linux" | "windows">("linux");
  const client = useQueryClient();
  const refresh = useConnectivityRefresh();

  const query = useQuery<Detail>({
    queryKey: ["agent-probe-detail", organization, id],
    queryFn: async ({ signal }) =>
      (await api.get(`agent-probes/${id}/detail/`, { signal })).data.data,
    refetchInterval: (q) => {
      refresh.refetchInterval(q);
      return refresh.enabled ? 15000 : false;
    },
    refetchIntervalInBackground: false,
  });

  const installation = useQuery<ProbeInstallation>({
    queryKey: ["agent-probe-install", organization, id, platform],
    queryFn: async ({ signal }) =>
      (
        await api.get(`agent-probes/${id}/installation/`, {
          params: { platform },
          signal,
        })
      ).data.data,
    enabled:
      admin && tab === "install" && !!query.data && !query.data.revoked_at,
  });

  const probe = query.data;

  const apply = async () => {
    if (!action) return;
    setBusy(true);
    setMessage("");
    try {
      const r = await api.post(
        `agent-probes/${id}/${action === "rotate" ? "rotate-token" : "revoke"}/`,
        action === "revoke" ? { reason } : {},
      );
      if (!active.current) return;
      if (action === "rotate") setToken(r.data.data.raw_token);
      setAction(null);
      setReason("");
      setMessage(
        action === "rotate"
          ? "Token reemplazado. Guarda el nuevo token y actualiza la configuración antes de reiniciar el contenedor."
          : "Agente revocado exitosamente. Sus monitores LAN quedaron pausados.",
      );
      await query.refetch();
      void client.invalidateQueries({ queryKey: ["agent-probes"] });
      void client.invalidateQueries({ queryKey: ["monitoring-targets"] });
    } catch (e) {
      setMessage(
        apiFailure(e).response?.data?.message ||
        "No se pudo completar la acción. Revisa el estado actual antes de reintentar.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <NOCDrawer
      isOpen
      onClose={() => {
        setToken("");
        onClose();
      }}
      title={probe?.name || "Detalle de Guardián Senti9"}
      maxWidthClass="max-w-4xl"
      tabVariant="segmented"
      statusBadge={
        probe && (
          <DetailBadge
            tone={
              probe.revoked_at
                ? "muted"
                : query.isError
                  ? "warning"
                  : probe.is_online
                    ? "success"
                    : probe.last_heartbeat
                      ? "warning"
                      : "muted"
            }
            pulse={!query.isError && probe.is_online && !probe.revoked_at}
          >
            {lifecycle(probe)}
            {query.isError && " · dato anterior"}
          </DetailBadge>
        )
      }
      tabs={[
        { id: "operation", label: "Operación & Servicios" },
        ...(admin && !probe?.revoked_at
          ? [{ id: "install", label: "Despliegue & Docker" }]
          : []),
        ...(admin ? [{ id: "administration", label: "Seguridad & Tokens" }] : []),
      ]}
      activeTab={tab}
      onTabChange={(value) => {
        setToken("");
        setAction(null);
        setTab(value);
      }}
    >
      <div className="space-y-5 text-sm min-w-0">
        {query.isError && <ReadFailure stale={!!probe} retry={query.refetch} />}
        {!probe && !query.isError && (
          <div className="flex items-center justify-center py-12 text-text-muted gap-2">
            <Loader2 size={18} className="animate-spin text-accent-green" />
            <span>Consultando estado del agente...</span>
          </div>
        )}
        <ActionFeedback>{message}</ActionFeedback>

        {probe && tab === "operation" && (
          <Senti9Operation
            probe={probe}
            queryFailed={query.isError}
            canCreateMonitor={canCreateMonitor}
            onNavigate={onClose}
          />
        )}

        {tab === "install" && admin && !probe?.revoked_at && (
          <div className="space-y-4">
            <PlatformPicker value={platform} onChange={setPlatform} />
            <div className="p-3.5 rounded-xl bg-bg-dark/60 border border-white/5 text-xs text-text-muted">
              Usa el archivo de token seguro que guardaste al crear la sonda. Consultar estas instrucciones no altera el token activo en el host. Conserva el volumen persistente{" "}
              <code className="text-accent-green font-mono">{installation.data?.volume_name || "senti9-data"}</code> al actualizar o migrar de contenedor.
            </div>
            {installation.isError && (
              <ReadFailure retry={installation.refetch} />
            )}
            {installation.data && (
              <>
                <InstallationInstructions
                  key={installation.data.platform}
                  profile={installation.data}
                  verificationHint="Al completar la ejecución en el host remoto, Sentinel detectará automáticamente los latidos entrantes en menos de 10 segundos."
                />
                <button
                  type="button"
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-accent-green text-bg-dark hover:bg-accent-green-hover transition-colors"
                  onClick={() => {
                    setTab("operation");
                    void query.refetch();
                  }}
                >
                  Verificar conexión operativa
                </button>
              </>
            )}
          </div>
        )}

        {probe && tab === "administration" && admin && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-text-main">
                  Gestión de Seguridad & Tokens
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Rotación de credenciales criptográficas y retiro controlado de agentes.
                </p>
              </div>
            </div>

            {probe.revoked_at ? (
              <div className="p-4 rounded-xl border border-zinc-700 bg-zinc-800/30 text-xs text-zinc-400">
                Guardián revocado el {date(probe.revoked_at)}. El historial operativo y las asignaciones se conservan para auditoría, pero el token anterior ha sido destruido de forma irreversible.
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-white/10 bg-bg-dark/60 space-y-3">
                <p className="text-xs text-text-muted leading-relaxed">
                  Para rotar el token de forma segura, asegúrate de tener acceso al host para actualizar la variable de entorno o archivo montado una vez emitido el nuevo secreto.
                </p>
                <div className="flex flex-wrap gap-2.5 pt-1">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-text-main transition-colors"
                    onClick={() => {
                      setToken("");
                      setAction("rotate");
                    }}
                  >
                    <RotateCw size={14} />
                    <span>Rotar Token</span>
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors"
                    onClick={() => {
                      setToken("");
                      setAction("revoke");
                    }}
                  >
                    <ShieldAlert size={14} />
                    <span>Retirar / Revocar Guardián</span>
                  </button>
                </div>
              </div>
            )}

            {action && (
              <form
                className="p-5 rounded-2xl border border-amber-500/30 bg-amber-500/5 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void apply();
                }}
              >
                <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
                  <AlertTriangle size={16} />
                  <h4>
                    {action === "revoke"
                      ? "Confirmar Revocación Definitiva"
                      : "Confirmar Rotación de Token"}
                  </h4>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">
                  {action === "revoke"
                    ? `Se pausarán ${probe.impact?.to_pause ?? 0} monitor(es) LAN asignados. El token quedará invalidado y la sonda no podrá volver a conectarse.`
                    : "El token previo dejará de ser admitido inmediatamente. Deberás copiar el nuevo token en el host antes del siguiente ciclo de latidos."}
                </p>

                {action === "revoke" && (
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-text-main">
                      Motivo del retiro (requerido para bitácora ISO 27001):
                    </span>
                    <textarea
                      required
                      minLength={3}
                      maxLength={500}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Ej. Servidor desmantelado por migración de infraestructura a la nube..."
                      className="w-full min-h-[90px] rounded-xl bg-bg-dark border border-white/10 p-3 text-xs text-text-main focus:border-accent-green focus:outline-none"
                    />
                  </label>
                )}

                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    type="submit"
                    disabled={busy}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${action === "revoke"
                      ? "bg-rose-500 text-white hover:bg-rose-600"
                      : "bg-accent-green text-bg-dark hover:bg-accent-green-hover"
                      } disabled:opacity-50`}
                  >
                    {busy
                      ? "Procesando..."
                      : action === "revoke"
                        ? "Revocar y Pausar Monitores"
                        : "Generar Nuevo Token"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setAction(null)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-text-muted hover:text-text-main bg-white/5 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {token && (
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-3">
                <p className="text-xs text-emerald-400 font-semibold">
                  Nuevo token emitido exitosamente. Solo se mostrará una vez.
                </p>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-accent-green text-bg-dark hover:bg-accent-green-hover transition-colors"
                  onClick={() => {
                    try {
                      const url = URL.createObjectURL(
                        new Blob([token], { type: "text/plain" }),
                      );
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `senti9-${id.slice(0, 8)}-token.txt`;
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch {
                      setMessage("No se pudo descargar el archivo. Cópialo manualmente.");
                    }
                  }}
                >
                  <Download size={15} />
                  <span>Descargar archivo de token</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </NOCDrawer>
  );
}

export default function Senti9Page() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const admin = !!(user?.is_staff || user?.is_superuser);
  const canCreateMonitor = useCapability("monitoring.create");
  const [viewMode, setViewMode] = usePersistentViewMode("senti9", "table");
  const [search, setSearch] = useState("");
  const [lifecycleFilter, setLifecycle] = useState("all");
  const [selected, setSelected] = useState<{
    id: string;
    tab: "operation" | "install";
  } | null>(null);
  const [panel, setPanel] = useState<"create" | "guide" | null>(null);

  const refresh = useConnectivityRefresh();
  const quota = refresh.subscription?.usage?.private_agents;

  const directory = useConnectivityDirectory<AgentProbe>(
    "agent-probes/",
    "agent-probes",
    { search, lifecycle: lifecycleFilter === "all" ? "" : lifecycleFilter },
    refresh.refetchInterval,
    { pollMs: refresh.enabled ? 15000 : undefined },
  );

  const probes = directory.data || [];

  // Métricas para los KPIs
  const totalProbes = directory.meta?.total ?? probes.length;
  const onlineCount = useMemo(
    () => probes.filter((p) => p.is_online && !p.revoked_at).length,
    [probes],
  );
  const offlineCount = useMemo(
    () => probes.filter((p) => !p.is_online && p.last_heartbeat && !p.revoked_at).length,
    [probes],
  );
  const pendingCount = useMemo(
    () => probes.filter((p) => !p.last_heartbeat && !p.revoked_at).length,
    [probes],
  );
  const revokedCount = useMemo(
    () => probes.filter((p) => !!p.revoked_at).length,
    [probes],
  );

  const statusPills: NOCStatusPill[] = [
    { id: "all", label: "Todos", count: totalProbes, variant: "all" },
    { id: "connected", label: "Conectados", count: onlineCount, variant: "success" },
    { id: "disconnected", label: "Desconectados", count: offlineCount, variant: "danger" },
    { id: "pending_connection", label: "Esperando Señal", count: pendingCount, variant: "warning" },
    { id: "revoked", label: "Revocados", count: revokedCount, variant: "neutral" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header Oficial NOC */}
      <NOCPageHeader
        title="Guardianes Senti9"
        badgeText="RED PRIVADA & ON-PREMISE"
        description="Sondas satélite ligeras para monitoreo continuo de servicios LAN, bases de datos y VPCs sin apertura de puertos entrantes."
        icon={<Radio size={24} className="text-accent-green" />}
        autoRefresh={{
          enabled: refresh.enabled,
          countdown: refresh.countdown,
          onToggle: refresh.toggle,
          intervalSeconds: 15,
          ready: refresh.ready,
          blockedReason: refresh.blockedReason,
        }}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPanel("guide")}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-text-muted hover:text-text-main bg-white/5 hover:bg-white/10 border border-white/5 transition-colors"
            >
              <BookOpen size={14} />
              <span>Requisitos & Guía</span>
            </button>

            {admin && (
              <button
                type="button"
                onClick={() => setPanel("create")}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-accent-green hover:bg-accent-green-hover text-bg-dark transition-colors shadow-sm cursor-pointer"
              >
                <Plus size={15} />
                <span>Registrar Senti9</span>
              </button>
            )}
          </div>
        }
      />

      {/* 2. Toolbar Operativo & Filtros por Estado */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <NOCToolbar
              searchTerm={search}
              onSearchChange={setSearch}
              searchPlaceholder="Buscar guardián por nombre, host, IP o versión..."
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              statusPills={statusPills}
              selectedStatus={lifecycleFilter}
              onStatusChange={(statusId) => setLifecycle(statusId)}
              extraFilters={quota ? <Senti9Quota quota={quota} /> : undefined}
            />
          </div>
        </div>

        {/* 4. Mensaje de Error en Lectura */}
        {directory.isError && (
          <ReadFailure stale={!!directory.data} retry={directory.refetch} />
        )}

        {/* 5. Lista / Grid de Guardianes */}
        <section aria-label="Directorio de Guardianes Senti9" className="min-w-0">
          {directory.isLoading && !directory.data ? (
            <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-white/5 bg-bg-card text-text-muted gap-3">
              <Loader2 size={26} className="animate-spin text-accent-green" />
              <p className="text-xs font-mono">Consultando catálogo de guardianes LAN...</p>
            </div>
          ) : probes.length > 0 ? (
            viewMode === "table" ? (
              <Senti9TableView
                probes={probes}
                onSelectProbe={(probe, initialTab) =>
                  setSelected({ id: probe.id, tab: initialTab || "operation" })
                }
                onCreateMonitor={(id) => navigate(`/monitoring?create=1&agent=${id}`)}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {probes.map((probe) => (
                  <Senti9AgentCard
                    key={probe.id}
                    probe={probe}
                    stale={directory.isError}
                    admin={admin}
                    canCreateMonitor={canCreateMonitor}
                    onDetail={() =>
                      setSelected({ id: probe.id, tab: "operation" })
                    }
                    onInstall={() =>
                      setSelected({ id: probe.id, tab: "install" })
                    }
                  />
                ))}
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-6 rounded-2xl border border-white/5 bg-bg-card text-center space-y-3">
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-text-muted">
                <Server size={32} />
              </div>
              <h3 className="text-base font-semibold text-text-main">
                {search || lifecycleFilter !== "all"
                  ? "No se encontraron guardianes con estos filtros"
                  : "No hay guardianes Senti9 registrados aún"}
              </h3>
              <p className="text-xs text-text-muted max-w-md leading-relaxed">
                {search || lifecycleFilter !== "all"
                  ? "Intenta modificar el término de búsqueda o selecciona otro filtro de estado."
                  : "Despliega tu primer agente Senti9 en un servidor local, máquina virtual o contenedor Docker para monitorear servicios privados sin exponer puertos."}
              </p>
              {search || lifecycleFilter !== "all" ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setLifecycle("all");
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-text-main transition-colors mt-2"
                >
                  Restablecer filtros
                </button>
              ) : admin ? (
                <button
                  type="button"
                  onClick={() => setPanel("create")}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-accent-green hover:bg-accent-green-hover text-bg-dark transition-colors mt-2"
                >
                  Registrar mi primer Senti9
                </button>
              ) : null}
            </div>
          )}

          {/* 6. Paginación */}
          <div className="pt-4">
            <DirectoryPagination directory={directory} />
          </div>
        </section>
      </div>

      {/* 7. Diálogos y Drawers Modales */}
      {panel === "guide" && (
        <Senti9InstallGuide
          onClose={() => setPanel(null)}
          onRegister={admin ? () => setPanel("create") : undefined}
        />
      )}

      {panel === "create" && (
        <CreateProbeModal isOpen onClose={() => setPanel(null)} />
      )}

      {selected && (
        <ProbeDetail
          key={selected.id}
          id={selected.id}
          initialTab={selected.tab}
          onClose={() => setSelected(null)}
          admin={admin}
        />
      )}
    </div>
  );
}
