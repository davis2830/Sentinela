import { useCompactViewport } from "../hooks/useCompactViewport";
import {
  ReadFailure,
  DirectoryPagination,
  ActionFeedback,
} from "../components/common/DirectoryState";
import { useConnectivityDirectory } from "../hooks/useConnectivityDirectory";
import { bulkOutcome } from "../utils/bulkOutcome";
import { useLinkedResource } from "../hooks/useLinkedResource";
import { useUrlFilter } from "../hooks/useUrlFilter";
import AdminButton from "../components/common/AdminButton";
import { useAuthStore } from "../store/authStore";
import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import { waitForFreshScan, type QueuedScan } from "../utils/scanPolling";
import type {
  APICheckTarget,
  CreateAPICheckTargetData,
  APICheckStats,
} from "../types/api_checks";
import EmptyState from "../components/common/EmptyState";
import ConfirmDelete from "../components/common/ConfirmDelete";
import APICheckCard from "../components/api_checks/APICheckCard";
import APICheckTableView from "../components/api_checks/APICheckTableView";
import APICheckDetailDrawer from "../components/api_checks/APICheckDetailDrawer";
import APICheckForm from "../components/api_checks/APICheckForm";
import {
  NOCPageHeader,
  NOCToolbar,
  NOCBulkActionBar,
} from "../components/common/noc";
import { useConnectivityRefresh } from "../hooks/useConnectivityRefresh";
import { usePersistentViewMode } from "../hooks/usePersistentViewMode";
import {
  Plug,
  Plus,
  Loader2,
  Trash2,
  Download,
  Pause,
  Play,
} from "lucide-react";

type StatusFilterType = "all" | "pass" | "slow" | "fail";

