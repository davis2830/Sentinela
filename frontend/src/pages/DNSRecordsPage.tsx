import { useDNSRecordsWorkspace } from './workspaces/useDNSRecordsWorkspace';
import ConfigurationDiagnosticNotice from '../components/common/ConfigurationDiagnosticNotice';
import CompactModuleSummary from '../components/common/CompactModuleSummary';
import AdminButton from '../components/common/AdminButton';
import ScanAction from '../components/common/ScanAction';
import { createPortal } from 'react-dom';
import type {
  DNSRecordType,
} from '../types/dns';
import EmptyState from '../components/common/EmptyState';
import ConfirmDelete from '../components/common/ConfirmDelete';
import {
  NOCPageHeader,
  NOCToolbar,
  NOCBulkActionBar,
  NOCDrawer,
} from '../components/common/noc';
import {
  Globe,
  Plus,
  Loader2,
  Trash2,
  Clock,
  Pencil,
  ExternalLink,
  History,
  AlertTriangle,
  CheckSquare,
  Square,
  Download,
  Zap,
  Check,
  Shield,
  X,
} from 'lucide-react';

const RECORD_TYPES: DNSRecordType[] = [
  'A',
  'AAAA',
  'CNAME',
  'MX',
  'TXT',
  'NS',
  'SOA',
  'PTR',
  'CAA',
];

