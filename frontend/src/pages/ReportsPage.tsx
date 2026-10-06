import { useLinkedResource } from '../hooks/useLinkedResource';
import { useUrlFilter } from '../hooks/useUrlFilter';
import CompactModuleSummary from '../components/common/CompactModuleSummary';
import AdminButton from '../components/common/AdminButton';
import { useAuthStore } from '../store/authStore';
import ReloadDataButton from '../components/common/ReloadDataButton';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { ReportItem, CreateReportData, ReportType } from '../types/reports';
import EmptyState from '../components/common/EmptyState';
import ConfirmDelete from '../components/common/ConfirmDelete';
import {
  NOCPageHeader,
  NOCKpiGrid,
  NOCKpiCard,
  NOCToolbar,
  NOCBulkActionBar,
} from '../components/common/noc';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { usePersistentViewMode } from '../hooks/usePersistentViewMode';

// Modular Report Components
import ReportTableView from '../components/reports/ReportTableView';
import ReportCard from '../components/reports/ReportCard';
import ReportDetailDrawer from '../components/reports/ReportDetailDrawer';
import CreateReportModal from '../components/reports/CreateReportModal';

import {
  FileText,
  Plus,
  Loader2,
  ShieldCheck,
  Wrench,
  Clock,
  BarChart3,
  Trash2,
} from 'lucide-react';

