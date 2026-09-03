import React from 'react';
import type { SSLCertificate } from '../../types/ssl';
import StatusBadge from '../common/StatusBadge';
import {
  Pencil,
  Trash2,
  RefreshCw,
  ExternalLink,
  CheckSquare,
  Square,
  Lock,
  ShieldCheck,
  ShieldAlert,
  Layers,
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

  const getGradeStyle = (grade?: string) => {
    switch (grade) {
      case 'A+':
      case 'A':
        return 'bg-accent-green/10 text-accent-green border-accent-green/30';
      case 'B':
        return 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30';
      case 'C':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      default:
        return 'bg-accent-red/10 text-accent-red border-accent-red/30';
    }
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
              <th className="py-3 px-4">Dominio Certificado</th>
              <th className="py-3 px-3">Autoridad Emisora (CA)</th>
              <th className="py-3 px-3">Seguridad</th>
              <th className="py-3 px-3">Estado</th>
              <th className="py-3 px-3">Vigencia & Timeline</th>
              <th className="py-3 px-3">Expiración</th>
              <th className="py-3 px-3">SANs</th>
              <th className="py-3 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-base/40 font-sans">
            {certificates.map((cert) => {
              const isSelected = selectedIds.includes(cert.id);
              const isScanning = scanningId === cert.id;
              const statusType = getStatusType(cert);
              const days = cert.days_remaining;

              // Calculate lifetime progress percentage
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

                  {/* Domain & Port */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Lock size={14} className="text-accent-green shrink-0" />
                      <span className="font-bold text-text-main group-hover:text-accent-green transition-colors text-sm font-sans">
                        {cert.domain}
                      </span>
                      {cert.port && cert.port !== 443 && (
                        <span className="font-mono text-[10px] px-1.5 py-0.2 bg-bg-dark border border-border-base rounded text-accent-blue">
                          :{cert.port}
                        </span>
                      )}
                      <a
                        href={`https://${cert.domain}${cert.port && cert.port !== 443 ? `:${cert.port}` : ''}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-text-dim hover:text-accent-green shrink-0"
                        title="Abrir endpoint seguro"
                      >
                        <ExternalLink size={11} />
                      </a>
                    </div>
                  </td>

                  {/* Issuer */}
                  <td className="py-3 px-3 text-text-muted text-xs font-sans">
                    {parseIssuerClean(cert.issuer)}
                  </td>

                  {/* Security Grade & TLS */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`font-mono font-bold text-[11px] px-2 py-0.5 rounded-full border ${getGradeStyle(
                          cert.security_grade
                        )}`}
                        title={`Grado de seguridad SSL: ${cert.security_grade || 'A'}`}
                      >
                        {cert.security_grade || 'A'}
                      </span>
                      <span className="font-mono text-[10px] text-text-dim">
                        {cert.tls_version || 'TLS 1.3'}
                      </span>
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="py-3 px-3">
                    <StatusBadge status={statusType} />
                  </td>

                  {/* Vigencia & Mini-Timeline */}
                  <td className="py-3 px-3 font-mono text-xs">
                    <div className="space-y-1">
                      {days !== null ? (
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold px-2 py-0.5 rounded-full ${
                              days <= 0
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : days <= 15
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            {days <= 0 ? 'Expirado' : `${days} días`}
                          </span>
                        </div>
                      ) : (
                        <span className="text-text-dim">-</span>
                      )}

                      {/* Timeline Bar */}
                      {percentUsed !== null && (
                        <div className="w-24 bg-bg-dark border border-border-base rounded-full h-1.5 overflow-hidden" title={`Vida del certificado: ${percentUsed}% transcurrido`}>
                          <div
                            className={`h-full rounded-full transition-all ${
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
                  </td>

                  {/* Expiration Date */}
                  <td className="py-3 px-3 text-text-dim font-mono text-xs whitespace-nowrap">
                    {cert.expiration_date
                      ? new Date(cert.expiration_date).toLocaleDateString('es-ES')
                      : 'N/A'}
                  </td>

                  {/* SANs Count */}
                  <td className="py-3 px-3">
                    {cert.san_domains && cert.san_domains.length > 0 ? (
                      <span
                        className="inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded-md bg-bg-dark border border-border-base text-text-muted"
                        title={cert.san_domains.join(', ')}
                      >
                        <Layers size={11} className="text-accent-blue" />
                        <span>{cert.san_domains.length} SANs</span>
                      </span>
                    ) : (
                      <span className="text-text-dim font-mono text-[11px]">1 SAN</span>
                    )}
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
