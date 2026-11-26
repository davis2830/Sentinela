import { useCompactViewport } from "../hooks/useCompactViewport";
import { bulkOutcome } from "../utils/bulkOutcome";
import { useConnectivityDirectory } from "../hooks/useConnectivityDirectory";
import {
  ReadFailure,
  DirectoryPagination,
  ActionFeedback,
} from "../components/common/DirectoryState";
import { useLinkedResource } from "../hooks/useLinkedResource";
import { useUrlFilter } from "../hooks/useUrlFilter";
import AdminButton from "../components/common/AdminButton";
import { useAuthStore } from "../store/authStore";
import { NOCPageHeader } from "../components/common/noc";
import { useConnectivityRefresh } from "../hooks/useConnectivityRefresh";
import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import { waitForFreshScan, type QueuedScan } from "../utils/scanPolling";
import type { MonitoringTarget, CreateTargetData } from "../types/monitoring";
import TargetCardGridView from "../components/monitoring/TargetCardGridView";
import TargetTableView from "../components/monitoring/TargetTableView";
import TargetDetailDrawer from "../components/monitoring/TargetDetailDrawer";
import TargetForm from "../components/monitoring/TargetForm";
import UptimeToolbar from "../components/monitoring/UptimeToolbar";
import {
  useTargets,
  type TargetDensity,
  type TargetGroupBy,
  type TargetSortField,
} from "../components/monitoring/useTargets";
import ModalSurface from "../components/common/ModalSurface";
import { usePersistentViewMode } from "../hooks/usePersistentViewMode";
import {
  Plus,
  Loader2,
  Trash2,
  TrendingUp,
  CheckSquare,
  Server,
  X,
} from "lucide-react";

