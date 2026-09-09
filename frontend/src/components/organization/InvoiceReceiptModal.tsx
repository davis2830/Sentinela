import React from 'react';
import { createPortal } from 'react-dom';
import { FileText, X, Download, Printer, CheckCircle2, Building, Shield } from 'lucide-react';

interface InvoiceReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: {
    id: string;
    invoice_number: string;
    period: string;
    date: string;
    due_date: string;
    plan_name: string;
    plan_tier: string;
    amount_usd: number;
    status: string;
    status_label: string;
    payment_method: string;
    billing_email: string;
    tax_id: string;
  } | null;
  organizationName: string;
}

export default function InvoiceReceiptModal({
  isOpen,
  onClose,
  invoice,
  organizationName,
}: InvoiceReceiptModalProps) {
  if (!isOpen || !invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  const content = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-bg-card border border-border-base rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden font-sans">
        {/* Header Actions */}
        <div className="p-5 border-b border-border-base flex items-center justify-between bg-bg-dark/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-accent-blue/10 text-accent-blue border border-accent-blue/20">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-main">
                Comprobante de Facturación Pro-Forma
              </h3>
              <p className="text-xs text-text-dim font-mono">{invoice.invoice_number}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:text-text-main bg-white/5 border border-border-base hover:bg-white/10 transition-colors cursor-pointer"
            >
              <Printer size={13} />
              <span>Imprimir</span>
            </button>
            <button
              onClick={onClose}
              className="text-text-dim hover:text-text-main p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Invoice Body */}
        <div className="p-7 space-y-6 text-xs text-text-main">
          {/* Top Brand Banner */}
          <div className="flex items-start justify-between border-b border-border-base pb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-tight text-accent-green font-mono">SENTINEL</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-accent-green/10 text-accent-green border border-accent-green/30 font-semibold uppercase">
                  OBSERVABILIDAD
                </span>
              </div>
              <p className="text-[11px] text-text-dim mt-1">
                Sentinel Observability Platform Inc.
              </p>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full font-bold text-xs bg-accent-green/10 text-accent-green border border-accent-green/30">
                <CheckCircle2 size={13} />
                {invoice.status_label.toUpperCase()}
              </span>
              <p className="text-[11px] text-text-dim font-mono mt-1.5">
                Emitida: {invoice.date}
              </p>
            </div>
          </div>

          {/* Billed To / Billed From */}
          <div className="grid grid-cols-2 gap-6 p-4 rounded-2xl bg-bg-dark/60 border border-border-base">
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-text-dim block mb-1">
                Facturado a (Cliente)
              </span>
              <div className="font-bold text-sm text-text-main flex items-center gap-1.5">
                <Building size={14} className="text-accent-blue" />
                {organizationName}
              </div>
              <p className="text-text-muted mt-0.5 font-mono text-[11px]">{invoice.billing_email}</p>
              {invoice.tax_id && invoice.tax_id !== 'N/A' && (
                <p className="text-text-dim mt-0.5 font-mono text-[11px]">ID Fiscal / RUT: {invoice.tax_id}</p>
              )}
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-text-dim block mb-1">
                Detalles del Pago
              </span>
              <p className="text-text-main font-semibold">Método: {invoice.payment_method}</p>
              <p className="text-text-muted mt-0.5">Periodo: {invoice.period}</p>
              <p className="text-text-dim mt-0.5 font-mono text-[11px]">Vencimiento: {invoice.due_date}</p>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-border-base rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-bg-dark border-b border-border-base text-text-dim uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Descripción del Servicio</th>
                  <th className="py-3 px-4 text-center">Periodo</th>
                  <th className="py-3 px-4 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-base">
                <tr>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-text-main">
                      Suscripción Sentinel - Plan {invoice.plan_name}
                    </div>
                    <div className="text-[11px] text-text-dim mt-0.5">
                      Monitoreo continuo de red, probes satélite, alertas y dashboards de observabilidad
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono text-text-muted">{invoice.period}</td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-text-main">
                    ${invoice.amount_usd.toFixed(2)} USD
                  </td>
                </tr>
              </tbody>
              <tfoot className="bg-bg-dark/80 font-bold border-t border-border-base">
                <tr>
                  <td colSpan={2} className="py-3.5 px-4 text-right uppercase text-text-dim">
                    Total Facturado
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-sm text-accent-green">
                    ${invoice.amount_usd.toFixed(2)} USD
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Footer note */}
          <div className="pt-2 flex items-center justify-between text-[11px] text-text-dim">
            <div className="flex items-center gap-1.5">
              <Shield size={13} className="text-accent-green" />
              <span>Transacción cifrada y asegurada por Sentinel Gateway.</span>
            </div>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-accent-green text-black font-bold text-xs hover:bg-accent-green/90 transition-all cursor-pointer"
            >
              Cerrar Comprobante
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}
