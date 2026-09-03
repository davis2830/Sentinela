import React from 'react';
import type { SSLCertificate } from '../../types/ssl';
import StatusBadge from '../common/StatusBadge';
import {
  Clock,
  Pencil,
  Trash2,
  RefreshCw,
  ExternalLink,
  CheckSquare,
  Square,
  Lock,
} from 'lucide-react';

export interface SSLCertificateTableViewProps {
  certificates: SSLCertificate[];
  selectedIds: string[];
  onToggleSelect: (cert: SSLCertificate) => void;
  onSelectAll: () => void;
  onSelectCert: (cert: SSLCertificate) => void;
  onScan: (id: string, e: React.MouseEvent) => void;
  scanningId: string | null;
  onEdit: (cert: SSLCertificate, e: React.MouseEvent) => void;
  onDelete: (cert: SSLCertificate, e: React.MouseEvent) => void;
}

function parseIssuerClean(issuerStr: string | null): string {
  if (!issuerStr) return 'Desconocido';
  const orgMatch = issuerStr.match(/organizationName=([^,]+)/i);
  if (orgMatch && orgMatch[1]) return orgMatch[1].trim();
  const cnMatch = issuerStr.match(/commonName=([^,]+)/i);
  if (cnMatch && cnMatch[1]) return cnMatch[1].trim();
  return issuerStr.split(',')[0].replace('CN=', '');
}

export default function SSLCertificateTableView({
  certificates,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onSelectCert,
  onScan,
  scanningId,
  onEdit,
  onDelete,
}: SSLCertificateTableViewProps) {
  const allSelected =
    certificates.length > 0 && selectedIds.length === certificates.length;

  const getStatusType = (cert: SSLCertificate) => {
    if (!cert.is_valid) return 'fallo';
    const days = cert.days_remaining;
    if (days !== null && days <= 0) return 'expirado';
    if (days !== null && days <= 15) return 'por_expirar';
    return 'valido';
  };

  return (
    <div className="bg-bg-card/95 border border-border-base/70 rounded-2xl overflow-hidden shadow-sm">
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
              <th className="py-3 px-4">Dominio Certificado</th>
              <th className="py-3 px-3">Autoridad Emisora (CA)</th>
              <th className="py-3 px-3">Estado</th>
              <th className="py-3 px-3">Vigencia</th>
              <th className="py-3 px-3">Fecha Expiración</th>
              <th className="py-3 px-3">Algoritmo</th>
              <th className="py-3 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-base/40 font-sans">
            {certificates.map((cert) => {
              const isSelected = selectedIds.includes(cert.id);
              const isScanning = scanningId === cert.id;
              const statusType = getStatusType(cert);
              const days = cert.days_remaining;

              return (
                <tr
                  key={cert.id}
                  onClick={() => onSelectCert(cert)}
                  className={`hover:bg-bg-card-hover/80 transition-colors cursor-pointer group ${
                    isSelected ? 'bg-accent-green/[0.03]' : ''
                  }`}
                >
                  {/* Row Checkbox */}
                  <td
                    className="py-3 px-3.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelect(cert);
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

                  {/* Domain */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Lock size={14} className="text-accent-green shrink-0" />
                      <span className="font-bold text-text-main group-hover:text-accent-green transition-colors text-sm">
                        {cert.domain}
                      </span>
                      <a
                        href={`https://${cert.domain}`}
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

                  {/* Issuer */}
                  <td className="py-3 px-3 text-text-muted text-xs">
                    {parseIssuerClean(cert.issuer)}
                  </td>

                  {/* Status Badge */}
                  <td className="py-3 px-3">
                    <StatusBadge status={statusType} />
                  </td>

                  {/* Days remaining */}
                  <td className="py-3 px-3 font-mono font-bold text-xs">
                    {days !== null ? (
                      <span
                        className={`px-2 py-0.5 rounded-full ${
                          days <= 0
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : days <= 15
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
                    {cert.expiration_date
                      ? new Date(cert.expiration_date).toLocaleDateString('es-ES')
                      : 'N/A'}
                  </td>

                  {/* Algorithm */}
                  <td className="py-3 px-3 text-text-dim font-mono text-[11px]">
                    {cert.algorithm || 'RSA'}
                  </td>

                  {/* Inline Actions */}
                  <td className="py-3 px-4 text-right">
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={(e) => onScan(cert.id, e)}
                        disabled={isScanning}
                        className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors disabled:opacity-50"
                        title="Verificar certificado ahora"
                      >
                        <RefreshCw
                          size={14}
                          className={isScanning ? 'animate-spin' : ''}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => onEdit(cert, e)}
                        className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors"
                        title="Editar dominio"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => onDelete(cert, e)}
                        className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded-full transition-colors"
                        title="Eliminar certificado"
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
