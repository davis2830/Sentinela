import ResourceActionButtons from "../common/ResourceActionButtons";
import SelectionCheckbox from "../common/SelectionCheckbox";
import {
  healthPalette,
  hasMeasurement,
  sslExpiryTone,
  sslGradeTone,
  sslStatus,
} from "../../utils/healthPresentation";

import React from "react";
import type { SSLCertificate } from "../../types/ssl";
import StatusBadge from "../common/StatusBadge";
import { Pencil, Trash2, ExternalLink, Lock, Layers } from "lucide-react";

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
  if (!issuerStr) return "Desconocido";
  const orgMatch = issuerStr.match(/organizationName=([^,]+)/i);
  if (orgMatch && orgMatch[1]) return orgMatch[1].trim();
  const cnMatch = issuerStr.match(/commonName=([^,]+)/i);
  if (cnMatch && cnMatch[1]) return cnMatch[1].trim();
  return issuerStr.split(",")[0].replace("CN=", "");
}

export default function SSLCertificateTableView({
  certificates,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onSelectCert,
  onEdit,
  onDelete,
}: SSLCertificateTableViewProps) {
  const allSelected =
    certificates.length > 0 && selectedIds.length === certificates.length;

  return (
    <div
      data-testid="connectivity-table"
      className="connectivity-directory-table min-w-0 max-w-full bg-bg-card border border-border-base/70 rounded-2xl overflow-hidden shadow-sm font-sans"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border-base text-text-muted text-xs bg-bg-dark/80">
              <th scope="col" className="py-3 px-3.5 w-10">
                <SelectionCheckbox
                  checked={allSelected}
                  label="Seleccionar todos los recursos de esta página"
                  onChange={onSelectAll}
                />
              </th>
              <th scope="col" className="py-3 px-4">
                Dominio Certificado
              </th>
              <th scope="col" className="py-3 px-3">
                Autoridad Emisora (CA)
              </th>
              <th scope="col" className="py-3 px-3">
                Seguridad
              </th>
              <th scope="col" className="py-3 px-3">
                Estado
              </th>
              <th scope="col" className="py-3 px-3">
                Vigencia & Timeline
              </th>
              <th scope="col" className="py-3 px-3">
                Expiración
              </th>
              <th scope="col" className="py-3 px-3">
                SANs
              </th>
              <th scope="col" className="py-3 px-4 text-right">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-base/40 font-sans">
            {certificates.map((cert) => {
              const isSelected = selectedIds.includes(cert.id);
              const statusType = sslStatus(cert);
              const expiryTone = sslExpiryTone(cert);
              const days = cert.days_remaining;

              // Calculate lifetime progress percentage
              let percentUsed: number | null = null;
              if (cert.issued_at && cert.expiration_date) {
                const start = new Date(cert.issued_at).getTime();
                const end = new Date(cert.expiration_date).getTime();
                const now = Date.now();
                if (end > start) {
                  percentUsed = Math.min(
                    100,
                    Math.max(
                      0,
                      Math.round(((now - start) / (end - start)) * 100),
                    ),
                  );
                }
              }

              return (
                <tr
                  key={cert.id}
                  onClick={() => onSelectCert(cert)}
                  tabIndex={0}
                  aria-label={cert.domain}
                  onKeyDown={(e) => {
                    if (
                      e.target === e.currentTarget &&
                      (e.key === "Enter" || e.key === " ")
                    ) {
                      e.preventDefault();
                      onSelectCert(cert);
                    }
                  }}
                  className={`hover:bg-bg-card-hover/80 transition-colors cursor-pointer group ${
                    isSelected ? "bg-accent-green/[0.03]" : ""
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
                    <SelectionCheckbox
                      checked={isSelected}
                      label={`Seleccionar ${cert.domain}`}
                      onChange={() => onToggleSelect(cert)}
                    />
                  </td>

                  {/* Domain & Port */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Lock size={14} className="text-accent-green shrink-0" />
                      <span className="font-bold text-text-main group-hover:text-accent-green transition-colors text-sm font-sans">
                        {cert.domain}
                      </span>
                      {cert.port && cert.port !== 443 && (
                        <span className="font-mono text-xs px-1.5 py-0.2 bg-bg-dark border border-border-base rounded text-accent-blue">
                          :{cert.port}
                        </span>
                      )}
                      <a
                        href={`https://${cert.domain}${cert.port && cert.port !== 443 ? `:${cert.port}` : ""}`}
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
                        className={`font-mono font-bold text-xs px-2 py-0.5 rounded-full border ${healthPalette[sslGradeTone(cert.security_grade, hasMeasurement(cert.last_scanned_at) && !cert.error_message && cert.is_valid)].badge}`}
                        title={`Grado de seguridad SSL: ${cert.security_grade || "—"}`}
                      >
                        {cert.security_grade || "—"}
                      </span>
                      <span className="font-mono text-xs text-text-dim">
                        {cert.tls_version || "—"}
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
                            className={`font-bold px-2 py-0.5 rounded-full border ${healthPalette[expiryTone].badge}`}
                          >
                            {days <= 0 ? "Expirado" : `${days} días`}
                          </span>
                        </div>
                      ) : (
                        <span className="text-text-dim">-</span>
                      )}

                      {/* Timeline Bar */}
                      {percentUsed !== null && expiryTone !== "muted" && (
                        <div
                          className="w-24 bg-bg-dark border border-border-base rounded-full h-1.5 overflow-hidden"
                          title={`Vida del certificado: ${percentUsed}% transcurrido`}
                        >
                          <div
                            className={`h-full rounded-full transition-all ${healthPalette[expiryTone].fill}`}
                            style={{ width: `${percentUsed}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Expiration Date */}
                  <td className="py-3 px-3 text-text-dim font-mono text-xs whitespace-nowrap">
                    {cert.expiration_date
                      ? new Date(cert.expiration_date).toLocaleDateString(
                          "es-ES",
                        )
                      : "N/A"}
                  </td>

                  {/* SANs Count */}
                  <td className="py-3 px-3">
                    {cert.san_domains && cert.san_domains.length > 0 ? (
                      <span
                        className="inline-flex items-center gap-1 font-mono text-xs px-2 py-0.5 rounded-md bg-bg-dark border border-border-base text-text-muted"
                        title={cert.san_domains.join(", ")}
                      >
                        <Layers size={11} className="text-accent-blue" />
                        <span>{cert.san_domains.length} SANs</span>
                      </span>
                    ) : (
                      <span className="text-text-dim font-mono text-xs">
                        1 SAN
                      </span>
                    )}
                  </td>

                  {/* Inline Actions */}
                  <td className="py-3 px-4 text-right">
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ResourceActionButtons
                        label={`Acciones de ${cert.domain}`}
                        actions={[
                          {
                            label: "Editar dominio",
                            onClick: (e) => onEdit(cert, e),
                            capability: "ssl_monitor.update",
                            icon: (
                              <>
                                <Pencil size={14} />
                              </>
                            ),
                          },
                          {
                            label: "Eliminar certificado",
                            onClick: (e) => onDelete(cert, e),
                            capability: "ssl_monitor.delete",
                            danger: true,
                            icon: (
                              <>
                                <Trash2 size={14} />
                              </>
                            ),
                          },
                        ]}
                      />
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