export default function APIChecksPage() {
  const compact = useCompactViewport();
  const organizationId = useAuthStore((state) => state.user?.organization?.id);

  const queryClient = useQueryClient();

  // State
  const [methodFilter, setMethodFilter] = useUrlFilter("method", [
    "all",
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "HEAD",
  ] as const);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useUrlFilter("status", [
    "all",
    "pass",
    "slow",
    "fail",
  ] as const);
  const [viewMode, setViewMode] = usePersistentViewMode("api_checks", "table");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [scanningId, setScanningId] = useState<string | null>(null);

  // Read cadence follows the server plan; GET never triggers a scan.
  const autoRefresh = useConnectivityRefresh();

  // Stats query
  const { data: stats } = useQuery<APICheckStats>({
    queryKey: ["api-check-stats", organizationId],
    queryFn: async () => {
      const response = await api.get("api-checks/stats/");
      return (response.data?.data || {}) as APICheckStats;
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  // List targets query
  const directory = useConnectivityDirectory<APICheckTarget>(
    "api-checks/",
    "api-check-targets",
    { search: searchTerm, method: methodFilter, status: statusFilter },
    autoRefresh.refetchInterval,
  );
  const { data: targets, isLoading, isError, refetch } = directory;
  const selectionScope = JSON.stringify(directory.params);
  useEffect(() => setSelectedIds([]), [selectionScope]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: CreateAPICheckTargetData) => {
      await api.post("api-checks/", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["api-check-targets", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["api-check-stats", organizationId],
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: CreateAPICheckTargetData;
    }) => {
      await api.patch(`api-checks/${id}/`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["api-check-targets", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["api-check-stats", organizationId],
      });
    },
  });

  const scanMutation = useMutation({
    mutationFn: async (id: string) => {
      setScanningId(id);
      const response = await api.post(`api-checks/${id}/scan/`);
      const queued = response.data?.data as QueuedScan;
      return waitForFreshScan<APICheckTarget>(
        queued,
        async () =>
          (await api.get(`api-checks/${id}/`)).data?.data as APICheckTarget,
        (target) => target.last_checked_at,
      );
    },
    onSuccess: (updatedTarget) => {
      queryClient.invalidateQueries({
        queryKey: ["api-check-targets", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["api-check-stats", organizationId],
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`api-checks/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["api-check-targets", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["api-check-stats", organizationId],
      });
      if (selectedTarget?.id === deleteTarget?.id) {
        setSelectedTarget(null);
      }
      setDeleteTarget(null);
    },
  });

  // Bulk Actions
  const handleToggleSelect = (target: APICheckTarget) => {
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
      setSelectedIds(filteredTargets.map((t: APICheckTarget) => t.id));
    }
  };

  const [bulkProcessing, setBulkProcessing] = useState(false);

  const handleBulkAction = async (
    action: "scan" | "pause" | "resume" | "delete",
  ) => {
    if (selectedIds.length === 0) return;

    if (
      action === "delete" &&
      !(await directory.confirmDelete(
        `Eliminar ${selectedIds.length} endpoints seleccionados.`,
      ))
    )
      return;

    setBulkProcessing(true);
    try {
      const response = await api.post("api-checks/bulk-action/", {
        action,
        target_ids: selectedIds,
      });
      const outcome = bulkOutcome(response.data.data, selectedIds);
      setSelectedIds(outcome.pending);
      directory.setMessage(outcome.message);
      queryClient.invalidateQueries({
        queryKey: ["api-check-targets", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["api-check-stats", organizationId],
      });
    } catch {
      directory.setMessage(
        "No se pudo confirmar la acción. No se reintentaron operaciones; revisa los recursos antes de reintentar.",
      );
    } finally {
      setBulkProcessing(false);
    }
  };

  // Export CSV Report
  const handleExportCSV = () => void directory.exportCSV();

  // Modals & Drawer State
  const [showForm, setShowForm] = useState(false);
  const [editingTarget, setEditingTarget] = useState<APICheckTarget | null>(
    null,
  );
  const [selectedTarget, setSelectedTarget] = useState<APICheckTarget | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<APICheckTarget | null>(null);

  const handleOpenCreate = () => {
    setEditingTarget(null);
    setShowForm(true);
  };

  const handleOpenEdit = (target: APICheckTarget, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingTarget(target);
    setShowForm(true);
  };

  const handleOpenDelete = (target: APICheckTarget, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeleteTarget(target);
  };

  const handleFormSubmit = async (data: CreateAPICheckTargetData) => {
    if (editingTarget) {
      await updateMutation.mutateAsync({ id: editingTarget.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
    setShowForm(false);
    setEditingTarget(null);
  };

  // KPI Calculations
  const allTargets = targets || [];
  const totalCount = stats?.total ?? "—";
  const passCount = stats?.pass_count ?? "—";
  const slowCount = stats?.slow_count ?? "—";
  const failCount = stats?.fail_count ?? "—";

  // Filtered & Searched Targets
  const filteredTargets = allTargets;

  useLinkedResource(targets, selectedTarget, setSelectedTarget);

  if (isError && !targets) return <ReadFailure retry={refetch} />;
  return (
    <div className="compact-workspace space-y-4 animate-in fade-in duration-300 font-sans">
      {isError && <ReadFailure stale={!!targets} retry={refetch} />}
      <ActionFeedback>{directory.message}</ActionFeedback>
      {directory.confirmation}

      {/* 1. TOP HEADER (Standard NOC Header) */}
      <NOCPageHeader
        title="API Endpoints Check"
        badgeText="API WATCHDOG"
        description="Valida respuestas HTTP, tiempos y campos JSON desde la nube."
        icon={<Plug size={26} />}
        autoRefresh={{
          enabled: autoRefresh.enabled,
          countdown: autoRefresh.countdown,
          onToggle: autoRefresh.toggle,
          intervalSeconds: autoRefresh.intervalSeconds,
          ready: autoRefresh.ready,
          blockedReason: autoRefresh.blockedReason,
        }}
        actions={
          <>
            <AdminButton
              capability="api_checks.create"
              type="button"
              onClick={handleOpenCreate}
              className="flex items-center gap-2 bg-accent-green text-black font-semibold px-5 py-2 rounded-full text-sm hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20 cursor-pointer"
            >
              <Plus size={16} />
              <span>Nuevo API Check</span>
            </AdminButton>
          </>
        }
      />

      {/* 3. TOOLBAR: Omnibar Search + Methods + Status Pills + Grid/Table Switcher */}
      <NOCToolbar
        layout="inline"
        countsScope="total de la organización"
        utilities={[
          {
            label: "Exportar resultados filtrados",
            icon: <Download size={16} />,
            onClick: () => void handleExportCSV(),
            disabled: !targets?.length,
          },
        ]}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por nombre de API, ruta o URL de endpoint..."
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        categoryLabel="Método:"
        categories={[
          { id: "all", label: "Todos" },
          { id: "GET", label: "GET" },
          { id: "POST", label: "POST" },
          { id: "PUT", label: "PUT" },
          { id: "PATCH", label: "PATCH" },
          { id: "DELETE", label: "DELETE" },
          { id: "HEAD", label: "HEAD" },
        ]}
        selectedCategory={methodFilter}
        onCategoryChange={setMethodFilter}
        statusPills={[
          { id: "all", label: "Todos", count: totalCount, variant: "all" },
          {
            id: "pass",
            label: "Exitosas",
            count: passCount,
            variant: "success",
          },
          { id: "slow", label: "Lentas", count: slowCount, variant: "warning" },
          {
            id: "fail",
            label: "Con Fallos",
            count: failCount,
            variant: "danger",
          },
        ]}
        selectedStatus={statusFilter}
        onStatusChange={(st) => setStatusFilter(st as StatusFilterType)}
      />

      {/* 4. FLOATING BULK ACTIONS BAR */}
      <NOCBulkActionBar
        selectedCount={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        itemLabel="endpoints"
        actions={
          <>
            <AdminButton
              capability="api_checks.update"
              type="button"
              onClick={() => handleBulkAction("pause")}
              disabled={bulkProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-dark border border-border-base text-text-muted hover:text-text-main font-semibold rounded-full text-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <Pause size={13} />
              Pausar
            </AdminButton>
            <AdminButton
              capability="api_checks.update"
              type="button"
              onClick={() => handleBulkAction("resume")}
              disabled={bulkProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-dark border border-border-base text-accent-green hover:bg-accent-green/10 font-semibold rounded-full text-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <Play size={13} />
              Reanudar
            </AdminButton>
            <AdminButton
              capability="api_checks.delete"
              type="button"
              onClick={() => handleBulkAction("delete")}
              disabled={bulkProcessing}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-accent-red text-white font-semibold rounded-full text-xs hover:bg-accent-red/90 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Trash2 size={13} />
              {bulkProcessing ? "Procesando..." : "Eliminar"}
            </AdminButton>
          </>
        }
      />

      {/* 5. MAIN CONTENT: DUAL VIEW (GRID OR TABLE) */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-accent-green" size={32} />
        </div>
      ) : filteredTargets && filteredTargets.length > 0 ? (
        viewMode === "grid" || compact ? (
          /* Grid View (Cards) */
          <div className="connectivity-card-grid">
            {filteredTargets.map((target: APICheckTarget) => (
              <APICheckCard
                key={target.id}
                target={target}
                isSelected={selectedIds.includes(target.id)}
                onToggleSelect={() => handleToggleSelect(target)}
                onClick={() => setSelectedTarget(target)}
                onScan={(e) => {
                  e.stopPropagation();
                  scanMutation.mutate(target.id);
                }}
                isScanning={scanningId === target.id}
                onEdit={(e) => handleOpenEdit(target, e)}
                onDelete={(e) => handleOpenDelete(target, e)}
              />
            ))}
          </div>
        ) : (
          /* Compact NOC Table View */
          <APICheckTableView
            targets={filteredTargets}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAllToggle}
            onSelectTarget={(t) => setSelectedTarget(t)}
            onScan={(id, e) => {
              e.stopPropagation();
              scanMutation.mutate(id);
            }}
            scanningId={scanningId}
            onEdit={(t, e) => handleOpenEdit(t, e)}
            onDelete={(t, e) => handleOpenDelete(t, e)}
          />
        )
      ) : (
        <EmptyState
          capability="api_checks.create"
          icon={Plug}
          title={
            searchTerm || methodFilter !== "all" || statusFilter !== "all"
              ? "No se encontraron endpoints con los filtros seleccionados"
              : "No hay API Check targets configurados"
          }
          description={
            searchTerm || methodFilter !== "all" || statusFilter !== "all"
              ? "Intenta cambiar el término de búsqueda o restablecer los filtros activos."
              : "Comienza a monitorear tus endpoints REST, tiempos de respuesta y validación de schemas."
          }
          actionLabel={
            searchTerm || methodFilter !== "all" || statusFilter !== "all"
              ? "Limpiar Filtros"
              : "Nuevo API Check"
          }
          onAction={() => {
            if (
              searchTerm ||
              methodFilter !== "all" ||
              statusFilter !== "all"
            ) {
              setSearchTerm("");
              setMethodFilter("all");
              setStatusFilter("all");
            } else {
              handleOpenCreate();
            }
          }}
        />
      )}

      {/* 6. SLIDE-OVER DETAIL DRAWER */}
      <APICheckDetailDrawer
        target={selectedTarget}
        isOpen={!!selectedTarget}
        onClose={() => setSelectedTarget(null)}
        onScan={async (id) => scanMutation.mutateAsync(id)}
        isScanning={scanningId === selectedTarget?.id}
        onEdit={(t) => handleOpenEdit(t)}
        onDelete={(t) => handleOpenDelete(t)}
      />

      {/* 7. CREATE / EDIT FORM MODAL WITH LIVE TEST */}
      {showForm && (
        <APICheckForm
          target={editingTarget}
          onSubmit={handleFormSubmit}
          onClose={() => {
            setShowForm(false);
            setEditingTarget(null);
          }}
        />
      )}

      {/* 8. DELETE CONFIRMATION MODAL */}
      <ConfirmDelete
        isOpen={!!deleteTarget}
        itemName={deleteTarget?.name || "este endpoint"}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
      <DirectoryPagination directory={directory} />
    </div>
  );
}
