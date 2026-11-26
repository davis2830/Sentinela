import {
  Loader2,
  Lock,
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
import { NOCBulkActionBar, NOCPageHeader } from "../components/common/noc";
import AdminButton from "../components/common/AdminButton";
import ConfirmDelete from "../components/common/ConfirmDelete";
import EmptyState from "../components/common/EmptyState";
import SSLToolbar from "../components/ssl/SSLToolbar";
import SSLCertificateTableView from "../components/ssl/SSLCertificateTableView";
import SSLCertificateCardGridView from "../components/ssl/SSLCertificateCardGridView";
import SSLDetailDrawer from "../components/ssl/SSLDetailDrawer";
import SSLAddModal from "../components/ssl/SSLAddModal";
import { useSSLCertificatesWorkspace } from "./workspaces/useSSLCertificatesWorkspace";

export default function SSLCertificatesPage() {
  const compact = useCompactViewport();
  const {
    directory,
    statusFilter,
    setStatusFilter,
    searchTerm,
    setSearchTerm,
    issuerFilter,
    setIssuerFilter,
    tlsFilter,
    setTlsFilter,
    gradeFilter,
    setGradeFilter,
    originFilter,
    setOriginFilter,
    groupBy,
    setGroupBy,
    collapsedGroups,
    toggleGroup,
    sortField,
    sortAsc,
    handleSortChange,
    thresholds,
    setThresholds,
    viewMode,
    setViewMode,
    density,
    setDensity,
    selectedIds,
    setSelectedIds,
    scanningId,
    linkingCertId,
    bulkBusy,
    showModal,
    editingCert,
    selectedCert,
    setSelectedCert,
    drawerSection,
    handleSelectCert,
    domainInput,
    setDomainInput,
    portInput,
    setPortInput,
    deleteTarget,
    setDeleteTarget,
    diagnostic,
    isTestingConnection,
    testResult,
    setTestResult,
    autoRefresh,
    certificates,
    isLoading,
    isError,
    refetch,
    scanMutation,
    deleteMutation,
    linkTargetMutation,
    handleToggleSelect,
    handleSelectAllToggle,
    handleBulkScan,
    handleBulkDelete,
    handleTestConnection,
    handleExportCSV,
    handleOpenCreate,
    handleOpenEdit,
    handleCloseModal,
    handleSubmitSSLModal,
    isSubmittingModal,
    hasFilters,
    clearAllFilters,
    summary,
    facets,
    sortedCertificates,
    groupedCertificates,
  } = useSSLCertificatesWorkspace();

  const linkedDeleteWarning =
    deleteTarget?.linked_targets && deleteTarget.linked_targets.length > 0
      ? `Este certificado está vinculado a ${deleteTarget.linked_targets
          .map((t) => t.name)
          .join(", ")} en Uptime. Al eliminarlo se desvinculará de esos targets.`
      : undefined;

  return (
    <div className="compact-workspace space-y-4 animate-in fade-in duration-200 font-sans">
      <ActionFeedback>{directory.message}</ActionFeedback>
      {directory.confirmation}

      {/* 1. Unified Header: Plain language subtitle & sentence-case CTA */}
      <NOCPageHeader
        title="Certificados SSL & TLS"
        badgeText="CERT GUARD"
        description="Te avisamos antes de que venzan tus certificados."
        icon={<Lock size={22} className="text-accent-green" />}
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
            capability="ssl_monitor.create"
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 bg-accent-green text-black font-semibold px-4 py-2 rounded-full text-sm hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20 cursor-pointer"
          >
            <Plus size={16} />
            <span>Agregar certificado</span>
          </AdminButton>
        }
      />

      {/* 2. Single-Row Unified Toolbar with Next Expiration, Thresholds & Export */}
      <SSLToolbar
        summary={summary}
        thresholds={thresholds}
        onThresholdsChange={setThresholds}
        statusFilter={statusFilter}
        onStatusFilterChange={(val) =>
          setStatusFilter(
            val as "all" | "expired" | "problem" | "expiring" | "valid",
          )
        }
        issuerFilter={issuerFilter}
        onIssuerFilterChange={setIssuerFilter}
        tlsFilter={tlsFilter}
        onTlsFilterChange={setTlsFilter}
        gradeFilter={gradeFilter}
        onGradeFilterChange={setGradeFilter}
        originFilter={originFilter}
        onOriginFilterChange={setOriginFilter}
        facets={facets}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        density={density}
        onDensityChange={setDensity}
        search={searchTerm}
        onSearchChange={setSearchTerm}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSelectCert={(cert) => handleSelectCert(cert, "overview")}
        onExportCSV={handleExportCSV}
        canExport={certificates.length > 0}
      />

      {/* 3. Floating Bulk Actions Bar */}
      <NOCBulkActionBar
        selectedCount={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        itemLabel="certificados"
        actions={
          <div className="flex items-center gap-2">
            <AdminButton
              capability="ssl_monitor.scan"
              type="button"
              onClick={() => void handleBulkScan()}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-accent-green/15 border border-accent-green/40 text-accent-green font-semibold rounded-full text-xs hover:bg-accent-green hover:text-black transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw
                size={12}
                className={bulkBusy ? "animate-spin" : ""}
              />
              <span>Comprobar</span>
            </AdminButton>
            <AdminButton
              capability="ssl_monitor.delete"
              type="button"
              onClick={() => void handleBulkDelete()}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-accent-red text-white font-semibold rounded-full text-xs hover:bg-accent-red/90 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Trash2 size={13} />
              <span>{bulkBusy ? "Procesando..." : "Eliminar"}</span>
            </AdminButton>
          </div>
        }
      />

      {/* 4. Read Error Banner */}
      {isError && (
        <div className="w-full max-w-[1400px] mx-auto">
          <ReadFailure stale={certificates.length > 0} retry={refetch} />
        </div>
      )}

      {/* 5. Main Directory: Compact Table vs Compact Status-Wall Cards */}
      <section aria-label="Directorio de Certificados SSL" className="min-w-0">
        {isLoading && certificates.length === 0 ? (
          <div className="w-full max-w-[1400px] mx-auto flex flex-col items-center justify-center py-20 rounded-2xl border border-border-base bg-bg-card text-text-muted gap-3">
            <Loader2 className="animate-spin text-accent-green" size={26} />
            <p className="text-xs font-mono">
              Consultando certificados SSL/TLS...
            </p>
          </div>
        ) : sortedCertificates.length > 0 ? (
          viewMode === "grid" || compact ? (
            <SSLCertificateCardGridView
              sortedCertificates={sortedCertificates}
              groupedCertificates={groupedCertificates}
              collapsedGroups={collapsedGroups}
              onToggleGroup={toggleGroup}
              thresholds={thresholds}
              density={density}
              selectedIds={selectedIds}
              scanningId={scanningId}
              onToggleSelect={handleToggleSelect}
              onSelectCert={handleSelectCert}
              onScan={(cert) => scanMutation.mutate(cert.id)}
              onEdit={handleOpenEdit}
              onDelete={(cert) => setDeleteTarget(cert)}
              onLinkTarget={(cert, target) =>
                linkTargetMutation.mutate({ cert, target })
              }
              linkingCertId={linkingCertId}
            />
          ) : (
            <SSLCertificateTableView
              sortedCertificates={sortedCertificates}
              groupedCertificates={groupedCertificates}
              collapsedGroups={collapsedGroups}
              onToggleGroup={toggleGroup}
              thresholds={thresholds}
              density={density}
              sortField={sortField}
              sortAsc={sortAsc}
              onSortChange={handleSortChange}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onSelectAll={handleSelectAllToggle}
              onSelectCert={handleSelectCert}
              onScan={(cert) => scanMutation.mutate(cert.id)}
              scanningId={scanningId}
              onEdit={handleOpenEdit}
              onDelete={(cert) => setDeleteTarget(cert)}
              onLinkTarget={(cert, target) =>
                linkTargetMutation.mutate({ cert, target })
              }
              linkingCertId={linkingCertId}
            />
          )
        ) : (
          !isError && (
            <div className="w-full max-w-[1400px] mx-auto">
              <EmptyState
                capability={hasFilters ? undefined : "ssl_monitor.create"}
                showAddIcon={!hasFilters}
                title={
                  hasFilters
                    ? "Sin coincidencias para estos filtros"
                    : "No hay certificados SSL registrados"
                }
                description={
                  hasFilters
                    ? "Ajusta la búsqueda, emisor, protocolo TLS o estado para ver el resto."
                    : "Agrega un dominio para vigilar su vigencia, cadena TLS y recibir avisos antes de que venza."
                }
                actionLabel={
                  hasFilters ? "Limpiar filtros" : "Agregar primer certificado"
                }
                onAction={() => {
                  if (hasFilters) clearAllFilters();
                  else handleOpenCreate();
                }}
              />
            </div>
          )
        )}

        <div className="pt-4 w-full max-w-[1400px] mx-auto">
          <DirectoryPagination directory={directory} />
        </div>
      </section>

      {/* 6. Slide-Over Detail Drawer */}
      {selectedCert && (
        <SSLDetailDrawer
          key={`${selectedCert.id}-${drawerSection}`}
          cert={selectedCert}
          certificates={sortedCertificates}
          initialSection={drawerSection}
          thresholds={thresholds}
          isScanning={scanningId === selectedCert.id}
          onSelectCert={(next) => handleSelectCert(next, "overview")}
          onScan={(cert) => scanMutation.mutate(cert.id)}
          onEdit={(cert) => handleOpenEdit(cert)}
          onDelete={(cert) => setDeleteTarget(cert)}
          onLinkTarget={(cert, target) =>
            linkTargetMutation.mutate({ cert, target })
          }
          isLinking={linkingCertId === selectedCert.id}
          onClose={() => setSelectedCert(null)}
        />
      )}

      {/* 7. Create / Edit Modal (shared ResourceAddModal) */}
      {showModal && (
        <SSLAddModal
          editingCert={editingCert}
          existingCertificates={certificates}
          domainInput={domainInput}
          onDomainInputChange={setDomainInput}
          portInput={portInput}
          onPortInputChange={setPortInput}
          isTesting={isTestingConnection}
          testResult={testResult}
          onClearTestResult={() => setTestResult(null)}
          onTest={(host, port) => void handleTestConnection(host, port)}
          diagnostic={diagnostic}
          isSubmitting={isSubmittingModal}
          onSubmitPayload={handleSubmitSSLModal}
          onSelectExisting={(cert) => handleSelectCert(cert, "overview")}
          onClose={handleCloseModal}
        />
      )}

      {/* 8. Delete Confirmation Modal (warns explicitly if linked to Uptime targets) */}
      <ConfirmDelete
        isOpen={!!deleteTarget}
        itemName={
          deleteTarget
            ? `${deleteTarget.domain}${deleteTarget.port && deleteTarget.port !== 443 ? `:${deleteTarget.port}` : ""}`
            : "este certificado"
        }
        warning={linkedDeleteWarning}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
