import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Check,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import ModalSurface from "../components/common/ModalSurface";
import { healthPalette } from "../utils/healthPresentation";
import { useCompactViewport } from "../hooks/useCompactViewport";
import {
  ActionFeedback,
  DirectoryPagination,
  ReadFailure,
} from "../components/common/DirectoryState";
import { useDNSRecordsWorkspace } from "./workspaces/useDNSRecordsWorkspace";
import ConfigurationDiagnosticNotice from "../components/common/ConfigurationDiagnosticNotice";
import AdminButton from "../components/common/AdminButton";
import type { DNSRecordType, DNSReferenceMode } from "../types/dns";
import EmptyState from "../components/common/EmptyState";
import ConfirmDelete from "../components/common/ConfirmDelete";
import { NOCBulkActionBar, NOCPageHeader } from "../components/common/noc";
import DNSToolbar from "../components/dns/DNSToolbar";
import DNSTableView from "../components/dns/DNSTableView";
import DNSCardGridView from "../components/dns/DNSCardGridView";
import DNSDetailDrawer from "../components/dns/DNSDetailDrawer";
import {
  formatDNSLatency,
  formatDNSTTL,
  useDNSRecords,
} from "../components/dns/useDNSRecords";

const RECORD_TYPES: DNSRecordType[] = [
  "A",
  "AAAA",
  "CNAME",
  "MX",
  "TXT",
  "NS",
  "SOA",
  "SRV",
  "PTR",
  "CAA",
];

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
    createMutation,
    updateMutation,
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
    handleSubmit,
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

      {/* 6. CREATE / EDIT FORM MODAL WITH LIVE TEST RESOLUTION */}
      {showModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
            onClick={handleCloseModal}
          >
            <ModalSurface
              label={
                editingRecord ? "Editar registro DNS" : "Agregar registro DNS"
              }
              onClose={handleCloseModal}
              className="bg-bg-card border border-border-base rounded-3xl p-6 sm:p-8 w-full max-w-lg shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-text-main flex items-center gap-2 font-sans">
                  <Globe size={19} className="text-accent-green" />
                  {editingRecord
                    ? "Editar registro DNS"
                    : "Agregar registro DNS"}
                </h2>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  aria-label="Cerrar ventana"
                  className="text-text-muted hover:text-text-main transition-colors p-1 cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-semibold text-text-muted mb-1.5">
                      Tipo
                    </label>
                    <select
                      value={recordTypeInput}
                      onChange={(e) => {
                        setRecordTypeInput(e.target.value as DNSRecordType);
                        setTestResult(null);
                      }}
                      className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-mono cursor-pointer"
                    >
                      {RECORD_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-text-muted mb-1.5">
                      Dominio o host (FQDN)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="ej. api.empresa.com o mail.empresa.com"
                      value={domainInput}
                      onChange={(e) => {
                        setDomainInput(e.target.value);
                        setTestResult(null);
                      }}
                      className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-mono"
                    />
                  </div>
                </div>

                <details
                  open={Boolean(expectedInput.trim())}
                  className="border border-border-base rounded-xl p-3 bg-bg-dark/40"
                >
                  <summary className="text-xs font-semibold text-text-muted cursor-pointer select-none">
                    Referencia esperada (opcional)
                  </summary>
                  <div className="space-y-2.5 mt-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-text-muted mb-1">
                        Modo de comparación
                      </label>
                      <select
                        value={referenceModeInput}
                        onChange={(e) =>
                          setReferenceModeInput(
                            e.target.value as DNSReferenceMode,
                          )
                        }
                        className="w-full bg-bg-dark border border-border-base rounded-lg px-2.5 py-1.5 text-xs text-text-main focus:outline-none focus:border-accent-green cursor-pointer"
                      >
                        <option value="exact">
                          Valores exactos (IPs o registros exactos)
                        </option>
                        <option value="cidr">
                          Rango CIDR (ej. 216.198.79.0/24 — ideal para CDN)
                        </option>
                        <option value="provider">
                          Mismo proveedor / prefijo (/24 IPv4, /48 IPv6)
                        </option>
                      </select>
                    </div>
                    <label className="block space-y-1.5">
                      <span className="text-[11px] text-text-dim">
                        Un valor o rango por línea (el orden no importa en
                        round-robin)
                      </span>
                      <textarea
                        value={expectedInput}
                        onChange={(e) => setExpectedInput(e.target.value)}
                        placeholder={
                          referenceModeInput === "cidr"
                            ? "216.198.79.0/24\n64.29.17.0/24"
                            : "104.21.91.196\n172.67.197.121"
                        }
                        className="w-full min-h-20 p-2.5 bg-bg-dark border border-border-base rounded-xl text-xs font-mono text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green"
                      />
                      <span className="block text-text-dim text-[11px]">
                        Solo alerta si el cambio persiste tras el TTL y los
                        resolvers coinciden fuera de esta referencia.
                      </span>
                    </label>
                  </div>
                </details>

                {/* Test Resolution Button */}
                <div className="pt-1">
                  <AdminButton
                    capability="dns_monitor.test"
                    type="button"
                    onClick={handleTestResolution}
                    disabled={!domainInput.trim() || isTestingResolution}
                    className="w-full py-2 px-4 rounded-xl border border-border-base bg-bg-dark hover:bg-bg-card-hover text-text-main text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isTestingResolution ? (
                      <>
                        <Loader2
                          className="animate-spin text-accent-green"
                          size={14}
                        />
                        <span>Consultando 1.1.1.1 y 8.8.8.8...</span>
                      </>
                    ) : (
                      <>
                        <Zap size={14} className="text-accent-yellow" />
                        <span>Probar resolución pública</span>
                      </>
                    )}
                  </AdminButton>
                </div>
                <ConfigurationDiagnosticNotice
                  notice={diagnostic.notice}
                  remaining={diagnostic.remaining}
                />

                {/* Test Result Live Preview */}
                {testResult && (
                  <div
                    className={`p-3.5 rounded-2xl border text-xs animate-in fade-in duration-200 ${
                      testResult.success
                        ? healthPalette.success.badge
                        : healthPalette.danger.badge
                    }`}
                  >
                    {testResult.success ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`font-bold flex items-center gap-1.5 ${healthPalette.success.text}`}
                          >
                            <Check size={14} /> Resuelto (
                            {formatDNSLatency(testResult.response_time_ms)})
                          </span>
                          <span className="font-mono text-[11px] text-text-dim">
                            TTL {formatDNSTTL(testResult.ttl)}
                            {testResult.resolver
                              ? ` · ${testResult.resolver}`
                              : ""}
                          </span>
                        </div>
                        <div className="font-mono text-xs bg-bg-dark/70 p-2 rounded-xl border border-border-base/50 space-y-1">
                          {testResult.values.map((v, i) => (
                            <div key={i} className="truncate" title={v}>
                              {v}
                            </div>
                          ))}
                        </div>
                        {testResult.propagation_status === "propagating" && (
                          <div className="text-[11px] text-amber-300">
                            Aviso: 1.1.1.1 y 8.8.8.8 devolvieron valores
                            distintos (propagación en curso).
                          </div>
                        )}
                        {testResult.spf_info && (
                          <div
                            className={`text-xs flex items-center gap-1 mt-1 ${healthPalette.success.text}`}
                          >
                            <Shield size={12} />
                            <span>
                              SPF detectado ({testResult.spf_info.policy})
                            </span>
                          </div>
                        )}
                        {testResult.dmarc_info && (
                          <div className="text-xs text-accent-purple flex items-center gap-1 mt-1">
                            <Shield size={12} />
                            <span>
                              DMARC: {testResult.dmarc_info.policy}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="font-bold flex items-center gap-1.5">
                          <AlertTriangle size={14} />
                          <span>
                            Error de resolución ({testResult.error_type || "DNS"})
                          </span>
                        </div>
                        <p className="text-xs font-mono opacity-90">
                          {testResult.error_message}
                        </p>
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
                      editingRecord
                        ? "dns_monitor.update"
                        : "dns_monitor.create"
                    }
                    type="submit"
                    disabled={
                      createMutation.isPending || updateMutation.isPending
                    }
                    className="flex-1 py-2.5 bg-accent-green text-black font-semibold rounded-full text-sm hover:bg-accent-green/90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm cursor-pointer"
                  >
                    {createMutation.isPending || updateMutation.isPending ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : editingRecord ? (
                      "Guardar cambios"
                    ) : (
                      "Agregar registro"
                    )}
                  </AdminButton>
                </div>
              </form>
            </ModalSurface>
          </div>,
          document.body,
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