export default function DNSRecordsPage() {
 const {showModal, editingRecord, domainInput, setDomainInput, recordTypeInput, setRecordTypeInput, typeFilter, setTypeFilter, searchTerm, setSearchTerm, viewMode, setViewMode, selectedIds, setSelectedIds, deleteTarget, setDeleteTarget, selectedRecord, setSelectedRecord, drawerTab, setDrawerTab, bulkDeleting, diagnostic, isTestingResolution, testResult, setTestResult, autoRefresh, records, isLoading, history, isLoadingHistory, createMutation, updateMutation, scanMutation, deleteMutation, handleToggleSelect, handleSelectAllToggle, handleBulkDelete, handleTestResolution, handleExportCSV, handleOpenCreate, handleOpenEdit, handleCloseModal, handleSubmit, getTypeBadgeClass, isRecentMutation, totalCount, resolvedCount, changedCount, filteredRecords} = useDNSRecordsWorkspace();



  return (
    <div className="compact-workspace space-y-6 animate-in fade-in duration-300 font-sans">
      {/* 1. TOP HEADER (Standard NOC Header) */}
      <NOCPageHeader queryKeys={["dns-records","dns-stats","dns-history"]}
        title="Registros & Zonas DNS"
        badgeText="DNS MONITOR"
        description="Monitorización continua de resolución, propagación, tiempos de respuesta y detección de mutaciones en zonas DNS."
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
          <>
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={!records || records.length === 0}
              className="flex items-center gap-2 bg-bg-card border border-border-base text-text-muted hover:text-text-main font-medium px-4 py-2 rounded-full text-sm hover:bg-bg-card-hover transition-all disabled:opacity-50 cursor-pointer"
              title="Descargar inventario DNS en formato CSV"
            >
              <Download size={15} />
              <span>Exportar</span>
            </button>


            <AdminButton capability="dns_monitor.create"
              type="button"
              onClick={handleOpenCreate}
              className="flex items-center gap-2 bg-accent-green text-black font-semibold px-5 py-2 rounded-full text-sm hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20 cursor-pointer"
            >
              <Plus size={16} />
              <span>Nuevo Registro</span>
            </AdminButton>
          </>
        }
      />

      {/* 2. NOC COMMAND CENTER: KPI STRIP */}
      <CompactModuleSummary variant="status" items={[
        {label:'Registros',value:records ? totalCount : null,icon:Globe,tone:'neutral'},
        {label:'Resueltos',value:records ? resolvedCount : null,icon:Check,tone:'success'},
        {label:'Cambios recientes',value:records ? changedCount : null,icon:History,tone:'warning'}
      ]} />

      {/* 3. TOOLBAR: Omnibar Search + Record Type Chips + Persistent Grid/Table Switcher */}
      <NOCToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por dominio, host o IP resuelta..."
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        categoryLabel="Tipo:"
        categories={[
          { id: 'all', label: 'Todos' },
          { id: 'A', label: 'A' },
          { id: 'AAAA', label: 'AAAA' },
          { id: 'CNAME', label: 'CNAME' },
          { id: 'MX', label: 'MX' },
          { id: 'TXT', label: 'TXT' },
          { id: 'NS', label: 'NS' },
          { id: 'SOA', label: 'SOA' },
          { id: 'PTR', label: 'PTR' },
          { id: 'CAA', label: 'CAA' },
        ]}
        selectedCategory={typeFilter}
        onCategoryChange={(cat) => setTypeFilter(cat as typeof typeFilter)}
      />

      {/* 4. FLOATING BULK ACTIONS BAR */}
      <NOCBulkActionBar
        selectedCount={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        itemLabel="registros"
        actions={
          <>

            <AdminButton capability="dns_monitor.delete"
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
      ) : filteredRecords && filteredRecords.length > 0 ? (
        viewMode === 'table' ? (
          /* Compact NOC Table View */
          <div data-testid="connectivity-table" className="min-w-0 max-w-full bg-bg-card border border-border-base/70 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border-base text-text-dim text-xs bg-bg-card">
                    <th scope="col" className="py-3 px-3.5 w-10">
                      <button
                        type="button"
                        onClick={handleSelectAllToggle}
                        className="text-text-dim hover:text-accent-green transition-colors"
                        title={
                          selectedIds.length === filteredRecords.length
                            ? 'Deseleccionar todos'
                            : 'Seleccionar todos'
                        }
                      >
                        {selectedIds.length === filteredRecords.length ? (
                          <CheckSquare size={16} className="text-accent-green" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </th>
                    <th scope="col" className="py-3 px-3">Tipo</th>
                    <th scope="col" className="py-3 px-4">Nombre / Host</th>
                    <th scope="col" className="py-3 px-4">Valor Resuelto</th>
                    <th scope="col" className="py-3 px-3">TTL</th>
                    <th scope="col" className="py-3 px-3">Latencia</th>
                    <th scope="col" className="py-3 px-3">Mutaciones</th>
                    <th scope="col" className="py-3 px-3">Último Check</th>
                    <th scope="col" className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-base/40">
                  {filteredRecords.map((record) => {
                    const isSelected = selectedIds.includes(record.id);
                    const isMutated = isRecentMutation(record.last_change_at);
                    const isTxt = record.record_type === 'TXT';
                    const isSpf = isTxt && record.value.includes('v=spf1');
                    const isDmarc = isTxt && record.value.includes('v=DMARC1');

                    return (
                      <tr
                        key={record.id}
                        tabIndex={0}
                        aria-label={record.domain}
                        onKeyDown={e=> { if(e.target===e.currentTarget && (e.key==='Enter'||e.key===' ')){e.preventDefault();setSelectedRecord(record);} }}
                        onClick={() => setSelectedRecord(record)}
                        className={`hover:bg-bg-card-hover/80 transition-colors cursor-pointer group ${
                          isSelected ? 'bg-accent-green/[0.03]' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <td
                          className="py-3 px-3.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSelect(record);
                          }}
                        >
                          <button
                            type="button"
                            className="text-text-dim hover:text-accent-green transition-colors"
                          >
                            {isSelected ? (
                              <CheckSquare size={16} className="text-accent-green" />
                            ) : (
                              <Square size={16} />
                            )}
                          </button>
                        </td>

                        {/* Record Type Badge */}
                        <td className="py-3 px-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${getTypeBadgeClass(
                              record.record_type
                            )}`}
                          >
                            {record.record_type}
                          </span>
                        </td>

                        {/* Domain / Host */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-text-main group-hover:text-accent-green transition-colors text-sm font-sans">
                              {record.domain}
                            </span>
                            <a
                              href={`https://${record.domain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-text-dim hover:text-accent-green shrink-0"
                              title="Abrir dominio"
                            >
                              <ExternalLink size={11} />
                            </a>
                          </div>
                        </td>

                        {/* Resolved Value */}
                        <td className="py-3 px-4 font-mono">
                          {record.value ? (
                            <div className="flex items-center gap-2 max-w-md">
                              <span
                                className="text-text-muted truncate block text-xs"
                                title={record.value}
                              >
                                {record.value.split('\n').slice(0, 2).join(', ')}
                                {record.value.split('\n').length > 2 ? ' ...' : ''}
                              </span>
                              {isSpf && (
                                <span className="px-1.5 py-0.2 rounded bg-accent-green/10 text-accent-green border border-accent-green/30 text-xs font-bold shrink-0">
                                  SPF
                                </span>
                              )}
                              {isDmarc && (
                                <span className="px-1.5 py-0.2 rounded bg-accent-purple/10 text-accent-purple border border-accent-purple/30 text-xs font-bold shrink-0">
                                  DMARC
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-accent-red font-semibold text-xs flex items-center gap-1">
                              <AlertTriangle size={12} />
                              Sin resolver
                            </span>
                          )}
                        </td>

                        {/* TTL */}
                        <td className="py-3 px-3 text-text-dim font-mono text-xs">
                          {record.ttl ? `${record.ttl}s` : 'Auto'}
                        </td>

                        {/* Latency ms */}
                        <td className="py-3 px-3 font-mono text-xs">
                          {record.response_time_ms ? (
                            <span
                              className={`font-semibold ${
                                record.response_time_ms < 400
                                  ? 'text-accent-green'
                                  : record.response_time_ms < 1000
                                  ? 'text-accent-yellow'
                                  : 'text-accent-red'
                              }`}
                            >
                              {record.response_time_ms}ms
                            </span>
                          ) : (
                            <span className="text-text-dim">-</span>
                          )}
                        </td>

                        {/* Mutations */}
                        <td className="py-3 px-3 font-mono text-xs">
                          {isMutated ? (
                            <span className="px-2 py-0.5 rounded-full bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/30 text-xs font-bold animate-pulse">
                              Mutación 24h
                            </span>
                          ) : record.last_change_at ? (
                            <span className="text-text-dim text-xs">
                              {new Date(record.last_change_at).toLocaleDateString('es-ES')}
                            </span>
                          ) : (
                            <span className="text-text-dim text-xs">Estable</span>
                          )}
                        </td>

                        {/* Last check */}
                        <td className="py-3 px-3 text-text-dim font-mono text-xs whitespace-nowrap">
                          {record.last_scanned_at
                            ? new Date(record.last_scanned_at).toLocaleTimeString('es-ES', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'N/A'}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div
                            className="flex items-center justify-end gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >

                            <AdminButton capability="dns_monitor.update"
                              type="button"
                              onClick={(e) => handleOpenEdit(record, e)}
                              className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors cursor-pointer"
                              title="Editar registro"
                            >
                              <Pencil size={14} />
                            </AdminButton>
                            <AdminButton capability="dns_monitor.delete"
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(record);
                              }}
                              className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded-full transition-colors cursor-pointer"
                              title="Eliminar registro"
                            >
                              <Trash2 size={14} />
                            </AdminButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Grid Cards View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRecords.map((record) => {
              const isSelected = selectedIds.includes(record.id);
              const isMutated = isRecentMutation(record.last_change_at);

              return (
                <div
                  key={record.id}
                  onClick={() => setSelectedRecord(record)}
                  className={`bg-bg-card border rounded-2xl p-5 hover:border-accent-green/50 transition-all flex flex-col justify-between cursor-pointer group shadow-sm relative ${
                    isSelected
                      ? 'border-accent-green bg-accent-green/[0.02] ring-1 ring-accent-green/40'
                      : 'border-border-base/70'
                  }`}
                >
                  <div>
                    {/* Header: Checkbox, Type Badge, Domain & Actions */}
                    <div className="flex items-start justify-between gap-2 mb-3.5">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSelect(record);
                          }}
                          className="text-text-dim hover:text-accent-green transition-colors shrink-0 cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare size={16} className="text-accent-green" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${getTypeBadgeClass(
                            record.record_type
                          )}`}
                        >
                          {record.record_type}
                        </span>

                        <h3
                          className="font-bold text-text-main truncate text-base group-hover:text-accent-green transition-colors font-sans"
                          title={record.domain}
                        >
                          {record.domain}
                        </h3>
                      </div>

                      {isMutated && (
                        <span className="px-2 py-0.5 rounded-full bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/30 text-xs font-bold animate-pulse shrink-0">
                          Mutación 24h
                        </span>
                      )}
                    </div>

                    {/* Value Box */}
                    <div className="bg-bg-dark/60 rounded-xl p-3 border border-border-base/50 font-mono text-xs space-y-1.5 mb-3">
                      <div className="text-xs text-text-dim flex justify-between font-sans">
                        <span>Valor Resuelto:</span>
                        {record.response_time_ms && (
                          <span className="text-accent-cyan font-mono font-bold">
                            {record.response_time_ms} ms
                          </span>
                        )}
                      </div>
                      <p className="text-text-main break-all line-clamp-3">
                        {record.value || (
                          <span className="text-accent-red font-sans">Sin respuesta / NXDOMAIN</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Card Footer: TTL + Actions */}
                  <div className="pt-3 border-t border-border-base/40 flex items-center justify-between text-xs text-text-dim">
                    <span className="font-mono text-xs">
                      TTL: <strong className="text-text-muted">{record.ttl ? `${record.ttl}s` : 'Auto'}</strong>
                    </span>

                    <div className="flex items-center gap-1">

                      <AdminButton capability="dns_monitor.update"
                        type="button"
                        onClick={(e) => handleOpenEdit(record, e)}
                        className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors cursor-pointer"
                        title="Editar registro"
                      >
                        <Pencil size={14} />
                      </AdminButton>
                      <AdminButton capability="dns_monitor.delete"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(record);
                        }}
                        className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded-full transition-colors cursor-pointer"
                        title="Eliminar registro"
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
        <EmptyState capability="dns_monitor.create"
          title="No hay registros DNS monitorizados"
          description="Agrega registros A, MX, TXT, CNAME o NS para vigilar la resolución de nombres y recibir alertas cuando las IPs cambien."
          actionLabel="Agregar Primer Registro DNS"
          onAction={handleOpenCreate}
        />
      )}

      {/* 6. SLIDE-OVER TECHNICAL DRAWER */}
      <NOCDrawer
        isOpen={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        title={selectedRecord ? `${selectedRecord.record_type} ${selectedRecord.domain}` : ''}
        subtitle="Auditoría de Zona DNS & Historial de Mutaciones de IP"
        statusBadge={
          selectedRecord ? (
            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${getTypeBadgeClass(
                  selectedRecord.record_type
                )}`}
              >
                {selectedRecord.record_type}
              </span>
              {selectedRecord.value ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs bg-accent-green/10 text-accent-green border border-accent-green/30 font-bold">
                  Resuelto
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs bg-accent-red/10 text-accent-red border border-accent-red/30 font-bold">
                  Sin respuesta
                </span>
              )}
            </div>
          ) : undefined
        }
        headerActions={
          selectedRecord && (
            <div className="flex items-center gap-2">
              <ScanAction resource={selectedRecord} route="dns-records" pending={scanMutation.isPending} onScan={()=>scanMutation.mutateAsync(selectedRecord.id)} />
              <a
                href={`https://${selectedRecord.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-full bg-bg-dark border border-border-base text-text-dim hover:text-text-main transition-colors"
                title="Abrir dominio"
              >
                <ExternalLink size={14} />
              </a>
            </div>
          )
        }
        quickKpis={
          selectedRecord && (
            <div className="grid grid-cols-3 gap-2.5 mb-2 font-mono">
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-xs text-text-dim font-sans">TTL Cache</div>
                <div className="text-xs font-bold text-text-main mt-0.5">
                  {selectedRecord.ttl ? `${selectedRecord.ttl}s` : 'Auto'}
                </div>
              </div>
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-xs text-text-dim font-sans">Latencia Consulta</div>
                <div className="text-xs font-bold text-accent-cyan mt-0.5">
                  {selectedRecord.response_time_ms ? `${selectedRecord.response_time_ms} ms` : '-'}
                </div>
              </div>
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-xs text-text-dim font-sans">Último Cambio</div>
                <div className="text-xs font-bold text-accent-yellow mt-0.5 truncate">
                  {selectedRecord.last_change_at
                    ? new Date(selectedRecord.last_change_at).toLocaleDateString('es-ES')
                    : 'Estable'}
                </div>
              </div>
            </div>
          )
        }
        tabs={[
          { id: 'history', label: `Historial de Mutaciones (${history?.length || 0})` },
          { id: 'details', label: 'Valores Resueltos & TTL' },
          ...(selectedRecord?.record_type === 'TXT'
            ? [{ id: 'security', label: 'Seguridad SPF / DMARC' }]
            : []),
        ]}
        activeTab={drawerTab}
        onTabChange={(t) => setDrawerTab(t as typeof drawerTab)}
        footerActions={
          selectedRecord && (
            <>
              <AdminButton capability="dns_monitor.update"
                type="button"
                onClick={() => handleOpenEdit(selectedRecord)}
                className="flex items-center gap-1.5 px-4 py-2 border border-border-base text-text-muted hover:text-text-main hover:bg-bg-dark rounded-full text-xs font-semibold transition-colors cursor-pointer"
              >
                <Pencil size={14} />
                Editar Registro
              </AdminButton>
              <AdminButton capability="dns_monitor.delete"
                type="button"
                onClick={() => setDeleteTarget(selectedRecord)}
                className="flex items-center gap-1.5 px-4 py-2 bg-accent-red/10 border border-accent-red/30 text-accent-red hover:bg-accent-red hover:text-white rounded-full text-xs font-semibold transition-colors cursor-pointer"
              >
                <Trash2 size={14} />
                Eliminar Registro
              </AdminButton>
            </>
          )
        }
        maxWidthClass="max-w-2xl"
      >
        {selectedRecord && drawerTab === 'history' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-text-muted">
                Auditoría de Mutaciones & Comparativa Diff
              </h4>
              <span className="text-xs text-text-dim font-mono">
                {history?.length || 0} eventos registrados
              </span>
            </div>

            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-accent-green" size={28} />
              </div>
            ) : history && history.length > 0 ? (
              <div className="space-y-3 font-mono">
                {history.map((item) => {
                  const oldLines = (item.old_value || '').split('\n').filter(Boolean);
                  const newLines = (item.new_value || '').split('\n').filter(Boolean);
                  const removed = oldLines.filter((l) => !newLines.includes(l));
                  const added = newLines.filter((l) => !oldLines.includes(l));

                  return (
                    <div
                      key={item.id}
                      className="p-4 bg-bg-dark/80 border border-border-base rounded-2xl space-y-3 text-xs"
                    >
                      <div className="flex items-center justify-between text-text-dim text-xs border-b border-border-base/40 pb-2">
                        <span className="flex items-center gap-1.5">
                          <Clock size={12} />
                          {new Date(item.changed_at).toLocaleString('es-ES')}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/30 font-semibold font-sans">
                          Mutación Confirmada
                        </span>
                      </div>

                      {/* Diff View */}
                      <div className="space-y-1.5 font-mono text-xs">
                        {removed.map((val, idx) => (
                          <div
                            key={`rem-${idx}`}
                            className="flex items-center gap-2 p-2 rounded-xl bg-accent-red/10 border border-accent-red/30 text-accent-red"
                          >
                            <span className="font-bold text-sm select-none">-</span>
                            <span className="break-all">{val}</span>
                            <span className="ml-auto text-xs font-sans opacity-80">(Anterior)</span>
                          </div>
                        ))}
                        {added.map((val, idx) => (
                          <div
                            key={`add-${idx}`}
                            className="flex items-center gap-2 p-2 rounded-xl bg-accent-green/10 border border-accent-green/30 text-accent-green"
                          >
                            <span className="font-bold text-sm select-none">+</span>
                            <span className="break-all">{val}</span>
                            <span className="ml-auto text-xs font-sans opacity-80 font-bold">(Nuevo)</span>
                          </div>
                        ))}
                        {removed.length === 0 && added.length === 0 && (
                          <div className="text-text-dim text-xs py-1">
                            Valores actualizados: {item.new_value}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-bg-dark/50 border border-border-base rounded-2xl p-8 text-center font-sans">
                <p className="text-text-dim text-xs">
                  No se han detectado mutaciones en este registro desde su creación.
                </p>
              </div>
            )}
          </div>
        )}

        {selectedRecord && drawerTab === 'details' && (
          <div className="space-y-4 font-sans">
            <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4 space-y-3 text-xs font-mono">
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-sans font-medium">Host / Dominio FQDN:</span>
                <span className="font-bold text-text-main">{selectedRecord.domain}</span>
              </div>
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-sans font-medium">Tipo de Registro:</span>
                <span className="font-bold text-accent-green">{selectedRecord.record_type}</span>
              </div>
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-sans font-medium">TTL Configurado:</span>
                <span className="font-bold text-text-main">{selectedRecord.ttl ? `${selectedRecord.ttl}s` : 'Auto'}</span>
              </div>
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-sans font-medium">Latencia de Consulta:</span>
                <span className="font-bold text-accent-cyan">{selectedRecord.response_time_ms ? `${selectedRecord.response_time_ms} ms` : '-'}</span>
              </div>
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-sans font-medium">Última Comprobación:</span>
                <span className="text-text-muted">
                  {selectedRecord.last_scanned_at
                    ? new Date(selectedRecord.last_scanned_at).toLocaleString('es-ES')
                    : 'Nunca'}
                </span>
              </div>
            </div>

            {/* Resolved Values Box */}
            <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4">
              <h4 className="text-xs font-semibold text-text-muted mb-2.5">
                Respuestas Actuales de la Zona
              </h4>
              {selectedRecord.value ? (
                <div className="space-y-1.5 font-mono text-xs">
                  {selectedRecord.value.split('\n').map((val, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-bg-card rounded-xl border border-border-base/60 text-text-main break-all"
                    >
                      {val}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-accent-red/10 border border-accent-red/30 rounded-xl text-accent-red text-xs">
                  Sin respuestas devueltas por el resolver.
                </div>
              )}
            </div>
          </div>
        )}

        {selectedRecord && drawerTab === 'security' && (
          <div className="space-y-4 font-sans">
            <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Shield size={16} className="text-accent-green" />
                <h4 className="text-xs font-bold text-text-main">
                  Políticas de Correo & Anti-Spoofing (SPF / DMARC)
                </h4>
              </div>

              {selectedRecord.value.includes('v=spf1') ? (
                <div className="p-3.5 bg-accent-green/10 border border-accent-green/30 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-accent-green">Política SPF Detectada</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-bg-dark text-accent-green">
                      v=spf1
                    </span>
                  </div>
                  <p className="font-mono text-xs text-text-muted break-all">
                    {selectedRecord.value}
                  </p>
                  <p className="text-xs text-text-dim">
                    Autoriza qué servidores tienen permiso para enviar correos electrónicos en nombre de este dominio.
                  </p>
                </div>
              ) : selectedRecord.value.includes('v=DMARC1') ? (
                <div className="p-3.5 bg-accent-purple/10 border border-accent-purple/30 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-accent-purple">Política DMARC Detectada</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-bg-dark text-accent-purple">
                      v=DMARC1
                    </span>
                  </div>
                  <p className="font-mono text-xs text-text-muted break-all">
                    {selectedRecord.value}
                  </p>
                  <p className="text-xs text-text-dim">
                    Protege el dominio corporativo contra phishing y ataques de suplantación de identidad.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-bg-card border border-border-base rounded-xl text-text-dim text-xs">
                  Este registro TXT no contiene directivas SPF ni DMARC.
                </div>
              )}
            </div>
          </div>
        )}
      </NOCDrawer>

      {/* 7. CREATE / EDIT FORM MODAL WITH LIVE TEST RESOLUTION */}
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
                <Globe size={19} className="text-accent-green" />
                {editingRecord ? 'Editar Registro DNS' : 'Nuevo Registro DNS'}
              </h2>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-text-muted hover:text-text-main transition-colors p-1"
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
                    Host o Dominio FQDN
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

              {/* Test Resolution Button */}
              <div className="pt-1">
                <AdminButton capability="dns_monitor.test"
                  type="button"
                  onClick={handleTestResolution}
                  disabled={!domainInput.trim() || isTestingResolution}
                  className="w-full py-2 px-4 rounded-xl border border-border-base bg-bg-dark hover:bg-bg-dark/80 text-text-main text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isTestingResolution ? (
                    <>
                      <Loader2 className="animate-spin text-accent-green" size={14} />
                      <span>Consultando servidores DNS...</span>
                    </>
                  ) : (
                    <>
                      <Zap size={14} className="text-accent-yellow" />
                      <span>Probar configuración</span>
                    </>
                  )}
                </AdminButton>
              </div>
                <ConfigurationDiagnosticNotice notice={diagnostic.notice} remaining={diagnostic.remaining} />

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
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-accent-green flex items-center gap-1.5">
                          <Check size={14} /> Consulta Exitosa ({testResult.response_time_ms} ms)
                        </span>
                        <span className="font-mono text-xs text-text-dim">
                          TTL: {testResult.ttl ? `${testResult.ttl}s` : 'Auto'}
                        </span>
                      </div>
                      <div className="font-mono text-xs bg-bg-dark/70 p-2 rounded-xl border border-border-base/50 space-y-1">
                        {testResult.values.map((v, i) => (
                          <div key={i} className="truncate" title={v}>
                            &bull; {v}
                          </div>
                        ))}
                      </div>
                      {testResult.spf_info && (
                        <div className="text-xs text-accent-green flex items-center gap-1 mt-1">
                          <Shield size={12} />
                          <span>Registro SPF válido detectado ({testResult.spf_info.policy})</span>
                        </div>
                      )}
                      {testResult.dmarc_info && (
                        <div className="text-xs text-accent-purple flex items-center gap-1 mt-1">
                          <Shield size={12} />
                          <span>Política DMARC: {testResult.dmarc_info.policy}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertTriangle size={14} />
                        <span>Fallo en la resolución DNS ({testResult.error_type})</span>
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
                <AdminButton capability={editingRecord ? 'dns_monitor.update' : 'dns_monitor.create'}
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 py-2.5 bg-accent-green text-black font-semibold rounded-full text-sm hover:bg-accent-green/90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm cursor-pointer"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : editingRecord ? (
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
        itemName={deleteTarget ? `${deleteTarget.record_type} ${deleteTarget.domain}` : ''}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
