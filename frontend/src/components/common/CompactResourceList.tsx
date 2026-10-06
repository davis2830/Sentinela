import { useState, type ReactNode, type MouseEvent } from 'react';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export type RowAction = { label: string; onClick: (event: MouseEvent) => void; readOnly?: boolean };
const statusLabels: Record<string,string> = {active:'Activa',acknowledged:'Reconocida',resolved:'Resuelta',open:'Abierto',investigating:'Investigando',identified:'Identificado',mitigated:'Mitigado',closed:'Cerrado',scheduled:'Programado',in_progress:'En curso',completed:'Completado',cancelled:'Cancelado',pending:'Pendiente',generating:'Generando',failed:'Fallido'};
export default function CompactResourceList<T extends { id: string }>({ items, selectedIds, onToggleSelect, onSelectAll, onOpen, title, subtitle, status, metadata, actions, header, selectable = true }: {
  items: T[]; selectedIds: string[] | Set<string>; onToggleSelect: (item: T, event: MouseEvent) => void;
  onSelectAll: () => void; onOpen: (item: T) => void; title: (item: T) => ReactNode;
  subtitle?: (item: T) => ReactNode; status: (item: T) => ReactNode;
  metadata?: (item: T) => ReactNode; actions?: (item: T) => RowAction[]; header?: ReactNode; selectable?: boolean;
}) {
  const [menu, setMenu] = useState<string | null>(null);
  const user = useAuthStore(s => s.user); const canManage = user?.is_staff || user?.is_superuser;
  const selected = (id: string) => selectedIds instanceof Set ? selectedIds.has(id) : selectedIds.includes(id);
  return <section className="compact-resource-list" aria-label="Lista de recursos">
    <div className="flex items-center gap-3 px-4 py-2 border-b border-border-base text-xs text-text-muted">
      {selectable && <input type="checkbox" aria-label="Seleccionar todos los recursos visibles" checked={items.length > 0 && items.every(i => selected(i.id))} onChange={onSelectAll} />}
      <span>{items.length} recursos visibles</span><div className="ml-auto flex gap-2 flex-wrap">{header}</div>
    </div>
    {items.map(item => <div key={item.id} className={`compact-resource-row ${selected(item.id) ? 'bg-accent-green/5' : ''}`}>
      {selectable ? <input type="checkbox" aria-label={`Seleccionar ${typeof title(item) === 'string' ? title(item) : 'recurso'}`} checked={selected(item.id)} onChange={() => {}} onClick={e => onToggleSelect(item, e)} /> : <span />}
      <button type="button" onClick={() => onOpen(item)} className="resource-identity text-left min-w-0">
        <span className="block text-sm font-semibold text-text-main truncate">{title(item)}</span>
        {subtitle && <span className="block text-xs text-text-muted truncate">{subtitle(item)}</span>}
      </button>
      <div className="resource-status text-xs text-text-muted">{typeof status(item)==='string' ? statusLabels[String(status(item))] ?? status(item) : status(item)}</div>
      <div className="resource-meta text-xs text-text-muted">{metadata?.(item)}</div>
      <div className="resource-actions relative flex justify-end" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setMenu(null);}}>
        {actions && actions(item).some(a => a.readOnly || canManage) ? <>
          <button type="button" aria-label={`Acciones de ${typeof title(item) === 'string' ? title(item) : 'recurso'}`} aria-expanded={menu === item.id} onClick={() => setMenu(menu === item.id ? null : item.id)} className="p-2 rounded-lg hover:bg-bg-card-hover"><MoreHorizontal size={18} /></button>
          {menu === item.id && <div className="absolute top-9 right-0 z-20 min-w-40 p-1 bg-bg-card border border-border-base rounded-xl shadow-xl" onKeyDown={e => { if (e.key === 'Escape') setMenu(null); }}>
            <button type="button" onClick={() => { onOpen(item); setMenu(null); }} className="block w-full text-left px-3 py-2 text-xs hover:bg-bg-card-hover">Ver detalle</button>
            {actions(item).filter(a => a.readOnly || canManage).map(a => <button key={a.label} type="button" onClick={e => { a.onClick(e); setMenu(null); }} className="block w-full text-left px-3 py-2 text-xs hover:bg-bg-card-hover">{a.label}</button>)}
          </div>}
        </> : <button type="button" onClick={() => onOpen(item)} aria-label="Ver detalle" className="p-2"><ChevronRight size={18} /></button>}
      </div>
    </div>)}
  </section>;
}
