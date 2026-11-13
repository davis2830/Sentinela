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
import TargetCard from "../components/monitoring/TargetCard";
import TargetTableView from "../components/monitoring/TargetTableView";
import TargetDetailDrawer from "../components/monitoring/TargetDetailDrawer";
import TargetForm from "../components/monitoring/TargetForm";
import MonitoringToolbar from "../components/monitoring/MonitoringToolbar";
import ModalSurface from "../components/common/ModalSurface";
import { usePersistentViewMode } from "../hooks/usePersistentViewMode";
import {
  Plus,
  Loader2,
  Trash2,
  TrendingUp,
  CheckSquare,
  Server,
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
  const [searchTerm, setSearchTerm] = useState("");
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
  const [sortField, setSortField] = useState<"name" | "latency" | "status">(
    "status",
  );
  const [sortAsc, setSortAsc] = useState(true);

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
      const res = await api.post(`/monitoring/${id}/scan/`);
      const queued = res.data?.data as QueuedScan;
      return waitForFreshScan<MonitoringTarget>(
        queued,
        async () =>
          (await api.get(`/monitoring/${id}/`)).data?.data as MonitoringTarget,
        (target) => target.last_checked_at,
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

  // Bulk selection handlers
  const handleSelectToggle = (target: MonitoringTarget) => {
    setSelectedIds((prev) =>
      prev.includes(target.id)
        ? prev.filter((id) => id !== target.id)
        : [...prev, target.id],
    );
  };

  const handleSelectAllToggle = () => {
    if (!filteredTargets || filteredTargets.length === 0) return;
    if (selectedIds.length === filteredTargets.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTargets.map((t) => t.id));
    }
  };

  const handleSortChange = (field: "name" | "latency" | "status") => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const allTargets = useMemo(() => targets || [], [targets]);

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

  // Filtered & Sorted Targets (Memoized)
  const filteredTargets = allTargets;
  const hasFilters =
    !!searchTerm ||
    statusFilter !== "all" ||
    protocolFilter !== "all" ||
    selectedTag !== "all";

  useLinkedResource(targets, selectedTarget, setSelectedTarget);

  if (isError && !targets) return <ReadFailure retry={refetch} />;
  return (
    <div className="compact-workspace space-y-4 animate-in fade-in duration-300">
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

      <MonitoringToolbar
        search={searchTerm}
        onSearchChange={setSearchTerm}
        protocol={protocolFilter}
        onProtocolChange={setProtocolFilter}
        status={statusFilter}
        onStatusChange={setStatusFilter}
        summary={directory.meta?.summary}
        tags={allTags}
        tag={selectedTag}
        onTagChange={setSelectedTag}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Floating Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="sticky top-4 z-20 bg-bg-dark/95 border border-accent-green/50 backdrop-blur-md rounded-2xl p-3 px-5 shadow-2xl flex items-center justify-between gap-4 animate-in slide-in-from-top duration-200">
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
      ) : filteredTargets && filteredTargets.length > 0 ? (
        viewMode === "grid" && !compact ? (
          <div className="connectivity-card-grid">
            {filteredTargets.map((target: MonitoringTarget) => (
              <TargetCard
                key={target.id}
                target={target}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onScan={(t) => scanMutation.mutateAsync(t.id)}
                onToggle={(t) => toggleMutation.mutate(t)}
                onAlert={() => navigate("/alerts")}
                isScanning={scanningId === target.id}
                onClick={setSelectedTarget}
                isSelected={selectedIds.includes(target.id)}
                onSelectToggle={handleSelectToggle}
              />
            ))}
          </div>
        ) : (
          <TargetTableView
            targets={filteredTargets}
            selectedIds={selectedIds}
            onSelectToggle={handleSelectToggle}
            onSelectAllToggle={handleSelectAllToggle}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onScan={(t) => scanMutation.mutate(t.id)}
            onToggle={(t) => toggleMutation.mutate(t)}
            onAlert={() => navigate("/alerts")}
            scanningId={scanningId}
            onClick={setSelectedTarget}
            sortField={sortField}
            sortAsc={sortAsc}
            onSortChange={handleSortChange}
          />
        )
      ) : (
        <div className="bg-bg-card border border-border-base rounded-2xl text-center py-16 px-4">
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
          onClose={() => setSelectedTarget(null)}
          onScan={(t) => scanMutation.mutate(t.id)}
          onEdit={handleEdit}
          onAlert={() => navigate("/alerts")}
          onExport={handleExport}
          isScanning={scanningId === selectedTarget.id}
        />
      )}

      {/* Private Satellite Agent Directory Drawer */}

      {/* Target Create/Edit Modal Form */}
      {showForm && (
        <TargetForm
          target={editingTarget}
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
              <p className="text-text-muted text-sm mb-6">
                ¿Seguro que deseas eliminar{" "}
                <strong className="text-text-main">{deleteConfirm.name}</strong>
                ? Esta acción eliminará todo su historial de métricas y no se
                puede deshacer.
              </p>
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
