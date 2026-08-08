import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { DomainInfo, CreateDomainInfoData, DomainStats } from '../types/domain';
import StatusBadge from '../components/common/StatusBadge';
import EmptyState from '../components/common/EmptyState';
import ConfirmDelete from '../components/common/ConfirmDelete';
import {
  FileText,
  Plus,
  Loader2,
  Trash2,
  Calendar,
  Building,
  RefreshCw,
  X,
  AlertTriangle,
  Server,
  Globe2,
  Pencil,
  Clock,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Flag,
  CheckCircle2,
} from 'lucide-react';

type FilterType = 'all' | 'expiring' | 'expired';

export default function DomainsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterType>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingDomain, setEditingDomain] = useState<DomainInfo | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<DomainInfo | null>(null);
  const [domainInput, setDomainInput] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DomainInfo | null>(null);

  const getEndpoint = () => {
    switch (filter) {
      case 'expiring':
        return 'domains/expiring/?days=30';
      case 'expired':
        return 'domains/expired/';
      default:
        return 'domains/';
    }
  };

  const { data: stats } = useQuery({
    queryKey: ['domain-stats'],
    queryFn: async () => {
      const response = await api.get('domains/stats/');
      return (response.data?.data || {}) as DomainStats;
    },
    refetchInterval: 15000,
  });

  const { data: domains, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['domains-whois', filter],
    queryFn: async () => {
      const response = await api.get(getEndpoint());
      return response.data?.data || [];
    },
    refetchInterval: 30000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateDomainInfoData) => {
      await api.post('domains/', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains-whois'] });
      queryClient.invalidateQueries({ queryKey: ['domain-stats'] });
      handleCloseModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, domain }: { id: string; domain: string }) => {
      await api.patch(`domains/${id}/`, { domain });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains-whois'] });
      queryClient.invalidateQueries({ queryKey: ['domain-stats'] });
      handleCloseModal();
    },
  });

  const scanMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`domains/${id}/scan/`);
      return response.data?.data;
    },
    onSuccess: (updatedDomain) => {
      queryClient.invalidateQueries({ queryKey: ['domains-whois'] });
      queryClient.invalidateQueries({ queryKey: ['domain-stats'] });
      if (selectedDomain && updatedDomain) {
        setSelectedDomain(updatedDomain);
      }
    },
  });

  const scanAllMutation = useMutation({
    mutationFn: async () => {
      await api.post('domains/scan-all/');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains-whois'] });
      queryClient.invalidateQueries({ queryKey: ['domain-stats'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`domains/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains-whois'] });
      queryClient.invalidateQueries({ queryKey: ['domain-stats'] });
      if (selectedDomain?.id === deleteTarget?.id) {
        setSelectedDomain(null);
      }
      setDeleteTarget(null);
    },
  });

  const handleOpenCreate = () => {
    setEditingDomain(null);
    setDomainInput('');
    setShowModal(true);
  };

  const handleOpenEdit = (domain: DomainInfo, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingDomain(domain);
    setDomainInput(domain.domain);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingDomain(null);
    setDomainInput('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainInput.trim()) return;
    let cleanDomain = domainInput.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    if (editingDomain) {
      updateMutation.mutate({ id: editingDomain.id, domain: cleanDomain });
    } else {
      createMutation.mutate({ domain: cleanDomain });
    }
  };

  const getStatusType = (dom: DomainInfo) => {
    if (dom.days_until_expiration !== null && dom.days_until_expiration <= 0) return 'expired';
    if (dom.days_until_expiration !== null && dom.days_until_expiration <= 30) return 'expiring';
    return 'active';
  };

  const renderNameServersList = (ns: string[] | string | null): string[] => {
    if (!ns) return [];
    if (Array.isArray(ns)) return ns;
    return ns.split(',').map((s) => s.trim());
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
            <Globe2 className="text-accent-green" size={28} />
            Dominios & WHOIS
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Gestión y monitoreo de la vigencia de registradores de dominio WHOIS
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => scanAllMutation.mutate()}
            disabled={scanAllMutation.isPending}
            className="flex items-center gap-2 bg-accent-green/10 border border-accent-green text-accent-green font-semibold px-3.5 py-2 rounded-md text-sm hover:bg-accent-green/20 transition-colors disabled:opacity-50"
            title="Consultar datos WHOIS de todos los dominios inmediatamente"
          >
            <RefreshCw size={16} className={scanAllMutation.isPending ? 'animate-spin' : ''} />
            Consultar WHOIS Todos
          </button>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-accent-green text-black font-semibold px-4 py-2 rounded-md text-sm hover:opacity-90 transition-opacity"
          >
            <Plus size={18} />
            Nuevo Dominio
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-bg-card border border-border-base rounded-xl p-4 flex items-center gap-3 shadow-md">
          <div className="w-10 h-10 rounded-lg bg-accent-blue/10 flex items-center justify-center text-accent-blue shrink-0">
            <Globe2 size={20} />
          </div>
          <div>
            <p className="text-xs font-mono uppercase text-text-muted">Total Monitoreados</p>
            <p className="text-xl font-bold font-mono text-text-main">{stats?.total || 0}</p>
          </div>
        </div>

        <div className="bg-bg-card border border-border-base rounded-xl p-4 flex items-center gap-3 shadow-md">
          <div className="w-10 h-10 rounded-lg bg-accent-green/10 flex items-center justify-center text-accent-green shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-xs font-mono uppercase text-text-muted">Dominios Activos</p>
            <p className="text-xl font-bold font-mono text-accent-green">{stats?.active || 0}</p>
          </div>
        </div>

        <div className="bg-bg-card border border-border-base rounded-xl p-4 flex items-center gap-3 shadow-md">
          <div className="w-10 h-10 rounded-lg bg-accent-yellow/10 flex items-center justify-center text-accent-yellow shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className="text-xs font-mono uppercase text-text-muted">Por Expirar (≤30d)</p>
            <p className="text-xl font-bold font-mono text-accent-yellow">{stats?.expiring_30d || 0}</p>
          </div>
        </div>

        <div className="bg-bg-card border border-border-base rounded-xl p-4 flex items-center gap-3 shadow-md">
          <div className="w-10 h-10 rounded-lg bg-accent-red/10 flex items-center justify-center text-accent-red shrink-0">
            <ShieldAlert size={20} />
          </div>
          <div>
            <p className="text-xs font-mono uppercase text-text-muted">Expirados / Errores</p>
            <p className="text-xl font-bold font-mono text-accent-red">{(stats?.expired || 0) + (stats?.error || 0)}</p>
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
          Por expirar ({stats?.expiring_30d || 0})
        </button>
        <button
          onClick={() => setFilter('expired')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            filter === 'expired'
              ? 'border-accent-red text-accent-red font-bold'
              : 'border-transparent text-text-muted hover:text-text-main'
          }`}
        >
          Expirados ({(stats?.expired || 0) + (stats?.error || 0)})
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-accent-green" size={32} />
        </div>
      ) : domains && domains.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {domains.map((domain: DomainInfo) => {
            const status = getStatusType(domain);
            const days = domain.days_until_expiration;
            const nsList = renderNameServersList(domain.name_servers);

            return (
              <div
                key={domain.id}
                onClick={() => setSelectedDomain(domain)}
                className="bg-bg-card border border-border-base rounded-xl p-5 hover:border-accent-green/50 transition-all flex flex-col justify-between cursor-pointer group shadow-lg"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className="w-9 h-9 rounded-lg bg-bg-dark border border-border-base flex items-center justify-center shrink-0 text-accent-green group-hover:border-accent-green/40 transition-colors">
                        <FileText size={18} />
                      </div>
                      <div className="overflow-hidden">
                        <h3 className="font-bold text-text-main truncate text-base group-hover:text-accent-green transition-colors" title={domain.domain}>
                          {domain.domain}
                        </h3>
                        {domain.registrant_country && (
                          <span className="text-[10px] font-mono text-text-dim uppercase tracking-wider">
                            País: {domain.registrant_country}
                          </span>
                        )}
                      </div>
                    </div>
                    <StatusBadge status={status} />
                  </div>

                  <div className="space-y-2.5 text-sm text-text-muted">
                    <div className="flex items-center justify-between border-b border-border-base/50 pb-2">
                      <span className="flex items-center gap-1.5 text-text-dim text-xs">
                        <Building size={14} /> Registrar
                      </span>
                      <span className="font-mono text-xs text-text-main font-semibold truncate max-w-[190px]">
                        {domain.registrar || 'Desconocido'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-b border-border-base/50 pb-2">
                      <span className="flex items-center gap-1.5 text-text-dim text-xs">
                        <Calendar size={14} /> Expiración
                      </span>
                      <span className="font-mono text-xs text-text-main">
                        {domain.expiration_date
                          ? new Date(domain.expiration_date).toLocaleDateString('es-ES')
                          : 'Pendiente'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-b border-border-base/50 pb-2">
                      <span className="flex items-center gap-1.5 text-text-dim text-xs">
                        <Server size={14} /> Name Servers
                      </span>
                      <span className="font-mono text-xs text-text-main truncate max-w-[180px]">
                        {nsList.length > 0 ? nsList.slice(0, 2).join(', ') : 'N/A'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pb-1">
                      <span className="text-text-dim text-xs">Días restantes</span>
                      <span
                        className={`font-mono text-xs font-bold ${
                          days !== null && days <= 30
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
                              : days <= 30
                              ? 'bg-accent-yellow'
                              : 'bg-accent-green'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(5, (days / 365) * 100))}%` }}
                        />
                      </div>
                    )}

                    {domain.error_message && (
                      <div className="mt-2 p-2 bg-accent-red/10 border border-accent-red/20 rounded text-xs text-accent-red font-mono truncate">
                        {domain.error_message}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-border-base flex items-center justify-between text-xs text-text-dim">
                  <span className="flex items-center gap-1 font-mono">
                    <Clock size={12} />
                    {domain.last_scanned_at
                      ? new Date(domain.last_scanned_at).toLocaleTimeString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Nunca'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleOpenEdit(domain, e)}
                      className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded transition-colors"
                      title="Editar dominio"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(domain);
                      }}
                      className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded transition-colors"
                      title="Eliminar dominio"
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
          icon={Globe2}
          title={
            filter === 'all'
              ? 'No hay dominios WHOIS registrados'
              : filter === 'expiring'
              ? 'No hay dominios por expirar'
              : 'No hay dominios expirados'
          }
          description={
            filter === 'all'
              ? 'Agrega tu primer dominio para supervisar las fechas de registro WHOIS.'
              : 'Genial. Todos tus dominios tienen renovación lejana.'
          }
          actionLabel={filter === 'all' ? 'Nuevo Dominio' : undefined}
          onAction={filter === 'all' ? handleOpenCreate : undefined}
        />
      )}

      {/* Domain WHOIS Detail Inspection Modal */}
      {selectedDomain && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedDomain(null)}
        >
          <div
            className="bg-bg-card border border-border-base rounded-2xl p-6 sm:p-8 w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-border-base pb-5 mb-6">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-12 h-12 rounded-xl bg-accent-green/10 border border-accent-green/30 flex items-center justify-center shrink-0 text-accent-green">
                  <Globe2 size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl sm:text-2xl font-bold text-text-main font-mono truncate" title={selectedDomain.domain}>
                      {selectedDomain.domain}
                    </h2>
                    <StatusBadge status={getStatusType(selectedDomain)} />
                  </div>
                  <p className="text-text-muted text-xs font-mono mt-0.5 flex items-center gap-2">
                    <span>WHOIS Registro</span>
                    <span>•</span>
                    <a
                      href={`https://${selectedDomain.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-green hover:underline flex items-center gap-1"
                    >
                      Visitar Dominio <ExternalLink size={12} />
                    </a>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => scanMutation.mutate(selectedDomain.id)}
                  disabled={scanMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 bg-accent-green/10 border border-accent-green/30 text-accent-green hover:bg-accent-green hover:text-black rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                  title="Re-consultar WHOIS"
                >
                  <RefreshCw size={14} className={scanMutation.isPending ? 'animate-spin' : ''} />
                  {scanMutation.isPending ? 'Consultando...' : 'Re-consultar'}
                </button>
                <button
                  onClick={() => setSelectedDomain(null)}
                  className="p-2 text-text-muted hover:text-text-main hover:bg-bg-dark rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="overflow-y-auto pr-1 space-y-6 flex-1">
              {selectedDomain.error_message && (
                <div className="p-4 bg-accent-red/10 border border-accent-red/30 rounded-xl flex items-start gap-3 text-accent-red">
                  <ShieldAlert size={22} className="shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm">Error en Consulta WHOIS</h4>
                    <p className="text-xs font-mono mt-1 opacity-90">{selectedDomain.error_message}</p>
                  </div>
                </div>
              )}

              {/* Timeline Section */}
              <div className="bg-bg-dark border border-border-base rounded-xl p-5">
                <h3 className="text-xs font-mono uppercase text-text-muted mb-4 flex items-center gap-2">
                  <Calendar size={16} className="text-accent-green" />
                  Línea de Tiempo y Expiración
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-text-dim">Fecha de Expiración</div>
                    <div className="text-base font-bold font-mono text-text-main mt-1">
                      {selectedDomain.expiration_date
                        ? new Date(selectedDomain.expiration_date).toLocaleDateString('es-ES', {
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
                        selectedDomain.days_until_expiration !== null && selectedDomain.days_until_expiration <= 30
                          ? 'text-accent-red'
                          : 'text-accent-green'
                      }`}
                    >
                      {selectedDomain.days_until_expiration !== null
                        ? `${selectedDomain.days_until_expiration} días`
                        : 'N/A'}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-text-dim">Fecha de Creación</div>
                    <div className="text-base font-mono text-text-muted mt-1">
                      {selectedDomain.creation_date
                        ? new Date(selectedDomain.creation_date).toLocaleDateString('es-ES')
                        : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Technical WHOIS Info */}
              <div className="space-y-4">
                <h3 className="text-xs font-mono uppercase text-text-muted flex items-center gap-2">
                  <Building size={16} className="text-accent-green" />
                  Información del Registrador & Name Servers
                </h3>

                <div className="grid grid-cols-1 gap-3 text-sm">
                  <div className="bg-bg-dark border border-border-base rounded-xl p-4">
                    <div className="text-xs text-text-dim uppercase font-mono mb-1">Registrador (Registrar)</div>
                    <div className="font-mono text-sm font-bold text-text-main">
                      {selectedDomain.registrar || 'Desconocido'}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-bg-dark border border-border-base rounded-xl p-4">
                      <div className="text-xs text-text-dim uppercase font-mono mb-1 flex items-center gap-1">
                        <Flag size={14} /> País Registrante
                      </div>
                      <div className="font-mono text-sm font-bold text-accent-green uppercase mt-1">
                        {selectedDomain.registrant_country || 'No especificado'}
                      </div>
                    </div>

                    <div className="bg-bg-dark border border-border-base rounded-xl p-4">
                      <div className="text-xs text-text-dim uppercase font-mono mb-1">Última Actualización WHOIS</div>
                      <div className="font-mono text-xs text-text-muted mt-1">
                        {selectedDomain.last_updated
                          ? new Date(selectedDomain.last_updated).toLocaleString('es-ES')
                          : 'N/A'}
                      </div>
                    </div>
                  </div>

                  {/* Name Servers */}
                  <div className="bg-bg-dark border border-border-base rounded-xl p-4">
                    <div className="text-xs text-text-dim uppercase font-mono mb-2 flex items-center gap-1.5">
                      <Server size={14} /> Servidores de Nombre (Name Servers)
                    </div>
                    {renderNameServersList(selectedDomain.name_servers).length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                        {renderNameServersList(selectedDomain.name_servers).map((ns, idx) => (
                          <div key={idx} className="bg-bg-card border border-border-base px-3 py-1.5 rounded font-mono text-xs text-accent-green">
                            {ns}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="font-mono text-xs text-text-dim">Sin name servers registrados</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-border-base flex items-center justify-between">
              <button
                onClick={() => {
                  const dom = selectedDomain;
                  setSelectedDomain(null);
                  handleOpenEdit(dom);
                }}
                className="flex items-center gap-1.5 px-4 py-2 border border-border-base text-text-muted hover:text-text-main hover:bg-bg-dark rounded-lg text-xs font-semibold transition-colors"
              >
                <Pencil size={15} />
                Editar Dominio
              </button>
              <button
                onClick={() => {
                  const dom = selectedDomain;
                  setSelectedDomain(null);
                  setDeleteTarget(dom);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-accent-red/10 border border-accent-red/30 text-accent-red hover:bg-accent-red hover:text-white rounded-lg text-xs font-semibold transition-colors"
              >
                <Trash2 size={15} />
                Eliminar Dominio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
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
                <Globe2 size={20} className="text-accent-green" />
                {editingDomain ? 'Editar Dominio WHOIS' : 'Registrar Dominio WHOIS'}
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
                  Dominio Principal
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. miempresa.com"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  className="w-full bg-bg-dark border border-border-base rounded-lg px-4 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-mono"
                />
                <p className="text-xs text-text-dim mt-1.5">
                  Se ejecutará una consulta WHOIS automática para obtener el registrador y expiración.
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
                  ) : editingDomain ? (
                    'Actualizar'
                  ) : (
                    'Consultar WHOIS'
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
