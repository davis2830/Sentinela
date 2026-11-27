import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pause, Play, Plug, Plus, RefreshCw, Trash2 } from "lucide-react";
import APICheckCardGridView from "../components/api_checks/APICheckCardGridView";
import APICheckDetailDrawer from "../components/api_checks/APICheckDetailDrawer";
import APICheckForm from "../components/api_checks/APICheckForm";
import APICheckTableView from "../components/api_checks/APICheckTableView";
import APICheckToolbar from "../components/api_checks/APICheckToolbar";
import {
  useAPIChecks,
  type APICheckDensity,
  type APICheckGroupBy,
  type APICheckSchemaFilter,
  type APICheckSortField,
} from "../components/api_checks/useAPIChecks";
import AdminButton from "../components/common/AdminButton";
import ConfirmDelete from "../components/common/ConfirmDelete";
import {
  ActionFeedback,
  DirectoryPagination,
  ReadFailure,
} from "../components/common/DirectoryState";
import EmptyState from "../components/common/EmptyState";
import { NOCBulkActionBar, NOCPageHeader } from "../components/common/noc";
import { useCompactViewport } from "../hooks/useCompactViewport";
import { useConnectivityDirectory } from "../hooks/useConnectivityDirectory";
import { useConnectivityRefresh } from "../hooks/useConnectivityRefresh";
import { useLinkedResource } from "../hooks/useLinkedResource";
import { usePersistentViewMode } from "../hooks/usePersistentViewMode";
import { useUrlFilter } from "../hooks/useUrlFilter";
import { api } from "../services/api";
import { useAuthStore } from "../store/authStore";
import type {
  APICheckStats,
  APICheckTarget,
  CreateAPICheckTargetData,
} from "../types/api_checks";
import { bulkOutcome } from "../utils/bulkOutcome";
import { waitForFreshScan, type QueuedScan } from "../utils/scanPolling";

type StatusFilterType =
  | "all"
  | "pass"
  | "slow"
  | "fail"
  | "rate_limited"
  | "paused"
  | "pending";

