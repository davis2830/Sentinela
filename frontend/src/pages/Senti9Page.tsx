import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Server,
  Search,
  Download,
  BookOpen,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { NOCDrawer } from "../components/common/noc";
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
import Senti9Quota from "../components/monitoring/Senti9Quota";
import Senti9RefreshStatus from "../components/monitoring/Senti9RefreshStatus";
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
    refetchInterval: (query) => {
      refresh.refetchInterval(query);
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
          ? "Token reemplazado. Descarga el archivo y actualiza el montaje antes de iniciar el agente."
          : "Agente revocado. Sus monitores quedaron pausados.",
      );
      await query.refetch();
      void client.invalidateQueries({ queryKey: ["agent-probes"] });
      void client.invalidateQueries({ queryKey: ["monitoring-targets"] });
    } catch (e) {
      setMessage(
        apiFailure(e).response?.data?.message ||
          "No se pudo aplicar. Revisa el estado actual antes de reintentar.",
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
      title={probe?.name || "Detalle de Senti9"}
      maxWidthClass="max-w-4xl senti9-detail"
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
        { id: "operation", label: "Operación" },
        ...(admin
          ? [
              ...(!probe?.revoked_at
                ? [{ id: "install", label: "Instalación" }]
                : []),
              { id: "administration", label: "Administrar" },
            ]
          : []),
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
        {!probe && !query.isError && <p role="status">Consultando agente…</p>}
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
          <>
            <PlatformPicker value={platform} onChange={setPlatform} />
            <p className="senti9-inline-help">
              Usa el archivo de token que guardaste. Consultar estas
              instrucciones no genera otro token. Conserva el volumen{" "}
              {installation.data?.volume_name || "del agente"} al actualizar o
              volver a una versión compatible.
            </p>
            {installation.isError && (
              <ReadFailure retry={installation.refetch} />
            )}{" "}
            {installation.data && (
              <>
                <InstallationInstructions
                  key={installation.data.platform}
                  profile={installation.data}
                  verificationHint="Al terminar, pulsa Revisar conexión para consultar la última señal. La comunicación con Sentinel todavía no confirma una medición del servicio."
                />
                <button
                  className="ui-button ui-button-primary"
                  onClick={() => {
                    setTab("operation");
                    void query.refetch();
                  }}
                >
                  Revisar conexión
                </button>
              </>
            )}
          </>
        )}
        {probe && tab === "administration" && admin && (
          <>
            <h3 className="text-base font-semibold">Credenciales y retiro</h3>
            {probe.revoked_at ? (
              <p>
                Revocado el {date(probe.revoked_at)}. Su historial y
                asignaciones se conservan; el token anterior ya no autoriza
                acceso.
              </p>
            ) : (
              <>
                <p className="text-text-muted">
                  Para rotar: activa drenaje, entrega los pendientes y detén el
                  contenedor. Sentinel comprobará desconexión y ausencia de
                  ejecuciones pendientes antes de reemplazar el token.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    className="ui-button"
                    onClick={() => {
                      setToken("");
                      setAction("rotate");
                    }}
                  >
                    Rotar token
                  </button>
                  <button
                    className="ui-button text-accent-red"
                    onClick={() => {
                      setToken("");
                      setAction("revoke");
                    }}
                  >
                    Retirar agente
                  </button>
                </div>
              </>
            )}
            {action && (
              <form
                className="p-4 rounded-xl border border-accent-yellow/40 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void apply();
                }}
              >
                <h4 className="font-semibold">
                  {action === "revoke"
                    ? "Revocar acceso de Senti9"
                    : "Reemplazar token de Senti9"}
                </h4>
                <p className="text-text-muted">
                  {action === "revoke"
                    ? `${probe.impact.to_pause} monitores se pausarán. ${probe.impact.pending} ejecuciones conocidas siguen pendientes. El token se invalidará irreversiblemente; no se reasignará ni reanudará ningún monitor.`
                    : "El token anterior dejará de funcionar. Descarga el nuevo archivo en este paso y reemplaza su montaje antes de reiniciar."}
                </p>
                {action === "revoke" && (
                  <label className="block space-y-2">
                    <span>Motivo obligatorio</span>
                    <textarea
                      required
                      minLength={3}
                      maxLength={500}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full min-h-24 rounded-xl bg-bg-main border border-border-base p-3"
                    />
                  </label>
                )}
                <div className="flex flex-wrap gap-3">
                  <button
                    disabled={busy}
                    className={`min-h-11 px-4 rounded-xl font-semibold ${action === "revoke" ? "bg-accent-red text-white" : "bg-accent-green text-black"}`}
                  >
                    {busy
                      ? "Aplicando…"
                      : action === "revoke"
                        ? "Revocar agente y pausar monitores"
                        : "Reemplazar token"}
                  </button>
                  <button
                    type="button"
                    className="ui-button"
                    disabled={busy}
                    onClick={() => setAction(null)}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
            {token && (
              <button
                className="ui-button flex gap-2 items-center"
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
                    setMessage(
                      "No se pudo descargar. Reintenta antes de cerrar.",
                    );
                  }
                }}
              >
                <Download size={18} />
                Descargar nuevo token (una sola revelación)
              </button>
            )}
          </>
        )}
      </div>
    </NOCDrawer>
  );
}

