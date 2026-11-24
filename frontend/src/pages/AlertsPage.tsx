import { useAlertsWorkspace } from './workspaces/useAlertsWorkspace';
import CompactModuleSummary from '../components/common/CompactModuleSummary';
import AdminButton from '../components/common/AdminButton';
import type { AlertSeverity, AlertStatus } from '../types/alerts';
import EmptyState from '../components/common/EmptyState';
import ConfirmDelete from '../components/common/ConfirmDelete';
import AlertRuleForm from '../components/alerts/AlertRuleForm';
import AlertRuleTableView from '../components/alerts/AlertRuleTableView';
import AlertTableView from '../components/alerts/AlertTableView';
import AlertCardsView from '../components/alerts/AlertCardsView';
import AlertRuleCardsView from '../components/alerts/AlertRuleCardsView';
import AlertInspectionDrawer from '../components/alerts/AlertInspectionDrawer';
import AlertSnoozeModal from '../components/alerts/AlertSnoozeModal';
import {
  NOCPageHeader,
  NOCToolbar,
  NOCBulkActionBar,
} from '../components/common/noc';
import {
  Bell,
  Plus,
  Loader2,
  Trash2,
  RefreshCw,
  Sliders,
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  CheckCheck,
  CheckSquare,
  Square,
  Info,
  X,
  Download,
  Moon,
  Eye,
} from 'lucide-react';

type MainTab = 'alerts' | 'rules';
type FilterStatus = 'all' | AlertStatus;
type FilterSeverity = 'all' | AlertSeverity;