export default function APIChecksPage() {
  const compact = useCompactViewport();
  const organizationId = useAuthStore((state) => state.user?.organization?.id);
  const queryClient = useQueryClient();

  // Filters & view state
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
    "rate_limited",
    "paused",
    "pending",
  ] as const);
  const [hostFilter, setHostFilter] = useState("all");
  const [schemaFilter, setSchemaFilter] = useState<APICheckSchemaFilter>("all");
  const [groupBy, setGroupBy] = useState<APICheckGroupBy>("none");
  const [density, setDensity] = useState<APICheckDensity>("compact");
  const [sortField, setSortField] = useState<APICheckSortField>("status");
  const [sortAsc, setSortAsc] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >({});
  const [viewMode, setViewMode] = usePersistentViewMode("api_checks", "table");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Modals & Drawer State
  const [showForm, setShowForm] = useState(false);
  const [editingTarget, setEditingTarget] = useState<APICheckTarget | null>(
    null,
  );
  const [selectedTarget, setSelectedTarget] = useState<APICheckTarget | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<APICheckTarget | null>(null);

  // Read cadence follows the server plan; GET never triggers a scan.
  const autoRefresh = useConnectivityRefresh();

  const { data: stats } = useQuery<APICheckStats>({
    queryKey: ["api-check-stats", organizationId],
    queryFn: async () => {
      const response = await api.get("api-checks/stats/");
      return (response.data?.data || {}) as APICheckStats;
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  const directory = useConnectivityDirectory<APICheckTarget>(
    "api-checks/",
    "api-check-targets",
    { search: searchTerm, method: methodFilter, status: statusFilter },
    autoRefresh.refetchInterval,
  );
  const { data: targets, isLoading, isError, refetch } = directory;
  const selectionScope = JSON.stringify(directory.params);
  useEffect(() => setSelectedIds([]), [selectionScope]);

  const allTargets = useMemo(() => targets || [], [targets]);

  // Keep selectedTarget synced when background polling updates the list
  useEffect(() => {
    if (!selectedTarget) return;
    const fresh = allTargets.find((t) => t.id === selectedTarget.id);
    if (fresh && fresh !== selectedTarget) {
      setSelectedTarget(fresh);
    }
  }, [allTargets, selectedTarget]);

  const { facets, summary, sortedTargets, groupedTargets } = useAPIChecks({
    targets: allTargets,
    hostFilter,
    schemaFilter,
    sortField,
    sortAsc,
    groupBy,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({
      queryKey: ["api-check-targets", organizationId],
    });
    queryClient.invalidateQueries({
      queryKey: ["api-check-stats", organizationId],
    });
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: CreateAPICheckTargetData) => {
      await api.post("api-checks/", data);
    },
    onSuccess: invalidateAll,
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
    onSuccess: invalidateAll,
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
      invalidateAll();
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
      invalidateAll();
      if (selectedTarget?.id === deleteTarget?.id) {
        setSelectedTarget(null);
      }
      setDeleteTarget(null);
    },
  });

  const handleSort = (field: APICheckSortField) => {
    if (sortField === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleToggleSelect = (target: APICheckTarget) => {
    setSelectedIds((prev) =>
      prev.includes(target.id)
        ? prev.filter((id) => id !== target.id)
        : [...prev, target.id],
    );
  };

  const handleSelectAllToggle = () => {
    if (sortedTargets.length === 0) return;
    if (selectedIds.length === sortedTargets.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedTargets.map((t) => t.id));
    }
  };

  const handleBulkAction = async (
    action: "scan" | "pause" | "resume" | "delete",
  ) => {
    if (selectedIds.length === 0) return;

    if (
      action === "delete" &&
      !(await directory.confirmDelete(
        `Eliminar ${selectedIds.length} endpoints seleccionados.`,
      ))
    ) {
      return;
    }

    setBulkProcessing(true);
    try {
      const response = await api.post("api-checks/bulk-action/", {
        action,
        target_ids: selectedIds,
      });
      const outcome = bulkOutcome(response.data.data, selectedIds);
      setSelectedIds(outcome.pending);
      directory.setMessage(outcome.message);
      invalidateAll();
    } catch {
      directory.setMessage(
        "No se pudo confirmar la acción. No se reintentaron operaciones; revisa los recursos antes de reintentar.",
      );
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingTarget(null);
    setShowForm(true);
  };

  const handleOpenEdit = (target: APICheckTarget) => {
    setEditingTarget(target);
    setShowForm(true);
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

  const hasActiveFilters = Boolean(
    searchTerm ||
      methodFilter !== "all" ||
      statusFilter !== "all" ||
      hostFilter !== "all" ||
      schemaFilter !== "all",
  );

  useLinkedResource(targets, selectedTarget, setSelectedTarget);

  if (isError && !targets) return <ReadFailure retry={refetch} />;

  return (
    <div className="compact-workspace space-y-4 animate-in fade-in duration-300 font-sans">
      {isError && <ReadFailure stale={!!targets} retry={refetch} />}
      <ActionFeedback>{directory.message}</ActionFeedback>
      {directory.confirmation}

      {/* 1. HEADER */}
      <div className="w-full max-w-[1400px] mx-auto">
        <NOCPageHeader
          title="API Endpoints"
          badgeText="API WATCHDOG"
          description="Valida respuestas HTTP, latencia y contratos JSON desde la nube."
          icon={<Plug size={24} />}
          autoRefresh={{
            enabled: autoRefresh.enabled,
            countdown: autoRefresh.countdown,
            onToggle: autoRefresh.toggle,
            intervalSeconds: autoRefresh.intervalSeconds,
            ready: autoRefresh.ready,
            blockedReason: autoRefresh.blockedReason,
          }}
          actions={
            <AdminButton
              capability="api_checks.create"
              type="button"
              onClick={handleOpenCreate}
              className="flex items-center gap-2 bg-accent-green text-black font-semibold px-4 py-2 rounded-full text-xs sm:text-sm hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20 cursor-pointer"
            >
              <Plus size={15} />
              <span>Agregar endpoint</span>
            </AdminButton>
          }
        />
      </div>

      {/* 2. UNIFIED SINGLE-ROW TOOLBAR */}
      <APICheckToolbar
        stats={stats}
        summary={summary}
        statusFilter={statusFilter}
        onStatusFilterChange={(st) => setStatusFilter(st as StatusFilterType)}
        methodFilter={methodFilter}
        onMethodFilterChange={(m) =>
          setMethodFilter(
            m as "all" | "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD",
          )
        }
        hostFilter={hostFilter}
        onHostFilterChange={setHostFilter}
        schemaFilter={schemaFilter}
        onSchemaFilterChange={setSchemaFilter}
        facets={facets}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        density={density}
        onDensityChange={setDensity}
        search={searchTerm}
        onSearchChange={setSearchTerm}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onExportCSV={() => void directory.exportCSV()}
        canExport={sortedTargets.length > 0}
      />

      {/* 3. FLOATING BULK ACTIONS BAR */}
      <NOCBulkActionBar
        selectedCount={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        itemLabel="endpoints"
        actions={
          <>
            <AdminButton
              capability="api_checks.scan"
              type="button"
              onClick={() => handleBulkAction("scan")}
              disabled={bulkProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-dark border border-border-base text-accent-green hover:bg-accent-green/10 font-semibold rounded-full text-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={13} />
              Comprobar
            </AdminButton>
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

      {/* 4. MAIN CONTENT: DUAL VIEW (TABLE OR CARDS) */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-accent-green" size={32} />
        </div>
      ) : sortedTargets.length > 0 ? (
        viewMode === "grid" || compact ? (
          <APICheckCardGridView
            targets={sortedTargets}
            groups={groupedTargets}
            collapsedGroups={collapsedGroups}
            onToggleGroup={toggleGroup}
            density={density}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectTarget={setSelectedTarget}
            onScan={(t) => scanMutation.mutate(t.id)}
            scanningId={scanningId}
            onEdit={handleOpenEdit}
            onDelete={setDeleteTarget}
          />
        ) : (
          <APICheckTableView
            targets={sortedTargets}
            groups={groupedTargets}
            collapsedGroups={collapsedGroups}
            onToggleGroup={toggleGroup}
            density={density}
            sortField={sortField}
            sortAsc={sortAsc}
            onSort={handleSort}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAllToggle}
            onSelectTarget={setSelectedTarget}
            onScan={(t) => scanMutation.mutate(t.id)}
            scanningId={scanningId}
            onEdit={handleOpenEdit}
            onDelete={setDeleteTarget}
          />
        )
      ) : (
        <div className="w-full max-w-[1400px] mx-auto">
          <EmptyState
            capability="api_checks.create"
            icon={Plug}
            title={
              hasActiveFilters
                ? "No se encontraron endpoints con los filtros seleccionados"
                : "No hay API Check targets configurados"
            }
            description={
              hasActiveFilters
                ? "Intenta cambiar el término de búsqueda o restablecer los filtros activos."
                : "Comienza a monitorear tus endpoints REST, tiempos de respuesta y validación de schemas."
            }
            actionLabel={
              hasActiveFilters ? "Limpiar filtros" : "Agregar endpoint"
            }
            onAction={() => {
              if (hasActiveFilters) {
                setSearchTerm("");
                setMethodFilter("all");
                setStatusFilter("all");
                setHostFilter("all");
                setSchemaFilter("all");
              } else {
                handleOpenCreate();
              }
            }}
          />
        </div>
      )}

      {/* 5. NON-MODAL DETAIL DRAWER (shared ResourceDetailDrawer with Prev/Next) */}
      <APICheckDetailDrawer
        target={selectedTarget}
        targets={sortedTargets}
        onSelectTarget={setSelectedTarget}
        onClose={() => setSelectedTarget(null)}
        onScan={async (id) => scanMutation.mutateAsync(id)}
        isScanning={scanningId === selectedTarget?.id}
        onEdit={handleOpenEdit}
        onDelete={setDeleteTarget}
      />

      {/* 6. CREATE / EDIT FORM MODAL WITH LIVE TEST */}
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

      {/* 7. DELETE CONFIRMATION MODAL */}
      <ConfirmDelete
        isOpen={!!deleteTarget}
        itemName={deleteTarget?.name || "este endpoint"}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />

      <div className="w-full max-w-[1400px] mx-auto">
        <DirectoryPagination directory={directory} />
      </div>
    </div>
  );
}