export default function ReportsPage() {
  const organizationId = useAuthStore(state => state.user?.organization?.id);

  const queryClient = useQueryClient();

  // State
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ReportItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [reportStatusFilter, setReportStatusFilter] = useUrlFilter('status', ['all','pending','generating','completed','failed'] as const);
  const [typeFilter, setTypeFilter] = useUrlFilter('type', ["all","sla","availability","ssl","incidents","trends","summary"] as const);
  const [viewMode, setViewMode] = usePersistentViewMode('reports', 'table');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Auto-refresh hook (15s countdown)
  const autoRefresh = useAutoRefresh({
    intervalSeconds: 15,
    initialEnabled: true,
  });

  // Query Reports List
  const { data: reports, isLoading } = useQuery<ReportItem[]>({
    queryKey: ['reports-list', organizationId],
    queryFn: async () => {
      const response = await api.get('reports/');
      return (response.data?.data || []) as ReportItem[];
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  // Create Report Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: CreateReportData) => {
      const response = await api.post('reports/', payload);
      return response.data?.data as ReportItem;
    },
    onSuccess: (newReport) => {
      queryClient.invalidateQueries({ queryKey: ['reports-list', organizationId] });
      setShowCreateModal(false);
      if (newReport) {
        setSelectedReport(newReport);
      }
    },
  });

  // Single Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`reports/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports-list', organizationId] });
      if (selectedReport?.id === deleteTarget?.id) {
        setSelectedReport(null);
      }
      setDeleteTarget(null);
    },
  });

  // Bulk Delete Action (Atomic backend endpoint)
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      !window.confirm(
        `¿Deseas eliminar permanentemente los ${selectedIds.length} reportes seleccionados?`
      )
    ) {
      return;
    }
    setBulkDeleting(true);
    try {
      await api.post('reports/bulk-action/', {
        action: 'delete',
        report_ids: selectedIds,
      });
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['reports-list', organizationId] });
    } catch (err) {
      console.error('Error in bulk delete:', err);
    } finally {
      setBulkDeleting(false);
    }
  };

  // Export handlers
  const handleExportCSV = async (reportId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const response = await api.get(`reports/${reportId}/export/csv/`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `reporte_sla_${reportId.slice(0, 8)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Error al exportar CSV:', err);
    }
  };

  const handleExportPDF = async (reportId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token') || '';
      const url = `${api.defaults.baseURL || '/api/v1/'}reports/${reportId}/export/pdf/${token ? `?token=${token}` : ''}`;
      window.open(url, '_blank');
    } catch (err) {
      console.error('Error al exportar PDF:', err);
    }
  };

  // Selection handlers
  const handleToggleSelect = (report: ReportItem) => {
    setSelectedIds((prev) =>
      prev.includes(report.id) ? prev.filter((id) => id !== report.id) : [...prev, report.id]
    );
  };

  const handleSelectAllToggle = () => {
    if (!filteredReports || filteredReports.length === 0) return;
    if (selectedIds.length === filteredReports.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredReports.map((r: ReportItem) => r.id));
    }
  };

  // KPI Calculations
  const allReports = reports || [];
  const totalCount = allReports.length;
  const completedReports = allReports.filter((r) => r.status === 'completed');
  const latestSlaReport = completedReports.find(
    (r) => r.report_type === 'sla' || r.report_type === 'summary'
  );

  const avgSla =
    latestSlaReport?.data?.overall_sla ??
    latestSlaReport?.data?.summary?.overall_sla_percentage ??
    99.9;
  const mttr =
    latestSlaReport?.data?.mttr_minutes ??
    latestSlaReport?.data?.summary?.mttr_minutes ??
    14.5;
  const mttd =
    latestSlaReport?.data?.mttd_minutes ??
    latestSlaReport?.data?.summary?.mttd_minutes ??
    3.2;

  // Filtered & Searched Reports
  const filteredReports = allReports.filter((report: ReportItem) => {
    const matchesSearch =
      report.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.report_type.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (typeFilter !== 'all' && report.report_type !== typeFilter) return false;
    if (reportStatusFilter !== 'all' && report.status !== reportStatusFilter) return false;

    return true;
  });

  useLinkedResource(reports, selectedReport, setSelectedReport);

  return (
    <div className="compact-workspace space-y-6 animate-in fade-in duration-300 font-sans">
      {/* 1. TOP HEADER (Standard NOC Header) */}
      <NOCPageHeader queryKeys={["reports-list"]}
        title="Reportes SLA & Métricas"
        badgeText="AUDITORÍA & SLA"
        description="Generación automatizada de informes ejecutivos de cumplimiento de SLA, presupuesto de error SRE, tiempos MTTR / MTTD y exportación directa a PDF y CSV."
        icon={<FileText size={26} />}
        autoRefresh={{
          enabled: autoRefresh.enabled,
          countdown: autoRefresh.countdown,
          onToggle: autoRefresh.toggle,
        }}
        actions={
          <AdminButton
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-accent-green text-black font-semibold px-5 py-2 rounded-full text-sm hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20"
          >
            <Plus size={16} />
            Nuevo Reporte
          </AdminButton>
        }
      />

      {/* 2. LIVE SLA & ERROR BUDGET TELEMETRY STRIP */}

      {/* 3. NOC COMMAND CENTER: KPI STRIP */}
      <CompactModuleSummary items={[{label:'Reportes',value:reports ? totalCount : null},{label:'Completados',value:reports ? allReports.filter(r=>r.status==='completed').length : null},{label:'Pendientes',value:reports ? allReports.filter(r=>r.status==='pending'||r.status==='generating').length : null},{label:'Fallidos',value:reports ? allReports.filter(r=>r.status==='failed').length : null}]} />
      <div className="flex flex-wrap gap-2 text-xs" aria-label="Estado del reporte">
        {(['all','pending','generating','completed','failed'] as const).map(status=><button key={status} type="button" aria-pressed={reportStatusFilter===status} onClick={()=>setReportStatusFilter(status)} className="px-3 py-1 rounded-lg border border-border-base">{({all:'Todos',pending:'Pendientes',generating:'Generando',completed:'Completados',failed:'Fallidos'})[status]}</button>)}
      </div>

      {/* 4. TOOLBAR: Omnibar Search + Category Chips + Grid/Table Switcher */}
      <NOCToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar informes por título o tipo..."
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        categoryLabel="Tipo:"
        categories={[
          { id: 'all', label: 'Todos' },
          { id: 'sla', label: 'SLA Contractual' },
          { id: 'availability', label: 'Disponibilidad' },
          { id: 'incidents', label: 'Incidentes' },
          { id: 'trends', label: 'Tendencias' },
          { id: 'ssl', label: 'SSL' },
          { id: 'summary', label: 'Resumen Ejecutivo' },
        ]}
        selectedCategory={typeFilter}
        onCategoryChange={setTypeFilter}
      />

      {/* 5. FLOATING BULK ACTIONS BAR */}
      <NOCBulkActionBar
        selectedCount={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        itemLabel="reportes"
        actions={
          <AdminButton
            type="button"
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-accent-red text-white font-semibold rounded-full text-xs hover:bg-accent-red/90 transition-all shadow-sm disabled:opacity-50"
          >
            <Trash2 size={13} />
            {bulkDeleting ? 'Eliminando...' : 'Eliminar Seleccionados'}
          </AdminButton>
        }
      />

      {/* 6. MAIN CONTENT: DUAL VIEW (GRID OR TABLE) */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-accent-green" size={32} />
        </div>
      ) : filteredReports && filteredReports.length > 0 ? (
        viewMode === 'table' ? (
          <ReportTableView
            reports={filteredReports}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAllToggle={handleSelectAllToggle}
            onSelectReport={(report) => setSelectedReport(report)}
            onDelete={(report) => setDeleteTarget(report)}
            onExportCSV={handleExportCSV}
            onExportPDF={handleExportPDF}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredReports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                isSelected={selectedIds.includes(report.id)}
                onToggleSelect={handleToggleSelect}
                onSelectReport={(r) => setSelectedReport(r)}
                onDelete={(r) => setDeleteTarget(r)}
                onExportCSV={handleExportCSV}
                onExportPDF={handleExportPDF}
              />
            ))}
          </div>
        )
      ) : (
        <EmptyState requiresAdmin
          icon={FileText}
          title="No se encontraron reportes"
          description={
            searchTerm || typeFilter !== 'all'
              ? 'No hay informes que coincidan con los criterios de búsqueda seleccionados.'
              : 'Aún no se han generado informes ejecutivos en esta organización.'
          }
          actionLabel="Generar Primer Reporte"
          onAction={() => setShowCreateModal(true)}
        />
      )}

      {/* 7. SLIDE-OVER DRAWER (AUDIT & DRILLDOWN) */}
      <ReportDetailDrawer
        report={selectedReport}
        isOpen={selectedReport !== null}
        onClose={() => setSelectedReport(null)}
        onExportCSV={handleExportCSV}
        onExportPDF={handleExportPDF}
      />

      {/* 8. CREATE REPORT MODAL */}
      <CreateReportModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={(data) => createMutation.mutate(data)}
        isSubmitting={createMutation.isPending}
      />

      {/* 9. DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <ConfirmDelete
          isOpen={true}
          title="Eliminar Reporte"
          itemName={deleteTarget.title}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onClose={() => setDeleteTarget(null)}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