export default function AlertsPage() {
  const {
    navigate,
    setSearchParams,
    targetIdFilter,
    activeTab,
    setActiveTab,
    showRuleModal,
    editingRule,
    deleteTarget,
    setDeleteTarget,
    viewMode,
    setViewMode,
    selectedAlert,
    setSelectedAlert,
    drawerTab,
    setDrawerTab,
    selectedAlertIds,
    setSelectedAlertIds,
    snoozeTarget,
    setSnoozeTarget,
    snoozeMinutes,
    setSnoozeMinutes,
    statusFilter,
    setStatusFilter,
    severityFilter,
    setSeverityFilter,
    searchTerm,
    setSearchTerm,
    actionNotification,
    setActionNotification,
    autoRefresh,
    rules,
    isLoadingRules,
    stats,
    isLoadingAlerts,
    getModuleRoute,
    getModuleName,
    deleteRuleMutation,
    updateAlertStatusMutation,
    acknowledgeAllMutation,
    resolveAllMutation,
    createIncidentMutation,
    evaluateMutation,
    snoozeAlertMutation,
    snoozeRuleMutation,
    bulkActionMutation,
    handleOpenCreateRule,
    handleOpenEditRule,
    handleCloseRuleModal,
    handleRuleSubmit,
    filteredAlerts,
    filteredRules,
    handleToggleSelectAlert,
    handleSelectAllVisible,
    handleExportCSV,
    handleConfirmSnooze,
    totalAlertsCount,
    isItemSnoozed,
  } = useAlertsWorkspace();

  return (
    <div className="compact-workspace space-y-6 animate-in fade-in duration-300 font-sans">
      {/* 1. TOP HEADER (Standard NOC Header) */}
      <NOCPageHeader
        queryKeys={["alerts-list", "alerts-stats", "alert-rules"]}
        title="Centro de Alertas Inteligentes & Umbrales"
        badgeText="SMART ALERTS RADAR"
        description="Deduplicación inteligente, anti-flapping, mitigación de fatiga (snooze), simulación previa y enlace directo a módulos."
        icon={<Bell size={26} />}
        autoRefresh={{
          enabled: autoRefresh.enabled,
          countdown: autoRefresh.countdown,
          onToggle: autoRefresh.toggle,
        }}
        actions={
          <>
            <AdminButton
              capability="alerts.evaluate"
              type="button"
              onClick={() => evaluateMutation.mutate()}
              disabled={evaluateMutation.isPending}
              className="flex items-center gap-2 bg-accent-green/10 border border-accent-green/40 text-accent-green font-medium px-4 py-2 rounded-full text-sm hover:bg-accent-green/20 transition-all disabled:opacity-50 cursor-pointer"
              title="Ejecutar evaluación de reglas inmediatamente"
            >
              <RefreshCw
                size={15}
                className={evaluateMutation.isPending ? 'animate-spin' : ''}
              />
              <span>
                {evaluateMutation.isPending ? 'Evaluando...' : 'Evaluar Reglas Ahora'}
              </span>
            </AdminButton>
            {activeTab === 'rules' && (
              <AdminButton
                capability="alerts.create"
                type="button"
                onClick={handleOpenCreateRule}
                className="flex items-center gap-2 bg-accent-green text-black font-semibold px-5 py-2 rounded-full text-sm hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20 cursor-pointer"
              >
                <Plus size={16} />
                Nueva Regla
              </AdminButton>
            )}
          </>
        }
      />

      {/* Action Notification Banner */}
      {actionNotification && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs font-sans animate-in fade-in slide-in-from-top-2 duration-200 ${
            actionNotification.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : actionNotification.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              : 'bg-sky-500/10 border-sky-500/30 text-sky-400'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {actionNotification.type === 'success' && (
              <CheckCircle2 size={16} className="shrink-0" />
            )}
            {actionNotification.type === 'error' && (
              <AlertTriangle size={16} className="shrink-0" />
            )}
            {actionNotification.type === 'info' && <Info size={16} className="shrink-0" />}
            <span className="font-medium">{actionNotification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotification(null)}
            className="p-1 hover:bg-white/10 rounded-full transition-colors text-text-dim hover:text-text-main cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 2. NOC COMMAND CENTER: KPI STRIP */}
      <CompactModuleSummary
        items={[
          { label: 'Críticas activas', value: stats?.active_critical ?? null },
          { label: 'Advertencias activas', value: stats?.active_warning ?? null },
          { label: 'Reconocidas', value: stats?.acknowledged ?? null },
          { label: 'Resueltas', value: stats?.resolved ?? null },
        ]}
      />

      {/* 3. TOOLBAR: Omnibar Search + View Mode Switcher + Main Tab Switcher + Status Pills */}
      <NOCToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={
          activeTab === 'alerts'
            ? 'Buscar por título, mensaje o módulo (SSL, DNS, API, WHOIS)...'
            : 'Buscar por nombre de regla o métrica...'
        }
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        categoryLabel="Vista:"
        categories={[
          { id: 'alerts', label: 'Alertas Activas & Historial' },
          { id: 'rules', label: `Reglas de Umbral (${rules?.length || 0})` },
        ]}
        selectedCategory={activeTab}
        onCategoryChange={(c) => setActiveTab(c as MainTab)}
        statusPills={
          activeTab === 'alerts'
            ? [
                { id: 'all', label: 'Todos', count: totalAlertsCount, variant: 'all' },
                { id: 'unresolved', label: 'Sin resolver', variant: 'warning' },
                {
                  id: 'active',
                  label: 'Activas',
                  count: stats?.total_active || 0,
                  variant: 'danger',
                },
                {
                  id: 'acknowledged',
                  label: 'Reconocidas',
                  count: stats?.acknowledged || 0,
                  variant: 'warning',
                },
                {
                  id: 'resolved',
                  label: 'Resueltas',
                  count: stats?.resolved || 0,
                  variant: 'success',
                },
              ]
            : undefined
        }
        selectedStatus={statusFilter}
        onStatusChange={(st) => setStatusFilter(st as FilterStatus)}
      />

      {targetIdFilter && activeTab === 'alerts' && (
        <div className="flex items-center gap-2 text-xs text-text-muted rounded-xl border border-border-accent bg-bg-card px-3 py-2">
          <Bell size={14} className="text-accent-yellow" />
          <span>Alertas del target seleccionado</span>
          <button
            type="button"
            onClick={() => setSearchParams({})}
            className="ml-auto text-accent-cyan hover:text-text-main"
          >
            Quitar filtro
          </button>
        </div>
      )}

      {/* 4. SUB-ACTIONS BAR FOR ALERTS */}
      {activeTab === 'alerts' && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-bg-card border border-border-base/70 p-3.5 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* Multi-select all checkbox */}
            {filteredAlerts.length > 0 && (
              <button
                type="button"
                onClick={handleSelectAllVisible}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-border-base bg-bg-dark text-text-dim hover:text-text-main transition-colors mr-1 cursor-pointer"
                title="Seleccionar todas las alertas visibles"
              >
                {selectedAlertIds.length === filteredAlerts.length && filteredAlerts.length > 0 ? (
                  <CheckSquare size={14} className="text-accent-green" />
                ) : (
                  <Square size={14} />
                )}
                <span>
                  {selectedAlertIds.length === filteredAlerts.length && filteredAlerts.length > 0
                    ? 'Deseleccionar'
                    : 'Seleccionar Todo'}
                </span>
              </button>
            )}

            <span className="text-text-dim text-xs font-semibold mr-1">Severidad:</span>
            {(['all', 'critical', 'warning', 'info'] as FilterSeverity[]).map((sv) => (
              <button
                key={sv}
                type="button"
                onClick={() => setSeverityFilter(sv)}
                className={`px-3 py-1 rounded-full border text-xs capitalize transition-all cursor-pointer ${
                  severityFilter === sv
                    ? 'bg-accent-green/10 border-accent-green/40 text-accent-green font-semibold'
                    : 'bg-bg-dark border-border-base/60 text-text-muted hover:text-text-main'
                }`}
              >
                {sv === 'all'
                  ? 'Todas'
                  : sv === 'critical'
                  ? 'Crítica'
                  : sv === 'warning'
                  ? 'Advertencia'
                  : 'Informativa'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Export CSV Button */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-border-base bg-bg-dark text-text-muted hover:text-accent-green text-xs font-medium transition-colors cursor-pointer"
              title="Descargar inventario de alertas en CSV (UTF-8 BOM)"
            >
              <Download size={14} />
              <span>Exportar CSV</span>
            </button>

            {/* Acknowledge All */}
            <AdminButton
              capability="alerts.acknowledge"
              type="button"
              onClick={() => acknowledgeAllMutation.mutate()}
              disabled={acknowledgeAllMutation.isPending || !stats?.total_active}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-border-base bg-bg-dark text-text-muted hover:text-text-main text-xs font-medium transition-colors disabled:opacity-40 cursor-pointer"
              title="Marcar todas las alertas activas como reconocidas"
            >
              <CheckCheck size={14} className="text-accent-yellow" />
              Reconocer Todas
            </AdminButton>

            {/* Resolve All */}
            <AdminButton
              capability="alerts.resolve"
              type="button"
              onClick={() => resolveAllMutation.mutate()}
              disabled={
                resolveAllMutation.isPending || (!stats?.total_active && !stats?.acknowledged)
              }
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-border-base bg-bg-dark text-text-muted hover:text-accent-green text-xs font-medium transition-colors disabled:opacity-40 cursor-pointer"
              title="Marcar todas las alertas como resueltas"
            >
              <CheckSquare size={14} className="text-accent-green" />
              Resolver Todas
            </AdminButton>
          </div>
        </div>
      )}

      {/* 5. NOC BULK ACTION BAR */}
      <NOCBulkActionBar
        selectedCount={selectedAlertIds.length}
        itemLabel="alertas"
        onClearSelection={() => setSelectedAlertIds([])}
        actions={
          <>
            <AdminButton
              capability="alerts.acknowledge"
              type="button"
              onClick={() =>
                bulkActionMutation.mutate({
                  action: 'acknowledge',
                  alert_ids: selectedAlertIds,
                })
              }
              disabled={bulkActionMutation.isPending}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-accent-yellow/15 border border-accent-yellow/40 text-accent-yellow hover:bg-accent-yellow/25 rounded-full text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
            >
              <Eye size={13} />
              Reconocer en Lote
            </AdminButton>

            <AdminButton
              capability="alerts.resolve"
              type="button"
              onClick={() =>
                bulkActionMutation.mutate({
                  action: 'resolve',
                  alert_ids: selectedAlertIds,
                })
              }
              disabled={bulkActionMutation.isPending}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-accent-green/15 border border-accent-green/40 text-accent-green hover:bg-accent-green/25 rounded-full text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle size={13} />
              Resolver en Lote
            </AdminButton>

            <AdminButton
              capability="alerts.snooze"
              type="button"
              onClick={() =>
                setSnoozeTarget({
                  type: 'bulk',
                  name: `${selectedAlertIds.length} alertas seleccionadas`,
                })
              }
              disabled={bulkActionMutation.isPending}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500/15 border border-amber-500/40 text-amber-400 hover:bg-amber-500/25 rounded-full text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
            >
              <Moon size={13} />
              Silenciar en Lote
            </AdminButton>

            <AdminButton
              capability="alerts.delete"
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    `¿Estás seguro de eliminar permanentemente ${selectedAlertIds.length} alertas seleccionadas?`
                  )
                ) {
                  bulkActionMutation.mutate({
                    action: 'delete',
                    alert_ids: selectedAlertIds,
                  });
                }
              }}
              disabled={bulkActionMutation.isPending}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-500/15 border border-rose-500/40 text-rose-400 hover:bg-rose-500/25 rounded-full text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
            >
              <Trash2 size={13} />
              Eliminar
            </AdminButton>
          </>
        }
      />

      {/* 6. MAIN CONTENT: DUAL VIEW MODE (CARDS vs TABLE) */}
      {activeTab === 'alerts' ? (
        isLoadingAlerts ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-accent-green" size={32} />
          </div>
        ) : filteredAlerts && filteredAlerts.length > 0 ? (
          viewMode === 'grid' ? (
            <AlertCardsView
              alerts={filteredAlerts}
              selectedAlertIds={selectedAlertIds}
              isItemSnoozed={isItemSnoozed}
              getModuleName={getModuleName}
              getModuleRoute={getModuleRoute}
              onSelectAlert={setSelectedAlert}
              onToggleSelectAlert={handleToggleSelectAlert}
              onNavigate={navigate}
              onSnooze={(alert) =>
                setSnoozeTarget({
                  type: 'alert',
                  id: alert.id,
                  name: alert.title,
                  isCurrentlySnoozed: isItemSnoozed(alert.snoozed_until),
                })
              }
              onCreateIncident={(id) => createIncidentMutation.mutate(id)}
              isCreatingIncident={createIncidentMutation.isPending}
              onUpdateStatus={(id, status) =>
                updateAlertStatusMutation.mutate({ id, status })
              }
            />
          ) : (
            <AlertTableView
              alerts={filteredAlerts}
              selectedIds={selectedAlertIds}
              onToggleSelect={handleToggleSelectAlert}
              onSelectAll={handleSelectAllVisible}
              onSelectAlert={setSelectedAlert}
              onSnooze={(alert, e) => {
                e.stopPropagation();
                setSnoozeTarget({
                  type: 'alert',
                  id: alert.id,
                  name: alert.title,
                  isCurrentlySnoozed: isItemSnoozed(alert.snoozed_until),
                });
              }}
              onCreateIncident={(id, e) => {
                e.stopPropagation();
                createIncidentMutation.mutate(id);
              }}
              onAcknowledge={(id, e) => {
                e.stopPropagation();
                updateAlertStatusMutation.mutate({ id, status: 'acknowledged' });
              }}
              onResolve={(id, e) => {
                e.stopPropagation();
                updateAlertStatusMutation.mutate({ id, status: 'resolved' });
              }}
              isCreatingIncident={createIncidentMutation.isPending}
            />
          )
        ) : (
          <EmptyState
            capability="alerts.create"
            icon={Bell}
            title={
              searchTerm || statusFilter !== 'all' || severityFilter !== 'all'
                ? 'No se encontraron alertas con los filtros aplicados'
                : 'No hay alertas activas en el sistema'
            }
            description={
              searchTerm || statusFilter !== 'all' || severityFilter !== 'all'
                ? 'Prueba a cambiar el término de búsqueda o restablecer los filtros de estado y severidad.'
                : 'Todos los servicios operan dentro de los umbrales normales sin infracciones reportadas.'
            }
            actionLabel={
              searchTerm || statusFilter !== 'all' || severityFilter !== 'all'
                ? 'Limpiar Filtros'
                : 'Evaluar Reglas Ahora'
            }
            onAction={() => {
              if (searchTerm || statusFilter !== 'all' || severityFilter !== 'all') {
                setSearchTerm('');
                setStatusFilter('all');
                setSeverityFilter('all');
              } else {
                evaluateMutation.mutate();
              }
            }}
          />
        )
      ) : (
        /* RULES TAB */
        isLoadingRules ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-accent-green" size={32} />
          </div>
        ) : filteredRules && filteredRules.length > 0 ? (
          viewMode === 'grid' ? (
            <AlertRuleCardsView
              rules={filteredRules}
              isItemSnoozed={isItemSnoozed}
              getModuleName={getModuleName}
              onSnooze={(rule) =>
                setSnoozeTarget({
                  type: 'rule',
                  id: rule.id,
                  name: rule.name,
                  isCurrentlySnoozed: isItemSnoozed(rule.snoozed_until),
                })
              }
              onEdit={handleOpenEditRule}
              onDelete={setDeleteTarget}
            />
          ) : (
            <AlertRuleTableView
              rules={filteredRules}
              onEdit={handleOpenEditRule}
              onDelete={setDeleteTarget}
              onSnooze={(rule) =>
                setSnoozeTarget({
                  type: 'rule',
                  id: rule.id,
                  name: rule.name,
                  isCurrentlySnoozed: isItemSnoozed(rule.snoozed_until),
                })
              }
            />
          )
        ) : (
          <EmptyState
            capability="alerts.create"
            icon={Sliders}
            title={
              searchTerm
                ? 'No se encontraron reglas con los términos de búsqueda'
                : 'No hay reglas de alerta configuradas'
            }
            description={
              searchTerm
                ? 'Prueba a cambiar el término de búsqueda para ver las reglas configuradas.'
                : 'Define condiciones y umbrales automáticos para ser notificado de incidentes por Email, Telegram o Webhook.'
            }
            actionLabel={searchTerm ? 'Limpiar Filtro' : 'Crear Primera Regla'}
            onAction={() => {
              if (searchTerm) {
                setSearchTerm('');
              } else {
                handleOpenCreateRule();
              }
            }}
          />
        )
      )}

      {/* 7. SLIDE-OVER NOCDRAWER FOR ALERT INSPECTION */}
      <AlertInspectionDrawer
        alert={selectedAlert}
        activeTab={drawerTab}
        onTabChange={setDrawerTab}
        onClose={() => setSelectedAlert(null)}
        getModuleName={getModuleName}
        getModuleRoute={getModuleRoute}
        onNavigate={navigate}
        isItemSnoozed={isItemSnoozed}
        onCreateIncident={(id) => createIncidentMutation.mutate(id)}
        isCreatingIncident={createIncidentMutation.isPending}
        onSnoozeAlert={(id, minutes) =>
          snoozeAlertMutation.mutate({ id, minutes })
        }
        isSnoozing={snoozeAlertMutation.isPending}
        onUpdateStatus={(id, status) =>
          updateAlertStatusMutation.mutate({ id, status })
        }
        isUpdatingStatus={updateAlertStatusMutation.isPending}
      />

      {/* 8. SNOOZE MODAL DIALOG */}
      <AlertSnoozeModal
        target={snoozeTarget}
        snoozeMinutes={snoozeMinutes}
        onSetSnoozeMinutes={setSnoozeMinutes}
        onConfirm={handleConfirmSnooze}
        onRemoveSnooze={() => {
          setSnoozeMinutes(0);
          if (snoozeTarget?.type === 'alert' && snoozeTarget.id) {
            snoozeAlertMutation.mutate({ id: snoozeTarget.id, minutes: 0 });
          } else if (snoozeTarget?.type === 'rule' && snoozeTarget.id) {
            snoozeRuleMutation.mutate({ id: snoozeTarget.id, minutes: 0 });
          }
        }}
        onClose={() => setSnoozeTarget(null)}
      />

      {/* 9. CREATE / EDIT RULE MODAL */}
      {showRuleModal && (
        <AlertRuleForm
          rule={editingRule}
          onSubmit={handleRuleSubmit}
          onClose={handleCloseRuleModal}
        />
      )}

      {/* 10. DELETE CONFIRMATION MODAL */}
      <ConfirmDelete
        isOpen={!!deleteTarget}
        itemName={deleteTarget?.name || 'esta regla'}
        isDeleting={deleteRuleMutation.isPending}
        onConfirm={() => deleteTarget && deleteRuleMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
