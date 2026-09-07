import React, { useState, useEffect } from 'react';
import type { AvailableTargetItem, ComponentSettingItem } from '../../types/status_page';
import {
  X,
  Loader2,
  Check,
  Globe,
  Plug,
  Lock,
  Activity,
  Server,
  Layers,
  Search,
  Eye,
  EyeOff,
} from 'lucide-react';

interface ComponentPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableTargets: AvailableTargetItem[];
  currentSettings: ComponentSettingItem[];
  onSave: (settings: ComponentSettingItem[]) => Promise<void>;
}

export default function ComponentPickerModal({
  isOpen,
  onClose,
  availableTargets,
  currentSettings,
  onSave,
}: ComponentPickerModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState<ComponentSettingItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const settingsMap = new Map<string, ComponentSettingItem>();
      (currentSettings || []).forEach((cs) => settingsMap.set(cs.id, cs));

      const merged: ComponentSettingItem[] = availableTargets.map((t) => {
        const existing = settingsMap.get(t.id);
        if (existing) {
          return { ...existing };
        }
        return {
          id: t.id,
          target_type: t.type === 'uptime' ? 'uptime' : 'api',
          display_name: t.name,
          category: t.default_category || 'Servicios Generales',
          is_visible: t.enabled,
        };
      });

      setItems(merged);
    }
  }, [isOpen, availableTargets, currentSettings]);

  if (!isOpen) return null;

  const handleToggleVisibility = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, is_visible: !item.is_visible } : item))
    );
  };

  const handleUpdateField = (id: string, field: 'display_name' | 'category', value: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleSelectAll = (visible: boolean) => {
    setItems((prev) => prev.map((item) => ({ ...item, is_visible: visible })));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(items);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = items.filter((item) => {
    const term = searchTerm.toLowerCase();
    return (
      item.display_name.toLowerCase().includes(term) ||
      item.category.toLowerCase().includes(term)
    );
  });

  const getTargetIcon = (type: string) => {
    switch (type) {
      case 'uptime':
        return <Globe size={15} className="text-emerald-400 shrink-0" />;
      case 'api':
        return <Plug size={15} className="text-amber-400 shrink-0" />;
      case 'ssl':
        return <Lock size={15} className="text-rose-400 shrink-0" />;
      case 'dns':
        return <Activity size={15} className="text-sky-400 shrink-0" />;
      default:
        return <Server size={15} className="text-text-muted shrink-0" />;
    }
  };

  const activeCount = items.filter((i) => i.is_visible).length;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200 font-sans"
      onClick={onClose}
    >
      <div
        className="bg-bg-card border border-border-base rounded-3xl p-6 w-full max-w-3xl shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border-base/60 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
              <Layers size={22} className="text-accent-green" />
              Selector de Componentes a Publicar
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Elige qué servicios mostrar públicamente en tu Status Page y personaliza sus nombres y categorías.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-main p-1.5 rounded-full hover:bg-bg-dark transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Toolbar & Filter */}
        <div className="py-4 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 text-text-dim" size={14} />
            <input
              type="text"
              placeholder="Buscar por nombre o categoría..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-bg-dark border border-border-base rounded-xl pl-9 pr-3 py-2 text-xs text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-sans"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <span className="text-xs font-mono text-text-dim">
              <strong className="text-accent-green">{activeCount}</strong> de {items.length} visibles
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleSelectAll(true)}
                className="px-2.5 py-1 text-[11px] bg-bg-dark border border-border-base text-text-muted hover:text-accent-green rounded-lg transition-colors cursor-pointer"
              >
                Mostrar Todos
              </button>
              <button
                type="button"
                onClick={() => handleSelectAll(false)}
                className="px-2.5 py-1 text-[11px] bg-bg-dark border border-border-base text-text-muted hover:text-accent-red rounded-lg transition-colors cursor-pointer"
              >
                Ocultar Todos
              </button>
            </div>
          </div>
        </div>

        {/* Component List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[300px]">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-text-dim text-xs">
              No se encontraron componentes que coincidan con la búsqueda.
            </div>
          ) : (
            filteredItems.map((item) => {
              const target = availableTargets.find((t) => t.id === item.id);

              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    item.is_visible
                      ? 'bg-bg-dark/80 border-border-base hover:border-accent-green/40'
                      : 'bg-bg-dark/30 border-border-base/40 opacity-60'
                  }`}
                >
                  {/* Left: Type, Switch & Info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleToggleVisibility(item.id)}
                      className={`p-2 rounded-xl border transition-all cursor-pointer ${
                        item.is_visible
                          ? 'bg-accent-green/15 text-accent-green border-accent-green/40 shadow-xs'
                          : 'bg-bg-dark text-text-dim border-border-base'
                      }`}
                      title={item.is_visible ? 'Visible en Status Page' : 'Oculto'}
                    >
                      {item.is_visible ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>

                    <div className="flex items-center gap-2">
                      {getTargetIcon(item.target_type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={item.display_name}
                        onChange={(e) => handleUpdateField(item.id, 'display_name', e.target.value)}
                        placeholder="Nombre visible para clientes..."
                        className="w-full bg-bg-card border border-border-base/70 rounded-lg px-2.5 py-1 text-xs font-semibold text-text-main focus:outline-none focus:border-accent-green"
                      />
                      {target?.target_url && (
                        <span className="text-[10px] font-mono text-text-dim truncate block mt-0.5">
                          {target.target_url}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Category Selector / Input */}
                  <div className="flex items-center gap-2 sm:w-56 shrink-0">
                    <div className="w-full">
                      <label className="block text-[10px] text-text-dim mb-0.5">Categoría:</label>
                      <input
                        type="text"
                        value={item.category}
                        onChange={(e) => handleUpdateField(item.id, 'category', e.target.value)}
                        placeholder="ej. Pasarela de Pagos"
                        className="w-full bg-bg-card border border-border-base/70 rounded-lg px-2.5 py-1 text-xs text-text-muted focus:outline-none focus:border-accent-green"
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 mt-3 border-t border-border-base/60 flex items-center justify-between shrink-0">
          <span className="text-xs text-text-dim">
            Los cambios se reflejarán de inmediato en la Status Page pública.
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border-base rounded-full text-xs text-text-muted hover:text-text-main hover:bg-bg-dark transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 bg-accent-green text-black font-semibold rounded-full text-xs hover:bg-accent-green/90 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Guardar Configuración
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
