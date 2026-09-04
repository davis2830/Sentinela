import React, { useState, useEffect } from 'react';
import type { StatusPageSummaryItem, StatusPageCreatePayload } from '../../types/status_page';
import {
  X,
  Loader2,
  Building,
  Globe,
  Mail,
  Copy,
  Plus,
} from 'lucide-react';

interface CreateStatusPageModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingPages: StatusPageSummaryItem[];
  onCreate: (payload: StatusPageCreatePayload) => Promise<void>;
}

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export default function CreateStatusPageModal({
  isOpen,
  onClose,
  existingPages,
  onCreate,
}: CreateStatusPageModalProps) {
  const [companyName, setCompanyName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [description, setDescription] = useState(
    'Estado de disponibilidad y rendimiento de nuestros servicios en tiempo real.'
  );
  const [logoUrl, setLogoUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isDefault, setIsDefault] = useState(false);
  const [cloneFromId, setCloneFromId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!slugManual && companyName) {
      setSlug(slugify(companyName));
    }
  }, [companyName, slugManual]);

  useEffect(() => {
    if (isOpen) {
      setCompanyName('');
      setSlug('');
      setSlugManual(false);
      setDescription('Estado de disponibilidad y rendimiento de nuestros servicios en tiempo real.');
      setLogoUrl('');
      setWebsiteUrl('');
      setSupportEmail('');
      setIsPublic(true);
      setIsDefault(false);
      setCloneFromId('');
      setErrorMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !slug.trim()) {
      setErrorMsg('El nombre de la empresa y el slug son campos obligatorios.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      await onCreate({
        company_name: companyName.trim(),
        slug: slug.trim().toLowerCase(),
        description: description.trim(),
        logo_url: logoUrl.trim(),
        website_url: websiteUrl.trim(),
        support_email: supportEmail.trim(),
        is_public: isPublic,
        is_default: isDefault,
        clone_from_page_id: cloneFromId ? cloneFromId : null,
      });
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Error al crear la Status Page.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200 font-sans"
      onClick={onClose}
    >
      <div
        className="bg-bg-card border border-border-base rounded-3xl p-6 w-full max-w-xl shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border-base/60 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
              <Plus size={20} className="text-accent-green" />
              Crear Nueva Status Page
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Configura un portal de estado independiente para un cliente, marca o unidad de negocio.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-main p-1.5 rounded-full hover:bg-bg-dark transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mt-4 p-3 bg-accent-red/10 border border-accent-red/30 rounded-xl text-xs text-accent-red">
            {errorMsg}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-4 pr-1 text-xs">
          <div className="space-y-3">
            <div>
              <label className="block font-semibold text-text-muted mb-1">
                Nombre de la Empresa o Portal <span className="text-accent-red">*</span>
              </label>
              <div className="flex items-center gap-2 bg-bg-dark border border-border-base rounded-xl px-3.5 py-2.5">
                <Building size={15} className="text-text-dim" />
                <input
                  type="text"
                  required
                  placeholder="ej. Banco Industrial, Coopeuch o Portal Clientes"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-transparent text-xs text-text-main placeholder:text-text-dim focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-text-muted mb-1">
                Slug / URL Pública del Portal <span className="text-accent-red">*</span>
              </label>
              <div className="flex items-center gap-1.5 bg-bg-dark border border-border-base rounded-xl px-3.5 py-2">
                <span className="text-text-dim font-mono text-xs shrink-0">/status/</span>
                <input
                  type="text"
                  required
                  placeholder="banco-industrial"
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setSlugManual(true);
                  }}
                  className="w-full bg-transparent text-xs font-mono text-accent-green focus:outline-none"
                />
              </div>
              <p className="text-[10px] text-text-dim mt-1">
                Tus clientes accederán directamente a este portal mediante su slug único.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-text-muted mb-1">
                Descripción & Propósito
              </label>
              <textarea
                rows={2}
                placeholder="Descripción visible en el encabezado de este portal..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-bg-dark border border-border-base rounded-xl px-3.5 py-2 text-xs text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-text-muted mb-1">
                  Sitio Web Principal (Opcional)
                </label>
                <div className="flex items-center gap-2 bg-bg-dark border border-border-base rounded-xl px-3 py-2">
                  <Globe size={14} className="text-text-dim" />
                  <input
                    type="url"
                    placeholder="https://empresa.com"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    className="w-full bg-transparent text-xs font-mono text-text-main placeholder:text-text-dim focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-text-muted mb-1">
                  Email de Soporte (Opcional)
                </label>
                <div className="flex items-center gap-2 bg-bg-dark border border-border-base rounded-xl px-3 py-2">
                  <Mail size={14} className="text-text-dim" />
                  <input
                    type="email"
                    placeholder="soporte@empresa.com"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    className="w-full bg-transparent text-xs font-mono text-text-main placeholder:text-text-dim focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {existingPages.length > 0 && (
              <div>
                <label className="block font-semibold text-text-muted mb-1">
                  Clonar Componentes Base (Opcional)
                </label>
                <div className="flex items-center gap-2 bg-bg-dark border border-border-base rounded-xl px-3 py-2">
                  <Copy size={14} className="text-text-dim shrink-0" />
                  <select
                    value={cloneFromId}
                    onChange={(e) => setCloneFromId(e.target.value)}
                    className="w-full bg-transparent text-xs text-text-main focus:outline-none cursor-pointer"
                  >
                    <option value="">Comenzar en blanco (sin componentes pre-asignados)</option>
                    {existingPages.map((p) => (
                      <option key={p.id} value={p.id}>
                        Copiar configuración de "{p.company_name}" ({p.published_components_count} componentes)
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[10px] text-text-dim mt-1">
                  Podrás ajustar y filtrar los componentes de forma independiente luego de crear la página.
                </p>
              </div>
            )}

            {/* Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-bg-dark/80 border border-border-base cursor-pointer hover:border-accent-green/40 transition-colors">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="rounded accent-accent-green"
                />
                <div>
                  <span className="font-semibold text-text-main block">Acceso Público</span>
                  <span className="text-[10px] text-text-dim">Visible a clientes sin login</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-bg-dark/80 border border-border-base cursor-pointer hover:border-accent-green/40 transition-colors">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded accent-accent-green"
                />
                <div>
                  <span className="font-semibold text-text-main block">Marcar como Principal</span>
                  <span className="text-[10px] text-text-dim">Será la página cargada por defecto</span>
                </div>
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-border-base/60 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-bg-dark hover:bg-bg-dark/80 text-text-muted hover:text-text-main border border-border-base rounded-full text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !companyName.trim() || !slug.trim()}
              className="px-5 py-2 bg-accent-green text-black font-semibold rounded-full text-xs hover:bg-accent-green/90 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Crear Status Page
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
