import {
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useCompactViewport } from "../hooks/useCompactViewport";
import {
  ActionFeedback,
  DirectoryPagination,
  ReadFailure,
} from "../components/common/DirectoryState";
import { useDNSRecordsWorkspace } from "./workspaces/useDNSRecordsWorkspace";
import AdminButton from "../components/common/AdminButton";
import EmptyState from "../components/common/EmptyState";
import ConfirmDelete from "../components/common/ConfirmDelete";
import { NOCBulkActionBar, NOCPageHeader } from "../components/common/noc";
import DNSToolbar from "../components/dns/DNSToolbar";
import DNSTableView from "../components/dns/DNSTableView";
import DNSCardGridView from "../components/dns/DNSCardGridView";
import DNSDetailDrawer from "../components/dns/DNSDetailDrawer";
import DNSAddModal from "../components/dns/DNSAddModal";
import { useDNSRecords } from "../components/dns/useDNSRecords";

export default function DNSRecordsPage() {
  const compact = useCompactViewport();
  const {
    expectedInput,
    setExpectedInput,
    referenceModeInput,
    setReferenceModeInput,
    directory,
    isError,
    refetch,
    showModal,
    editingRecord,
    domainInput,
    setDomainInput,
    recordTypeInput,
    setRecordTypeInput,
    typeFilter,
    setTypeFilter,
    searchTerm,
    setSearchTerm,
    viewMode,
    setViewMode,
    selectedIds,
    setSelectedIds,
    scanningId,
    acceptingRefId,
    linkingRecordId,
    deleteTarget,
    setDeleteTarget,
    selectedRecord,
    setSelectedRecord,
    bulkDeleting,
    bulkScanning,
    diagnostic,
    isTestingResolution,
    testResult,
    setTestResult,
    autoRefresh,
    records,
    isLoading,
    history,
    isLoadingHistory,
    scanMutation,
    acceptReferenceMutation,
    linkTargetMutation,
    deleteMutation,
    handleToggleSelect,
    handleBulkScan,
    handleBulkDelete,
    handleTestResolution,
    handleExportCSV,
    handleOpenCreate,
    handleOpenEdit,
    handleCloseModal,
    handleSubmitDNSModal,
    isSubmittingModal,
  } = useDNSRecordsWorkspace();

  const {
    statusFilter,
    setStatusFilter,
    zoneFilter,
    setZoneFilter,
    resolverFilter,
    setResolverFilter,
    groupBy,
    setGroupBy,
    sortKey,
    sortDir,
    handleSort,
    density,
    setDensity,
    summary,
    facets,
    sortedRecords,
    groupedRecords,
  } = useDNSRecords(records || [], typeFilter);

  const hasActiveFilters =
    Boolean(searchTerm) ||
    typeFilter !== "all" ||
    statusFilter !== "all" ||
    zoneFilter !== "all" ||
    resolverFilter !== "all";

  const handleToggleSelectAllVisible = () => {
    if (sortedRecords.length === 0) return;
    if (selectedIds.length === sortedRecords.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedRecords.map((r) => r.id));
    }
  };

  const deleteWarning =
    deleteTarget &&
    deleteTarget.linked_targets &&
    deleteTarget.linked_targets.length > 0
      ? `Se desvinculará de ${deleteTarget.linked_targets
          .map((t) => t.name)
          .join(", ")} en Uptime. El target de Uptime seguirá funcionando.`
      : undefined;

  if (isError && !records) return <ReadFailure retry={refetch} />;

  return (
    <div className="compact-workspace space-y-4 animate-in fade-in duration-300 font-sans">
      {isError && records && <ReadFailure stale retry={refetch} />}
      <ActionFeedback>{directory.message}</ActionFeedback>
      {directory.confirmation}

      {/* 1. TOP HEADER (Standard NOC Header) */}
      <NOCPageHeader
        title="Registros & Zonas DNS"
        badgeText="DNS MONITOR"
        description="Te avisamos si cambia la resolución de tus dominios."
        icon={<Globe size={26} />}
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
            capability="dns_monitor.create"
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-accent-green text-black font-semibold px-5 py-2 rounded-full text-sm hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20 cursor-pointer"
          >
            <Plus size={16} />
            <span>Agregar registro</span>
          </AdminButton>
        }
      />

      {/* 2. SINGLE-ROW TOOLBAR */}
      <DNSToolbar
        summary={summary}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        typeFilter={typeFilter}
        onTypeFilterChange={(v) => setTypeFilter(v as typeof typeFilter)}
        zoneFilter={zoneFilter}
        onZoneFilterChange={setZoneFilter}
        resolverFilter={resolverFilter}
        onResolverFilterChange={setResolverFilter}
        facets={facets}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        density={density}
        onDensityChange={setDensity}
        search={searchTerm}
        onSearchChange={setSearchTerm}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onExportCSV={handleExportCSV}
        canExport={Boolean(records?.length)}
      />

      {/* 3. FLOATING BULK ACTIONS BAR */}
      <NOCBulkActionBar
        selectedCount={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        itemLabel="registros"
        actions={
          <>
            <AdminButton
              capability="dns_monitor.scan"
              type="button"
              onClick={handleBulkScan}
              disabled={bulkScanning}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-bg-dark border border-border-accent text-text-main font-semibold rounded-full text-xs hover:border-accent-green hover:text-accent-green transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw
                size={13}
                className={bulkScanning ? "animate-spin" : ""}
              />
              {bulkScanning ? "Comprobando..." : "Comprobar ahora"}
            </AdminButton>
            <AdminButton
              capability="dns_monitor.delete"
              type="button"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-accent-red text-white font-semibold rounded-full text-xs hover:bg-accent-red/90 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Trash2 size={13} />
              {bulkDeleting ? "Eliminando..." : "Eliminar"}
            </AdminButton>
          </>
        }
      />

      {/* 4. MAIN CONTENT: TABLE OR COMPACT CARD GRID */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-accent-green" size={32} />
        </div>
      ) : sortedRecords.length > 0 ? (
        viewMode === "table" && !compact ? (
          <DNSTableView
            groups={groupedRecords}
            allVisibleRecords={sortedRecords}
            activeRecordId={selectedRecord?.id ?? null}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAllVisible}
            density={density}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            scanningId={scanningId}
            acceptingRefId={acceptingRefId}
            linkingRecordId={linkingRecordId}
            onSelectRecord={setSelectedRecord}
            onScan={(rec) => scanMutation.mutate(rec.id)}
            onAcceptReference={(rec, mode) =>
              acceptReferenceMutation.mutate({ record: rec, mode })
            }
            onEdit={(rec) => handleOpenEdit(rec)}
            onDelete={setDeleteTarget}
            onLinkTarget={(rec, target) =>
              linkTargetMutation.mutate({ record: rec, target })
            }
          />
        ) : (
          <DNSCardGridView
            groups={groupedRecords}
            activeRecordId={selectedRecord?.id ?? null}
            selectedIds={selectedIds}
            scanningId={scanningId}
            acceptingRefId={acceptingRefId}
            linkingRecordId={linkingRecordId}
            onToggleSelect={handleToggleSelect}
            onSelectRecord={setSelectedRecord}
            onScan={(rec) => scanMutation.mutate(rec.id)}
            onAcceptReference={(rec, mode) =>
              acceptReferenceMutation.mutate({ record: rec, mode })
            }
            onEdit={(rec) => handleOpenEdit(rec)}
            onDelete={setDeleteTarget}
            onLinkTarget={(rec, target) =>
              linkTargetMutation.mutate({ record: rec, target })
            }
          />
        )
      ) : (
        <EmptyState
          capability={hasActiveFilters ? undefined : "dns_monitor.create"}
          showAddIcon={!hasActiveFilters}
          title={
            hasActiveFilters
              ? "Sin coincidencias para estos filtros"
              : "No hay registros DNS monitorizados"
          }
          description={
            hasActiveFilters
              ? "Prueba con otro dominio, valor, tipo o estado."
              : "Agrega un registro para vigilar cambios de resolución y propagación."
          }
          actionLabel={
            hasActiveFilters
              ? "Limpiar filtros"
              : "Agregar primer registro DNS"
          }
          onAction={() => {
            if (hasActiveFilters) {
              setSearchTerm("");
              setTypeFilter("all");
              setStatusFilter("all");
              setZoneFilter("all");
              setResolverFilter("all");
            } else {
              handleOpenCreate();
            }
          }}
        />
      )}

      {/* 5. COMPACT 540px SLIDE-OVER DETAIL DRAWER */}
      {selectedRecord && (
        <DNSDetailDrawer
          record={selectedRecord}
          records={sortedRecords}
          history={history}
          isLoadingHistory={isLoadingHistory}
          isScanning={scanningId === selectedRecord.id}
          isAcceptingRef={acceptingRefId === selectedRecord.id}
          isLinking={linkingRecordId === selectedRecord.id}
          onSelectRecord={setSelectedRecord}
          onScan={(rec) => scanMutation.mutate(rec.id)}
          onAcceptReference={(rec, mode) =>
            acceptReferenceMutation.mutate({ record: rec, mode })
          }
          onEdit={(rec) => handleOpenEdit(rec)}
          onDelete={setDeleteTarget}
          onLinkTarget={(rec, target) =>
            linkTargetMutation.mutate({ record: rec, target })
          }
          onClose={() => setSelectedRecord(null)}
        />
      )}

      {/* 6. CREATE / EDIT FORM MODAL (shared ResourceAddModal with multi-type chips & CIDR reference) */}
      {showModal && (
        <DNSAddModal
          editingRecord={editingRecord}
          existingRecords={records || []}
          domainInput={domainInput}
          onDomainInputChange={setDomainInput}
          recordTypeInput={recordTypeInput}
          onRecordTypeInputChange={setRecordTypeInput}
          expectedInput={expectedInput}
          onExpectedInputChange={setExpectedInput}
          referenceModeInput={referenceModeInput}
          onReferenceModeInputChange={setReferenceModeInput}
          isTesting={isTestingResolution}
          testResult={testResult}
          onClearTestResult={() => setTestResult(null)}
          onTest={(dom, rt) => void handleTestResolution(dom, rt)}
          diagnostic={diagnostic}
          isSubmitting={isSubmittingModal}
          onSubmitPayload={handleSubmitDNSModal}
          onSelectExisting={(rec) => setSelectedRecord(rec)}
          onClose={handleCloseModal}
        />
      )}

      {/* 7. DELETE CONFIRMATION MODAL (with Uptime unlink warning) */}
      <ConfirmDelete
        isOpen={!!deleteTarget}
        itemName={
          deleteTarget
            ? `${deleteTarget.record_type} ${deleteTarget.domain}`
            : ""
        }
        warning={deleteWarning}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />

      <DirectoryPagination directory={directory} />
    </div>
  );
}
