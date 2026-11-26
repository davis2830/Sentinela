import { createPortal } from "react-dom";
import {
  Check,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useCompactViewport } from "../hooks/useCompactViewport";
import {
  ActionFeedback,
  DirectoryPagination,
  ReadFailure,
} from "../components/common/DirectoryState";
import { NOCBulkActionBar, NOCPageHeader } from "../components/common/noc";
import AdminButton from "../components/common/AdminButton";
import ConfigurationDiagnosticNotice from "../components/common/ConfigurationDiagnosticNotice";
import ConfirmDelete from "../components/common/ConfirmDelete";
import EmptyState from "../components/common/EmptyState";
import ModalSurface from "../components/common/ModalSurface";
import SSLToolbar from "../components/ssl/SSLToolbar";
import SSLCertificateTableView from "../components/ssl/SSLCertificateTableView";
import SSLCertificateCardGridView from "../components/ssl/SSLCertificateCardGridView";
import SSLDetailDrawer from "../components/ssl/SSLDetailDrawer";
import {
  formatSSLDate,
  formatTLSVersion,
  parseIssuerOrganization,
} from "../components/ssl/useSSLCertificates";
import { healthPalette } from "../utils/healthPresentation";
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
    createMutation,
    updateMutation,
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
    handleSubmitModal,
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
            <span>Agregar dominio</span>
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
                  hasFilters ? "Limpiar filtros" : "Agregar primer dominio"
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

      {/* 7. Create / Edit Modal with Live Connection Test */}
      {showModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
            onClick={handleCloseModal}
          >
            <ModalSurface
              label={editingCert ? "Editar dominio SSL" : "Agregar dominio SSL"}
              onClose={handleCloseModal}
              className="bg-bg-card border border-border-base rounded-3xl p-6 sm:p-8 w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-text-main flex items-center gap-2 font-sans">
                  <Lock size={18} className="text-accent-green" />
                  <span>
                    {editingCert ? "Editar dominio" : "Agregar dominio"}
                  </span>
                </h2>
                <button
                  type="button"
                  aria-label="Cerrar formulario SSL"
                  onClick={handleCloseModal}
                  className="text-text-muted hover:text-text-main transition-colors p-1 cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmitModal} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-text-muted mb-1.5">
                      Dominio o FQDN
                    </label>
                    <input
                      type="text"
                      required
                      id="ssl-domain"
                      aria-label="Dominio o FQDN"
                      placeholder="ej. api.tuempresa.com"
                      value={domainInput}
                      onChange={(e) => {
                        setDomainInput(e.target.value);
                        setTestResult(null);
                      }}
                      className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-mono"
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-semibold text-text-muted mb-1.5">
                      Puerto
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={65535}
                      aria-label="Puerto"
                      value={portInput}
                      onChange={(e) => {
                        setPortInput(parseInt(e.target.value, 10) || 443);
                        setTestResult(null);
                      }}
                      className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-mono text-center"
                    />
                  </div>
                </div>
                <p className="text-xs text-text-dim">
                  Puertos comunes:{" "}
                  <span className="font-mono text-accent-green">443</span>{" "}
                  (HTTPS),{" "}
                  <span className="font-mono text-sky-400">8443</span>{" "}
                  (Paneles),{" "}
                  <span className="font-mono text-accent-purple">636</span>{" "}
                  (LDAPS).
                </p>

                {/* Live TLS Connection Test */}
                <div className="pt-1">
                  <AdminButton
                    capability="ssl_monitor.test"
                    type="button"
                    onClick={() => void handleTestConnection()}
                    disabled={!domainInput.trim() || isTestingConnection}
                    className="w-full py-2 px-4 rounded-xl border border-border-base bg-bg-dark hover:bg-bg-dark/80 text-text-main text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isTestingConnection ? (
                      <>
                        <Loader2
                          className="animate-spin text-accent-green"
                          size={14}
                        />
                        <span>Probando conexión TLS con el host...</span>
                      </>
                    ) : (
                      <>
                        <Zap size={14} className="text-amber-400" />
                        <span>Probar conexión TLS</span>
                      </>
                    )}
                  </AdminButton>
                  <ConfigurationDiagnosticNotice
                    notice={diagnostic.notice}
                    remaining={diagnostic.remaining}
                  />
                </div>

                {testResult && (
                  <div
                    className={`p-3.5 rounded-2xl border text-xs animate-in fade-in duration-200 ${
                      testResult.is_valid
                        ? healthPalette.success.badge
                        : healthPalette.danger.badge
                    }`}
                  >
                    {testResult.is_valid ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span
                            className={`font-bold flex items-center gap-1.5 ${healthPalette.success.text}`}
                          >
                            <Check size={14} /> Conexión exitosa · Grado{" "}
                            {testResult.security_grade}
                          </span>
                          <span className="font-mono text-xs text-text-dim">
                            {formatTLSVersion(testResult.tls_version)}
                          </span>
                        </div>
                        <div className="text-xs text-text-muted">
                          <span>Emisor: </span>
                          <span className="font-mono text-text-main">
                            {parseIssuerOrganization(testResult.issuer)}
                          </span>
                        </div>
                        <div className="text-xs text-text-muted">
                          <span>Vigencia: </span>
                          <span className="font-mono font-bold text-text-main">
                            {testResult.days_remaining != null
                              ? `en ${testResult.days_remaining} días`
                              : "Sin datos"}
                          </span>
                          {testResult.expiration_date && (
                            <span className="ml-1.5 font-mono text-text-dim">
                              ({formatSSLDate(testResult.expiration_date)})
                            </span>
                          )}
                          {testResult.san_domains && (
                            <span className="ml-2 font-mono text-text-dim">
                              · {testResult.san_domains.length} SANs
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2">
                        <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block">
                            Fallo en la prueba TLS
                          </span>
                          <span className="text-xs font-mono opacity-90">
                            {testResult.error_message}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-4 border-t border-border-base">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 py-2.5 border border-border-base rounded-full text-sm text-text-muted hover:bg-bg-dark transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <AdminButton
                    capability={
                      editingCert ? "ssl_monitor.update" : "ssl_monitor.create"
                    }
                    type="submit"
                    disabled={
                      createMutation.isPending || updateMutation.isPending
                    }
                    className="flex-1 py-2.5 bg-accent-green text-black font-semibold rounded-full text-sm hover:bg-accent-green/90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm cursor-pointer"
                  >
                    {createMutation.isPending || updateMutation.isPending ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : editingCert ? (
                      "Guardar cambios"
                    ) : (
                      "Agregar dominio"
                    )}
                  </AdminButton>
                </div>
              </form>
            </ModalSurface>
          </div>,
          document.body,
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
