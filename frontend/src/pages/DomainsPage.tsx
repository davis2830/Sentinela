import {
  Globe2,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useCompactViewport } from "../hooks/useCompactViewport";
import {
  ActionFeedback,
  DirectoryPagination,
  ReadFailure,
} from "../components/common/DirectoryState";
import { useDomainsWorkspace } from "./workspaces/useDomainsWorkspace";
import AdminButton from "../components/common/AdminButton";
import EmptyState from "../components/common/EmptyState";
import ConfirmDelete from "../components/common/ConfirmDelete";
import { NOCBulkActionBar, NOCPageHeader } from "../components/common/noc";
import DomainToolbar from "../components/domains/DomainToolbar";
import DomainTableView from "../components/domains/DomainTableView";
import DomainCardGridView from "../components/domains/DomainCardGridView";
import DomainDetailDrawer from "../components/domains/DomainDetailDrawer";
import DomainAddModal from "../components/domains/DomainAddModal";
import { useDomains } from "../components/domains/useDomains";

export default function DomainsPage() {
  const compact = useCompactViewport();
  const {
    directory,
    isError,
    refetch,
    searchTerm,
    setSearchTerm,
    viewMode,
    setViewMode,
    selectedIds,
    setSelectedIds,
    scanningId,
    acknowledgingId,
    savingManualDateId,
    savingAutoRenewId,
    linkingDomainId,
    watchingSuggestion,
    showModal,
    editingDomain,
    selectedDomain,
    setSelectedDomain,
    domainInput,
    setDomainInput,
    manualExpirationInput,
    setManualExpirationInput,
    deleteTarget,
    setDeleteTarget,
    bulkDeleting,
    bulkScanning,
    diagnostic,
    isTestingWhois,
    testResult,
    setTestResult,
    autoRefresh,
    domains,
    unwatchedSuggestions,
    isLoading,
    watchSuggestionMutation,
    saveManualDateMutation,
    saveAutoRenewMutation,
    acknowledgeChangesMutation,
    linkTargetMutation,
    scanMutation,
    deleteMutation,
    handleToggleSelect,
    handleBulkScan,
    handleBulkDelete,
    handleTestWhois,
    handleExportCSV,
    handleOpenCreate,
    handleOpenEdit,
    handleCloseModal,
    handleSubmitDomainModal,
    isSubmittingModal,
  } = useDomainsWorkspace();

  const {
    thresholds,
    setThresholds,
    statusFilter,
    setStatusFilter,
    registrarFilter,
    setRegistrarFilter,
    tldFilter,
    setTldFilter,
    lockFilter,
    setLockFilter,
    nsFilter,
    setNsFilter,
    groupBy,
    setGroupBy,
    sortKey,
    sortDir,
    handleSort,
    density,
    setDensity,
    summary,
    facets,
    sortedDomains,
    groupedDomains,
  } = useDomains(domains || []);

  const hasActiveFilters =
    Boolean(searchTerm) ||
    statusFilter !== "all" ||
    registrarFilter !== "all" ||
    tldFilter !== "all" ||
    lockFilter !== "all" ||
    nsFilter !== "all";

  const handleToggleSelectAllVisible = () => {
    if (sortedDomains.length === 0) return;
    if (selectedIds.length === sortedDomains.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedDomains.map((d) => d.id));
    }
  };

  // Impact warning when deleting a domain that has linked targets or dependent resources
  const buildDeleteWarning = (): string | undefined => {
    if (!deleteTarget) return undefined;
    const parts: string[] = [];
    if (deleteTarget.linked_targets && deleteTarget.linked_targets.length > 0) {
      parts.push(
        `Se desvinculará de ${deleteTarget.linked_targets
          .map((t) => t.name)
          .join(", ")} en Uptime.`,
      );
    }
    const deps = deleteTarget.dependencies;
    if (
      deps &&
      (deps.targets_count > 0 || deps.dns_count > 0 || deps.ssl_count > 0)
    ) {
      const items = [
        deps.targets_count > 0
          ? `${deps.targets_count} ${deps.targets_count === 1 ? "target" : "targets"}`
          : null,
        deps.dns_count > 0
          ? `${deps.dns_count} ${deps.dns_count === 1 ? "registro DNS" : "registros DNS"}`
          : null,
        deps.ssl_count > 0
          ? `${deps.ssl_count} ${deps.ssl_count === 1 ? "certificado" : "certificados"}`
          : null,
      ].filter(Boolean);
      parts.push(
        `Dejarás de vigilar el vencimiento del dominio del que dependen ${items.join(" · ")}.`,
      );
    }
    return parts.length > 0 ? parts.join(" ") : undefined;
  };

  const primarySuggestion = unwatchedSuggestions[0];

  if (isError && !domains) return <ReadFailure retry={refetch} />;

  return (
    <div className="compact-workspace space-y-4 animate-in fade-in duration-300 font-sans">
      {isError && domains && <ReadFailure stale retry={refetch} />}
      <ActionFeedback>{directory.message}</ActionFeedback>
      {directory.confirmation}

      {/* 1. TOP HEADER (Standard NOC Header) */}
      <NOCPageHeader
        title="Dominios & WHOIS"
        badgeText="DOMAIN WATCH"
        description="Te avisamos antes de que venzan tus dominios o cambien sus datos de registro."
        icon={<Globe2 size={26} />}
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
            capability="domain.create"
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-accent-green text-black font-semibold px-5 py-2 rounded-full text-sm hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20 cursor-pointer"
          >
            <Plus size={16} />
            <span>Agregar dominio</span>
          </AdminButton>
        }
      />

      {/* 2. SINGLE-ROW TOOLBAR */}
      <DomainToolbar
        summary={summary}
        thresholds={thresholds}
        onThresholdsChange={setThresholds}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        registrarFilter={registrarFilter}
        onRegistrarFilterChange={setRegistrarFilter}
        tldFilter={tldFilter}
        onTldFilterChange={setTldFilter}
        lockFilter={lockFilter}
        onLockFilterChange={setLockFilter}
        nsFilter={nsFilter}
        onNsFilterChange={setNsFilter}
        facets={facets}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        density={density}
        onDensityChange={setDensity}
        search={searchTerm}
        onSearchChange={setSearchTerm}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSelectDomain={setSelectedDomain}
        onExportCSV={handleExportCSV}
        canExport={Boolean(domains?.length)}
      />

      {/* 2B. UNWATCHED DOMAIN DISCOVERY CALLOUT (cross-module value) */}
      {primarySuggestion && (
        <div className="w-full max-w-[1400px] mx-auto rounded-xl border border-sky-500/30 bg-sky-500/[0.06] px-3.5 py-2 flex items-center justify-between gap-3 flex-wrap text-xs">
          <div className="flex items-center gap-2 min-w-0 text-text-muted">
            <Sparkles size={14} className="text-sky-400 shrink-0" />
            <span className="truncate">
              Detectamos{" "}
              <strong className="font-mono text-text-main">
                {primarySuggestion.domain}
              </strong>{" "}
              en otros módulos (
              {[
                primarySuggestion.targets_count > 0
                  ? `${primarySuggestion.targets_count} ${primarySuggestion.targets_count === 1 ? "target" : "targets"}`
                  : null,
                primarySuggestion.dns_count > 0
                  ? `${primarySuggestion.dns_count} DNS`
                  : null,
                primarySuggestion.ssl_count > 0
                  ? `${primarySuggestion.ssl_count} SSL`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              ). ¿Vigilar su vencimiento?
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <AdminButton
              capability="domain.create"
              type="button"
              disabled={watchingSuggestion === primarySuggestion.domain}
              onClick={() =>
                watchSuggestionMutation.mutate(primarySuggestion.domain)
              }
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-green/15 border border-accent-green/45 text-accent-green hover:bg-accent-green/25 font-semibold text-[11px] disabled:opacity-50 transition-colors cursor-pointer !min-h-0"
            >
              {watchingSuggestion === primarySuggestion.domain ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Plus size={12} />
              )}
              <span>Vigilar {primarySuggestion.domain}</span>
            </AdminButton>
            {unwatchedSuggestions.length > 1 && (
              <span className="text-[11px] text-text-dim font-mono">
                +{unwatchedSuggestions.length - 1} más
              </span>
            )}
          </div>
        </div>
      )}

      {/* 3. FLOATING BULK ACTIONS BAR */}
      <NOCBulkActionBar
        selectedCount={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        itemLabel="dominios"
        actions={
          <>
            <AdminButton
              capability="domain.scan"
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
              capability="domain.delete"
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

      {/* 4. MAIN CONTENT: COMPACT 48px TABLE OR STATUS CARDS */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-accent-green" size={32} />
        </div>
      ) : sortedDomains.length > 0 ? (
        viewMode === "table" && !compact ? (
          <DomainTableView
            groups={groupedDomains}
            allVisibleDomains={sortedDomains}
            activeDomainId={selectedDomain?.id ?? null}
            thresholds={thresholds}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAllVisible}
            density={density}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            scanningId={scanningId}
            linkingDomainId={linkingDomainId}
            onSelectDomain={setSelectedDomain}
            onScan={(dom) => scanMutation.mutate(dom.id)}
            onEdit={(dom) => handleOpenEdit(dom)}
            onDelete={setDeleteTarget}
            onLinkTarget={(dom, target) =>
              linkTargetMutation.mutate({ domain: dom, target })
            }
          />
        ) : (
          <DomainCardGridView
            groups={groupedDomains}
            activeDomainId={selectedDomain?.id ?? null}
            thresholds={thresholds}
            selectedIds={selectedIds}
            scanningId={scanningId}
            onToggleSelect={handleToggleSelect}
            onSelectDomain={setSelectedDomain}
            onScan={(dom) => scanMutation.mutate(dom.id)}
            onEdit={(dom) => handleOpenEdit(dom)}
            onDelete={setDeleteTarget}
          />
        )
      ) : (
        <EmptyState
          capability={hasActiveFilters ? undefined : "domain.create"}
          showAddIcon={!hasActiveFilters}
          title={
            hasActiveFilters
              ? "Sin coincidencias para estos filtros"
              : "No hay dominios vigilados"
          }
          description={
            hasActiveFilters
              ? "Prueba con otro dominio, registrador, TLD o estado."
              : "Agrega un dominio para vigilar su vencimiento, bloqueo de transferencia y nameservers."
          }
          actionLabel={
            hasActiveFilters ? "Limpiar filtros" : "Agregar primer dominio"
          }
          onAction={() => {
            if (hasActiveFilters) {
              setSearchTerm("");
              setStatusFilter("all");
              setRegistrarFilter("all");
              setTldFilter("all");
              setLockFilter("all");
              setNsFilter("all");
            } else {
              handleOpenCreate();
            }
          }}
        />
      )}

      {/* 5. NON-BLUR INTERACTIVE DETAIL DRAWER */}
      {selectedDomain && (
        <DomainDetailDrawer
          domain={selectedDomain}
          domains={sortedDomains}
          thresholds={thresholds}
          isScanning={scanningId === selectedDomain.id}
          isAcknowledging={acknowledgingId === selectedDomain.id}
          isSavingManualDate={savingManualDateId === selectedDomain.id}
          isSavingAutoRenew={savingAutoRenewId === selectedDomain.id}
          isLinking={linkingDomainId === selectedDomain.id}
          onSelectDomain={setSelectedDomain}
          onScan={(dom) => scanMutation.mutate(dom.id)}
          onAcknowledgeChanges={(dom) => acknowledgeChangesMutation.mutate(dom)}
          onSaveManualExpiration={(dom, dateStr) =>
            saveManualDateMutation.mutate({ domain: dom, dateStr })
          }
          onSetAutoRenew={(dom, autoRenew) =>
            saveAutoRenewMutation.mutate({ domain: dom, autoRenew })
          }
          onEdit={(dom) => handleOpenEdit(dom)}
          onDelete={setDeleteTarget}
          onLinkTarget={(dom, target) =>
            linkTargetMutation.mutate({ domain: dom, target })
          }
          onClose={() => setSelectedDomain(null)}
        />
      )}

      {/* 6. ADD / EDIT DOMAIN MODAL (shared ResourceAddModal with PSL, auto-renew & dependencies) */}
      {showModal && (
        <DomainAddModal
          editingDomain={editingDomain}
          existingDomains={domains || []}
          domainInput={domainInput}
          onDomainInputChange={setDomainInput}
          manualExpirationInput={manualExpirationInput}
          onManualExpirationChange={setManualExpirationInput}
          isTesting={isTestingWhois}
          testResult={testResult}
          onClearTestResult={() => setTestResult(null)}
          onTest={(dom) => void handleTestWhois(dom)}
          diagnostic={diagnostic}
          isSubmitting={isSubmittingModal}
          onSubmitPayload={handleSubmitDomainModal}
          onSelectExisting={(dom) => setSelectedDomain(dom)}
          onClose={handleCloseModal}
        />
      )}

      {/* 7. DELETE CONFIRMATION MODAL (with linked target & dependency impact warning) */}
      <ConfirmDelete
        isOpen={!!deleteTarget}
        itemName={deleteTarget?.domain || ""}
        warning={buildDeleteWarning()}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />

      <DirectoryPagination directory={directory} />
    </div>
  );
}
