import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type {
  SSLCertificate,
  CreateSSLCertificateData,
  SSLStats,
  SSLTestConnectionResult,
} from '../types/ssl';
import StatusBadge from '../components/common/StatusBadge';
import EmptyState from '../components/common/EmptyState';
import ConfirmDelete from '../components/common/ConfirmDelete';
import SSLCertificateTableView from '../components/ssl/SSLCertificateTableView';
import {
  NOCPageHeader,
  NOCKpiGrid,
  NOCKpiCard,
  NOCToolbar,
  NOCBulkActionBar,
  NOCDrawer,
} from '../components/common/noc';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { usePersistentViewMode } from '../hooks/usePersistentViewMode';
import {
  ShieldCheck,
  Plus,
  Loader2,
  Trash2,
  Calendar,
  Building2,
  RefreshCw,
  X,
  AlertTriangle,
  Lock,
  Pencil,
  Copy,
  Check,
  Clock,
  ExternalLink,
  ShieldAlert,
  Cpu,
  Globe,
  CheckSquare,
  Square,
  Zap,
  Download,
  Activity,
  Layers,
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
  const queryClient = useQueryClient();

  // State
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  // Persistent viewMode: remembers table or grid across refreshes and updates
  const [viewMode, setViewMode] = usePersistentViewMode('ssl_certificates', 'table');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [scanningId, setScanningId] = useState<string | null>(null);

  // Modals & Drawer State
  const [showModal, setShowModal] = useState(false);
  const [editingCert, setEditingCert] = useState<SSLCertificate | null>(null);
  const [selectedCert, setSelectedCert] = useState<SSLCertificate | null>(null);
  const [domainInput, setDomainInput] = useState('');
  const [portInput, setPortInput] = useState<number>(443);
  const [deleteTarget, setDeleteTarget] = useState<SSLCertificate | null>(null);
  const [copiedFingerprint, setCopiedFingerprint] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'overview' | 'sans' | 'technical'>('overview');
  const [sanSearchTerm, setSanSearchTerm] = useState('');
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Live Test Connection State
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<SSLTestConnectionResult | null>(null);

  // Auto-refresh hook (15s countdown)
  const autoRefresh = useAutoRefresh({
    intervalSeconds: 15,
    initialEnabled: true,
  });

  const getEndpoint = () => {
    switch (filter) {
      case 'expiring':
        return 'ssl-certificates/expiring/?days=15';
      case 'expired':
        return 'ssl-certificates/expired/';
      default:
        return 'ssl-certificates/';
    }
  };

  const { data: stats } = useQuery<SSLStats>({
    queryKey: ['ssl-stats'],
    queryFn: async () => {
      const response = await api.get('ssl-certificates/stats/');
      return (response.data?.data || {}) as SSLStats;
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  const { data: certificates, isLoading } = useQuery<SSLCertificate[]>({
    queryKey: ['ssl-certificates', filter],
    queryFn: async () => {
      const response = await api.get(getEndpoint());
      return (response.data?.data || []) as SSLCertificate[];
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateSSLCertificateData) => {
      await api.post('ssl-certificates/', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ssl-certificates'] });
      queryClient.invalidateQueries({ queryKey: ['ssl-stats'] });
      handleCloseModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, domain, port }: { id: string; domain: string; port: number }) => {
      await api.patch(`ssl-certificates/${id}/`, { domain, port });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ssl-certificates'] });
      queryClient.invalidateQueries({ queryKey: ['ssl-stats'] });
      handleCloseModal();
    },
  });

  const scanMutation = useMutation({
    mutationFn: async (id: string) => {
      setScanningId(id);
      const response = await api.post(`ssl-certificates/${id}/scan/`);
      return response.data?.data;
    },
    onSuccess: (updatedCert) => {
      queryClient.invalidateQueries({ queryKey: ['ssl-certificates'] });
      queryClient.invalidateQueries({ queryKey: ['ssl-stats'] });
      if (selectedCert && updatedCert && selectedCert.id === updatedCert.id) {
        setSelectedCert(updatedCert);
      }
      setScanningId(null);
    },
    onError: () => {
      setScanningId(null);
    },
  });

  const scanAllMutation = useMutation({
    mutationFn: async () => {
      await api.post('ssl-certificates/scan-all/');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ssl-certificates'] });
      queryClient.invalidateQueries({ queryKey: ['ssl-stats'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`ssl-certificates/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ssl-certificates'] });
      queryClient.invalidateQueries({ queryKey: ['ssl-stats'] });
      if (selectedCert?.id === deleteTarget?.id) {
        setSelectedCert(null);
      }
      setDeleteTarget(null);
    },
  });

  // Bulk Actions via backend endpoint
  const handleToggleSelect = (cert: SSLCertificate) => {
    setSelectedIds((prev) =>
      prev.includes(cert.id) ? prev.filter((id) => id !== cert.id) : [...prev, cert.id]
    );
  };

  const handleSelectAllToggle = () => {
    if (!filteredCertificates) return;
    if (selectedIds.length === filteredCertificates.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredCertificates.map((c) => c.id));
    }
  };

  const handleBulkScan = async () => {
    if (selectedIds.length === 0) return;
    try {
      await api.post('ssl-certificates/bulk-action/', {
        action: 'scan',
        certificate_ids: selectedIds,
      });
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['ssl-certificates'] });
      queryClient.invalidateQueries({ queryKey: ['ssl-stats'] });
    } catch {
      // Fallback
      for (const id of selectedIds) {
        api.post(`ssl-certificates/${id}/scan/`).catch(() => {});
      }
      setSelectedIds([]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      !window.confirm(
        `¿Deseas eliminar permanentemente los ${selectedIds.length} certificados seleccionados?`
      )
    ) {
      return;
    }
    setBulkDeleting(true);
    try {
      await api.post('ssl-certificates/bulk-action/', {
        action: 'delete',
        certificate_ids: selectedIds,
      });
    } catch {
      for (const id of selectedIds) {
        try {
          await api.delete(`ssl-certificates/${id}/`);
        } catch {}
      }
    }
    setSelectedIds([]);
    setBulkDeleting(false);
    queryClient.invalidateQueries({ queryKey: ['ssl-certificates'] });
    queryClient.invalidateQueries({ queryKey: ['ssl-stats'] });
  };

  // Test SSL Connection in Modal
  const handleTestConnection = async () => {
    if (!domainInput.trim()) return;
    setIsTestingConnection(true);
    setTestResult(null);

    let cleanDomain = domainInput.trim().toLowerCase();
    cleanDomain = cleanDomain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (cleanDomain.includes(':')) {
      cleanDomain = cleanDomain.split(':')[0];
    }

    try {
      const response = await api.post('ssl-certificates/test-connection/', {
        domain: cleanDomain,
        port: portInput || 443,
      });
      setTestResult(response.data?.data as SSLTestConnectionResult);
    } catch (err: any) {
      setTestResult({
        domain: cleanDomain,
        port: portInput || 443,
        is_valid: false,
        error_message: err.response?.data?.message || 'Error de conexión con el servidor SSL.',
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Export CSV Report
  const handleExportCSV = () => {
    if (!certificates || certificates.length === 0) return;
    const headers = [
      'Dominio',
      'Puerto',
      'Autoridad Emisora (CA)',
      'Estado',
      'Grado Seguridad',
      'Vigencia (Días)',
      'Fecha Expiración',
      'Versión TLS',
      'Algoritmo',
      'SANs Cubiertos',
    ];
    const rows = certificates.map((c) => [
      c.domain,
      c.port || 443,
      `"${(c.issuer || '').replace(/"/g, '""')}"`,
      c.is_valid ? 'Válido' : 'Fallo',
      c.security_grade || 'A',
      c.days_remaining ?? 'N/A',
      c.expiration_date ? new Date(c.expiration_date).toISOString().split('T')[0] : 'N/A',
      c.tls_version || 'TLSv1.3',
      c.algorithm || 'SHA-256',
      `"${(c.san_domains || []).join('; ')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `sentinel_inventario_ssl_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Modal Handlers
  const handleOpenCreate = () => {
    setEditingCert(null);
    setDomainInput('');
    setPortInput(443);
    setTestResult(null);
    setShowModal(true);
  };

  const handleOpenEdit = (cert: SSLCertificate, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingCert(cert);
    setDomainInput(cert.domain);
    setPortInput(cert.port || 443);
    setTestResult(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCert(null);
    setDomainInput('');
    setPortInput(443);
    setTestResult(null);
  };

  const handleSubmitModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainInput.trim()) return;

    let cleanDomain = domainInput.trim().toLowerCase();
    cleanDomain = cleanDomain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    let port = portInput || 443;

    if (cleanDomain.includes(':')) {
      const parts = cleanDomain.split(':');
      cleanDomain = parts[0];
      port = parseInt(parts[1], 10) || 443;
    }

    if (editingCert) {
      updateMutation.mutate({ id: editingCert.id, domain: cleanDomain, port });
    } else {
      createMutation.mutate({ domain: cleanDomain, port });
    }
  };

  const handleCopyFingerprint = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFingerprint(true);
    setTimeout(() => setCopiedFingerprint(false), 2000);
  };

  const getStatusType = (cert: SSLCertificate) => {
    if (!cert.is_valid) return 'fallo';
    const days = cert.days_remaining;
    if (days !== null && days <= 0) return 'expirado';
    if (days !== null && days <= 15) return 'por_expirar';
    return 'valido';
  };

  // KPI Calculations
  const allCerts = certificates || [];
  const totalCount = stats?.total || allCerts.length;
  const validCount = stats?.valid || allCerts.filter((c: SSLCertificate) => c.is_valid).length;
  const expiringCount =
    stats?.expiring_15d ||
    allCerts.filter(
      (c: SSLCertificate) =>
        c.days_remaining !== null && c.days_remaining <= 15 && c.days_remaining > 0
    ).length;
  const expiredCount = (stats?.expired || 0) + (stats?.invalid || 0);

  const validitySla =
    totalCount > 0 ? Math.round((validCount / totalCount) * 1000) / 10 : 100.0;

  // Filtered & Searched Certificates
  const filteredCertificates = allCerts.filter((cert: SSLCertificate) => {
    const matchesSearch =
      cert.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cert.issuer && cert.issuer.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (cert.algorithm && cert.algorithm.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (cert.san_domains &&
        cert.san_domains.some((san) => san.toLowerCase().includes(searchTerm.toLowerCase())));

    if (!matchesSearch) return false;

    if (filter === 'expiring') {
      return cert.days_remaining !== null && cert.days_remaining <= 15 && cert.days_remaining > 0;
    }
    if (filter === 'expired') {
      return !cert.is_valid || (cert.days_remaining !== null && cert.days_remaining <= 0);
    }

    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-sans">
      {/* 1. TOP HEADER (Standard NOC Header) */}
      <NOCPageHeader
        title="Certificados SSL & TLS"
        badgeText="CERT GUARD"
        description="Supervisa la validez, cadena criptográfica, emisor y vencimiento de tus certificados SSL/TLS con alertas preventivas."
        icon={<Lock size={26} />}
        autoRefresh={{
          enabled: autoRefresh.enabled,
          countdown: autoRefresh.countdown,
          onToggle: autoRefresh.toggle,
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
            <button
              type="button"
              onClick={() => scanAllMutation.mutate()}
              disabled={scanAllMutation.isPending}
              className="flex items-center gap-2 bg-accent-green/10 border border-accent-green/40 text-accent-green font-medium px-4 py-2 rounded-full text-sm hover:bg-accent-green/20 transition-all disabled:opacity-50 cursor-pointer"
              title="Re-escanear todos los certificados inmediatamente"
            >
              <RefreshCw
                size={15}
                className={scanAllMutation.isPending ? 'animate-spin' : ''}
              />
              <span>Escanear Todos</span>
            </button>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="flex items-center gap-2 bg-accent-green text-black font-semibold px-5 py-2 rounded-full text-sm hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20 cursor-pointer"
            >
              <Plus size={16} />
              <span>Nuevo Certificado</span>
            </button>
          </>
        }
      />

      {/* 2. NOC COMMAND CENTER: KPI STRIP */}
      <NOCKpiGrid columns={4}>
        {/* KPI 1: Disponibilidad y Validez */}
        <NOCKpiCard
          title="Salud de Certificados"
          icon={<ShieldCheck size={16} className="text-accent-green" />}
          badge={{
            text: validitySla >= 95.0 ? 'Óptimo' : 'Atención',
            variant: validitySla >= 95.0 ? 'success' : 'warning',
          }}
          value={`${validitySla}%`}
          valueSuffix="vigentes"
          progress={{ value: validitySla }}
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Inventario total</span>
              <span className="font-mono text-text-main font-medium">{totalCount} dominios</span>
            </div>
          }
        />

        {/* KPI 2: Certificados por Expirar */}
        <NOCKpiCard
          title="Próximos a Vencer"
          icon={<Clock size={16} className={expiringCount > 0 ? 'text-accent-yellow' : 'text-accent-green'} />}
          badge={{
            text: expiringCount > 0 ? '≤ 15 días' : 'Bajo control',
            variant: expiringCount > 0 ? 'warning' : 'neutral',
          }}
          value={expiringCount}
          valueColor={expiringCount > 0 ? 'text-accent-yellow' : 'text-text-main'}
          subtitle={expiringCount > 0 ? 'Requieren renovación en CA' : 'Sin riesgos inmediatos'}
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Umbral preventivo</span>
              <span className="font-mono text-accent-yellow">15 días</span>
            </div>
          }
        />

        {/* KPI 3: Certificados Críticos o Caídos */}
        <NOCKpiCard
          title="Fallos o Expirados"
          icon={<AlertTriangle size={16} className={expiredCount > 0 ? 'text-accent-red' : 'text-text-dim'} />}
          badge={{
            text: expiredCount > 0 ? 'Incidente' : '0 Caídos',
            variant: expiredCount > 0 ? 'danger' : 'success',
          }}
          value={expiredCount}
          valueColor={expiredCount > 0 ? 'text-accent-red' : 'text-accent-green'}
          subtitle={expiredCount > 0 ? 'Tráfico HTTPS comprometido' : 'Todos los dominios con TLS activo'}
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Cifrado TLS Activo</span>
              <span className="text-accent-green font-medium">Protegido</span>
            </div>
          }
        />

        {/* KPI 4: Frecuencia de Monitoreo */}
        <NOCKpiCard
          title="Vigencia Promedio"
          icon={<Calendar size={16} className="text-accent-blue" />}
          badge={{
            text: `${stats?.avg_days_remaining || 63}d promedio`,
            variant: 'info',
          }}
          value={`${stats?.avg_days_remaining || 63} días`}
          valueColor="text-accent-blue"
          subtitle="Tiempo medio de vida útil restante"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Inspección Multi-puerto</span>
              <span className="text-accent-green font-medium font-mono">:443, :8443, :636</span>
            </div>
          }
        />
      </NOCKpiGrid>

      {/* 3. TOOLBAR: Omnibar Search + Status Pills + Persistent Grid/Table Switcher */}
      <NOCToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por dominio, autoridad emisora (CA), SANs o algoritmo..."
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        statusPills={[
          { id: 'all', label: 'Todos', count: totalCount, variant: 'all' },
          { id: 'expiring', label: 'Por expirar', count: expiringCount, variant: 'warning' },
          { id: 'expired', label: 'Expirados / Fallos', count: expiredCount, variant: 'danger' },
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
            <button
              type="button"
              onClick={handleBulkScan}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-accent-green text-black font-semibold rounded-full text-xs hover:bg-accent-green/90 transition-all shadow-sm cursor-pointer"
            >
              <RefreshCw size={13} />
              Re-escanear Seleccionados
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-accent-red text-white font-semibold rounded-full text-xs hover:bg-accent-red/90 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Trash2 size={13} />
              {bulkDeleting ? 'Eliminando...' : 'Eliminar'}
            </button>
          </>
        }
      />

      {/* 5. MAIN CONTENT: DUAL VIEW (GRID OR COMPACT TABLE) */}
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
              const isScanning = scanningId === cert.id;

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
                  className={`bg-bg-card/95 border rounded-2xl p-5 hover:border-accent-green/50 transition-all flex flex-col justify-between cursor-pointer group shadow-sm relative ${
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
                              <span className="font-mono text-[10px] px-1.5 py-0.2 bg-bg-dark border border-border-base rounded text-accent-blue">
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
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-full bg-accent-green/10 text-accent-green border border-accent-green/30">
                        {cert.security_grade || 'A'}
                      </span>
                      <span className="font-mono text-[11px] bg-bg-dark px-2 py-0.5 rounded-md border border-border-base/50">
                        {cert.tls_version || 'TLS 1.3'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          scanMutation.mutate(cert.id);
                        }}
                        disabled={isScanning}
                        className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors disabled:opacity-50"
                        title="Verificar certificado ahora"
                      >
                        <RefreshCw size={14} className={isScanning ? 'animate-spin' : ''} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleOpenEdit(cert, e)}
                        className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors"
                        title="Editar dominio"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(cert);
                        }}
                        className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded-full transition-colors"
                        title="Eliminar certificado"
                      >
                        <Trash2 size={14} />
                      </button>
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
        <EmptyState
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
              <button
                type="button"
                onClick={() => scanMutation.mutate(selectedCert.id)}
                disabled={scanningId === selectedCert.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-green/10 border border-accent-green/30 text-accent-green hover:bg-accent-green/20 text-xs font-semibold transition-all disabled:opacity-50"
              >
                <RefreshCw
                  size={13}
                  className={scanningId === selectedCert.id ? 'animate-spin' : ''}
                />
                Re-escanear
              </button>
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
        onTabChange={(tab) => setDrawerTab(tab as any)}
      >
        {selectedCert && drawerTab === 'overview' && (
          <div className="space-y-4">
            {/* Quick Lifetime Metric Strip */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-bg-dark/90 border border-border-base rounded-2xl p-3.5">
                <span className="text-[11px] text-text-dim block mb-1">Días Restantes</span>
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
                <span className="text-[11px] text-text-dim block mb-1">Protocolo Activo</span>
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
                      className="text-accent-green hover:underline flex items-center gap-1 text-[11px] cursor-pointer"
                    >
                      {copiedFingerprint ? <Check size={12} /> : <Copy size={12} />}
                      {copiedFingerprint ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <p className="text-text-muted break-all leading-relaxed bg-bg-card p-3 rounded-xl border border-border-base/40 text-[11px]">
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
                          {isWildcard && <span className="text-[10px] font-sans opacity-80">(Wildcard)</span>}
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
      {showModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
          onClick={handleCloseModal}
        >
          <div
            className="bg-bg-card border border-border-base rounded-3xl p-6 sm:p-8 w-full max-w-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-text-main flex items-center gap-2 font-sans">
                <Lock size={19} className="text-accent-green" />
                {editingCert ? 'Editar Certificado SSL' : 'Monitorear Nuevo Certificado SSL'}
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
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    Dominio o FQDN
                  </label>
                  <input
                    type="text"
                    required
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
                    value={portInput}
                    onChange={(e) => {
                      setPortInput(parseInt(e.target.value, 10) || 443);
                      setTestResult(null);
                    }}
                    className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-mono text-center"
                  />
                </div>
              </div>
              <p className="text-[11px] text-text-dim">
                Puertos comunes: <span className="font-mono text-accent-green">443</span> (HTTPS), <span className="font-mono text-accent-blue">8443</span> (Paneles), <span className="font-mono text-accent-purple">636</span> (LDAPS).
              </p>

              {/* Test Connection Button */}
              <div className="pt-1">
                <button
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
                      <span>Probar Conexión SSL en Vivo</span>
                    </>
                  )}
                </button>
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
                        <span className="font-mono text-[11px] text-text-dim">
                          {testResult.tls_version}
                        </span>
                      </div>
                      <div className="text-[11px] text-text-muted">
                        <span>Emisor: </span>
                        <span className="font-mono text-text-main">{parseIssuerName(testResult.issuer || null)}</span>
                      </div>
                      <div className="text-[11px] text-text-muted">
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
                        <span className="text-[11px] font-mono opacity-90">{testResult.error_message}</span>
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
                <button
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
                </button>
              </div>
            </form>
          </div>
        </div>
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
