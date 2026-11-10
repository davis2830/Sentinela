import { useDomainsWorkspace } from './workspaces/useDomainsWorkspace';
import ConfigurationDiagnosticNotice from '../components/common/ConfigurationDiagnosticNotice';
import CompactModuleSummary from '../components/common/CompactModuleSummary';
import AdminButton from '../components/common/AdminButton';
import ScanAction from '../components/common/ScanAction';
import { createPortal } from 'react-dom';
import StatusBadge from '../components/common/StatusBadge';
import EmptyState from '../components/common/EmptyState';
import ConfirmDelete from '../components/common/ConfirmDelete';
import DomainTableView from '../components/domains/DomainTableView';
import {
  NOCPageHeader,
  NOCToolbar,
  NOCBulkActionBar,
  NOCDrawer,
} from '../components/common/noc';
import {
  Plus,
  Loader2,
  Trash2,
  Calendar,
  Building,
  X,
  AlertTriangle,
  Server,
  Globe2,
  Pencil,
  Clock,
  ExternalLink,
  ShieldCheck,
  CheckSquare,
  Square,
  Zap,
  Download,
  Lock,
  Unlock,
  Check,
} from 'lucide-react';

type FilterType = 'all' | 'expiring' | 'expired';

function renderNameServersList(nsData: unknown): string[] {
  if (!nsData) return [];
  if (Array.isArray(nsData)) return nsData.map((item) => String(item).toLowerCase());
  if (typeof nsData === 'string') {
    try {
      const parsed = JSON.parse(nsData);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item).toLowerCase());
    } catch {
      return nsData.split(/[\s,]+/).filter(Boolean).map((s) => s.toLowerCase());
    }
  }
  return [];
}

