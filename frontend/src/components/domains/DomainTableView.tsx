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
  Lock,
  Unlock,
  Server,
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
    if (domain.status === 'error' || Boolean(domain.error_message)) return 'fallo';
    const days = domain.days_until_expiration;
    if (days !== null && days <= 0) return 'expirado';
    if (days !== null && days <= 30) return 'por_expirar';
    return 'valido';
  };

  const calculateLifePercentage = (domain: DomainInfo) => {
    if (!domain.creation_date || !domain.expiration_date) return null;
    const start = new Date(domain.creation_date).getTime();
    const end = new Date(domain.expiration_date).getTime();
    const now = Date.now();
    const total = end - start;
    if (total <= 0) return 100;
    const elapsed = now - start;
    return Math.min(Math.max(Math.round((elapsed / total) * 100), 0), 100);
  };

  const parseNameservers = (nsData: any): string[] => {
    if (!nsData) return [];
    if (Array.isArray(nsData)) return nsData.map((s) => String(s).toLowerCase());
    if (typeof nsData === 'string') {
      try {
        const parsed = JSON.parse(nsData);
        if (Array.isArray(parsed)) return parsed.map((s) => String(s).toLowerCase());
      } catch {
        return nsData.split(/[\s,]+/).filter(Boolean).map((s) => s.toLowerCase());
      }
    }
    return [];
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
                  className="text-text-dim hover:text-accent-green transition-colors cursor-pointer"
                  title={allSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
                >
                  {allSelected ? (
                    <CheckSquare size={16} className="text-accent-green" />
                  ) : (
                    <Square size={16} />
                  )}
                </button>
              </th>
              <th className="py-3 px-4">Dominio FQDN</th>
              <th className="py-3 px-3">Registrador ICANN</th>
              <th className="py-3 px-3">Bloqueo EPP</th>
              <th className="py-3 px-3">Vigencia & Timeline</th>
              <th className="py-3 px-3">Fecha Vencimiento</th>
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
              const lifePct = calculateLifePercentage(domain);
              const nsList = parseNameservers(domain.name_servers);

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
                      className="text-text-dim hover:text-accent-green transition-colors cursor-pointer"
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
                  <td
                    className="py-3 px-3 text-text-muted text-xs truncate max-w-[170px]"
                    title={domain.registrar || ''}
                  >
                    {domain.registrar || 'Desconocido'}
                  </td>

                  {/* EPP Domain Lock */}
                  <td className="py-3 px-3">
                    {domain.is_locked ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-accent-green/10 text-accent-green border border-accent-green/30">
                        <Lock size={10} />
                        Protegido
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/30">
                        <Unlock size={10} />
                        Sin Bloqueo
                      </span>
                    )}
                  </td>

                  {/* Days remaining & Lifecycle timeline */}
                  <td className="py-3 px-3 min-w-[140px]">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-bold">
                          {days !== null ? (
                            <span
                              className={
                                days <= 0
                                  ? 'text-accent-red'
                                  : days <= 30
                                  ? 'text-accent-yellow'
                                  : 'text-accent-green'
                              }
                            >
                              {days <= 0 ? 'Expirado' : `${days} días`}
                            </span>
                          ) : (
                            <span className="text-text-dim">-</span>
                          )}
                        </span>
                        {lifePct !== null && (
                          <span className="text-[10px] font-mono text-text-dim">
                            {lifePct}% consumido
                          </span>
                        )}
                      </div>

                      {/* Micro Progress Bar */}
                      {lifePct !== null && (
                        <div className="w-full h-1 bg-bg-dark rounded-full overflow-hidden border border-border-base/50">
                          <div
                            className={`h-full transition-all duration-500 rounded-full ${
                              days !== null && days <= 15
                                ? 'bg-accent-red'
                                : days !== null && days <= 30
                                ? 'bg-accent-yellow'
                                : 'bg-accent-green'
                            }`}
                            style={{ width: `${lifePct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Expiration Date */}
                  <td className="py-3 px-3 text-text-dim font-mono text-xs whitespace-nowrap">
                    {domain.expiration_date
                      ? new Date(domain.expiration_date).toLocaleDateString('es-ES')
                      : 'N/A'}
                  </td>

                  {/* Nameservers */}
                  <td className="py-3 px-3 font-mono text-xs">
                    {nsList.length > 0 ? (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-blue/10 text-accent-blue border border-accent-blue/30 text-[11px] font-medium"
                        title={nsList.join(', ')}
                      >
                        <Server size={11} />
                        {nsList.length} NS
                      </span>
                    ) : (
                      <span className="text-text-dim text-[11px]">Sin NS</span>
                    )}
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
                        className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors disabled:opacity-50 cursor-pointer"
                        title="Consultar WHOIS ahora"
                      >
                        <RefreshCw
                          size={14}
                          className={isScanning ? 'animate-spin text-accent-green' : ''}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => onEdit(domain, e)}
                        className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors cursor-pointer"
                        title="Editar dominio"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => onDelete(domain, e)}
                        className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded-full transition-colors cursor-pointer"
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
