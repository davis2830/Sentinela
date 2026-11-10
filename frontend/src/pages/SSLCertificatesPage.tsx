import { useSSLCertificatesWorkspace } from './workspaces/useSSLCertificatesWorkspace';
import ModalSurface from '../components/common/ModalSurface';
import ConfigurationDiagnosticNotice from '../components/common/ConfigurationDiagnosticNotice';
import CompactModuleSummary from '../components/common/CompactModuleSummary';
import AdminButton from '../components/common/AdminButton';
import ScanAction from '../components/common/ScanAction';
import { createPortal } from 'react-dom';
import type {
  SSLCertificate,
} from '../types/ssl';
import StatusBadge from '../components/common/StatusBadge';
import EmptyState from '../components/common/EmptyState';
import ConfirmDelete from '../components/common/ConfirmDelete';
import SSLCertificateTableView from '../components/ssl/SSLCertificateTableView';
import {
  NOCPageHeader,
  NOCToolbar,
  NOCBulkActionBar,
  NOCDrawer,
} from '../components/common/noc';
import {
  ShieldCheck,
  Plus,
  Loader2,
  Trash2,
  Calendar,
  Building2,
  X,
  Lock,
  Pencil,
  Copy,
  Check,
  Clock,
  ExternalLink,
  ShieldAlert,
  Globe,
  CheckSquare,
  Square,
  Zap,
  Download,
  Search,
} from 'lucide-react';

type FilterType = 'all' | 'expiring' | 'expired';

function parseIssuerName(issuerStr: string | null): string {
  if (!issuerStr) return 'Desconocido';
  const orgMatch = issuerStr.match(/organizationName=([^,]+)/i);
  if (orgMatch && orgMatch[1]) return orgMatch[1].trim();
  const cnMatch = issuerStr.match(/commonName=([^,]+)/i);
  if (cnMatch && cnMatch[1]) return cnMatch[1].trim();
  return issuerStr.split(',')[0].replace('CN=', '');
}