export default function DomainsPage() {
 const {filter, setFilter, searchTerm, setSearchTerm, viewMode, setViewMode, selectedIds, setSelectedIds, scanningId, showModal, editingDomain, selectedDomain, setSelectedDomain, domainInput, setDomainInput, deleteTarget, setDeleteTarget, drawerTab, setDrawerTab, bulkDeleting, diagnostic, isTestingWhois, testResult, setTestResult, autoRefresh, stats, domains, isLoading, createMutation, updateMutation, scanMutation, deleteMutation, handleToggleSelect, handleSelectAllToggle, handleBulkDelete, handleTestWhois, handleExportCSV, handleOpenCreate, handleOpenEdit, handleCloseModal, handleSubmitModal, getStatusType, calculateLifePercentage, totalCount, activeCount, expiringCount, lockedCount, filteredDomains} = useDomainsWorkspace();



  return (
    <div className="compact-workspace space-y-6 animate-in fade-in duration-300 font-sans">
      {/* 1. TOP HEADER (Standard NOC Header) */}
      <NOCPageHeader queryKeys={["domains","domain-stats"]}
        title="Dominios & WHOIS"
        badgeText="DOMAIN WATCH"
        description="Supervisión continua de vigencia ICANN, registradores autorizados, servidores de nombres DNS y fechas de renovación."
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
          <>
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={!domains || domains.length === 0}
              className="flex items-center gap-2 bg-bg-card border border-border-base text-text-muted hover:text-text-main font-medium px-4 py-2 rounded-full text-sm hover:bg-bg-card-hover transition-all disabled:opacity-50 cursor-pointer"
              title="Exportar inventario de dominios a CSV"
            >
              <Download size={15} />
              <span>Exportar</span>
            </button>


            <AdminButton capability="domain.create"
              type="button"
              onClick={handleOpenCreate}
              className="flex items-center gap-2 bg-accent-green text-black font-semibold px-5 py-2 rounded-full text-sm hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20 cursor-pointer"
            >
              <Plus size={16} />
              <span>Registrar Dominio</span>
            </AdminButton>
          </>
        }
      />

      {/* 2. NOC COMMAND CENTER: KPI STRIP */}
      <CompactModuleSummary variant="status" items={[
        {label:'Dominios',value:domains ? totalCount : null,icon:Globe2,tone:'neutral'},
        {label:'Vigentes',value:domains ? activeCount : null,icon:ShieldCheck,tone:'success'},
        {label:'Por vencer',value:domains ? expiringCount : null,icon:Clock,tone:'warning'},
        {label:'Bloqueados',value:domains ? lockedCount : null,icon:Lock,tone:'success'}
      ]} />

      {/* 3. TOOLBAR: Omnibar Search + Status Filter Chips + Persistent Grid/Table Switcher */}
      <NOCToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por dominio o registrador acreditado..."
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        categoryLabel="Filtro:"
        categories={[
          { id: 'all', label: `Todos (${totalCount})` },
          { id: 'expiring', label: `Por Expirar (${expiringCount})` },
          { id: 'expired', label: `Expirados / Error (${stats?.expired || 0})` },
        ]}
        selectedCategory={filter}
        onCategoryChange={(cat) => setFilter(cat as FilterType)}
      />

      {/* 4. FLOATING BULK ACTIONS BAR */}
      <NOCBulkActionBar
        selectedCount={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        itemLabel="dominios"
        actions={
          <>

            <AdminButton capability="domain.delete"
              type="button"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-accent-red text-white font-semibold rounded-full text-xs hover:bg-accent-red/90 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Trash2 size={13} />
              {bulkDeleting ? 'Eliminando...' : 'Eliminar'}
            </AdminButton>
          </>
        }
      />

      {/* 5. MAIN CONTENT: DUAL VIEW (COMPACT TABLE OR GRID) */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-accent-green" size={32} />
        </div>
      ) : filteredDomains && filteredDomains.length > 0 ? (
        viewMode === 'table' ? (
          /* Compact NOC Table View */
          <DomainTableView
            domains={filteredDomains}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAllToggle}
            onSelectDomain={(d) => setSelectedDomain(d)}
            onScan={(id, e) => {
              e.stopPropagation();
              scanMutation.mutate(id);
            }}
            scanningId={scanningId}
            onEdit={(d, e) => handleOpenEdit(d, e)}
            onDelete={(d, e) => {
              e.stopPropagation();
              setDeleteTarget(d);
            }}
          />
        ) : (
          /* Grid Cards View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDomains.map((domain) => {
              const isSelected = selectedIds.includes(domain.id);
              const days = domain.days_until_expiration;
              const nsList = renderNameServersList(domain.name_servers);
              const lifePct = calculateLifePercentage(domain);

              return (
                <div
                  key={domain.id}
                  onClick={() => setSelectedDomain(domain)}
                  className={`bg-bg-card border rounded-2xl p-5 hover:border-accent-green/50 transition-all flex flex-col justify-between cursor-pointer group shadow-sm relative ${
                    isSelected
                      ? 'border-accent-green bg-accent-green/[0.02] ring-1 ring-accent-green/40'
                      : 'border-border-base/70'
                  }`}
                >
                  <div>
                    {/* Header: Checkbox + Domain Name + Lock Badge */}
                    <div className="flex items-start justify-between gap-2 mb-3.5">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSelect(domain);
                          }}
                          className="text-text-dim hover:text-accent-green transition-colors shrink-0 cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare size={16} className="text-accent-green" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                        <h3
                          className="font-bold text-text-main truncate text-base group-hover:text-accent-green transition-colors font-sans"
                          title={domain.domain}
                        >
                          {domain.domain}
                        </h3>
                      </div>

                      {/* EPP Lock Badge */}
                      {domain.is_locked ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-accent-green/10 text-accent-green border border-accent-green/30 flex items-center gap-1 shrink-0">
                          <Lock size={10} />
                          Protegido
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/30 flex items-center gap-1 shrink-0">
                          <Unlock size={10} />
                          Sin Bloqueo
                        </span>
                      )}
                    </div>

                    {/* Card Content Details */}
                    <div className="space-y-2 text-xs text-text-muted bg-bg-dark/50 rounded-xl p-3 border border-border-base/40">
                      <div className="flex items-center justify-between border-b border-border-base/40 pb-1.5">
                        <span className="flex items-center gap-1.5 text-text-dim font-medium">
                          <Building size={13} /> Registrador:
                        </span>
                        <span
                          className="font-mono text-text-main font-semibold truncate max-w-[170px]"
                          title={domain.registrar || ''}
                        >
                          {domain.registrar || 'Desconocido'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between border-b border-border-base/40 pb-1.5">
                        <span className="flex items-center gap-1.5 text-text-dim font-medium">
                          <Calendar size={13} /> Expiración:
                        </span>
                        <span className="font-mono text-text-main">
                          {domain.expiration_date
                            ? new Date(domain.expiration_date).toLocaleDateString('es-ES')
                            : 'N/A'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-text-dim font-medium">
                          <Clock size={13} /> Días restantes:
                        </span>
                        <span
                          className={`font-mono font-bold ${
                            days !== null && days <= 0
                              ? 'text-accent-red'
                              : days !== null && days <= 30
                              ? 'text-accent-yellow'
                              : 'text-accent-green'
                          }`}
                        >
                          {days !== null ? (days <= 0 ? 'Expirado' : `${days} días`) : 'N/A'}
                        </span>
                      </div>

                      {/* Lifecycle Progress Bar */}
                      {lifePct !== null && (
                        <div className="pt-1">
                          <div className="w-full h-1.5 bg-bg-dark rounded-full overflow-hidden border border-border-base/50">
                            <div
                              className={`h-full transition-all duration-500 rounded-full ${
                                days !== null && days <= 15
                                  ? 'bg-accent-red'
                                  : days !== null && days <= 30
                                  ? 'bg-accent-yellow'
                                  : 'bg-accent-green'
                              }`}
                              style={{ width: `${lifePct}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer: Nameservers + Actions */}
                  <div className="mt-4 pt-3 border-t border-border-base/40 flex items-center justify-between text-xs text-text-dim">
                    <span
                      className="font-mono text-xs bg-bg-dark px-2 py-0.5 rounded-md border border-border-base/50 truncate max-w-[160px]"
                      title={nsList.join(', ')}
                    >
                      {nsList.length > 0 ? `${nsList.length} NS activos` : 'Sin NS'}
                    </span>

                    <div className="flex items-center gap-1">

                      <AdminButton capability="domain.update"
                        type="button"
                        onClick={(e) => handleOpenEdit(domain, e)}
                        className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors cursor-pointer"
                        title="Editar dominio"
                      >
                        <Pencil size={14} />
                      </AdminButton>
                      <AdminButton capability="domain.delete"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(domain);
                        }}
                        className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded-full transition-colors cursor-pointer"
                        title="Eliminar dominio"
                      >
                        <Trash2 size={14} />
                      </AdminButton>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <EmptyState capability="domain.create"
          icon={Globe2}
          title={
            searchTerm || filter !== 'all'
              ? 'No se encontraron dominios con los filtros aplicados'
              : 'No hay dominios registrados'
          }
          description={
            searchTerm || filter !== 'all'
              ? 'Prueba a cambiar el término de búsqueda o restablecer los filtros.'
              : 'Comienza a monitorear la vigencia y datos WHOIS de tus dominios corporativos.'
          }
          actionLabel={
            searchTerm || filter !== 'all' ? 'Limpiar Filtros' : 'Registrar Dominio'
          }
          onAction={() => {
            if (searchTerm || filter !== 'all') {
              setSearchTerm('');
              setFilter('all');
            } else {
              handleOpenCreate();
            }
          }}
        />
      )}

      {/* 6. SLIDE-OVER DETAIL DRAWER */}
      <NOCDrawer
        isOpen={!!selectedDomain}
        onClose={() => setSelectedDomain(null)}
        title={selectedDomain?.domain || ''}
        subtitle={
          selectedDomain && (
            <div className="flex items-center gap-2">
              <span>Registrador: {selectedDomain.registrar || 'Desconocido'}</span>
              <span>&bull;</span>
              <a
                href={`http://${selectedDomain.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-green hover:underline flex items-center gap-1"
              >
                Abrir <ExternalLink size={11} />
              </a>
            </div>
          )
        }
        statusBadge={
          selectedDomain && (
            <div className="flex items-center gap-2">
              {selectedDomain.is_locked ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-accent-green/10 text-accent-green border border-accent-green/30 flex items-center gap-1">
                  <Lock size={11} />
                  EPP Protegido
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/30 flex items-center gap-1">
                  <Unlock size={11} />
                  Sin Bloqueo EPP
                </span>
              )}
              <StatusBadge status={getStatusType(selectedDomain)} />
            </div>
          )
        }
        headerActions={
          selectedDomain && (
            <ScanAction resource={selectedDomain} route="domains" pending={scanMutation.isPending} onScan={()=>scanMutation.mutateAsync(selectedDomain.id)} />
          )
        }
        quickKpis={
          selectedDomain && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-xs text-text-dim font-sans">Días Restantes</div>
                <div
                  className={`text-base font-bold mt-0.5 ${
                    selectedDomain.days_until_expiration !== null && selectedDomain.days_until_expiration <= 30
                      ? 'text-accent-red'
                      : 'text-accent-green'
                  }`}
                >
                  {selectedDomain.days_until_expiration !== null
                    ? `${selectedDomain.days_until_expiration}d`
                    : 'N/A'}
                </div>
              </div>
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-xs text-text-dim font-sans">Fecha Expiración</div>
                <div className="text-sm font-semibold text-text-main mt-0.5 truncate">
                  {selectedDomain.expiration_date
                    ? new Date(selectedDomain.expiration_date).toLocaleDateString('es-ES')
                    : 'N/A'}
                </div>
              </div>
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-xs text-text-dim font-sans">Fecha Creación</div>
                <div className="text-sm font-semibold text-text-muted mt-0.5 truncate">
                  {selectedDomain.creation_date
                    ? new Date(selectedDomain.creation_date).toLocaleDateString('es-ES')
                    : 'N/A'}
                </div>
              </div>
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-xs text-text-dim font-sans">Servidores NS</div>
                <div className="text-sm font-semibold text-accent-blue mt-0.5">
                  {renderNameServersList(selectedDomain.name_servers).length} NS
                </div>
              </div>
            </div>
          )
        }
        tabs={[
          { id: 'overview', label: 'Vigencia & Renovación' },
          { id: 'security', label: 'Seguridad EPP & Privacidad' },
          { id: 'nameservers', label: 'Delegación Nameservers' },
        ]}
        activeTab={drawerTab}
        onTabChange={(t) => setDrawerTab(t as typeof drawerTab)}
        footerActions={
          selectedDomain && (
            <>
              <AdminButton capability="domain.update"
                type="button"
                onClick={() => handleOpenEdit(selectedDomain)}
                className="flex items-center gap-1.5 px-4 py-2 border border-border-base text-text-muted hover:text-text-main hover:bg-bg-dark rounded-full text-xs font-semibold transition-colors cursor-pointer"
              >
                <Pencil size={14} />
                Editar Dominio
              </AdminButton>
              <AdminButton capability="domain.delete"
                type="button"
                onClick={() => setDeleteTarget(selectedDomain)}
                className="flex items-center gap-1.5 px-4 py-2 bg-accent-red/10 border border-accent-red/30 text-accent-red hover:bg-accent-red hover:text-white rounded-full text-xs font-semibold transition-colors cursor-pointer"
              >
                <Trash2 size={14} />
                Eliminar Dominio
              </AdminButton>
            </>
          )
        }
        maxWidthClass="max-w-2xl"
      >
        {selectedDomain && drawerTab === 'overview' && (
          <div className="space-y-4">
            <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4 space-y-3 text-xs">
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-medium">Registrador Acreditado:</span>
                <span className="font-mono font-semibold text-text-main truncate max-w-[280px]">
                  {selectedDomain.registrar || 'Desconocido'}
                </span>
              </div>
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-medium">Fecha Creación:</span>
                <span className="font-mono text-text-main">
                  {selectedDomain.creation_date
                    ? new Date(selectedDomain.creation_date).toLocaleDateString('es-ES')
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-medium">Fecha Expiración:</span>
                <span className="font-mono font-bold text-text-main">
                  {selectedDomain.expiration_date
                    ? new Date(selectedDomain.expiration_date).toLocaleDateString('es-ES')
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-medium">Última Modificación en Registry:</span>
                <span className="font-mono text-text-muted">
                  {selectedDomain.last_updated
                    ? new Date(selectedDomain.last_updated).toLocaleDateString('es-ES')
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-dim font-medium">Última Comprobación WHOIS:</span>
                <span className="font-mono text-text-muted">
                  {selectedDomain.last_scanned_at
                    ? new Date(selectedDomain.last_scanned_at).toLocaleString('es-ES')
                    : 'Nunca'}
                </span>
              </div>
            </div>
          </div>
        )}

        {selectedDomain && drawerTab === 'security' && (
          <div className="space-y-4">
            <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4 space-y-3 text-xs">
              {/* Domain Lock Banner */}
              <div
                className={`p-3.5 rounded-2xl border flex items-start gap-2.5 ${
                  selectedDomain.is_locked
                    ? 'bg-accent-green/10 border-accent-green/30 text-text-main'
                    : 'bg-accent-yellow/10 border-accent-yellow/30 text-text-main'
                }`}
              >
                {selectedDomain.is_locked ? (
                  <Lock className="text-accent-green shrink-0 mt-0.5" size={16} />
                ) : (
                  <Unlock className="text-accent-yellow shrink-0 mt-0.5" size={16} />
                )}
                <div>
                  <h4 className="font-bold text-xs">
                    {selectedDomain.is_locked
                      ? 'Bloqueo Anti-Transferencia Activo (Domain Lock)'
                      : 'Atención: Dominio sin Bloqueo de Transferencia'}
                  </h4>
                  <p className="text-xs text-text-muted mt-0.5">
                    {selectedDomain.is_locked
                      ? 'El registrador ha activado la directiva clientTransferProhibited. El dominio está blindado contra transferencias no autorizadas.'
                      : 'El dominio no tiene activo el bloqueo de transferencia. Se recomienda habilitarlo en el registrador para prevenir Domain Hijacking.'}
                  </p>
                </div>
              </div>

              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-medium">País Registrante:</span>
                <span className="font-bold font-mono text-text-main">
                  {selectedDomain.registrant_country || 'No disponible'}
                </span>
              </div>
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-medium">Servidor WHOIS:</span>
                <span className="font-bold font-mono text-text-main">
                  {selectedDomain.whois_server || 'whois.iana.org'}
                </span>
              </div>
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-medium">DNSSEC:</span>
                <span className="font-bold font-mono text-text-main">
                  {selectedDomain.dnssec || 'unsigned'}
                </span>
              </div>
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-medium">Estado ICANN / EPP:</span>
                <span className="font-bold font-mono text-accent-green break-all max-w-[280px]">
                  {Array.isArray(selectedDomain.status)
                    ? selectedDomain.status.join(', ')
                    : selectedDomain.status || 'Activo'}
                </span>
              </div>
              {selectedDomain.error_message && (
                <div className="p-3 bg-accent-red/10 border border-accent-red/20 rounded-xl text-accent-red">
                  {selectedDomain.error_message}
                </div>
              )}
            </div>
          </div>
        )}

        {selectedDomain && drawerTab === 'nameservers' && (
          <div className="space-y-4">
            <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4">
              <h4 className="text-xs font-semibold text-text-muted mb-3 flex items-center gap-1.5">
                <Server size={14} className="text-accent-green" />
                Servidores de Nombres Delegados en el TLD
              </h4>
              {renderNameServersList(selectedDomain.name_servers).length > 0 ? (
                <div className="space-y-2">
                  {renderNameServersList(selectedDomain.name_servers).map((ns, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-bg-card border border-border-base/60 rounded-xl text-xs font-mono text-text-main flex items-center gap-2"
                    >
                      <span className="w-2 h-2 rounded-full bg-accent-green" />
                      <span className="font-bold">{ns}</span>
                      <span className="ml-auto text-xs text-text-dim font-sans font-medium">Autoritativo</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-dim font-mono">
                  No se detectaron servidores de nombres delegados para este dominio.
                </p>
              )}
            </div>
          </div>
        )}
      </NOCDrawer>

      {/* 7. CREATE / EDIT FORM MODAL WITH LIVE TEST WHOIS */}
      {showModal && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
          onClick={handleCloseModal}
        >
          <div
            className="bg-bg-card border border-border-base rounded-3xl p-6 sm:p-8 w-full max-w-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-text-main flex items-center gap-2 font-sans">
                <Globe2 size={19} className="text-accent-green" />
                {editingDomain ? 'Editar Dominio' : 'Monitorear Nuevo Dominio WHOIS'}
              </h2>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-text-muted hover:text-text-main transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitModal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  Nombre de Dominio FQDN
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. empresa.com o micoope.com.gt"
                  value={domainInput}
                  onChange={(e) => {
                    setDomainInput(e.target.value);
                    setTestResult(null);
                  }}
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-mono"
                />
                <p className="text-xs text-text-dim mt-1.5">
                  Ingresa el dominio corporativo raíz (ej. <code>empresa.com</code> sin https://).
                </p>
              </div>

              {/* Test WHOIS Button */}
              <div className="pt-1">
                <AdminButton capability="domain.test"
                  type="button"
                  onClick={handleTestWhois}
                  disabled={!domainInput.trim() || isTestingWhois}
                  className="w-full py-2 px-4 rounded-xl border border-border-base bg-bg-dark hover:bg-bg-dark/80 text-text-main text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isTestingWhois ? (
                    <>
                      <Loader2 className="animate-spin text-accent-green" size={14} />
                      <span>Consultando registro WHOIS/RDAP...</span>
                    </>
                  ) : (
                    <>
                      <Zap size={14} className="text-accent-yellow" />
                      <span>Probar configuración</span>
                    </>
                  )}
                </AdminButton>
                  <ConfigurationDiagnosticNotice notice={diagnostic.notice} remaining={diagnostic.remaining} />
              </div>

              {/* Test Result Live Preview */}
              {testResult && (
                <div
                  className={`p-3.5 rounded-2xl border text-xs animate-in fade-in duration-200 ${
                    testResult.success
                      ? 'bg-accent-green/10 border-accent-green/30 text-text-main'
                      : 'bg-accent-red/10 border-accent-red/30 text-accent-red'
                  }`}
                >
                  {testResult.success ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-accent-green flex items-center gap-1.5">
                          <Check size={14} /> Consulta Exitosa
                        </span>
                        {testResult.is_locked ? (
                          <span className="px-2 py-0.5 rounded-full bg-accent-green/20 text-accent-green text-xs font-bold flex items-center gap-1">
                            <Lock size={10} /> Transfer Lock Activo
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-accent-yellow/20 text-accent-yellow text-xs font-bold flex items-center gap-1">
                            <Unlock size={10} /> Sin Bloqueo
                          </span>
                        )}
                      </div>

                      <div className="font-mono text-xs bg-bg-dark/70 p-2.5 rounded-xl border border-border-base/50 space-y-1">
                        <div className="flex justify-between">
                          <span className="text-text-dim">Registrador:</span>
                          <span className="font-bold truncate max-w-[200px]">{testResult.registrar || 'Desconocido'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-dim">Vigencia Restante:</span>
                          <span className="font-bold text-accent-green">
                            {testResult.days_until_expiration !== null ? `${testResult.days_until_expiration} días` : 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-dim">Fecha Vencimiento:</span>
                          <span>
                            {testResult.expiration_date
                              ? new Date(testResult.expiration_date).toLocaleDateString('es-ES')
                              : 'N/A'}
                          </span>
                        </div>
                        {testResult.name_servers && testResult.name_servers.length > 0 && (
                          <div className="pt-1 border-t border-border-base/40 text-text-dim">
                            <span>Nameservers ({testResult.name_servers.length}):</span>
                            <div className="text-text-main truncate">
                              {testResult.name_servers.slice(0, 2).join(', ')}
                              {testResult.name_servers.length > 2 ? ' ...' : ''}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertTriangle size={14} />
                        <span>Fallo en la consulta WHOIS</span>
                      </div>
                      <p className="text-xs font-mono opacity-90">{testResult.error_message}</p>
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
                <AdminButton capability={editingDomain ? 'domain.update' : 'domain.create'}
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 py-2.5 bg-accent-green text-black font-semibold rounded-full text-sm hover:bg-accent-green/90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm cursor-pointer"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : editingDomain ? (
                    'Actualizar'
                  ) : (
                    'Guardar y Monitorear'
                  )}
                </AdminButton>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* 8. DELETE CONFIRMATION MODAL */}
      <ConfirmDelete
        isOpen={!!deleteTarget}
        itemName={deleteTarget?.domain || 'este dominio'}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
