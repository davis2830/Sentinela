import { useIncidentsWorkspace } from './workspaces/useIncidentsWorkspace';
import MemberPicker from '../components/users/MemberPicker';
import CompactModuleSummary from '../components/common/CompactModuleSummary';
import AdminButton from '../components/common/AdminButton';
import type {
  Incident,
  IncidentAlert,
  IncidentStatus,
} from '../types/incidents';
import StatusBadge from '../components/common/StatusBadge';
import PriorityBadge from '../components/common/PriorityBadge';
import EmptyState from '../components/common/EmptyState';
import ConfirmDelete from '../components/common/ConfirmDelete';
import IncidentForm from '../components/incidents/IncidentForm';
import TimelineView from '../components/incidents/TimelineView';
import IncidentCard from '../components/incidents/IncidentCard';
import IncidentTableView from '../components/incidents/IncidentTableView';
import {
  NOCPageHeader,
  NOCToolbar,
  NOCBulkActionBar,
  NOCDrawer,
} from '../components/common/noc';
import {
  AlertOctagon,
  Plus,
  Loader2,
  Trash2,
  Clock,
  Pencil,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Bell,
  Search,
  Check,
  Wrench,
  ShieldAlert,
  Activity,
  UserCheck,
  User,
  Server,
  FileText,
  ExternalLink,
  Download,
  Layers,
} from 'lucide-react';

const LIFECYCLE_STEPS: { status: IncidentStatus; label: string; icon: import('lucide-react').LucideIcon }[] = [
  { status: 'open', label: 'Abierto', icon: AlertOctagon },
  { status: 'investigating', label: 'Investigando', icon: Search },
  { status: 'identified', label: 'Identificado', icon: Wrench },
  { status: 'mitigated', label: 'Mitigado', icon: ShieldAlert },
  { status: 'resolved', label: 'Resuelto', icon: CheckCircle2 },
  { status: 'closed', label: 'Cerrado', icon: XCircle },
];