export default function Senti9Page() {
  const user = useAuthStore((s) => s.user);
  const admin = !!(user?.is_staff || user?.is_superuser);
  const canCreateMonitor = useCapability("monitoring.create");
  const [search, setSearch] = useState("");
  const [lifecycleFilter, setLifecycle] = useState("active");
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
    { search, lifecycle: lifecycleFilter },
    refresh.refetchInterval,
    { pollMs: refresh.enabled ? 15000 : undefined },
  );
  return (
    <div className="compact-workspace senti9-workspace space-y-5 text-sm">
      <header className="senti9-page-header">
        <div className="senti9-page-heading">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight">Senti9</h1>
            <span className="senti9-page-badge">AGENTES PRIVADOS</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Monitorea tus servicios desde la oficina, sucursal o datacenter.
          </p>
        </div>
        <div className="senti9-page-actions">
          <button
            type="button"
            className="senti9-header-guide"
            aria-label="Guía de instalación"
            onClick={() => setPanel("guide")}
          >
            <BookOpen size={16} aria-hidden="true" />
            <span>Guía</span>
          </button>
          <Senti9RefreshStatus
            enabled={refresh.enabled}
            ready={refresh.ready}
            blockedReason={refresh.blockedReason}
            countdown={refresh.countdown}
            updatedAt={directory.dataUpdatedAt}
            fetching={directory.isFetching}
            failed={directory.isError}
            onToggle={refresh.toggle}
            onRefresh={() => {
              void directory.refetch();
            }}
          />
          {admin && (
            <button
              type="button"
              className="senti9-register-button"
              onClick={() => setPanel("create")}
            >
              <Plus size={18} aria-hidden="true" />
              Registrar Senti9
            </button>
          )}
        </div>
      </header>
      <div className="senti9-workspace-grid">
        <section
          className="min-w-0 space-y-4"
          aria-labelledby="senti9-directory-title"
        >
          <div className="senti9-directory-caption">
            <div>
              <h2 id="senti9-directory-title" className="text-lg font-semibold">
                Tus agentes
              </h2>
              <p className="text-text-muted mt-1">
                Revisa la conexión y abre sus monitores o instrucciones.
              </p>
            </div>
            {quota && <Senti9Quota quota={quota} />}
          </div>
          <div className="senti9-directory-toolbar">
            <label className="senti9-search">
              <Search size={18} />
              <span className="sr-only">Buscar agente</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o host"
              />
            </label>
            <label className="senti9-state-filter">
              <span>Estado</span>
              <select
                value={lifecycleFilter}
                onChange={(e) => setLifecycle(e.target.value)}
              >
                <option value="active">Activos</option>
                <option value="connected">Conectados</option>
                <option value="disconnected">Desconectados</option>
                <option value="pending_connection">Sin conexión inicial</option>
                <option value="revoked">Archivo de revocados</option>
                <option value="all">Todos</option>
              </select>
            </label>
          </div>
          {directory.isError && (
            <ReadFailure stale={!!directory.data} retry={directory.refetch} />
          )}
          <div className="senti9-agent-list" aria-busy={directory.isFetching}>
            {directory.isLoading && !directory.data ? (
              <div role="status" className="senti9-empty">
                <Loader2 size={24} className="animate-spin" />
                <p>Consultando agentes…</p>
              </div>
            ) : (
              directory.data?.map((probe) => (
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
              ))
            )}
            {!directory.isLoading &&
              !directory.isError &&
              !directory.data?.length && (
                <div className="senti9-empty">
                  <span className="senti9-title-icon">
                    <Server size={26} />
                  </span>
                  <h3 className="text-lg font-semibold">
                    {search || lifecycleFilter !== "active"
                      ? "No hay agentes con estos filtros"
                      : "Conecta tu primera ubicación"}
                  </h3>
                  <p className="text-text-muted max-w-md">
                    {search || lifecycleFilter !== "active"
                      ? "Cambia el estado o la búsqueda para ver otros agentes."
                      : "Registra Senti9 en un equipo de tu red para medir servicios privados desde Sentinel."}
                  </p>
                  {search || lifecycleFilter !== "active" ? (
                    <button
                      className="ui-button"
                      onClick={() => {
                        setSearch("");
                        setLifecycle("active");
                      }}
                    >
                      Limpiar filtros
                    </button>
                  ) : (
                    <button
                      className="ui-button ui-button-secondary"
                      onClick={() => setPanel("guide")}
                    >
                      Ver cómo instalarlo
                    </button>
                  )}
                </div>
              )}
          </div>
          <DirectoryPagination directory={directory} />
        </section>
        <aside
          className="senti9-start-panel"
          aria-label="Instalación y siguientes pasos"
        >
          <div className="senti9-network-sketch" aria-hidden="true">
            <span>
              <Server size={25} />
            </span>
            <span className="senti9-network-line" />
            <span>
              <ShieldCheck size={25} />
            </span>
          </div>
          <p className="senti9-eyebrow">DE TU RED A SENTINEL</p>
          <h2 className="text-xl font-semibold">
            Instala. Conecta. Monitorea.
          </h2>
          <p className="text-text-muted leading-relaxed">
            Un contenedor en tu red; la visibilidad, en Sentinel.
          </p>
          <ol className="senti9-journey">
            {[
              ["Registra la ubicación", "Nombre y plataforma del equipo."],
              ["Instala con Docker", "Guarda el token y copia los comandos."],
              [
                "Crea tu primer monitor",
                "Confirma la señal y revisa su medición.",
              ],
            ].map(([title, text], i) => (
              <li key={title}>
                <span className="senti9-step-number">{i + 1}</span>
                <div>
                  <h3 className="font-medium">{title}</h3>
                  <p className="text-text-muted text-sm mt-1">{text}</p>
                </div>
              </li>
            ))}
          </ol>
          <button
            className="ui-button ui-button-secondary w-full"
            onClick={() => setPanel("guide")}
          >
            <BookOpen size={17} />
            Ver requisitos y pasos
          </button>
          <p className="text-xs text-text-muted flex gap-2 leading-relaxed">
            <ShieldCheck size={16} className="shrink-0 mt-0.5" />
            Sin puertos entrantes. El equipo necesita acceso a Sentinel y a los
            servicios que vas a medir.
          </p>
        </aside>
      </div>
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
