import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { SSLCertificate, CreateSSLCertificateData, SSLStats } from '../types/ssl';
import StatusBadge from '../components/common/StatusBadge';
import EmptyState from '../components/common/EmptyState';
import ConfirmDelete from '../components/common/ConfirmDelete';
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
} from 'lucide-react';

type FilterType = 'all' | 'expiring' | 'expired';

// Helper to clean DN strings (e.g., countryName=GB, organizationName=Sectigo Limited...)
function parseIssuerName(issuerStr: string | null): string {
  if (!issuerStr) return 'Desconocido';
  const orgMatch = issuerStr.match(/organizationName=([^,]+)/i);
  if (orgMatch && orgMatch[1]) return orgMatch[1].trim();
  const cnMatch = issuerStr.match(/commonName=([^,]+)/i);
  if (cnMatch && cnMatch[1]) return cnMatch[1].trim();
  return issuerStr;
}

export default function SSLCertificatesPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterType>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingCert, setEditingCert] = useState<SSLCertificate | null>(null);
  const [selectedCert, setSelectedCert] = useState<SSLCertificate | null>(null);
  const [domainInput, setDomainInput] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SSLCertificate | null>(null);
  const [copiedFingerprint, setCopiedFingerprint] = useState(false);

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

  const { data: stats } = useQuery({
    queryKey: ['ssl-stats'],
    queryFn: async () => {
      const response = await api.get('ssl-certificates/stats/');
      return (response.data?.data || {}) as SSLStats;
    },
    refetchInterval: 15000,
  });

  const { data: certificates, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['ssl-certificates', filter],
    queryFn: async () => {
      const response = await api.get(getEndpoint());
      return response.data?.data || [];
    },
    refetchInterval: 30000,
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
      const response = await api.post(`ssl-certificates/${id}/scan/`);
      return response.data?.data;
    },
    onSuccess: (updatedCert) => {
      queryClient.invalidateQueries({ queryKey: ['ssl-certificates'] });
      queryClient.invalidateQueries({ queryKey: ['ssl-stats'] });
      if (selectedCert && updatedCert) {
        setSelectedCert(updatedCert);
      }
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainInput.trim()) return;
    let cleanDomain = domainInput.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    if (editingCert) {
      updateMutation.mutate({ id: editingCert.id, domain: cleanDomain });
    } else {
      createMutation.mutate({ domain: cleanDomain });
    }
  };

  const handleCopyFingerprint = (fingerprint: string) => {
    navigator.clipboard.writeText(fingerprint);
    setCopiedFingerprint(true);
    setTimeout(() => setCopiedFingerprint(false), 2000);
  };

  const getStatusType = (cert: SSLCertificate) => {
    if (!cert.is_valid) return 'invalid';
    if (cert.days_remaining !== null && cert.days_remaining <= 0) return 'expired';
    if (cert.days_remaining !== null && cert.days_remaining <= 15) return 'expiring';
    return 'valid';
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
            <ShieldCheck className="text-accent-green" size={28} />
            Certificados SSL
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Supervisa la validez, emisor, algoritmo y vencimiento de tus certificados SSL/TLS
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => scanAllMutation.mutate()}
            disabled={scanAllMutation.isPending}
            className="flex items-center gap-2 bg-accent-green/10 border border-accent-green text-accent-green font-semibold px-3.5 py-2 rounded-md text-sm hover:bg-accent-green/20 transition-colors disabled:opacity-50"
            title="Re-escanear todos los certificados inmediatamente"
          >
            <RefreshCw size={16} className={scanAllMutation.isPending ? 'animate-spin' : ''} />
            Escanear Todos
          </button>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-accent-green text-black font-semibold px-4 py-2 rounded-md text-sm hover:opacity-90 transition-opacity"
          >
            <Plus size={18} />
            Nuevo Certificado
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-bg-card border border-border-base rounded-xl p-4 flex items-center gap-3 shadow-md">
          <div className="w-10 h-10 rounded-lg bg-accent-blue/10 flex items-center justify-center text-accent-blue shrink-0">
            <ShieldCheck size={20} />
          </div>
          <div>
            <p className="text-xs font-mono uppercase text-text-muted">Total Monitoreados</p>
            <p className="text-xl font-bold font-mono text-text-main">{stats?.total || 0}</p>
          </div>
        </div>

        <div className="bg-bg-card border border-border-base rounded-xl p-4 flex items-center gap-3 shadow-md">
          <div className="w-10 h-10 rounded-lg bg-accent-green/10 flex items-center justify-center text-accent-green shrink-0">
            <Check size={20} />
          </div>
          <div>
            <p className="text-xs font-mono uppercase text-text-muted">Certificados Válidos</p>
            <p className="text-xl font-bold font-mono text-accent-green">{stats?.valid || 0}</p>
          </div>
        </div>

        <div className="bg-bg-card border border-border-base rounded-xl p-4 flex items-center gap-3 shadow-md">
          <div className="w-10 h-10 rounded-lg bg-accent-yellow/10 flex items-center justify-center text-accent-yellow shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className="text-xs font-mono uppercase text-text-muted">Por Expirar (≤15d)</p>
            <p className="text-xl font-bold font-mono text-accent-yellow">{stats?.expiring_15d || 0}</p>
          </div>
        </div>

        <div className="bg-bg-card border border-border-base rounded-xl p-4 flex items-center gap-3 shadow-md">
          <div className="w-10 h-10 rounded-lg bg-accent-red/10 flex items-center justify-center text-accent-red shrink-0">
            <ShieldAlert size={20} />
          </div>
          <div>
            <p className="text-xs font-mono uppercase text-text-muted">Expirados / Errores</p>
            <p className="text-xl font-bold font-mono text-accent-red">{(stats?.expired || 0) + (stats?.invalid || 0)}</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-border-base mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            filter === 'all'
              ? 'border-accent-green text-accent-green font-bold'
              : 'border-transparent text-text-muted hover:text-text-main'
          }`}
        >
          Todos ({stats?.total || 0})
        </button>
        <button
          onClick={() => setFilter('expiring')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            filter === 'expiring'
              ? 'border-accent-yellow text-accent-yellow font-bold'
              : 'border-transparent text-text-muted hover:text-text-main'
          }`}
        >
          <AlertTriangle size={15} />
          Por expirar ({stats?.expiring_15d || 0})
        </button>
        <button
          onClick={() => setFilter('expired')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            filter === 'expired'
              ? 'border-accent-red text-accent-red font-bold'
              : 'border-transparent text-text-muted hover:text-text-main'
          }`}
        >
          Expirados ({(stats?.expired || 0) + (stats?.invalid || 0)})
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-accent-green" size={32} />
        </div>
      ) : certificates && certificates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {certificates.map((cert: SSLCertificate) => {
            const status = getStatusType(cert);
            const issuerClean = parseIssuerName(cert.issuer);
            const days = cert.days_remaining;

            return (
              <div
                key={cert.id}
                onClick={() => setSelectedCert(cert)}
                className="bg-bg-card border border-border-base rounded-xl p-5 hover:border-accent-green/50 transition-all flex flex-col justify-between cursor-pointer group shadow-lg"
              >
                <div>
                  {/* Top Bar: Icon, Domain, Status */}
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className="w-9 h-9 rounded-lg bg-bg-dark border border-border-base flex items-center justify-center shrink-0 text-accent-green group-hover:border-accent-green/40 transition-colors">
                        <Lock size={18} />
                      </div>
                      <div className="overflow-hidden">
                        <h3 className="font-bold text-text-main truncate text-base group-hover:text-accent-green transition-colors" title={cert.domain}>
                          {cert.domain}
                        </h3>
                        {cert.algorithm && (
                          <span className="text-[10px] font-mono text-text-dim uppercase tracking-wider">
                            {cert.algorithm}
                          </span>
                        )}
                      </div>
                    </div>
                    <StatusBadge status={status} />
                  </div>

                  {/* Card Content Grid */}
                  <div className="space-y-2.5 text-sm text-text-muted">
                    <div className="flex items-center justify-between border-b border-border-base/50 pb-2">
                      <span className="flex items-center gap-1.5 text-text-dim text-xs">
                        <Building2 size={14} /> Emisor
                      </span>
                      <span className="font-mono text-xs text-text-main font-semibold truncate max-w-[190px]" title={cert.issuer || ''}>
                        {issuerClean}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-b border-border-base/50 pb-2">
                      <span className="flex items-center gap-1.5 text-text-dim text-xs">
                        <Calendar size={14} /> Expiración
                      </span>
                      <span className="font-mono text-xs text-text-main">
                        {cert.expiration_date
                          ? new Date(cert.expiration_date).toLocaleDateString('es-ES')
                          : 'Pendiente'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pb-1">
                      <span className="text-text-dim text-xs">Días restantes</span>
                      <span
                        className={`font-mono text-xs font-bold ${
                          days !== null && days <= 15
                            ? 'text-accent-red'
                            : 'text-accent-green'
                        }`}
                      >
                        {days !== null ? `${days} días` : '-'}
                      </span>
                    </div>

                    {/* Expiration Progress Bar */}
                    {days !== null && (
                      <div className="w-full bg-bg-dark rounded-full h-1.5 overflow-hidden border border-border-base">
                        <div
                          className={`h-full transition-all ${
                            days <= 0
                              ? 'bg-accent-red'
                              : days <= 15
                              ? 'bg-accent-yellow'
                              : 'bg-accent-green'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(5, (days / 90) * 100))}%` }}
                        />
                      </div>
                    )}

                    {cert.error_message && (
                      <div className="mt-2 p-2 bg-accent-red/10 border border-accent-red/20 rounded text-xs text-accent-red font-mono truncate" title={cert.error_message}>
                        {cert.error_message}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-5 pt-3 border-t border-border-base flex items-center justify-between text-xs text-text-dim">
                  <span className="flex items-center gap-1 font-mono">
                    <Clock size={12} />
                    {cert.last_scanned_at
                      ? new Date(cert.last_scanned_at).toLocaleTimeString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Nunca'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleOpenEdit(cert, e)}
                      className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded transition-colors"
                      title="Editar certificado"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(cert);
                      }}
                      className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded transition-colors"
                      title="Eliminar certificado"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={ShieldCheck}
          title={
            filter === 'all'
              ? 'No hay certificados SSL registrados'
              : filter === 'expiring'
              ? 'No hay certificados por expirar'
              : 'No hay certificados expirados'
          }
          description={
            filter === 'all'
              ? 'Agrega tu primer dominio para escanear y monitorear su certificado SSL.'
              : 'Genial. Todos tus certificados están vigentes.'
          }
          actionLabel={filter === 'all' ? 'Nuevo Certificado' : undefined}
          onAction={filter === 'all' ? handleOpenCreate : undefined}
        />
      )}

      {/* SSL Detail Inspection Modal */}
      {selectedCert && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedCert(null)}
        >
          <div
            className="bg-bg-card border border-border-base rounded-2xl p-6 sm:p-8 w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-border-base pb-5 mb-6">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-12 h-12 rounded-xl bg-accent-green/10 border border-accent-green/30 flex items-center justify-center shrink-0 text-accent-green">
                  <Lock size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl sm:text-2xl font-bold text-text-main font-mono truncate" title={selectedCert.domain}>
                      {selectedCert.domain}
                    </h2>
                    <StatusBadge status={getStatusType(selectedCert)} />
                  </div>
                  <p className="text-text-muted text-xs font-mono mt-0.5 flex items-center gap-2">
                    <span>ID: {selectedCert.id.slice(0, 8)}...</span>
                    <span>•</span>
                    <a
                      href={`https://${selectedCert.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-green hover:underline flex items-center gap-1"
                    >
                      Abrir HTTPS <ExternalLink size={12} />
                    </a>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => scanMutation.mutate(selectedCert.id)}
                  disabled={scanMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 bg-accent-green/10 border border-accent-green/30 text-accent-green hover:bg-accent-green hover:text-black rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                  title="Ejecutar escaneo SSL inmediato"
                >
                  <RefreshCw size={14} className={scanMutation.isPending ? 'animate-spin' : ''} />
                  {scanMutation.isPending ? 'Escaneando...' : 'Re-escanear'}
                </button>
                <button
                  onClick={() => setSelectedCert(null)}
                  className="p-2 text-text-muted hover:text-text-main hover:bg-bg-dark rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div className="overflow-y-auto pr-1 space-y-6 flex-1">
              {/* Health Banner */}
              {selectedCert.error_message ? (
                <div className="p-4 bg-accent-red/10 border border-accent-red/30 rounded-xl flex items-start gap-3 text-accent-red">
                  <ShieldAlert size={22} className="shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm">Fallo en el Análisis SSL</h4>
                    <p className="text-xs font-mono mt-1 opacity-90">{selectedCert.error_message}</p>
                  </div>
                </div>
              ) : selectedCert.is_valid ? (
                <div className="p-4 bg-accent-green/10 border border-accent-green/30 rounded-xl flex items-start gap-3 text-accent-green">
                  <ShieldCheck size={22} className="shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm">Certificado SSL Válido y Operativo</h4>
                    <p className="text-xs font-mono mt-1 text-text-muted">
                      El certificado responde correctamente en el puerto 443 con una cadena de confianza intacta.
                    </p>
                  </div>
                </div>
              ) : null}

              {/* Expiration Timeline Section */}
              <div className="bg-bg-dark border border-border-base rounded-xl p-5">
                <h3 className="text-xs font-mono uppercase text-text-muted mb-4 flex items-center gap-2">
                  <Calendar size={16} className="text-accent-green" />
                  Vigencia y Tiempo Restante
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-text-dim">Fecha de Expiración</div>
                    <div className="text-base font-bold font-mono text-text-main mt-1">
                      {selectedCert.expiration_date
                        ? new Date(selectedCert.expiration_date).toLocaleDateString('es-ES', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'No disponible'}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-text-dim">Días Restantes</div>
                    <div
                      className={`text-base font-bold font-mono mt-1 ${
                        selectedCert.days_remaining !== null && selectedCert.days_remaining <= 15
                          ? 'text-accent-red'
                          : 'text-accent-green'
                      }`}
                    >
                      {selectedCert.days_remaining !== null
                        ? `${selectedCert.days_remaining} días`
                        : 'N/A'}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-text-dim">Último Escaneo</div>
                    <div className="text-base font-mono text-text-muted mt-1">
                      {selectedCert.last_scanned_at
                        ? new Date(selectedCert.last_scanned_at).toLocaleString('es-ES')
                        : 'Nunca'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Technical Certificate Specs Grid */}
              <div className="space-y-4">
                <h3 className="text-xs font-mono uppercase text-text-muted flex items-center gap-2">
                  <Cpu size={16} className="text-accent-green" />
                  Detalles Técnicos del Certificado
                </h3>

                <div className="grid grid-cols-1 gap-3 text-sm">
                  {/* Issuer Detailed */}
                  <div className="bg-bg-dark border border-border-base rounded-xl p-4">
                    <div className="text-xs text-text-dim uppercase font-mono mb-1 flex items-center gap-1.5">
                      <Building2 size={14} /> Emisor Completo (Issuer)
                    </div>
                    <div className="font-mono text-xs text-text-main break-all leading-relaxed">
                      {selectedCert.issuer || 'Desconocido'}
                    </div>
                  </div>

                  {/* Subject Detailed */}
                  <div className="bg-bg-dark border border-border-base rounded-xl p-4">
                    <div className="text-xs text-text-dim uppercase font-mono mb-1 flex items-center gap-1.5">
                      <Lock size={14} /> Nombre del Sujeto (Subject)
                    </div>
                    <div className="font-mono text-xs text-text-main break-all leading-relaxed">
                      {selectedCert.subject || selectedCert.domain}
                    </div>
                  </div>

                  {/* Algorithm & Fingerprint & TLS Version */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-bg-dark border border-border-base rounded-xl p-4">
                      <div className="text-xs text-text-dim uppercase font-mono mb-1 flex items-center gap-1.5">
                        <Cpu size={14} /> Algoritmo de Firma
                      </div>
                      <div className="font-mono text-sm font-bold text-accent-green mt-1">
                        {selectedCert.algorithm || 'SHA-256'}
                      </div>
                    </div>

                    <div className="bg-bg-dark border border-border-base rounded-xl p-4">
                      <div className="text-xs text-text-dim uppercase font-mono mb-1 flex items-center gap-1.5">
                        <ShieldCheck size={14} /> Protocolo TLS
                      </div>
                      <div className="font-mono text-sm font-bold text-accent-blue mt-1">
                        {selectedCert.tls_version || 'TLSv1.3'}
                      </div>
                    </div>

                    <div className="bg-bg-dark border border-border-base rounded-xl p-4">
                      <div className="text-xs text-text-dim uppercase font-mono mb-1 flex items-center gap-1.5">
                        <Fingerprint size={14} /> Fingerprint SHA-256
                      </div>
                      {selectedCert.fingerprint ? (
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <span className="font-mono text-xs text-text-muted truncate max-w-[140px]" title={selectedCert.fingerprint}>
                            {selectedCert.fingerprint}
                          </span>
                          <button
                            onClick={() => handleCopyFingerprint(selectedCert.fingerprint || '')}
                            className="p-1 text-text-dim hover:text-accent-green transition-colors"
                            title="Copiar Fingerprint"
                          >
                            {copiedFingerprint ? <Check size={14} className="text-accent-green" /> : <Copy size={14} />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs font-mono text-text-dim">Sin generar</span>
                      )}
                    </div>
                  </div>

                  {/* Subject Alternative Names (SANs) */}
                  {selectedCert.san_domains && selectedCert.san_domains.length > 0 && (
                    <div className="bg-bg-dark border border-border-base rounded-xl p-4">
                      <div className="text-xs text-text-dim uppercase font-mono mb-2 flex items-center gap-1.5">
                        <Globe size={14} /> Dominios Alternativos Protegidos (SANs)
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedCert.san_domains.map((san, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded bg-bg-card border border-border-base text-text-main text-xs font-mono"
                          >
                            {san}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Action Footer */}
            <div className="mt-6 pt-4 border-t border-border-base flex items-center justify-between">
              <button
                onClick={() => {
                  const cert = selectedCert;
                  setSelectedCert(null);
                  handleOpenEdit(cert);
                }}
                className="flex items-center gap-1.5 px-4 py-2 border border-border-base text-text-muted hover:text-text-main hover:bg-bg-dark rounded-lg text-xs font-semibold transition-colors"
              >
                <Pencil size={15} />
                Editar Dominio
              </button>
              <button
                onClick={() => {
                  const cert = selectedCert;
                  setSelectedCert(null);
                  setDeleteTarget(cert);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-accent-red/10 border border-accent-red/30 text-accent-red hover:bg-accent-red hover:text-white rounded-lg text-xs font-semibold transition-colors"
              >
                <Trash2 size={15} />
                Eliminar Certificado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Form Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={handleCloseModal}
        >
          <div
            className="bg-bg-card border border-border-base rounded-xl p-6 w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
                <ShieldCheck size={20} className="text-accent-green" />
                {editingCert ? 'Editar Certificado SSL' : 'Registrar Certificado SSL'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-text-muted hover:text-text-main"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <label className="block text-xs font-mono uppercase text-text-muted mb-2">
                  Dominio
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. miempresa.com o api.miempresa.com"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  className="w-full bg-bg-dark border border-border-base rounded-lg px-4 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-mono"
                />
                <p className="text-xs text-text-dim mt-1.5">
                  El sistema realizará un análisis SSL automático.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 py-2.5 border border-border-base rounded-lg text-sm text-text-muted hover:bg-bg-card-hover transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 py-2.5 bg-accent-green text-black font-semibold rounded-lg text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
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

      {/* Delete Confirmation Modal */}
      <ConfirmDelete
        isOpen={!!deleteTarget}
        itemName={deleteTarget?.domain || ''}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
