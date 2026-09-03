import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { SSLCertificate, CreateSSLCertificateData, SSLStats } from '../types/ssl';
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
  Fingerprint,
  Globe,
  CheckSquare,
  Square,
  Zap,
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
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [scanningId, setScanningId] = useState<string | null>(null);

  // Modals & Drawer State
  const [showModal, setShowModal] = useState(false);
  const [editingCert, setEditingCert] = useState<SSLCertificate | null>(null);
  const [selectedCert, setSelectedCert] = useState<SSLCertificate | null>(null);
  const [domainInput, setDomainInput] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SSLCertificate | null>(null);
  const [copiedFingerprint, setCopiedFingerprint] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'overview' | 'sans' | 'technical'>('overview');
  const [bulkDeleting, setBulkDeleting] = useState(false);

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
    mutationFn: async ({ id, domain }: { id: string; domain: string }) => {
      await api.patch(`ssl-certificates/${id}/`, { domain });
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

  // Bulk Actions
  const handleToggleSelect = (cert: SSLCertificate) => {
    setSelectedIds((prev) =>
      prev.includes(cert.id) ? prev.filter((id) => id !== cert.id) : [...prev, cert.id]
    );
  };

  const handleSelectAllToggle = () => {
    if (!filteredCertificates || filteredCertificates.length === 0) return;
    if (selectedIds.length === filteredCertificates.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredCertificates.map((c: SSLCertificate) => c.id));
    }
  };

  const handleBulkScan = async () => {
    if (selectedIds.length === 0) return;
    for (const id of selectedIds) {
      try {
        await api.post(`ssl-certificates/${id}/scan/`);
      } catch (err) {
        // Continue
      }
    }
    queryClient.invalidateQueries({ queryKey: ['ssl-certificates'] });
    queryClient.invalidateQueries({ queryKey: ['ssl-stats'] });
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
    for (const id of selectedIds) {
      try {
        await api.delete(`ssl-certificates/${id}/`);
      } catch (err) {
        // Continue
      }
    }
    setSelectedIds([]);
    setBulkDeleting(false);
    queryClient.invalidateQueries({ queryKey: ['ssl-certificates'] });
    queryClient.invalidateQueries({ queryKey: ['ssl-stats'] });
  };

  // Modal Handlers
  const handleOpenCreate = () => {
    setEditingCert(null);
    setDomainInput('');
    setShowModal(true);
  };

  const handleOpenEdit = (cert: SSLCertificate, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingCert(cert);
    setDomainInput(cert.domain);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCert(null);
    setDomainInput('');
  };

  const handleSubmitModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainInput.trim()) return;

    let cleanDomain = domainInput.trim().toLowerCase();
    cleanDomain = cleanDomain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');

    if (editingCert) {
      updateMutation.mutate({ id: editingCert.id, domain: cleanDomain });
    } else {
      createMutation.mutate({ domain: cleanDomain });
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
  const expiringCount = stats?.expiring_15d || allCerts.filter(
    (c: SSLCertificate) => c.days_remaining !== null && c.days_remaining <= 15 && c.days_remaining > 0
  ).length;
  const expiredCount = (stats?.expired || 0) + (stats?.invalid || 0);

  const validitySla =
    totalCount > 0
      ? Math.round((validCount / totalCount) * 1000) / 10
      : 100.0;

  // Filtered & Searched Certificates
  const filteredCertificates = allCerts.filter((cert: SSLCertificate) => {
    const matchesSearch =
      cert.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cert.issuer && cert.issuer.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (cert.algorithm && cert.algorithm.toLowerCase().includes(searchTerm.toLowerCase()));

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
        title="Certificados SSL"
        badgeText="CERT GUARD"
        description="Supervisa la validez, emisor, algoritmo y vencimiento de tus certificados SSL/TLS con alertas tempranas."
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
              onClick={() => scanAllMutation.mutate()}
              disabled={scanAllMutation.isPending}
              className="flex items-center gap-2 bg-accent-green/10 border border-accent-green/40 text-accent-green font-medium px-4 py-2 rounded-full text-sm hover:bg-accent-green/20 transition-all disabled:opacity-50"
              title="Re-escanear todos los certificados inmediatamente"
            >
              <RefreshCw
                size={15}
                className={scanAllMutation.isPending ? 'animate-spin' : ''}
              />
              Escanear Todos
            </button>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="flex items-center gap-2 bg-accent-green text-black font-semibold px-5 py-2 rounded-full text-sm hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20"
            >
              <Plus size={16} />
              Nuevo Certificado
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
              <span>Cadena de Confianza</span>
              <span>{validCount} de {totalCount} certificados</span>
            </div>
          }
        />

        {/* KPI 2: Por Expirar */}
        <NOCKpiCard
          title="Próximos a Expirar"
          icon={<AlertTriangle size={16} className="text-amber-400" />}
          badge={{
            text: '≤ 15 días',
            variant: expiringCount > 0 ? 'warning' : 'neutral',
          }}
          value={expiringCount}
          valueColor={expiringCount > 0 ? 'text-amber-400' : 'text-text-main'}
          valueSuffix="certificados"
          subtitle="Requieren renovación con la autoridad CA"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Alerta temprana</span>
              <span className="text-amber-400 font-medium">Auto-notificación</span>
            </div>
          }
        />

        {/* KPI 3: Distribución */}
        <NOCKpiCard
          title="Estado de Cobertura"
          icon={<Zap size={16} className="text-sky-400" />}
          badge={{
            text: `${totalCount} Dominios`,
            variant: 'neutral',
          }}
          distribution={[
            { label: 'Válidos', count: validCount, variant: 'success' },
            { label: 'Por expirar', count: expiringCount, variant: 'warning' },
            { label: 'Expirados', count: expiredCount, variant: 'danger' },
          ]}
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Cifrado TLS 1.3</span>
              <span className="text-accent-green">Activo</span>
            </div>
          }
        />

        {/* KPI 4: Frecuencia de Verificación */}
        <NOCKpiCard
          title="Carga de Monitoreo"
          icon={<Cpu size={16} className="text-accent-green" />}
          badge={{
            text: 'Celery Beat',
            variant: 'neutral',
          }}
          value={totalCount > 0 ? `${totalCount} checks` : '0 checks'}
          valueColor="text-accent-green"
          valueSuffix="por ciclo"
          subtitle="Verificación de handshake TLS y expiración"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Puerto Inspeccionado</span>
              <span className="text-accent-green font-medium font-mono">443 / HTTPS</span>
            </div>
          }
        />
      </NOCKpiGrid>

      {/* 3. TOOLBAR: Omnibar Search + Status Pills + Grid/Table Switcher */}
      <NOCToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por dominio, autoridad emisora (CA) o algoritmo..."
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
              className="flex items-center gap-1.5 px-4 py-1.5 bg-accent-green text-black font-semibold rounded-full text-xs hover:bg-accent-green/90 transition-all shadow-sm"
            >
              <RefreshCw size={13} />
              Re-escanear Seleccionados
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-accent-red text-white font-semibold rounded-full text-xs hover:bg-accent-red/90 transition-all shadow-sm disabled:opacity-50"
            >
              <Trash2 size={13} />
              {bulkDeleting ? 'Eliminando...' : 'Eliminar'}
            </button>
          </>
        }
      />

      {/* 5. MAIN CONTENT: DUAL VIEW (GRID OR TABLE) */}
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
                    {/* Top Bar: Checkbox, Icon, Domain, Radar & Status */}
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
                          <h3
                            className="font-bold text-text-main truncate text-base group-hover:text-accent-green transition-colors font-sans"
                            title={cert.domain}
                          >
                            {cert.domain}
                          </h3>
                          {cert.algorithm && (
                            <span className="text-xs font-medium text-text-dim">
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
                          <Clock size={13} /> Días restantes:
                        </span>
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
                  </div>

                  {/* Footer: Algorithm + Actions */}
                  <div className="mt-4 pt-3 border-t border-border-base/40 flex items-center justify-between text-xs text-text-dim">
                    <span className="font-mono text-[11px] bg-bg-dark px-2 py-0.5 rounded-md border border-border-base/50">
                      {cert.algorithm || 'RSA'}
                    </span>

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
            onEdit={(c, e) => handleOpenEdit(c, e)}
            onDelete={(c, e) => {
              e.stopPropagation();
              setDeleteTarget(c);
            }}
          />
        )
      ) : (
        <EmptyState
          icon={ShieldCheck}
          title={
            searchTerm || filter !== 'all'
              ? 'No se encontraron certificados con los filtros aplicados'
              : 'No hay certificados SSL registrados'
          }
          description={
            searchTerm || filter !== 'all'
              ? 'Prueba a cambiar el término de búsqueda o restablecer los filtros.'
              : 'Agrega tu primer dominio para escanear y monitorear su certificado SSL.'
          }
          actionLabel={
            searchTerm || filter !== 'all' ? 'Limpiar Filtros' : 'Nuevo Certificado'
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

      {/* 6. SLIDE-OVER DETAIL DRAWER (Zero Context Loss with NOCDrawer) */}
      <NOCDrawer
        isOpen={!!selectedCert}
        onClose={() => setSelectedCert(null)}
        title={selectedCert?.domain || ''}
        subtitle={
          selectedCert && (
            <div className="flex items-center gap-2">
              <span>ID: {selectedCert.id.slice(0, 8)}...</span>
              <span>•</span>
              <a
                href={`https://${selectedCert.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-green hover:underline flex items-center gap-1"
              >
                Abrir HTTPS <ExternalLink size={11} />
              </a>
            </div>
          )
        }
        statusBadge={selectedCert && <StatusBadge status={getStatusType(selectedCert)} />}
        headerActions={
          selectedCert && (
            <button
              type="button"
              onClick={() => scanMutation.mutate(selectedCert.id)}
              disabled={scanMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-green/10 border border-accent-green/30 text-accent-green hover:bg-accent-green hover:text-black rounded-full text-xs font-semibold transition-all disabled:opacity-50"
              title="Ejecutar escaneo SSL inmediato"
            >
              <RefreshCw
                size={13}
                className={scanMutation.isPending ? 'animate-spin' : ''}
              />
              <span>{scanMutation.isPending ? 'Escaneando...' : 'Re-escanear'}</span>
            </button>
          )
        }
        quickKpis={
          selectedCert && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-[11px] text-text-dim">Vigencia</div>
                <div
                  className={`text-base font-bold font-mono mt-0.5 ${
                    selectedCert.days_remaining !== null && selectedCert.days_remaining <= 15
                      ? 'text-rose-400'
                      : 'text-accent-green'
                  }`}
                >
                  {selectedCert.days_remaining !== null
                    ? `${selectedCert.days_remaining}d`
                    : 'N/A'}
                </div>
              </div>
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-[11px] text-text-dim">Expiración</div>
                <div className="text-sm font-semibold font-mono text-text-main mt-0.5 truncate">
                  {selectedCert.expiration_date
                    ? new Date(selectedCert.expiration_date).toLocaleDateString('es-ES')
                    : 'N/A'}
                </div>
              </div>
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-[11px] text-text-dim">Cifrado</div>
                <div className="text-sm font-semibold font-mono text-accent-blue mt-0.5 truncate">
                  {selectedCert.algorithm || 'RSA'}
                </div>
              </div>
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-[11px] text-text-dim">Protocolo</div>
                <div className="text-sm font-semibold font-mono text-emerald-400 mt-0.5">
                  TLS 1.3
                </div>
              </div>
            </div>
          )
        }
        tabs={[
          { id: 'overview', label: 'Vigencia & Estado', icon: <Calendar size={13} /> },
          { id: 'technical', label: 'Detalles Técnicos', icon: <Cpu size={13} /> },
          { id: 'sans', label: 'Dominios SANs', icon: <Globe size={13} /> },
        ]}
        activeTab={drawerTab}
        onTabChange={(t) => setDrawerTab(t as any)}
        footerActions={
          selectedCert && (
            <>
              <button
                type="button"
                onClick={() => handleOpenEdit(selectedCert)}
                className="flex items-center gap-1.5 px-4 py-2 border border-border-base text-text-muted hover:text-text-main hover:bg-bg-dark rounded-full text-xs font-semibold transition-colors"
              >
                <Pencil size={14} />
                Editar Dominio
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(selectedCert)}
                className="flex items-center gap-1.5 px-4 py-2 bg-accent-red/10 border border-accent-red/30 text-accent-red hover:bg-accent-red hover:text-white rounded-full text-xs font-semibold transition-colors"
              >
                <Trash2 size={14} />
                Eliminar Certificado
              </button>
            </>
          )
        }
        maxWidthClass="max-w-2xl"
      >
        {selectedCert && drawerTab === 'overview' && (
          <div className="space-y-4">
            {/* Health Banner */}
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
                  <p className="text-xs font-mono mt-1 text-text-muted">
                    El certificado responde correctamente en el puerto 443 con una cadena de confianza intacta.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4 space-y-3 text-xs">
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-medium">Emisor Principal:</span>
                <span className="font-mono font-semibold text-text-main truncate max-w-[280px]">
                  {parseIssuerName(selectedCert.issuer)}
                </span>
              </div>
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-medium">Fecha de Registro:</span>
                <span className="font-mono text-text-main">
                  {selectedCert.created_at
                    ? new Date(selectedCert.created_at).toLocaleDateString('es-ES')
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-medium">Fecha Expiración:</span>
                <span className="font-mono font-bold text-text-main">
                  {selectedCert.expiration_date
                    ? new Date(selectedCert.expiration_date).toLocaleDateString('es-ES')
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-dim font-medium">Último Escaneo:</span>
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
                  Sujeto (Subject):
                </span>
                <p className="text-text-main break-all leading-relaxed bg-bg-card p-3 rounded-xl border border-border-base/40">
                  {selectedCert.subject || selectedCert.domain}
                </p>
              </div>

              {selectedCert.fingerprint && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-text-dim font-sans font-medium">
                      Fingerprint SHA-256:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyFingerprint(selectedCert.fingerprint || '')}
                      className="text-accent-green hover:underline flex items-center gap-1 text-[11px]"
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
              <h4 className="text-xs font-semibold text-text-muted mb-3 flex items-center gap-1.5">
                <Globe size={14} className="text-accent-green" />
                Nombres Alternativos del Sujeto (SANs)
              </h4>
              {selectedCert.san_domains && selectedCert.san_domains.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedCert.san_domains.map((san, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-bg-card border border-border-base/60 rounded-full text-xs font-mono text-text-main"
                    >
                      {san}
                    </span>
                  ))}
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

      {/* 7. CREATE / EDIT FORM MODAL */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
          onClick={handleCloseModal}
        >
          <div
            className="bg-bg-card border border-border-base rounded-2xl p-6 w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
                <Lock size={18} className="text-accent-green" />
                {editingCert ? 'Editar Dominio SSL' : 'Monitorear Nuevo Certificado SSL'}
              </h2>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-text-muted hover:text-text-main transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitModal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  Nombre de Dominio (FQDN)
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. api.tuempresa.com"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-mono"
                />
                <p className="text-[11px] text-text-dim mt-1.5">
                  No incluyas https:// ni puertos; Sentinel inspeccionará el handshake TLS por el puerto 443.
                </p>
              </div>

              <div className="flex gap-3 pt-4 border-t border-border-base">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 py-2.5 border border-border-base rounded-full text-sm text-text-muted hover:bg-bg-dark transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 py-2.5 bg-accent-green text-black font-semibold rounded-full text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : editingCert ? (
                    'Actualizar'
                  ) : (
                    'Guardar y Escanear'
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
        itemName={deleteTarget?.domain || 'este certificado'}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
