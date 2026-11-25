import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  CheckCircle2,
  Loader2,
  Plus,
  Radio,
  Server,
  Terminal,
} from "lucide-react";
import { api } from "../services/api";
import { NOCPageHeader } from "../components/common/noc";
import {
  ReadFailure,
  DirectoryPagination,
} from "../components/common/DirectoryState";
import CreateProbeModal from "../components/monitoring/CreateProbeModal";
import { Senti9InstallGuide } from "../components/monitoring/Senti9Installation";
import { useCapability } from "../hooks/useCapability";
import Senti9Toolbar from "../components/monitoring/Senti9Toolbar";
import Senti9TableView, {
  type GuardianActionSection,
} from "../components/monitoring/Senti9TableView";
import Senti9CardGridView from "../components/monitoring/Senti9CardGridView";
import Senti9DetailDrawer from "../components/monitoring/Senti9DetailDrawer";
import Senti9Quota from "../components/monitoring/Senti9Quota";
import {
  useGuardians,
  type GuardianDensity,
  type GuardianGroupBy,
  type GuardianSignalRange,
  type GuardianSortField,
} from "../components/monitoring/useGuardians";
import { usePersistentViewMode } from "../hooks/usePersistentViewMode";
import { useConnectivityDirectory } from "../hooks/useConnectivityDirectory";
import { useConnectivityRefresh } from "../hooks/useConnectivityRefresh";
import { useAuthStore } from "../store/authStore";
import type { AgentProbe } from "../types/agent_probe";