export default function MonitoringPage() {
  const compact = useCompactViewport();
  const organizationId = useAuthStore((state) => state.user?.organization?.id);

  const navigate = useNavigate();
  const [navigationParams, setNavigationParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(
    () => navigationParams.get("create") === "1",
  );
  const [editingTarget, setEditingTarget] = useState<MonitoringTarget | null>(
    null,
  );
  const [selectedTarget, setSelectedTarget] = useState<MonitoringTarget | null>(
    null,
  );
  const [deleteConfirm, setDeleteConfirm] = useState<MonitoringTarget | null>(
    null,
  );

  const [scanningId, setScanningId] = useState<string | null>(null);
  const autoRefresh = useConnectivityRefresh();
  const [searchTerm, setSearchTerm] = useState(
    () => navigationParams.get("search") || "",
  );

  useEffect(() => {
    const paramSearch = navigationParams.get("search");
    if (paramSearch !== null && paramSearch !== searchTerm) {
      setSearchTerm(paramSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigationParams]);
  const [statusFilter, setStatusFilter] = useUrlFilter("status", [
    "all",
    "up",
    "down",
    "slow",
    "disabled",
  ] as const);
  const [protocolFilter, setProtocolFilter] = useUrlFilter("type", [
    "all",
    "http",
    "https",
    "tcp",
    "dns",
    "api",
    "ssl",
  ] as const);
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [viewMode, setViewMode] = usePersistentViewMode("monitoring", "table");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState<TargetSortField>("status");
  const [sortAsc, setSortAsc] = useState(true);

  // Shared density & grouping across both List and Card views
  const [density, setDensity] = useState<TargetDensity>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sentinel_monitoring_density");
      if (saved === "comfortable" || saved === "compact") return saved;
    }
    return "comfortable";
  });
  const handleDensityChange = (next: TargetDensity) => {
    setDensity(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("sentinel_monitoring_density", next);
    }
  };

  const [groupBy, setGroupBy] = useState<TargetGroupBy>("none");
  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >({});
  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const directory = useConnectivityDirectory<MonitoringTarget>(
    "monitoring/",
    "monitoring-targets",
    {
      search: searchTerm,
      type: protocolFilter,
      status: statusFilter,
      tag: selectedTag,
      agent: navigationParams.get("agent") || "",
      ordering:
        (sortAsc ? "" : "-") +
        { name: "name", latency: "last_latency", status: "last_status" }[
          sortField
        ],
    },
    autoRefresh.refetchInterval,
  );
  const { data: targets, isLoading, isError, refetch } = directory;
  const selectionScope = JSON.stringify(directory.params);
  useEffect(() => setSelectedIds([]), [selectionScope]);

  const createMutation = useMutation({
    mutationFn: async (data: CreateTargetData) => {
      await api.post("/monitoring/", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["monitoring-targets", organizationId],
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: CreateTargetData;
    }) => {
      await api.patch(`/monitoring/${id}/`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["monitoring-targets", organizationId],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/monitoring/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["monitoring-targets", organizationId],
      });
    },
  });

  const scanMutation = useMutation({
    mutationFn: async (id: string) => {
      setScanningId(id);
      const current = targets?.find((t) => t.id === id);
      const res = await api.post(`/monitoring/${id}/scan/`);
      const queued = res.data?.data as QueuedScan;
      return waitForFreshScan<MonitoringTarget>(
        queued,
        async () =>
          (await api.get(`/monitoring/${id}/`)).data?.data as MonitoringTarget,
        (target) => target.last_checked_at,
        {
          label: current?.name,
          formatResult: (t) => {
            const lat =
              t.last_latency != null ? `${Math.round(t.last_latency)} ms` : null;
            const statusMap: Record<string, string> = {
              up: "online",
              slow: "lento",
              down: "caído",
              error: "error",
            };
            const st = statusMap[t.last_status || ""] || "actualizado";
            return {
              message: [t.name, lat, st].filter(Boolean).join(" · "),
              tone:
                t.last_status === "up"
                  ? "success"
                  : t.last_status === "slow"
                    ? "warning"
                    : "danger",
            };
          },
          onView: (t) => handleSelectTarget(t),
        },
      );
    },
    onSuccess: (updatedTarget) => {
      queryClient.invalidateQueries({
        queryKey: ["monitoring-targets", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["monitoring-checks", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["target-checks-chart", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["target-uptime-sla", organizationId],
      });
      if (
        selectedTarget &&
        updatedTarget &&
        selectedTarget.id === updatedTarget.id
      ) {
        setSelectedTarget(updatedTarget);
      }
      setScanningId(null);
    },
    onError: () => {
      setScanningId(null);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (target: MonitoringTarget) => {
      await api.patch(`/monitoring/${target.id}/`, {
        enabled: !target.enabled,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["monitoring-targets", organizationId],
      });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: async ({
      action,
      target_ids,
    }: {
      action: string;
      target_ids: string[];
    }) => {
      if (
        action === "delete" &&
        !(await directory.confirmDelete(
          `Eliminar ${target_ids.length} monitores de esta página`,
        ))
      )
        return null;
      const r = await api.post("/monitoring/bulk-action/", {
        action,
        target_ids,
      });
      return bulkOutcome(r.data.data, target_ids);
    },
    onSuccess: (outcome) => {
      queryClient.invalidateQueries({
        queryKey: ["monitoring-targets", organizationId],
      });
      if (outcome) {
        setSelectedIds(outcome.pending);
        directory.setMessage(outcome.message);
      }
    },
    onError: () =>
      directory.setMessage(
        "No se pudo confirmar la operación. Se conserva la selección; revisa los datos antes de reintentar.",
      ),
  });

  const handleExport = async (targetId: string, targetName: string) => {
    try {
      const response = await api.get(`/monitoring/${targetId}/export/`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `monitoring_history_${targetName.replace(/\s+/g, "_")}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      console.error("Error exporting history:", err);
    }
  };

  const handleSubmit = async (data: CreateTargetData) => {
    if (editingTarget) {
      await updateMutation.mutateAsync({ id: editingTarget.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  const handleEdit = (target: MonitoringTarget) => {
    setEditingTarget(target);
    setShowForm(true);
  };

  const handleDelete = (target: MonitoringTarget) => {
    setDeleteConfirm(target);
  };

  const confirmDelete = async () => {
    if (deleteConfirm) {
      await deleteMutation.mutateAsync(deleteConfirm.id);
      setDeleteConfirm(null);
      if (selectedTarget?.id === deleteConfirm.id) {
        setSelectedTarget(null);
      }
    }
  };

  const handleNewTarget = () => {
    setEditingTarget(null);
    setShowForm(true);
  };

  const handleSelectTarget = (target: MonitoringTarget | null) => {
    setSelectedTarget(target);
    setNavigationParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (target) {
          next.set("target", target.id);
        } else {
          next.delete("target");
          next.delete("resource");
        }
        return next;
      },
      { replace: false },
    );
  };

  useEffect(() => {
    const targetIdFromUrl =
      navigationParams.get("target") || navigationParams.get("resource");
    if (!targetIdFromUrl && selectedTarget) {
      setSelectedTarget(null);
    }
  }, [navigationParams, selectedTarget]);

  const allTargets = useMemo(() => targets || [], [targets]);

  // Shared sorting, summary KPIs and grouping for both Card and Table views
  const { sortedTargets, summary, groupedTargets } = useTargets({
    targets: allTargets,
    sortField,
    sortAsc,
    groupBy,
    totalOrgSummary: directory.meta?.summary,
  });

  // Bulk selection handlers
  const handleSelectToggle = (target: MonitoringTarget) => {
    setSelectedIds((prev) =>
      prev.includes(target.id)
        ? prev.filter((id) => id !== target.id)
        : [...prev, target.id],
    );
  };

  const handleSelectAllToggle = () => {
    if (!sortedTargets || sortedTargets.length === 0) return;
    if (selectedIds.length === sortedTargets.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedTargets.map((t) => t.id));
    }
  };

  const handleSortChange = (field: TargetSortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Keep the applied tag available even when its result page is empty.
  const allTags = useMemo(
    () =>
      Array.from(
        new Set([
          ...allTargets.flatMap((t) => t.tags || []),
          ...(selectedTag === "all" ? [] : [selectedTag]),
        ]),
      ) as string[],
    [allTargets, selectedTag],
  );

  const activeAgentId = navigationParams.get("agent") || "";
  const activeAgentName = useMemo(() => {
    if (!activeAgentId) return "";
    const match = allTargets.find((t) => t.agent_probe === activeAgentId);
    return (match?.agent_probe_name || "").replace(/^Senti9:\s*/i, "");
  }, [activeAgentId, allTargets]);

  const clearAgentFilter = () => {
    setNavigationParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("agent");
        return next;
      },
      { replace: false },
    );
  };

  const hasFilters =
    !!searchTerm ||
    statusFilter !== "all" ||
    protocolFilter !== "all" ||
    selectedTag !== "all" ||
    !!activeAgentId;

  useLinkedResource(targets, selectedTarget, setSelectedTarget);

  if (isError && !targets) return <ReadFailure retry={refetch} />;
  return (
    <div className="compact-workspace space-y-3.5 animate-in fade-in duration-300">
      {isError && <ReadFailure stale={!!targets} retry={refetch} />}
      <ActionFeedback>{directory.message}</ActionFeedback>
      {directory.confirmation}

      <NOCPageHeader
        title="Uptime & Latencia"
        badgeText="RESULTADOS DE MONITOREO"
        description="Disponibilidad y latencia de servicios públicos y privados."
        autoRefresh={{ ...autoRefresh, onToggle: autoRefresh.toggle }}
        actions={
          <>
            <button
              onClick={() => navigate("/senti9")}
              className="flex items-center gap-2 bg-accent-purple/10 border border-accent-purple/40 text-accent-purple font-medium px-4 py-2 rounded-full text-sm hover:bg-accent-purple/20 transition-all shadow-sm"
              title="Administrar guardianes Senti9 para auditar redes privadas y On-Premise"
            >
              <Server size={15} />
              <span>Senti9</span>
            </button>

            <AdminButton
              capability="monitoring.create"
              onClick={handleNewTarget}
              className="flex items-center gap-2 bg-accent-green text-black font-semibold px-5 py-2 rounded-full text-sm hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20"
            >
              <Plus size={16} />
              Nuevo Target
            </AdminButton>
          </>
        }
      />

      {/* Shared Unified Summary & Filter Bar for both Card and List views */}
      <UptimeToolbar
        visibleCount={sortedTargets.length}
        summary={summary}
        activeStatusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        protocolFilter={protocolFilter}
        onProtocolFilterChange={setProtocolFilter}
        tagFilter={selectedTag}
        onTagFilterChange={setSelectedTag}
        availableTags={allTags}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        density={density}
        onDensityChange={handleDensityChange}
        search={searchTerm}
        onSearchChange={setSearchTerm}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Active Guardian Filter Banner (when opened from Senti9 "X monitor(es)") */}
      {activeAgentId && (
        <div className="w-full max-w-[1400px] mx-auto flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl border border-accent-purple/35 bg-accent-purple/10 text-xs">
          <div className="flex items-center gap-2 min-w-0 text-text-main">
            <Server size={13} className="text-accent-purple shrink-0" />
            <span className="truncate">
              Filtrado por guardián Senti9:{" "}
              <strong className="font-semibold">
                {activeAgentName || activeAgentId.slice(0, 8)}
              </strong>
            </span>
          </div>
          <button
            type="button"
            onClick={clearAgentFilter}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-text-muted hover:text-text-main hover:bg-white/10 transition-colors cursor-pointer shrink-0 !min-h-0"
            title="Quitar filtro de guardián y ver todos los monitores"
          >
            <X size={12} />
            <span>Quitar filtro</span>
          </button>
        </div>
      )}

      {/* Floating Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="sticky top-4 z-20 w-full max-w-[1400px] mx-auto bg-bg-dark/95 border border-accent-green/50 backdrop-blur-md rounded-2xl p-3 px-5 shadow-2xl flex items-center justify-between gap-4 animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-3">
            <CheckSquare size={18} className="text-accent-green" />
            <span className="text-sm font-semibold text-text-main">
              {selectedIds.length} target{selectedIds.length > 1 ? "s" : ""}{" "}
              seleccionado{selectedIds.length > 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <AdminButton
              capability="monitoring.update"
              onClick={() =>
                bulkMutation.mutate({
                  action: "pause",
                  target_ids: selectedIds,
                })
              }
              disabled={bulkMutation.isPending}
              className="px-3.5 py-1.5 bg-amber-500/10 border border-amber-500/40 text-amber-400 font-medium rounded-full text-xs hover:bg-amber-500/20 transition-all"
            >
              Pausar
            </AdminButton>
            <AdminButton
              capability="monitoring.update"
              onClick={() =>
                bulkMutation.mutate({
                  action: "resume",
                  target_ids: selectedIds,
                })
              }
              disabled={bulkMutation.isPending}
              className="px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 font-medium rounded-full text-xs hover:bg-emerald-500/20 transition-all"
            >
              Reanudar
            </AdminButton>
            <AdminButton
              capability="monitoring.delete"
              onClick={() =>
                bulkMutation.mutate({
                  action: "delete",
                  target_ids: selectedIds,
                })
              }
              disabled={bulkMutation.isPending}
              className="px-3.5 py-1.5 bg-rose-500/10 border border-rose-500/40 text-rose-400 font-medium rounded-full text-xs hover:bg-rose-500/20 transition-all"
            >
              Eliminar
            </AdminButton>
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 text-text-muted hover:text-text-main text-xs font-medium transition-colors"
            >
              Deseleccionar
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area: Grid vs Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-accent-green" size={36} />
        </div>
      ) : sortedTargets && sortedTargets.length > 0 ? (
        viewMode === "grid" && !compact ? (
          <TargetCardGridView
            sortedTargets={sortedTargets}
            groupedTargets={groupedTargets}
            groupBy={groupBy}
            collapsedGroups={collapsedGroups}
            onToggleGroup={toggleGroup}
            density={density}
            selectedIds={selectedIds}
            onSelectToggle={handleSelectToggle}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onScan={(t) => scanMutation.mutateAsync(t.id)}
            onToggle={(t) => toggleMutation.mutate(t)}
            onAlert={() => navigate("/alerts")}
            scanningId={scanningId}
            onClick={handleSelectTarget}
          />
        ) : (
          <TargetTableView
            sortedTargets={sortedTargets}
            groupedTargets={groupedTargets}
            collapsedGroups={collapsedGroups}
            onToggleGroup={toggleGroup}
            density={density}
            selectedIds={selectedIds}
            onSelectToggle={handleSelectToggle}
            onSelectAllToggle={handleSelectAllToggle}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggle={(t) => toggleMutation.mutate(t)}
            onAlert={() => navigate("/alerts")}
            onClick={handleSelectTarget}
            sortField={sortField}
            sortAsc={sortAsc}
            onSortChange={handleSortChange}
          />
        )
      ) : (
        <div className="w-full max-w-[1400px] mx-auto bg-bg-card border border-border-base rounded-2xl text-center py-16 px-4">
          <TrendingUp className="mx-auto text-text-dim mb-4" size={48} />
          <h3 className="text-lg font-bold text-text-main mb-1">
            No se encontraron objetivos de monitoreo
          </h3>
          <p className="text-text-muted text-sm mb-6 max-w-sm mx-auto">
            {hasFilters
              ? "Prueba ajustando la búsqueda, el tipo, el estado o la etiqueta."
              : "Empieza registrando tu primer servidor, API o dominio para supervisar su latencia y SLA."}
          </p>
          {hasFilters ? (
            <button
              className="ui-button"
              onClick={() => {
                setSearchTerm("");
                setSelectedTag("all");
                // React Router does not queue multiple search-param setters.
                setNavigationParams(
                  (current) => {
                    const next = new URLSearchParams(current);
                    next.delete("status");
                    next.delete("type");
                    return next;
                  },
                  { replace: true },
                );
              }}
            >
              Limpiar filtros
            </button>
          ) : (
            <AdminButton
              capability="monitoring.create"
              onClick={handleNewTarget}
              className="ui-button ui-button-primary"
            >
              <Plus size={18} />
              Crear target
            </AdminButton>
          )}
        </div>
      )}

      {/* Target Detail Slide-Over Drawer */}
      {selectedTarget && (
        <TargetDetailDrawer
          target={selectedTarget}
          targets={sortedTargets || []}
          onSelectTarget={handleSelectTarget}
          onClose={() => handleSelectTarget(null)}
          onScan={(t) => scanMutation.mutate(t.id)}
          onEdit={handleEdit}
          onAlert={() => navigate("/alerts")}
          onTogglePause={(t) => toggleMutation.mutate(t)}
          onExport={handleExport}
          isScanning={scanningId === selectedTarget.id}
        />
      )}

      {/* Target Create/Edit Modal Form */}
      {showForm && (
        <TargetForm
          target={editingTarget}
          existingTargets={sortedTargets || targets || []}
          onSubmit={handleSubmit}
          onClose={() => {
            setShowForm(false);
            setEditingTarget(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
            onClick={() => setDeleteConfirm(null)}
          >
            <ModalSurface
              label="Eliminar Target"
              onClose={() => setDeleteConfirm(null)}
              className="bg-bg-card border border-border-base rounded-xl p-6 w-full max-w-sm shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-accent-red/10 flex items-center justify-center">
                  <Trash2 className="text-accent-red" size={20} />
                </div>
                <h2 className="text-lg font-bold">Eliminar Target</h2>
              </div>
              <p className="text-text-muted text-sm mb-4">
                ¿Seguro que deseas eliminar{" "}
                <strong className="text-text-main">{deleteConfirm.name}</strong>
                ? Esta acción eliminará todo su historial de métricas y no se
                puede deshacer.
              </p>
              {((deleteConfirm.linked_ssl_count ?? 0) > 0 ||
                (deleteConfirm.linked_dns_count ?? 0) > 0) && (
                <div className="mb-5 rounded-lg border border-amber-500/35 bg-amber-500/10 p-3 text-xs text-amber-200 leading-relaxed space-y-1.5">
                  {(deleteConfirm.linked_ssl_count ?? 0) > 0 && (
                    <p>
                      Se desvinculará {deleteConfirm.linked_ssl_count}{" "}
                      {deleteConfirm.linked_ssl_count === 1
                        ? "certificado SSL"
                        : "certificados SSL"}
                      {deleteConfirm.linked_ssl_domain
                        ? ` (${deleteConfirm.linked_ssl_domain})`
                        : ""}
                      . El certificado seguirá activo en SSL &amp; TLS sin
                      vínculo a este target.
                    </p>
                  )}
                  {(deleteConfirm.linked_dns_count ?? 0) > 0 && (
                    <p>
                      Se desvincularán {deleteConfirm.linked_dns_count}{" "}
                      {deleteConfirm.linked_dns_count === 1
                        ? "registro DNS"
                        : "registros DNS"}
                      . Seguirán activos en Registros &amp; Zonas DNS sin
                      vínculo a este target.
                    </p>
                  )}
                </div>
              )}
              <div className="flex gap-3">
                <AdminButton
                  capability="monitoring.delete"
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2.5 border border-border-base rounded-lg text-sm text-text-muted hover:bg-bg-card-hover transition-colors"
                >
                  Cancelar
                </AdminButton>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-2.5 bg-accent-red text-white font-semibold rounded-lg text-sm hover:opacity-90 transition-opacity"
                >
                  Eliminar
                </button>
              </div>
            </ModalSurface>
          </div>,
          document.body,
        )}
      <DirectoryPagination directory={directory} />
    </div>
  );
}
