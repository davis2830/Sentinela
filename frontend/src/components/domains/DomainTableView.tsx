import React from 'react';
import type { DomainInfo } from '../../types/domain';
import StatusBadge from '../common/StatusBadge';
import {
  Clock,
  Pencil,
  Trash2,
  RefreshCw,
  ExternalLink,
  CheckSquare,
  Square,
  Globe2,
} from 'lucide-react';

export interface DomainTableViewProps {
  domains: DomainInfo[];
  selectedIds: string[];
  onToggleSelect: (domain: DomainInfo) => void;
  onSelectAll: () => void;
  onSelectDomain: (domain: DomainInfo) => void;
  onScan: (id: string, e: React.MouseEvent) => void;
  scanningId: string | null;
  onEdit: (domain: DomainInfo, e: React.MouseEvent) => void;
  onDelete: (domain: DomainInfo, e: React.MouseEvent) => void;
}

export default function DomainTableView({
  domains,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onSelectDomain,
  onScan,
  scanningId,
  onEdit,
  onDelete,
}: DomainTableViewProps) {
  const allSelected =
    domains.length > 0 && selectedIds.length === domains.length;

  const getStatusType = (domain: DomainInfo) => {
    if (domain.status === 'error') return 'fallo';
    const days = domain.days_until_expiration;
    if (days !== null && days <= 0) return 'expirado';
    if (days !== null && days <= 30) return 'por_expirar';
    return 'valido';
  };

  return (
    <div className="bg-bg-card/95 border border-border-base/70 rounded-2xl overflow-hidden shadow-sm font-sans">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border-base text-text-dim text-xs bg-bg-card/50">
              <th className="py-3 px-3.5 w-10">
                <button
                  type="button"
                  onClick={onSelectAll}
                  className="text-text-dim hover:text-accent-green transition-colors"
                  title={allSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
                >
                  {allSelected ? (
                    <CheckSquare size={16} className="text-accent-green" />
                  ) : (
                    <Square size={16} />
                  )}
                </button>
              </th>
              <th className="py-3 px-4">Dominio WHOIS</th>
              <th className="py-3 px-3">Registrador</th>
              <th className="py-3 px-3">Estado</th>
              <th className="py-3 px-3">Vigencia</th>
              <th className="py-3 px-3">Expiración</th>
              <th className="py-3 px-3">Servidores NS</th>
              <th className="py-3 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-base/40">
            {domains.map((domain) => {
              const isSelected = selectedIds.includes(domain.id);
              const isScanning = scanningId === domain.id;
              const statusType = getStatusType(domain);
              const days = domain.days_until_expiration;

              return (
                <tr
                  key={domain.id}
                  onClick={() => onSelectDomain(domain)}
                  className={`hover:bg-bg-card-hover/80 transition-colors cursor-pointer group ${
                    isSelected ? 'bg-accent-green/[0.03]' : ''
                  }`}
                >
                  {/* Row Checkbox */}
                  <td
                    className="py-3 px-3.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelect(domain);
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

                  {/* Domain Name */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Globe2 size={14} className="text-accent-green shrink-0" />
                      <span className="font-bold text-text-main group-hover:text-accent-green transition-colors text-sm">
                        {domain.domain}
                      </span>
                      <a
                        href={`http://${domain.domain}`}
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

                  {/* Registrar */}
                  <td className="py-3 px-3 text-text-muted text-xs truncate max-w-[160px]" title={domain.registrar || ''}>
                    {domain.registrar || 'Desconocido'}
                  </td>

                  {/* Status Badge */}
                  <td className="py-3 px-3">
                    <StatusBadge status={statusType} />
                  </td>

                  {/* Days until expiration */}
                  <td className="py-3 px-3 font-mono font-bold text-xs">
                    {days !== null ? (
                      <span
                        className={`px-2 py-0.5 rounded-full ${
                          days <= 0
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : days <= 30
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        {days <= 0 ? 'Expirado' : `${days} días`}
                      </span>
                    ) : (
                      <span className="text-text-dim">-</span>
                    )}
                  </td>

                  {/* Expiration Date */}
                  <td className="py-3 px-3 text-text-dim font-mono text-xs whitespace-nowrap">
                    {domain.expiration_date
                      ? new Date(domain.expiration_date).toLocaleDateString('es-ES')
                      : 'N/A'}
                  </td>

                  {/* Nameservers */}
                  <td className="py-3 px-3 text-text-dim font-mono text-[11px] truncate max-w-[180px]">
                    {Array.isArray(domain.name_servers) && domain.name_servers.length > 0
                      ? domain.name_servers[0]
                      : 'Sin NS'}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={(e) => onScan(domain.id, e)}
                        disabled={isScanning}
                        className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors disabled:opacity-50"
                        title="Consultar WHOIS ahora"
                      >
                        <RefreshCw
                          size={14}
                          className={isScanning ? 'animate-spin' : ''}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => onEdit(domain, e)}
                        className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors"
                        title="Editar dominio"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => onDelete(domain, e)}
                        className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded-full transition-colors"
                        title="Eliminar dominio"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
