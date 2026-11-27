import { useMemo, useState } from "react";
import {
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import AdminButton from "../components/common/AdminButton";
import ConfirmDelete from "../components/common/ConfirmDelete";
import {
  ActionFeedback,
  DirectoryPagination,
  ReadFailure,
} from "../components/common/DirectoryState";
import EmptyState from "../components/common/EmptyState";
import { NOCBulkActionBar, NOCPageHeader } from "../components/common/noc";
import SecurityHeaderCardGridView from "../components/security_headers/SecurityHeaderCardGridView";
import SecurityHeaderDetailDrawer from "../components/security_headers/SecurityHeaderDetailDrawer";
import SecurityHeaderForm from "../components/security_headers/SecurityHeaderForm";
import SecurityHeaderTableView from "../components/security_headers/SecurityHeaderTableView";
import SecurityHeaderToolbar from "../components/security_headers/SecurityHeaderToolbar";
import {
  useSecurityHeaders,
  type SecurityHeaderDensity,
  type SecurityHeaderGroupBy,
  type SecurityHeaderLeakFilter,
  type SecurityHeaderProtectionFilter,
  type SecurityHeaderSortField,
} from "../components/security_headers/useSecurityHeaders";
import { useCapability } from "../hooks/useCapability";
import { useCompactViewport } from "../hooks/useCompactViewport";
import { useSecurityHeadersWorkspace } from "./workspaces/useSecurityHeadersWorkspace";

export default function SecurityHeadersPage() {
  const compact = useCompactViewport();
  const canScan = useCapability("security_headers.scan");
  const canUpdate = useCapability("security_headers.update");
  const canDelete = useCapability("security_headers.delete");

  const {
    directory,
    stats,
    targets,
    isLoading,
    isError,
    refetch,
    selectedTarget,
    setSelectedTarget,
    showForm,
    setShowForm,
    editingTarget,
    setEditingTarget,
    deleteTarget,
    setDeleteTarget,
    gradeFilter,
    setGradeFilter,
    searchTerm,
    setSearchTerm,
    viewMode,
    setViewMode,
    selectedIds,
    setSelectedIds,
    scanningId,
    bulkActionRunning,
    autoRefresh,
    results,
    isLoadingResults,
    scanMutation,
    deleteMutation,
    handleToggleSelect,
    handleToggleEnabled,
    handleExecuteBulkAction,
    handleExportCSV,
    handleFormSubmit,
    handleOpenCreate,
    handleOpenEdit,
  } = useSecurityHeadersWorkspace();

  const [leakFilter, setLeakFilter] = useState<SecurityHeaderLeakFilter>("all");
  const [protectionFilter, setProtectionFilter] =
    useState<SecurityHeaderProtectionFilter>("all");
  const [hostFilter, setHostFilter] = useState("all");
  const [groupBy, setGroupBy] = useState<SecurityHeaderGroupBy>("none");
  const [density, setDensity] = useState<SecurityHeaderDensity>("compact");
  const [sortField, setSortField] = useState<SecurityHeaderSortField>("status");
  const [sortAsc, setSortAsc] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >({});

  const allTargets = useMemo(() => targets || [], [targets]);

  const { facets, summary, sortedTargets, groupedTargets } = useSecurityHeaders(
    {
      targets: allTargets,
      leakFilter,
      protectionFilter,
      hostFilter,
      sortField,
      sortAsc,
      groupBy,
    },
  );

  const handleSortChange = (field: SecurityHeaderSortField) => {
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

  const handleSelectAll = () => {
    if (sortedTargets.length === 0) return;
    if (selectedIds.length === sortedTargets.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedTargets.map((t) => t.id));
    }
  };

  const hasFilters =
    Boolean(searchTerm) ||
    gradeFilter !== "all" ||
    leakFilter !== "all" ||
    protectionFilter !== "all" ||
    hostFilter !== "all";

  const clearAllFilters = () => {
    setSearchTerm("");
    setGradeFilter("all");
    setLeakFilter("all");
    setProtectionFilter("all");
    setHostFilter("all");
    setGroupBy("none");
  };

  if (isError && !targets) return <ReadFailure retry={refetch} />;

  return (
    <div className="compact-workspace space-y-4 animate-in fade-in duration-200 font-sans">
      {isError && targets && <ReadFailure stale retry={refetch} />}
      <ActionFeedback>{directory.message}</ActionFeedback>
      {directory.confirmation}

      {/* 1. Standard NOC Header */}
      <NOCPageHeader
        title="Cabeceras de Seguridad"
        badgeText="HEADER AUDIT"
        description="Audita cabeceras HTTP de seguridad (HSTS, CSP, XFO) y fugas de servidor desde la nube."
        icon={<ShieldCheck size={22} className="text-accent-green" />}
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
            capability="security_headers.create"
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 bg-accent-green text-black font-semibold px-4 py-2 rounded-full text-sm hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20 cursor-pointer"
          >
            <Plus size={16} />
            <span>Agregar endpoint</span>
          </AdminButton>
        }
      />

      {/* 2. Single-Row Shared Connectivity Toolbar */}
      <SecurityHeaderToolbar
        stats={stats}
        summary={summary}
        search={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={gradeFilter}
        onStatusFilterChange={setGradeFilter}
        leakFilter={leakFilter}
        onLeakFilterChange={setLeakFilter}
        protectionFilter={protectionFilter}
        onProtectionFilterChange={setProtectionFilter}
        hostFilter={hostFilter}
        onHostFilterChange={setHostFilter}
        availableHosts={facets.hosts}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        density={density}
        onDensityChange={setDensity}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onExportCSV={handleExportCSV}
        canExport={allTargets.length > 0}
      />

      {/* 3. Bulk Actions Bar */}
      <NOCBulkActionBar
        selectedCount={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        itemLabel="endpoints"
        actions={
          <>
            <AdminButton
              capability="security_headers.scan"
              type="button"
              onClick={() => void handleExecuteBulkAction("scan")}
              disabled={bulkActionRunning}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-bg-card border border-border-base text-accent-green hover:bg-accent-green/10 font-semibold rounded-full text-xs transition-all disabled:opacity-50"
            >
              <RefreshCw size={13} />
              Auditar
            </AdminButton>
            <AdminButton
              capability="security_headers.update"
              type="button"
              onClick={() => void handleExecuteBulkAction("pause")}
              disabled={bulkActionRunning}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-bg-card border border-border-base text-text-muted hover:text-text-main font-semibold rounded-full text-xs transition-all disabled:opacity-50"
            >
              <Pause size={13} />
              Pausar
            </AdminButton>
            <AdminButton
              capability="security_headers.update"
              type="button"
              onClick={() => void handleExecuteBulkAction("resume")}
              disabled={bulkActionRunning}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-bg-card border border-border-base text-accent-green hover:bg-accent-green/10 font-semibold rounded-full text-xs transition-all disabled:opacity-50"
            >
              <Play size={13} />
              Reanudar
            </AdminButton>
            <AdminButton
              capability="security_headers.delete"
              type="button"
              onClick={() => void handleExecuteBulkAction("delete")}
              disabled={bulkActionRunning}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-accent-red text-white font-semibold rounded-full text-xs hover:bg-accent-red/90 transition-all shadow-sm disabled:opacity-50"
            >
              <Trash2 size={13} />
              Eliminar
            </AdminButton>
          </>
        }
      />

      {/* 4. Main Directory: Table vs Compact Cards */}
      {isLoading ? (
        <div className="w-full max-w-[1400px] mx-auto flex flex-col items-center justify-center py-20 rounded-2xl border border-border-base bg-bg-card text-text-muted gap-3">
          <Loader2 className="animate-spin text-accent-green" size={26} />
          <p className="text-xs font-mono">Consultando cabeceras de seguridad...</p>
        </div>
      ) : sortedTargets.length > 0 ? (
        viewMode === "grid" || compact ? (
          <SecurityHeaderCardGridView
            targets={sortedTargets}
            groupedTargets={groupedTargets}
            collapsedGroups={collapsedGroups}
            onToggleGroup={toggleGroup}
            density={density}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectTarget={setSelectedTarget}
            onScan={(id) => scanMutation.mutate(id)}
            scanningId={scanningId}
            onEdit={handleOpenEdit}
            onToggleEnabled={handleToggleEnabled}
            onDelete={setDeleteTarget}
            canScan={canScan}
            canUpdate={canUpdate}
            canDelete={canDelete}
          />
        ) : (
          <SecurityHeaderTableView
            targets={sortedTargets}
            groupedTargets={groupedTargets}
            collapsedGroups={collapsedGroups}
            onToggleGroup={toggleGroup}
            density={density}
            sortField={sortField}
            sortAsc={sortAsc}
            onSortChange={handleSortChange}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            onSelectTarget={setSelectedTarget}
            onScan={(id) => scanMutation.mutate(id)}
            scanningId={scanningId}
            onEdit={handleOpenEdit}
            onToggleEnabled={handleToggleEnabled}
            onDelete={setDeleteTarget}
            canScan={canScan}
            canUpdate={canUpdate}
            canDelete={canDelete}
          />
        )
      ) : (
        <EmptyState
          capability="security_headers.create"
          icon={ShieldCheck}
          title={
            hasFilters
              ? "No se encontraron endpoints con estos filtros"
              : "No hay endpoints de Security Headers monitoreados"
          }
          description={
            hasFilters
              ? "Ajusta la búsqueda, calificación, fugas o blindaje para ver el resto del directorio."
              : "Supervisa las cabeceras HTTP de seguridad (HSTS, CSP, XFO) y fugas de servidor de tus portales y APIs."
          }
          actionLabel={hasFilters ? "Limpiar filtros" : "Agregar endpoint"}
          onAction={() => {
            if (hasFilters) clearAllFilters();
            else handleOpenCreate();
          }}
        />
      )}

      <div className="pt-2 w-full max-w-[1400px] mx-auto">
        <DirectoryPagination directory={directory} />
      </div>

      {/* 5. Shared Slide-Over Detail Drawer */}
      {selectedTarget && (
        <SecurityHeaderDetailDrawer
          target={selectedTarget}
          targets={sortedTargets}
          results={results}
          isLoadingResults={isLoadingResults}
          isScanning={
            scanMutation.isPending && scanningId === selectedTarget.id
          }
          onSelectTarget={setSelectedTarget}
          onScan={(id) => scanMutation.mutateAsync(id)}
          onEdit={handleOpenEdit}
          onToggleEnabled={handleToggleEnabled}
          onDelete={setDeleteTarget}
          canUpdate={canUpdate}
          canDelete={canDelete}
          onClose={() => setSelectedTarget(null)}
        />
      )}

      {/* 6. Create / Edit Modal */}
      {showForm && (
        <SecurityHeaderForm
          target={editingTarget}
          onSubmit={handleFormSubmit}
          onClose={() => {
            setShowForm(false);
            setEditingTarget(null);
          }}
        />
      )}

      {/* 7. Delete Confirmation */}
      <ConfirmDelete
        isOpen={!!deleteTarget}
        itemName={deleteTarget?.name || "este endpoint"}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