export default function IncidentsPage() {
 const {navigate, selectedIncident, setSelectedIncident, showForm, setShowForm, editingIncident, setEditingIncident, deleteTarget, setDeleteTarget, noteInput, setNoteInput, searchTerm, setSearchTerm, statusFilter, setStatusFilter, priorityFilter, setPriorityFilter, viewMode, setViewMode, selectedIds, setSelectedIds, drawerTab, setDrawerTab, bulkProcessing, rcaRootCause, setRcaRootCause, rcaResolutionSummary, setRcaResolutionSummary, rcaPreventiveActions, setRcaPreventiveActions, assigneeState, setAssigneeState, teamAssigneeState, setTeamAssigneeState, autoRefresh, incidents, isLoading, teams, timelineEvents, isLoadingTimeline, linkedAlerts, updateMutation, deleteMutation, addNoteMutation, rcaMutation, assignMutation, handleToggleSelect, handleSelectAllToggle, handleBulkAction, handleFormSubmit, handleAddNote, handleSaveRca, handleSaveAssignee, handleStatusChange, handleOpenCreate, handleOpenEdit, handleExportCSV, getModuleRoute, getModuleIcon, allIncidents, totalCount, criticalCount, inProgressCount, resolvedCount, filteredIncidents, currentStepIndex} = useIncidentsWorkspace();



  return (
    <div className="compact-workspace space-y-6 animate-in fade-in duration-300 font-sans">
      {/* 1. TOP HEADER (Standard NOC Header) */}
      <NOCPageHeader queryKeys={["incidents-list","incidents-stats","incident-timeline","incident-alerts","org-members-select","teams-list-select"]}
        title="Gestión de Incidentes"
        badgeText="CENTRO DE INCIDENTES"
        description="Gestión del ciclo de vida ITIL/SRE, asignación de ingenieros, RCA colaborativo y control de MTTR."
        icon={<AlertOctagon size={26} />}
        autoRefresh={{
          enabled: autoRefresh.enabled,
          countdown: autoRefresh.countdown,
          onToggle: autoRefresh.toggle,
        }}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-2 bg-bg-card border border-border-base text-text-muted hover:text-text-main hover:bg-bg-card-hover font-semibold px-4 py-2 rounded-full text-xs transition-all shadow-xs cursor-pointer"
              title="Exportar inventario de incidentes a CSV"
            >
              <Download size={14} />
              Exportar CSV
            </button>
            <AdminButton capability="incidents.create"
              type="button"
              onClick={handleOpenCreate}
              className="flex items-center gap-2 bg-accent-green text-black font-semibold px-5 py-2 rounded-full text-sm hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20 cursor-pointer"
            >
              <Plus size={16} />
              Nuevo Incidente
            </AdminButton>
          </div>
        }
      />

      {/* 2. NOC COMMAND CENTER: KPI STRIP */}
      <CompactModuleSummary items={[{label:'Incidentes',value:incidents ? totalCount : null},{label:'Críticos',value:incidents ? criticalCount : null},{label:'En gestión',value:incidents ? inProgressCount : null},{label:'Resueltos',value:incidents ? resolvedCount : null}]} />

      {/* 3. TOOLBAR: Omnibar Search + Priority Chips + Status Pills + Dual View */}
      <NOCToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por título, servicio afectado, responsable o descripción..."
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        categoryLabel="Prioridad:"
        categories={[
          { id: 'all', label: 'Todas' },
          { id: 'critical', label: 'Crítica' },
          { id: 'high', label: 'Alta' },
          { id: 'medium', label: 'Media' },
          { id: 'low', label: 'Baja' },
        ]}
        selectedCategory={priorityFilter}
        onCategoryChange={setPriorityFilter}
        statusPills={[
          { id: 'all', label: 'Todos', count: totalCount, variant: 'all' },
          { id: 'active', label: 'Activos', count: allIncidents.filter(i=>!['resolved','closed'].includes(i.status)).length, variant: 'warning' },
          {
            id: 'open',
            label: 'Abiertos',
            count: allIncidents.filter((i: Incident) => i.status === 'open').length,
            variant: 'danger',
          },
          {
            id: 'investigating',
            label: 'Investigando',
            count: allIncidents.filter((i: Incident) => i.status === 'investigating').length,
            variant: 'warning',
          },
          {
            id: 'identified',
            label: 'Identificados',
            count: allIncidents.filter((i: Incident) => i.status === 'identified').length,
            variant: 'info',
          },
          {
            id: 'mitigated',
            label: 'Mitigados',
            count: allIncidents.filter((i: Incident) => i.status === 'mitigated').length,
            variant: 'info',
          },
          {
            id: 'resolved',
            label: 'Resueltos',
            count: allIncidents.filter((i: Incident) => i.status === 'resolved').length,
            variant: 'success',
          },
          {
            id: 'closed',
            label: 'Cerrados',
            count: allIncidents.filter((i: Incident) => i.status === 'closed').length,
            variant: 'neutral',
          },
        ]}
        selectedStatus={statusFilter}
        onStatusChange={setStatusFilter}
      />

      {/* 4. FLOATING BULK ACTIONS BAR (Atomic & Fast) */}
      <NOCBulkActionBar
        selectedCount={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        itemLabel="incidentes"
        actions={
          <>

            <AdminButton capability="incidents.resolve"
              type="button"
              onClick={() => handleBulkAction('resolve')}
              disabled={bulkProcessing}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-accent-green text-black font-semibold rounded-full text-xs hover:bg-accent-green/90 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 size={13} />
              Resolver
            </AdminButton>
            <AdminButton capability="incidents.update"
              type="button"
              onClick={() => handleBulkAction('mitigate')}
              disabled={bulkProcessing}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-500 text-black font-semibold rounded-full text-xs hover:bg-teal-400 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <ShieldAlert size={13} />
              Mitigar
            </AdminButton>
            <AdminButton capability="incidents.resolve"
              type="button"
              onClick={() => handleBulkAction('close')}
              disabled={bulkProcessing}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-bg-card border border-border-base text-text-muted hover:text-text-main font-semibold rounded-full text-xs transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <XCircle size={13} />
              Cerrar
            </AdminButton>
            <AdminButton capability="incidents.delete"
              type="button"
              onClick={() => handleBulkAction('delete')}
              disabled={bulkProcessing}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-accent-red text-white font-semibold rounded-full text-xs hover:bg-accent-red/90 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Trash2 size={13} />
              {bulkProcessing ? 'Eliminando...' : 'Eliminar'}
            </AdminButton>
          </>
        }
      />

      {/* 5. MAIN CONTENT: DUAL VIEW (GRID OR TABLE) */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-accent-green" size={32} />
        </div>
      ) : filteredIncidents && filteredIncidents.length > 0 ? (
        viewMode === 'grid' ? (
          /* Grid View (Cards) */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredIncidents.map((incident: Incident) => (
              <IncidentCard
                key={incident.id}
                incident={incident}
                isSelected={selectedIds.includes(incident.id)}
                onToggleSelect={() => handleToggleSelect(incident.id)}
                onClick={() => setSelectedIncident(incident)}
                onEdit={(e) => handleOpenEdit(incident, e)}
                onDelete={(e) => {
                  e.stopPropagation();
                  setDeleteTarget(incident);
                }}
              />
            ))}
          </div>
        ) : (
          /* Table View */
          <IncidentTableView
            incidents={filteredIncidents}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAllToggle}
            onRowClick={(incident) => setSelectedIncident(incident)}
            onEdit={(e, incident) => handleOpenEdit(incident, e)}
            onDelete={(e, incident) => {
              e.stopPropagation();
              setDeleteTarget(incident);
            }}
          />
        )
      ) : (
        <EmptyState capability="incidents.create"
          icon={AlertOctagon}
          title={
            searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
              ? 'No se encontraron incidentes con los filtros aplicados'
              : 'No hay incidentes operativos reportados'
          }
          description={
            searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
              ? 'Prueba a cambiar los términos de búsqueda o limpiar los filtros seleccionados.'
              : 'El sistema no registra incidentes en curso. Todos los servicios funcionan normalmente.'
          }
          actionLabel={
            searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
              ? 'Limpiar Filtros'
              : 'Nuevo Incidente'
          }
          onAction={() => {
            if (searchTerm || statusFilter !== 'all' || priorityFilter !== 'all') {
              setSearchTerm('');
              setStatusFilter('all');
              setPriorityFilter('all');
            } else {
              handleOpenCreate();
            }
          }}
        />
      )}

      {/* 6. SLIDE-OVER DETAIL DRAWER (Zero Context Loss with NOCDrawer) */}
      <NOCDrawer
        isOpen={!!selectedIncident}
        onClose={() => setSelectedIncident(null)}
        title={selectedIncident?.title || ''}
        subtitle={
          selectedIncident && (
            <p className="text-xs text-text-muted">
              {selectedIncident.description || 'Sin descripción adicional.'}
            </p>
          )
        }
        statusBadge={
          selectedIncident && (
            <div className="flex items-center gap-2">
              <PriorityBadge priority={selectedIncident.priority} />
              <StatusBadge status={selectedIncident.status} />
            </div>
          )
        }
        quickKpis={
          selectedIncident && (
            <div className="space-y-3">
              {/* Stepper Flow Bar */}
              <div className="bg-bg-dark/90 border border-border-base rounded-2xl p-3.5">
                <div className="text-xs font-semibold text-text-dim mb-2.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Activity size={13} className="text-accent-green" />
                    Controlador del Ciclo de Vida del Incidente
                  </span>
                  {selectedIncident.duration_minutes > 0 && (
                    <span className="font-mono text-sky-400 text-xs">
                      Duración: {selectedIncident.duration_minutes}m
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {LIFECYCLE_STEPS.map((step, idx) => {
                    const Icon = step.icon;
                    const isCurrent = step.status === selectedIncident.status;
                    const isPast = idx <= currentStepIndex;

                    return (
                      <button
                        key={step.status}
                        type="button"
                        onClick={() => handleStatusChange(step.status)}
                        disabled={updateMutation.isPending}
                        className={`p-2 rounded-xl border text-xs font-medium flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-accent-green/15 border-accent-green text-accent-green shadow-sm font-semibold'
                            : isPast
                            ? 'bg-bg-card border-border-base text-text-main hover:border-accent-green/50'
                            : 'bg-bg-dark border-border-base/50 text-text-dim hover:text-text-muted'
                        }`}
                      >
                        <Icon
                          size={14}
                          className={isCurrent ? 'text-accent-green' : 'text-text-dim'}
                        />
                        <span className="truncate w-full text-center">{step.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Info Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-sans">
                <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                  <div className="text-xs text-text-dim">Apertura</div>
                  <div className="text-xs font-bold font-mono text-text-main mt-0.5 truncate">
                    {new Date(selectedIncident.opened_at).toLocaleDateString('es-ES')}
                  </div>
                </div>
                <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                  <div className="text-xs text-text-dim">Responsable</div>
                  <div className="text-xs font-bold text-sky-400 mt-0.5 truncate">
                    {selectedIncident.assigned_to_name || 'Sin asignar'}
                  </div>
                </div>
                <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                  <div className="text-xs text-text-dim">Servicio</div>
                  <div className="text-xs font-bold text-text-main mt-0.5 truncate flex items-center gap-1">
                    {getModuleIcon(selectedIncident.target_type)}
                    <span>{selectedIncident.impacted_service || 'General'}</span>
                  </div>
                </div>
                <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                  <div className="text-xs text-text-dim">Alertas</div>
                  <div className="text-base font-bold font-mono text-accent-green mt-0.5">
                    {selectedIncident.alerts_count}
                  </div>
                </div>
              </div>
            </div>
          )
        }
        tabs={[
          { id: 'timeline', label: 'Ciclo & Bitácora', icon: <Clock size={13} /> },
          { id: 'rca', label: 'Causa Raíz (RCA)', icon: <FileText size={13} /> },
          {
            id: 'alerts',
            label: `Alertas (${selectedIncident?.alerts_count || 0})`,
            icon: <Bell size={13} />,
          },
          { id: 'details', label: 'Asignación & SLA', icon: <UserCheck size={13} /> },
        ]}
        activeTab={drawerTab}
        onTabChange={(t) => setDrawerTab(t as typeof drawerTab)}
        footerActions={
          selectedIncident && (
            <>
              <AdminButton capability="incidents.update"
                type="button"
                onClick={() => handleOpenEdit(selectedIncident)}
                className="flex items-center gap-1.5 px-4 py-2 border border-border-base text-text-muted hover:text-text-main hover:bg-bg-dark rounded-full text-xs font-semibold transition-colors cursor-pointer"
              >
                <Pencil size={14} />
                Editar Incidente
              </AdminButton>
              <AdminButton capability="incidents.delete"
                type="button"
                onClick={() => setDeleteTarget(selectedIncident)}
                className="flex items-center gap-1.5 px-4 py-2 bg-accent-red/10 border border-accent-red/30 text-accent-red hover:bg-accent-red hover:text-white rounded-full text-xs font-semibold transition-colors cursor-pointer"
              >
                <Trash2 size={14} />
                Eliminar Incidente
              </AdminButton>
            </>
          )
        }
        maxWidthClass="max-w-2xl"
      >
        {/* Tab 1: Timeline & Bitácora */}
        {selectedIncident && drawerTab === 'timeline' && (
          <div className="space-y-5">
            {/* Add Note Form */}
            <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4">
              <h4 className="text-xs font-semibold text-text-muted mb-2.5 flex items-center gap-1.5">
                <MessageSquare size={14} className="text-accent-green" />
                Agregar Nota de Bitácora / Avance Operativo
              </h4>
              <form onSubmit={handleAddNote} className="space-y-2.5">
                <textarea
                  rows={2}
                  required
                  placeholder="Escribe un avance técnico, mitigación realizada o diagnóstico..."
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  className="w-full bg-bg-card border border-border-base rounded-xl px-3 py-2 text-xs text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-sans resize-none"
                />
                <AdminButton capability="incidents.update"
                  type="submit"
                  disabled={addNoteMutation.isPending || !noteInput.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-accent-green text-black font-semibold rounded-full text-xs hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
                >
                  {addNoteMutation.isPending ? (
                    <Loader2 className="animate-spin" size={13} />
                  ) : (
                    <Check size={13} />
                  )}
                  Publicar en Línea de Tiempo
                </AdminButton>
              </form>
            </div>

            {/* Timeline View */}
            {isLoadingTimeline ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="animate-spin text-accent-green" size={26} />
              </div>
            ) : (
              <TimelineView events={timelineEvents || []} />
            )}
          </div>
        )}

        {/* Tab 2: Root Cause Analysis (RCA) & Post-Mortem */}
        {selectedIncident && drawerTab === 'rca' && (
          <div className="space-y-5">
            <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                  <FileText size={15} className="text-purple-400" />
                  Post-Mortem & Análisis de Causa Raíz (RCA)
                </h4>
                {selectedIncident.root_cause && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30">
                    RCA Registrado
                  </span>
                )}
              </div>
              <p className="text-xs text-text-dim mb-4 leading-relaxed">
                Documenta la causa raíz técnica del problema, el resumen de las acciones de
                mitigación ejecutadas y los compromisos preventivos para evitar recurrencias.
              </p>

              <form onSubmit={handleSaveRca} className="space-y-4 text-xs">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    Causa Raíz Identificada (Root Cause)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="ej. Saturación de pool de conexiones JDBC por consulta lenta no indexada..."
                    value={rcaRootCause}
                    onChange={(e) => setRcaRootCause(e.target.value)}
                    className="w-full bg-bg-card border border-border-base rounded-xl px-3.5 py-2.5 text-xs text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-sans resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    Resumen de Resolución & Acciones de Mitigación
                  </label>
                  <textarea
                    rows={3}
                    placeholder="ej. Se reinició el microservicio, se aplicó índice temporal y se aumentó el pool..."
                    value={rcaResolutionSummary}
                    onChange={(e) => setRcaResolutionSummary(e.target.value)}
                    className="w-full bg-bg-card border border-border-base rounded-xl px-3.5 py-2.5 text-xs text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-sans resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    Acciones Preventivas & Mejoras Futuras
                  </label>
                  <textarea
                    rows={3}
                    placeholder="ej. Agregar alerta de umbral al 80% del pool, revisión de queries en sprint siguiente..."
                    value={rcaPreventiveActions}
                    onChange={(e) => setRcaPreventiveActions(e.target.value)}
                    className="w-full bg-bg-card border border-border-base rounded-xl px-3.5 py-2.5 text-xs text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-sans resize-none"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <AdminButton capability="incidents.update"
                    type="submit"
                    disabled={rcaMutation.isPending}
                    className="flex items-center gap-1.5 px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-full text-xs transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    {rcaMutation.isPending ? (
                      <Loader2 className="animate-spin" size={13} />
                    ) : (
                      <Check size={13} />
                    )}
                    Guardar Análisis RCA
                  </AdminButton>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tab 3: Linked Alerts */}
        {selectedIncident && drawerTab === 'alerts' && (
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-text-muted">
              Alertas del Sistema Vinculadas a este Incidente
            </h4>
            {linkedAlerts && linkedAlerts.length > 0 ? (
              <div className="space-y-2.5">
                {linkedAlerts.map((la: IncidentAlert) => (
                  <div
                    key={la.id}
                    className="p-4 bg-bg-dark/80 border border-border-base rounded-2xl flex items-center justify-between text-xs gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0 mt-0.5">
                        <Bell size={15} />
                      </div>
                      <div>
                        <span className="font-bold text-text-main text-sm block">
                          {la.alert_title}
                        </span>
                        <p className="text-xs text-text-dim mt-1 font-mono">
                          Vinculada el: {new Date(la.added_at).toLocaleString('es-ES')}
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-accent-green/10 text-accent-green border border-accent-green/30 shrink-0">
                      Activa
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-bg-dark/50 border border-border-base rounded-2xl p-8 text-center">
                <Bell size={24} className="text-text-dim mx-auto mb-2 opacity-50" />
                <p className="text-text-dim text-xs">
                  No hay alertas del sistema vinculadas a este incidente.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Details, Assignee & SLA */}
        {selectedIncident && drawerTab === 'details' && (
          <div className="space-y-5 text-xs font-sans">
            {/* Operator & Squad Assignment Card */}
            <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4 space-y-4">
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                  <UserCheck size={15} className="text-sky-400" />
                  Asignación de Responsables (Operador & Cuadrilla)
                </h4>
                <p className="text-xs text-text-dim">
                  Asigna el incidente a un miembro del equipo de guardia y/o a una cuadrilla especializada para resolución y seguimiento.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1 flex items-center gap-1">
                    <User size={12} className="text-sky-400" /> Operador Asignado:
                  </label>
                  <MemberPicker value={assigneeState} onChange={setAssigneeState} />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1 flex items-center gap-1">
                    <Layers size={12} className="text-accent-purple" /> Cuadrilla / Equipo:
                  </label>
                  <select
                    value={teamAssigneeState}
                    onChange={(e) => setTeamAssigneeState(e.target.value)}
                    className="w-full bg-bg-card border border-border-base rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:border-accent-green font-sans cursor-pointer"
                  >
                    <option value="">-- Sin equipo asignado --</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <AdminButton capability="incidents.update"
                  type="button"
                  onClick={handleSaveAssignee}
                  disabled={assignMutation.isPending}
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-black font-semibold rounded-full text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {assignMutation.isPending ? (
                    <Loader2 className="animate-spin" size={13} />
                  ) : (
                    <Check size={13} />
                  )}
                  Guardar Asignaciones
                </AdminButton>
              </div>
            </div>

            {/* Impacted Service & 1-Click Jump */}
            <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                <Server size={15} className="text-emerald-400" />
                Servicio o Activo Afectado
              </h4>
              <div className="flex items-center justify-between p-3 bg-bg-card rounded-xl border border-border-base/50">
                <div className="flex items-center gap-2.5">
                  {getModuleIcon(selectedIncident.target_type)}
                  <div>
                    <span className="font-semibold text-text-main block">
                      {selectedIncident.impacted_service || 'Infraestructura General'}
                    </span>
                    <span className="text-xs text-text-dim">
                      Módulo: {selectedIncident.target_type || 'General'}
                    </span>
                  </div>
                </div>

                {getModuleRoute(selectedIncident.target_type) && (
                  <button
                    type="button"
                    onClick={() => {
                      const route = getModuleRoute(selectedIncident.target_type);
                      if (route) navigate(route);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-dark hover:bg-accent-green/10 border border-border-base hover:border-accent-green/40 text-text-muted hover:text-accent-green rounded-full text-xs font-medium transition-colors cursor-pointer"
                  >
                    <span>Ir al Módulo</span>
                    <ExternalLink size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* SLA & Milestone Chronology */}
            <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                <Clock size={15} className="text-sky-400" />
                Hitos Cronológicos & SLA
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-xs">
                <div className="p-3 bg-bg-card rounded-xl border border-border-base/50">
                  <span className="text-text-dim block text-xs font-sans">
                    Fecha de Apertura:
                  </span>
                  <span className="text-text-main font-semibold mt-1 block">
                    {new Date(selectedIncident.opened_at).toLocaleString('es-ES')}
                  </span>
                </div>
                <div className="p-3 bg-bg-card rounded-xl border border-border-base/50">
                  <span className="text-text-dim block text-xs font-sans">
                    Reconocido (MTTA):
                  </span>
                  <span className="text-accent-cyan font-semibold mt-1 block">
                    {selectedIncident.acknowledged_at
                      ? new Date(selectedIncident.acknowledged_at).toLocaleString('es-ES')
                      : 'Pendiente de toma de posesión'}
                  </span>
                </div>
                <div className="p-3 bg-bg-card rounded-xl border border-border-base/50">
                  <span className="text-text-dim block text-xs font-sans">
                    Mitigación Aplicada:
                  </span>
                  <span className="text-teal-400 font-semibold mt-1 block">
                    {selectedIncident.mitigated_at
                      ? new Date(selectedIncident.mitigated_at).toLocaleString('es-ES')
                      : 'En curso / Sin confirmar'}
                  </span>
                </div>
                <div className="p-3 bg-bg-card rounded-xl border border-border-base/50">
                  <span className="text-text-dim block text-xs font-sans">
                    Resolución Final (MTTR):
                  </span>
                  <span className="text-accent-green font-semibold mt-1 block">
                    {selectedIncident.resolved_at
                      ? new Date(selectedIncident.resolved_at).toLocaleString('es-ES')
                      : selectedIncident.closed_at
                      ? new Date(selectedIncident.closed_at).toLocaleString('es-ES')
                      : 'Incidente Activo'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </NOCDrawer>

      {/* 7. CREATE / EDIT FORM MODAL */}
      {showForm && (
        <IncidentForm
          incident={editingIncident}
          onSubmit={handleFormSubmit}
          onClose={() => {
            setShowForm(false);
            setEditingIncident(null);
          }}
        />
      )}

      {/* 8. DELETE CONFIRMATION MODAL */}
      <ConfirmDelete
        isOpen={!!deleteTarget}
        itemName={deleteTarget?.title || 'este incidente'}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