export default function Senti9Page() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const admin = !!(user?.is_staff || user?.is_superuser);
  const canCreateMonitor = useCapability("monitoring.create");
  const [viewMode, setViewMode] = usePersistentViewMode("senti9", "table");

  const toggleMutation = useMutation({
    mutationFn: async (probe: AgentProbe) => {
      const nextEnabled = probe.enabled === false;
      return (
        await api.patch(`agent-probes/${probe.id}/`, {
          enabled: nextEnabled,
        })
      ).data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["agent-probes"] });
      void queryClient.invalidateQueries({ queryKey: ["agent-probe-detail"] });
      void queryClient.invalidateQueries({ queryKey: ["monitoring-targets"] });
    },
  });

  // Unified filters & table state (preserved across List <-> Card switch)
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [versionFilter, setVersionFilter] = useState("all");
  const [signalRangeFilter, setSignalRangeFilter] =
    useState<GuardianSignalRange>("all");
  const [groupBy, setGroupBy] = useState<GuardianGroupBy>("none");
  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >({});
  const [sortField, setSortField] = useState<GuardianSortField>("status");
  const [sortAsc, setSortAsc] = useState(true);
  const [density, setDensity] = useState<GuardianDensity>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sentinel_senti9_density");
      if (saved === "compact" || saved === "comfortable") return saved;
    }
    return "compact";
  });

  const handleDensityChange = (next: GuardianDensity) => {
    setDensity(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("sentinel_senti9_density", next);
    }
  };

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSortChange = (field: GuardianSortField) => {
    if (sortField === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const [selected, setSelected] = useState<{
    id: string;
    section: GuardianActionSection;
  } | null>(null);
  const [panel, setPanel] = useState<"create" | "guide" | null>(null);

  const refresh = useConnectivityRefresh();
  const quota = refresh.subscription?.usage?.private_agents;

  const directory = useConnectivityDirectory<AgentProbe>(
    "agent-probes/",
    "agent-probes",
    { search },
    refresh.refetchInterval,
    { pollMs: refresh.enabled ? 15000 : undefined },
  );

  const probes = directory.data || [];

  const { summary, availableVersions, sortedProbes, groupedProbes } =
    useGuardians({
      probes,
      statusFilter,
      platformFilter,
      versionFilter,
      signalRangeFilter,
      sortField,
      sortAsc,
      groupBy,
    });

  const hasFilters =
    Boolean(search) ||
    statusFilter !== "all" ||
    platformFilter !== "all" ||
    versionFilter !== "all" ||
    signalRangeFilter !== "all";

  const clearAllFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setPlatformFilter("all");
    setVersionFilter("all");
    setSignalRangeFilter("all");
    setGroupBy("none");
  };

  return (
    <div className="compact-workspace space-y-4 animate-in fade-in duration-200">
      {/* 1. Unified Header: Consistent "Guardián" vocabulary & concise subtitle */}
      <NOCPageHeader
        title="Guardianes Senti9"
        badgeText="RED PRIVADA & ON-PREMISE"
        description="Monitorea servicios dentro de tu red sin abrir puertos."
        icon={<Radio size={22} className="text-accent-green" />}
        autoRefresh={{
          enabled: refresh.enabled,
          countdown: refresh.countdown,
          onToggle: refresh.toggle,
          intervalSeconds: 15,
          ready: refresh.ready,
          blockedReason: refresh.blockedReason,
        }}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {quota && <Senti9Quota quota={quota} />}

            <button
              type="button"
              onClick={() => setPanel("guide")}
              title="Requisitos y guía de instalación de guardianes"
              aria-label="Requisitos y guía de instalación"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium text-text-muted hover:text-text-main bg-bg-dark/80 hover:bg-bg-card-hover border border-border-base transition-colors cursor-pointer"
            >
              <BookOpen size={14} />
              <span className="hidden sm:inline">Guía</span>
            </button>

            {admin && (
              <button
                type="button"
                onClick={() => setPanel("create")}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-accent-green hover:bg-accent-green/90 text-black transition-all shadow-md shadow-accent-green/20 cursor-pointer"
              >
                <Plus size={16} />
                <span>Registrar guardián</span>
              </button>
            )}
          </div>
        }
      />

      {/* 2. Single-Row Unified Toolbar */}
      <Senti9Toolbar
        summary={summary}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        platformFilter={platformFilter}
        onPlatformFilterChange={setPlatformFilter}
        versionFilter={versionFilter}
        onVersionFilterChange={setVersionFilter}
        availableVersions={availableVersions}
        signalRangeFilter={signalRangeFilter}
        onSignalRangeFilterChange={setSignalRangeFilter}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        density={density}
        onDensityChange={handleDensityChange}
        search={search}
        onSearchChange={setSearch}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* 3. Read Error Banner */}
      {directory.isError && (
        <div className="w-full max-w-[1400px] mx-auto">
          <ReadFailure stale={!!directory.data} retry={directory.refetch} />
        </div>
      )}

      {/* 4. Main Directory: Table vs Status-Wall Cards vs Guided Empty State */}
      <section aria-label="Directorio de Guardianes Senti9" className="min-w-0">
        {directory.isLoading && !directory.data ? (
          <div className="w-full max-w-[1400px] mx-auto flex flex-col items-center justify-center py-20 rounded-2xl border border-border-base bg-bg-card text-text-muted gap-3">
            <Loader2 size={26} className="animate-spin text-accent-green" />
            <p className="text-xs font-mono">
              Consultando guardianes Senti9...
            </p>
          </div>
        ) : sortedProbes.length > 0 ? (
          viewMode === "table" ? (
            <Senti9TableView
              sortedProbes={sortedProbes}
              groupedProbes={groupedProbes}
              collapsedGroups={collapsedGroups}
              onToggleGroup={toggleGroup}
              density={density}
              sortField={sortField}
              sortAsc={sortAsc}
              onSortChange={handleSortChange}
              admin={admin}
              canCreateMonitor={canCreateMonitor}
              onSelectProbe={(probe, section = "operation") =>
                setSelected({ id: probe.id, section })
              }
              onCreateMonitor={(id) =>
                navigate(`/monitoring?create=1&agent=${id}`)
              }
              onToggleProbe={(probe) => toggleMutation.mutate(probe)}
            />
          ) : (
            <Senti9CardGridView
              sortedProbes={sortedProbes}
              groupedProbes={groupedProbes}
              collapsedGroups={collapsedGroups}
              onToggleGroup={toggleGroup}
              density={density}
              hasFilters={hasFilters}
              admin={admin}
              canCreateMonitor={canCreateMonitor}
              onSelectProbe={(probe, section = "operation") =>
                setSelected({ id: probe.id, section })
              }
              onCreateMonitor={(id) =>
                navigate(`/monitoring?create=1&agent=${id}`)
              }
              onToggleProbe={(probe) => toggleMutation.mutate(probe)}
            />
          )
        ) : hasFilters ? (
          <div className="w-full max-w-[1400px] mx-auto flex flex-col items-center justify-center py-16 px-6 rounded-2xl border border-border-base bg-bg-card text-center space-y-3">
            <div className="p-3 rounded-2xl bg-bg-dark border border-border-base text-text-muted">
              <Server size={28} />
            </div>
            <h3 className="text-base font-semibold text-text-main">
              No se encontraron guardianes con estos filtros
            </h3>
            <p className="text-xs text-text-muted max-w-md">
              Ajusta la búsqueda, estado, plataforma o versión para ver el resto
              del directorio.
            </p>
            <button
              type="button"
              onClick={clearAllFilters}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-bg-dark border border-border-base hover:border-accent-green text-text-main transition-colors cursor-pointer"
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          /* Guided Step-by-Step Empty State */
          <div className="w-full max-w-[1400px] mx-auto rounded-2xl border border-border-base bg-bg-card p-8 space-y-6">
            <div className="max-w-xl space-y-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-accent-green">
                <Radio size={12} />
                Primeros pasos
              </span>
              <h3 className="text-lg font-bold text-text-main">
                Conecta tu primer guardián Senti9
              </h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Despliega un contenedor ligero dentro de tu LAN o VPC para
                monitorear bases de datos, APIs internas y puertos privados sin
                exponer tu red a Internet.
              </p>
            </div>

            <ol className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
              <li className="rounded-xl border border-border-base bg-bg-dark/60 p-4 space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-text-main">
                  <Server size={15} className="text-sky-400 shrink-0" />
                  <span>1. Requisitos mínimos</span>
                </div>
                <p className="text-text-muted leading-relaxed">
                  Un host Linux o Windows con Docker y salida HTTPS (puerto 443)
                  hacia Sentinel. No requiere puertos entrantes.
                </p>
              </li>
              <li className="rounded-xl border border-border-base bg-bg-dark/60 p-4 space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-text-main">
                  <Terminal size={15} className="text-emerald-400 shrink-0" />
                  <span>2. Ejecuta el comando Docker</span>
                </div>
                <p className="text-text-muted leading-relaxed">
                  Al registrar el guardián recibirás su token único y el comando
                  listo para copiar y pegar en tu servidor.
                </p>
              </li>
              <li className="rounded-xl border border-border-base bg-bg-dark/60 p-4 space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-text-main">
                  <CheckCircle2
                    size={15}
                    className="text-accent-green shrink-0"
                  />
                  <span>3. Espera la primera señal</span>
                </div>
                <p className="text-text-muted leading-relaxed">
                  En menos de 15 segundos aparecerá conectado y podrás asignarle
                  tus monitores internos desde Uptime.
                </p>
              </li>
            </ol>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              {admin && (
                <button
                  type="button"
                  onClick={() => setPanel("create")}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold bg-accent-green hover:bg-accent-green/90 text-black transition-all shadow-md shadow-accent-green/20 cursor-pointer"
                >
                  <Plus size={16} />
                  <span>Registrar guardián</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setPanel("guide")}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-medium text-text-muted hover:text-text-main border border-border-base bg-bg-dark hover:bg-bg-card-hover transition-colors cursor-pointer"
              >
                <BookOpen size={14} />
                <span>Ver requisitos completos</span>
              </button>
            </div>
          </div>
        )}

        <div className="pt-4 w-full max-w-[1400px] mx-auto">
          <DirectoryPagination directory={directory} />
        </div>
      </section>

      {/* 5. Modals & Slide-Over Detail Drawer */}
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
        <Senti9DetailDrawer
          key={`${selected.id}-${selected.section}`}
          probeId={selected.id}
          probes={sortedProbes}
          initialSection={selected.section}
          admin={admin}
          canCreateMonitor={canCreateMonitor}
          onSelectProbeId={(nextId) =>
            setSelected({ id: nextId, section: "operation" })
          }
          onCreateMonitor={(id) =>
            navigate(`/monitoring?create=1&agent=${id}`)
          }
          onToggleProbe={(probe) => toggleMutation.mutate(probe)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