export default function SSLCertificatesPage() {
 const {filter, setFilter, searchTerm, setSearchTerm, viewMode, setViewMode, selectedIds, setSelectedIds, scanningId, showModal, editingCert, selectedCert, setSelectedCert, domainInput, setDomainInput, portInput, setPortInput, deleteTarget, setDeleteTarget, copiedFingerprint, drawerTab, setDrawerTab, sanSearchTerm, setSanSearchTerm, bulkDeleting, diagnostic, isTestingConnection, testResult, setTestResult, autoRefresh, stats, certificates, isLoading, isError, refetch, createMutation, updateMutation, scanMutation, deleteMutation, handleToggleSelect, handleSelectAllToggle, handleBulkDelete, handleTestConnection, handleExportCSV, handleOpenCreate, handleOpenEdit, handleCloseModal, handleSubmitModal, handleCopyFingerprint, getStatusType, totalCount, validCount, expiringCount, expiredCount, filteredCertificates} = useSSLCertificatesWorkspace();



  return (
    <div className="compact-workspace space-y-6 animate-in fade-in duration-300 font-sans">
      {/* 1. TOP HEADER (Standard NOC Header) */}
      <NOCPageHeader queryKeys={["ssl-certificates","ssl-stats"]}
        title="Certificados SSL & TLS"
        badgeText="CERT GUARD"
        description="Supervisa la validez, cadena criptográfica, emisor y vencimiento de tus certificados SSL/TLS con alertas preventivas."
        icon={<Lock size={26} />}
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
              disabled={!certificates || certificates.length === 0}
              className="flex items-center gap-2 bg-bg-card border border-border-base text-text-muted hover:text-text-main font-medium px-4 py-2 rounded-full text-sm hover:bg-bg-card-hover transition-all disabled:opacity-50 cursor-pointer"
              title="Descargar inventario SSL en formato CSV"
            >
              <Download size={15} />
              <span>Exportar</span>
            </button>


            <AdminButton capability="ssl_monitor.create"
              type="button"
              onClick={handleOpenCreate}
              className="flex items-center gap-2 bg-accent-green text-black font-semibold px-5 py-2 rounded-full text-sm hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20 cursor-pointer"
            >
              <Plus size={16} />
              <span>Nuevo Certificado</span>
            </AdminButton>
          </>
        }
      />

      {/* 2. NOC COMMAND CENTER: KPI STRIP */}
      <CompactModuleSummary variant="status" items={[
        {label:'Certificados',value:certificates ? totalCount : null,icon:Lock,tone:'neutral'},
        {label:'Válidos',value:certificates ? validCount : null,icon:ShieldCheck,tone:'success'},
        {label:'Por vencer',value:certificates ? expiringCount : null,icon:Clock,tone:'warning'},
        {label:'Inválidos / vencidos',value:stats ? expiredCount : null,icon:ShieldAlert,tone:'danger'}
      ]} />

      {/* 3. TOOLBAR: Omnibar Search + Status Pills + Persistent Grid/Table Switcher */}
      <NOCToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por dominio, autoridad emisora (CA), SANs o algoritmo..."
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        statusPills={[
          { id: 'all', label: 'Todos', count: isError ? undefined : totalCount, variant: 'all' },
          { id: 'expiring', label: 'Por expirar', count: isError ? undefined : expiringCount, variant: 'warning' },
          { id: 'expired', label: 'Expirados / Fallos', count: isError ? undefined : expiredCount, variant: 'danger' },
        ]}
        selectedStatus={filter}
        onStatusChange={(st) => setFilter(st as FilterType)}
      />

      {/* 4. FLOATING BULK ACTIONS BAR */}
      <NOCBulkActionBar
        selectedCount={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        itemLabel="certificados"
        actions={
          <>

            <AdminButton capability="ssl_monitor.delete"
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

      {/* 5. MAIN CONTENT: DUAL VIEW (GRID OR COMPACT TABLE) */}
      {isError && <section role="alert" className="rounded-2xl border border-accent-yellow/40 bg-bg-card p-5 text-sm text-text-main">
        <p>No pudimos consultar los certificados. Esto no significa que se hayan eliminado.</p>
        <button className="mt-2 text-accent-green" onClick={() => refetch()}>Reintentar consulta de certificados</button>
      </section>}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-accent-green" size={32} />
        </div>
      ) : filteredCertificates && filteredCertificates.length > 0 ? (
        viewMode === 'grid' ? (
          /* Grid View (Cards) */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCertificates.map((cert: SSLCertificate) => {
              const status = getStatusType(cert);
              const issuerClean = parseIssuerName(cert.issuer);
              const days = cert.days_remaining;
              const isSelected = selectedIds.includes(cert.id);

              let percentUsed: number | null = null;
              if (cert.issued_at && cert.expiration_date) {
                const start = new Date(cert.issued_at).getTime();
                const end = new Date(cert.expiration_date).getTime();
                const now = Date.now();
                if (end > start) {
                  percentUsed = Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));
                }
              }

              return (
                <div
                  key={cert.id}
                  onClick={() => setSelectedCert(cert)}
                  className={`bg-bg-card border rounded-2xl p-5 hover:border-accent-green/50 transition-all flex flex-col justify-between cursor-pointer group shadow-sm relative ${
                    isSelected
                      ? 'border-accent-green bg-accent-green/[0.02] ring-1 ring-accent-green/40'
                      : 'border-border-base/70'
                  }`}
                >
                  <div>
                    {/* Top Bar: Checkbox, Icon, Domain, Port & Status */}
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        {/* Checkbox */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSelect(cert);
                          }}
                          className="text-text-dim hover:text-accent-green transition-colors shrink-0"
                          title={isSelected ? 'Deseleccionar' : 'Seleccionar'}
                        >
                          {isSelected ? (
                            <CheckSquare size={16} className="text-accent-green" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>

                        <div className="w-9 h-9 rounded-xl bg-bg-dark border border-border-base flex items-center justify-center shrink-0 text-accent-green group-hover:border-accent-green/40 transition-colors">
                          <Lock size={16} />
                        </div>
                        <div className="overflow-hidden">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3
                              className="font-bold text-text-main truncate text-base group-hover:text-accent-green transition-colors font-sans"
                              title={cert.domain}
                            >
                              {cert.domain}
                            </h3>
                            {cert.port && cert.port !== 443 && (
                              <span className="font-mono text-xs px-1.5 py-0.2 bg-bg-dark border border-border-base rounded text-accent-blue">
                                :{cert.port}
                              </span>
                            )}
                          </div>
                          {cert.issuer && (
                            <span className="text-xs font-medium text-text-dim truncate block max-w-[200px]">
                              {issuerClean}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Radar & Status */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {cert.is_valid && (
                          <span className="relative flex h-2 w-2 mr-0.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                          </span>
                        )}
                        <StatusBadge status={status} />
                      </div>
                    </div>

                    {/* Card Content Details */}
                    <div className="space-y-2 text-xs text-text-muted bg-bg-dark/50 rounded-xl p-3 border border-border-base/40">
                      <div className="flex items-center justify-between border-b border-border-base/40 pb-1.5">
                        <span className="flex items-center gap-1.5 text-text-dim font-medium">
                          <Building2 size={13} /> Emisor:
                        </span>
                        <span
                          className="font-mono text-text-main font-semibold truncate max-w-[180px]"
                          title={cert.issuer || ''}
                        >
                          {issuerClean}
                        </span>
                      </div>

                      <div className="flex items-center justify-between border-b border-border-base/40 pb-1.5">
                        <span className="flex items-center gap-1.5 text-text-dim font-medium">
                          <Calendar size={13} /> Expiración:
                        </span>
                        <span className="font-mono text-text-main">
                          {cert.expiration_date
                            ? new Date(cert.expiration_date).toLocaleDateString('es-ES')
                            : 'N/A'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-text-dim font-medium">
                          <Clock size={13} /> Vigencia:
                        </span>
                        <div className="text-right">
                          <span
                            className={`font-mono font-bold ${
                              days !== null && days <= 0
                                ? 'text-rose-400'
                                : days !== null && days <= 15
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                            }`}
                          >
                            {days !== null ? (days <= 0 ? 'Expirado' : `${days} días`) : 'N/A'}
                          </span>
                        </div>
                      </div>

                      {/* Timeline Bar in Card */}
                      {percentUsed !== null && (
                        <div className="w-full bg-bg-dark border border-border-base rounded-full h-1.5 overflow-hidden mt-1.5" title={`Vida consumida: ${percentUsed}%`}>
                          <div
                            className={`h-full rounded-full ${
                              (days || 0) <= 0
                                ? 'bg-accent-red'
                                : (days || 0) <= 15
                                ? 'bg-accent-yellow'
                                : 'bg-accent-green'
                            }`}
                            style={{ width: `${percentUsed}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer: Grade + Algorithm + Actions */}
                  <div className="mt-4 pt-3 border-t border-border-base/40 flex items-center justify-between text-xs text-text-dim">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-accent-green/10 text-accent-green border border-accent-green/30">
                        {cert.security_grade || 'A'}
                      </span>
                      <span className="font-mono text-xs bg-bg-dark px-2 py-0.5 rounded-md border border-border-base/50">
                        {cert.tls_version || 'TLS 1.3'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">

                      <AdminButton capability="ssl_monitor.update"
                        type="button"
                        onClick={(e) => handleOpenEdit(cert, e)}
                        className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors"
                        title="Editar dominio"
                      >
                        <Pencil size={14} />
                      </AdminButton>
                      <AdminButton capability="ssl_monitor.delete"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(cert);
                        }}
                        className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded-full transition-colors"
                        title="Eliminar certificado"
                      >
                        <Trash2 size={14} />
                      </AdminButton>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Compact NOC Table View */
          <SSLCertificateTableView
            certificates={filteredCertificates}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAllToggle}
            onSelectCert={(c) => setSelectedCert(c)}
            onScan={(id, e) => {
              e.stopPropagation();
              scanMutation.mutate(id);
            }}
            scanningId={scanningId}
            onEdit={handleOpenEdit}
            onDelete={(cert, e) => {
              if (e) e.stopPropagation();
              setDeleteTarget(cert);
            }}
          />
        )
      ) : (
        !isError && <EmptyState capability="ssl_monitor.create"
          title="No hay certificados SSL registrados"
          description="Añade tus dominios críticos para auditar la vigencia de sus certificados SSL/TLS y recibir avisos antes del vencimiento."
          actionLabel="Monitorear Primer Certificado"
          onAction={handleOpenCreate}
        />
      )}

      {/* 6. SLIDE-OVER TECHNICAL DRAWER */}
      <NOCDrawer
        isOpen={!!selectedCert}
        onClose={() => setSelectedCert(null)}
        title={selectedCert ? `${selectedCert.domain}${selectedCert.port && selectedCert.port !== 443 ? `:${selectedCert.port}` : ''}` : ''}
        subtitle="Auditoría Criptográfica & Cadena de Confianza SSL/TLS"
        statusBadge={
          selectedCert ? (
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded-full bg-accent-green/10 text-accent-green border border-accent-green/30">
                Grado {selectedCert.security_grade || 'A'}
              </span>
              <StatusBadge status={getStatusType(selectedCert)} />
            </div>
          ) : undefined
        }
        headerActions={
          selectedCert && (
            <div className="flex items-center gap-2">
              <ScanAction resource={selectedCert} route="ssl-certificates" pending={scanMutation.isPending} onScan={()=>scanMutation.mutateAsync(selectedCert.id)} />
              <a
                href={`https://${selectedCert.domain}${selectedCert.port && selectedCert.port !== 443 ? `:${selectedCert.port}` : ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-full bg-bg-dark border border-border-base text-text-dim hover:text-text-main transition-colors"
                title="Abrir endpoint en nueva pestaña"
              >
                <ExternalLink size={14} />
              </a>
            </div>
          )
        }
        tabs={[
          { id: 'overview', label: `Vigencia & Estado (${selectedCert?.days_remaining ?? 0}d)` },
          {
            id: 'sans',
            label: `Dominios SANs (${selectedCert?.san_domains?.length || 1})`,
          },
          { id: 'technical', label: 'Criptografía & TLS' },
        ]}
        activeTab={drawerTab}
        onTabChange={(tab) => setDrawerTab(tab as typeof drawerTab)}
      >
        {selectedCert && drawerTab === 'overview' && (
          <div className="space-y-4">
            {/* Quick Lifetime Metric Strip */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-bg-dark/90 border border-border-base rounded-2xl p-3.5">
                <span className="text-xs text-text-dim block mb-1">Días Restantes</span>
                <span
                  className={`text-2xl font-bold font-mono ${
                    (selectedCert.days_remaining || 0) <= 0
                      ? 'text-accent-red'
                      : (selectedCert.days_remaining || 0) <= 15
                      ? 'text-accent-yellow'
                      : 'text-accent-green'
                  }`}
                >
                  {selectedCert.days_remaining !== null
                    ? `${selectedCert.days_remaining}d`
                    : 'Sin datos'}
                </span>
              </div>
              <div className="bg-bg-dark/90 border border-border-base rounded-2xl p-3.5">
                <span className="text-xs text-text-dim block mb-1">Protocolo Activo</span>
                <span className="text-2xl font-bold font-mono text-accent-blue">
                  {selectedCert.tls_version || 'TLS 1.3'}
                </span>
              </div>
            </div>

            {/* Error or Success Alert */}
            {selectedCert.error_message ? (
              <div className="p-4 bg-accent-red/10 border border-accent-red/30 rounded-2xl flex items-start gap-3 text-accent-red">
                <ShieldAlert size={22} className="shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm">Fallo en el Análisis SSL</h4>
                  <p className="text-xs font-mono mt-1 opacity-90">{selectedCert.error_message}</p>
                </div>
              </div>
            ) : selectedCert.is_valid ? (
              <div className="p-4 bg-accent-green/10 border border-accent-green/30 rounded-2xl flex items-start gap-3 text-accent-green">
                <ShieldCheck size={22} className="shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm">Certificado SSL Válido y Operativo</h4>
                  <p className="text-xs font-sans mt-1 text-text-muted">
                    El certificado responde correctamente en el puerto {selectedCert.port || 443} con una cadena de confianza intacta.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4 space-y-3 text-xs">
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-medium">Emisor Principal (CA):</span>
                <span className="font-mono font-semibold text-text-main truncate max-w-[280px]">
                  {parseIssuerName(selectedCert.issuer)}
                </span>
              </div>
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-medium">Puerto de Escaneo:</span>
                <span className="font-mono text-accent-green font-bold">
                  {selectedCert.port || 443}
                </span>
              </div>
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-medium">Fecha de Emisión:</span>
                <span className="font-mono text-text-main">
                  {selectedCert.issued_at
                    ? new Date(selectedCert.issued_at).toLocaleDateString('es-ES')
                    : selectedCert.created_at
                    ? new Date(selectedCert.created_at).toLocaleDateString('es-ES')
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-medium">Fecha de Expiración:</span>
                <span className="font-mono font-bold text-text-main">
                  {selectedCert.expiration_date
                    ? new Date(selectedCert.expiration_date).toLocaleDateString('es-ES')
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-dim font-medium">Último Chequeo:</span>
                <span className="font-mono text-text-muted">
                  {selectedCert.last_scanned_at
                    ? new Date(selectedCert.last_scanned_at).toLocaleString('es-ES')
                    : 'Nunca'}
                </span>
              </div>
            </div>
          </div>
        )}

        {selectedCert && drawerTab === 'technical' && (
          <div className="space-y-4">
            <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4 space-y-3 text-xs font-mono">
              <div>
                <span className="text-text-dim font-sans font-medium block mb-1">
                  Emisor Completo (Issuer DN):
                </span>
                <p className="text-text-main break-all leading-relaxed bg-bg-card p-3 rounded-xl border border-border-base/40">
                  {selectedCert.issuer || 'Desconocido'}
                </p>
              </div>

              <div>
                <span className="text-text-dim font-sans font-medium block mb-1">
                  Sujeto del Certificado (Subject):
                </span>
                <p className="text-text-main break-all leading-relaxed bg-bg-card p-3 rounded-xl border border-border-base/40">
                  {selectedCert.subject || selectedCert.domain}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-text-dim font-sans font-medium block mb-1">Algoritmo:</span>
                  <p className="text-text-main bg-bg-card p-2.5 rounded-xl border border-border-base/40">
                    {selectedCert.algorithm || 'SHA-256'}
                  </p>
                </div>
                <div>
                  <span className="text-text-dim font-sans font-medium block mb-1">Protocolo TLS:</span>
                  <p className="text-accent-green bg-bg-card p-2.5 rounded-xl border border-border-base/40 font-bold">
                    {selectedCert.tls_version || 'TLS 1.3'}
                  </p>
                </div>
              </div>

              {selectedCert.fingerprint && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-text-dim font-sans font-medium">
                      Huella Digital (Fingerprint SHA-256):
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyFingerprint(selectedCert.fingerprint || '')}
                      className="text-accent-green hover:underline flex items-center gap-1 text-xs cursor-pointer"
                    >
                      {copiedFingerprint ? <Check size={12} /> : <Copy size={12} />}
                      {copiedFingerprint ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <p className="text-text-muted break-all leading-relaxed bg-bg-card p-3 rounded-xl border border-border-base/40 text-xs">
                    {selectedCert.fingerprint}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {selectedCert && drawerTab === 'sans' && (
          <div className="space-y-4">
            <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-text-muted flex items-center gap-1.5">
                  <Globe size={14} className="text-accent-green" />
                  Nombres Alternativos del Sujeto (SANs)
                </h4>
                <span className="font-mono text-xs text-text-dim">
                  {selectedCert.san_domains?.length || 0} dominios
                </span>
              </div>

              {/* SANs Search Bar */}
              {selectedCert.san_domains && selectedCert.san_domains.length > 5 && (
                <div className="relative mb-3">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
                  <input
                    type="text"
                    placeholder="Filtrar nombres SAN..."
                    value={sanSearchTerm}
                    onChange={(e) => setSanSearchTerm(e.target.value)}
                    className="w-full bg-bg-card border border-border-base rounded-xl pl-9 pr-3 py-1.5 text-xs text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green"
                  />
                </div>
              )}

              {selectedCert.san_domains && selectedCert.san_domains.length > 0 ? (
                <div className="flex flex-wrap gap-2 max-h-72 overflow-y-auto pr-1">
                  {selectedCert.san_domains
                    .filter((san) => !sanSearchTerm || san.toLowerCase().includes(sanSearchTerm.toLowerCase()))
                    .map((san, idx) => {
                      const isWildcard = san.startsWith('*.');
                      return (
                        <span
                          key={idx}
                          className={`px-3 py-1.5 rounded-xl text-xs font-mono flex items-center gap-1.5 ${
                            isWildcard
                              ? 'bg-accent-purple/10 border border-accent-purple/30 text-accent-purple'
                              : 'bg-bg-card border border-border-base/60 text-text-main'
                          }`}
                        >
                          <Lock size={11} className={isWildcard ? 'text-accent-purple' : 'text-accent-green'} />
                          <span>{san}</span>
                          {isWildcard && <span className="text-xs font-sans opacity-80">(Wildcard)</span>}
                        </span>
                      );
                    })}
                </div>
              ) : (
                <p className="text-xs text-text-dim font-mono">
                  No se registraron dominios alternativos SANs para este certificado.
                </p>
              )}
            </div>
          </div>
        )}
      </NOCDrawer>

      {/* 7. CREATE / EDIT FORM MODAL WITH LIVE TEST CONNECTION */}
      {showModal && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
          onClick={handleCloseModal}
        >
          <ModalSurface label={editingCert ? "Editar Certificado SSL" : "Monitorear Nuevo Certificado SSL"} onClose={handleCloseModal}
            className="bg-bg-card border border-border-base rounded-3xl p-6 sm:p-8 w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-text-main flex items-center gap-2 font-sans">
                <Lock size={19} className="text-accent-green" />
                {editingCert ? 'Editar Certificado SSL' : 'Monitorear Nuevo Certificado SSL'}
              </h2>
              <button
                type="button" aria-label="Cerrar formulario SSL"
                onClick={handleCloseModal}
                className="text-text-muted hover:text-text-main transition-colors p-1"
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
                    id="ssl-domain" aria-label="Dominio o FQDN" placeholder="ej. api.tuempresa.com"
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
                    aria-label="Puerto" value={portInput}
                    onChange={(e) => {
                      setPortInput(parseInt(e.target.value, 10) || 443);
                      setTestResult(null);
                    }}
                    className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-mono text-center"
                  />
                </div>
              </div>
              <p className="text-xs text-text-dim">
                Puertos comunes: <span className="font-mono text-accent-green">443</span> (HTTPS), <span className="font-mono text-accent-blue">8443</span> (Paneles), <span className="font-mono text-accent-purple">636</span> (LDAPS).
              </p>

              {/* Test Connection Button */}
              <div className="pt-1">
                <AdminButton capability="ssl_monitor.test"
                  type="button"
                  onClick={handleTestConnection}
                  disabled={!domainInput.trim() || isTestingConnection}
                  className="w-full py-2 px-4 rounded-xl border border-border-base bg-bg-dark hover:bg-bg-dark/80 text-text-main text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isTestingConnection ? (
                    <>
                      <Loader2 className="animate-spin text-accent-green" size={14} />
                      <span>Probando conexión TLS con el host...</span>
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
                    testResult.is_valid
                      ? 'bg-accent-green/10 border-accent-green/30 text-text-main'
                      : 'bg-accent-red/10 border-accent-red/30 text-accent-red'
                  }`}
                >
                  {testResult.is_valid ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-accent-green flex items-center gap-1.5">
                          <Check size={14} /> Conexión Exitosa &bull; Grado {testResult.security_grade}
                        </span>
                        <span className="font-mono text-xs text-text-dim">
                          {testResult.tls_version}
                        </span>
                      </div>
                      <div className="text-xs text-text-muted">
                        <span>Emisor: </span>
                        <span className="font-mono text-text-main">{parseIssuerName(testResult.issuer || null)}</span>
                      </div>
                      <div className="text-xs text-text-muted">
                        <span>Vigencia: </span>
                        <span className="font-mono text-accent-green font-bold">{testResult.days_remaining} días</span>
                        {testResult.san_domains && (
                          <span className="ml-2 font-mono text-text-dim">({testResult.san_domains.length} SANs cubiertos)</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">Fallo en la prueba de conexión</span>
                        <span className="text-xs font-mono opacity-90">{testResult.error_message}</span>
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
                <AdminButton capability={editingCert ? 'ssl_monitor.update' : 'ssl_monitor.create'}
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 py-2.5 bg-accent-green text-black font-semibold rounded-full text-sm hover:bg-accent-green/90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm cursor-pointer"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : editingCert ? (
                    'Actualizar'
                  ) : (
                    'Guardar y Monitorear'
                  )}
                </AdminButton>
              </div>
            </form>
          </ModalSurface>
        </div>,
        document.body
      )}

      {/* 8. DELETE CONFIRMATION MODAL */}
      <ConfirmDelete
        isOpen={!!deleteTarget}
        itemName={deleteTarget ? `${deleteTarget.domain}:${deleteTarget.port || 443}` : 'este certificado'}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
